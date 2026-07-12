"""
generate_bank.py — FBLA StudyBot question factory
==================================================
Batch-generates multiple-choice questions for every event in
study-materials/, following question-generation-rules.txt, and saves
them to question-bank.json inside each event folder.

USAGE
  python3 generate_bank.py                 # generate for all events
  python3 generate_bank.py accounting      # one event only
  python3 generate_bank.py --dry-run       # no API calls; show the
                                           # sections it found per event

SETUP (one time)
  1. pip3 install google-genai
  2. Create keys.py next to this file containing:
         GOOGLE_KEY = "your-gemini-api-key"
     (keys.py must be in .gitignore — never push it!)

DESIGN (matches the plan we made)
  - 5 questions per API request (small batches = reliable JSON)
  - Sends ONLY the relevant knowledge-area section, not whole files
  - Validates every question; retries once on bad JSON, then skips
  - Sleeps between requests to respect free-tier rate limits;
    on a rate-limit error, waits 60s and continues
  - Saves progress after every batch -> safe to stop and resume
  - Weights questions by "(N test items)" counts when present
"""

import json
import os
import random
import re
import sys
import time

# ----------------------------- SETTINGS -----------------------------
MODEL = "claude-haiku-4-5-20251001"  # cheapest Claude model; swap to sonnet for higher quality
TARGET_PER_EVENT = 50        # questions per event
BATCH_SIZE = 5               # questions per API request
RATE_DELAY = 7               # seconds between requests (free tier safe)
RATE_LIMIT_WAIT = 60         # seconds to wait after a 429/quota error
BASE = os.path.dirname(os.path.abspath(__file__))
MATERIALS = os.path.join(BASE, "study-materials")
RULES_FILE = os.path.join(BASE, "question-generation-rules.txt")

# ----------------------------- API KEY ------------------------------
def get_client():
    try:
        from keys import ANTHROPIC_KEY as key
    except ImportError:
        key = os.environ.get("ANTHROPIC_KEY", "")
    if not key:
        sys.exit("No API key. Create keys.py with ANTHROPIC_KEY = \"...\" "
                 "or set the ANTHROPIC_KEY environment variable.")
    import anthropic
    return anthropic.Anthropic(api_key=key)

# ------------------------ READ STUDY MATERIAL ------------------------
def read_event_text(event_dir):
    """Concatenate every .txt in the event folder except the bank."""
    parts = []
    for name in sorted(os.listdir(event_dir)):
        if name.endswith(".txt"):
            with open(os.path.join(event_dir, name), encoding="utf-8") as f:
                parts.append(f.read())
    return "\n\n".join(parts)

SECTION_RE = re.compile(r"^([A-Z]{1,2})\.\s+(.+)$")   # "A. Journalizing"
PART_RE = re.compile(r"^PART\s+\d+\s*[—-]\s*(.+)$")   # "PART 2 — HISTORY"
WEIGHT_RE = re.compile(r"\((\d+)\s*(?:test\s*)?items?\)", re.I)

def split_sections(text):
    """Split study text into knowledge-area sections.
    Returns list of dicts: {name, weight, body}."""
    sections, current = [], None
    for line in text.splitlines():
        stripped = line.strip()
        m = SECTION_RE.match(stripped) or PART_RE.match(stripped)
        if m:
            if current and current["body"].strip():
                sections.append(current)
            title = m.group(m.lastindex).strip()
            w = WEIGHT_RE.search(title)
            weight = int(w.group(1)) if w else 5
            name = WEIGHT_RE.sub("", title).strip()
            current = {"name": name, "weight": weight, "body": line + "\n"}
        elif current:
            current["body"] += line + "\n"
    if current and current["body"].strip():
        sections.append(current)
    # de-duplicate names (outline + study-content may repeat headers):
    # keep the LONGEST body per name — it has the most material.
    best = {}
    for s in sections:
        if s["name"] not in best or len(s["body"]) > len(best[s["name"]]["body"]):
            best[s["name"]] = s
    return list(best.values())

# --------------------------- GENERATION -----------------------------
PROMPT_TEMPLATE = """{rules}

============================================================
SOURCE MATERIAL (generate questions ONLY from this section):

Event: {event}
Knowledge area: {area}
Difficulty: ALL {n} questions must be at {difficulty} difficulty.

{body}
============================================================

Generate exactly {n} multiple-choice questions from the source
material above, following every generation rule.

Respond with ONLY a JSON array (no code fences, no other text) of
{n} objects, each with exactly these fields:
  "question": string,
  "options": array of exactly 4 strings,
  "correct_index": integer 0-3,
  "explanation": 2-3 sentence string,
  "difficulty": "{difficulty}"
"""

def parse_questions(raw, area_name):
    """Extract and validate a JSON array of questions from model output."""
    start, end = raw.find("["), raw.rfind("]")
    if start == -1 or end == -1:
        raise ValueError("no JSON array found")
    items = json.loads(raw[start:end + 1])
    good = []
    for q in items:
        if (isinstance(q.get("question"), str)
                and isinstance(q.get("options"), list)
                and len(q["options"]) == 4
                and all(isinstance(o, str) for o in q["options"])
                and isinstance(q.get("correct_index"), int)
                and 0 <= q["correct_index"] <= 3
                and isinstance(q.get("explanation"), str)):
            q["knowledge_area"] = area_name
            q.setdefault("difficulty", "easy")
            good.append(q)
    if not good:
        raise ValueError("no valid questions in response")
    return good

def enforce_difficulty(questions, difficulty):
    """Override whatever the model wrote so the tag always matches the request."""
    for q in questions:
        q['difficulty'] = difficulty
    return questions

def shuffle_answer_positions(questions, position_counts):
    """Deterministically assign correct-answer positions to enforce 25-25-25-25 distribution.

    Instead of random shuffling (which still clusters), we track how many times each
    position (0=A, 1=B, 2=C, 3=D) has been used and always place the next correct answer
    at whichever position is most under-represented. Ties broken randomly.

    position_counts is a mutable list [nA, nB, nC, nD] shared across all batches
    for a single bank so the balance is maintained globally, not just per batch.
    """
    for q in questions:
        correct_text = q['options'][q['correct_index']]
        # Pick the position with the lowest usage count
        min_count = min(position_counts)
        candidates = [i for i, c in enumerate(position_counts) if c == min_count]
        target = random.choice(candidates)
        # Rebuild options list with correct answer at target position
        others = [o for o in q['options'] if o != correct_text]
        random.shuffle(others)
        q['options'] = others[:target] + [correct_text] + others[target:]
        q['correct_index'] = target
        position_counts[target] += 1
    return questions


def check_distribution(bank, label=""):
    """Print A/B/C/D ratio for the bank. Called every 100 questions."""
    counts = [0, 0, 0, 0]
    for q in bank:
        counts[q['correct_index']] += 1
    total = len(bank)
    letters = 'ABCD'
    ratio = '  '.join(f"{letters[i]}:{counts[i]}({counts[i]/total*100:.0f}%)" for i in range(4))
    print(f"  [distribution @ {total}q{' '+label if label else ''}]  {ratio}")

def call_model(client, prompt):
    """One API call with rate-limit handling."""
    while True:
        try:
            resp = client.messages.create(
                model=MODEL,
                max_tokens=2048,
                messages=[{"role": "user", "content": prompt}],
            )
            return resp.content[0].text
        except Exception as e:
            msg = str(e)
            if "429" in msg or "quota" in msg.lower() or "rate" in msg.lower():
                print(f"    rate limited — waiting {RATE_LIMIT_WAIT}s ...")
                time.sleep(RATE_LIMIT_WAIT)
            else:
                raise

def push_event(event, bank_path, n):
    """Commit and push the question bank for one event to GitHub."""
    import subprocess
    rel = os.path.relpath(bank_path, BASE)
    try:
        subprocess.run(["git", "add", rel], cwd=BASE, check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-m", f"Add {n} questions for {event}"],
            cwd=BASE, check=True, capture_output=True, text=True,
        )
        subprocess.run(["git", "push", "origin", "main"], cwd=BASE, check=True, capture_output=True)
        print(f"  Pushed to GitHub: {rel}")
    except subprocess.CalledProcessError as e:
        print(f"  Git push failed for {event}: {getattr(e, 'stderr', '') or e}")


def generate_event(client, event, rules, dry_run=False, difficulty="hard"):
    event_dir = os.path.join(MATERIALS, event)
    bank_path = os.path.join(event_dir, "question-bank.json")

    text = read_event_text(event_dir)
    sections = split_sections(text)
    if not sections:
        print(f"  !! {event}: no knowledge-area sections found, skipping")
        return

    if dry_run:
        print(f"  {event}: {len(sections)} sections")
        for s in sections:
            print(f"      [{s['weight']:>3} wt] {s['name']}  "
                  f"({len(s['body'])} chars)")
        return

    bank = []
    if os.path.exists(bank_path):
        with open(bank_path, encoding="utf-8") as f:
            bank = json.load(f)
    if len(bank) >= TARGET_PER_EVENT:
        print(f"  {event}: already has {len(bank)} questions — skipping")
        return

    # Track correct-answer position counts across the whole bank so
    # shuffle_answer_positions can enforce 25-25-25-25 globally.
    position_counts = [0, 0, 0, 0]
    for q in bank:
        position_counts[q['correct_index']] += 1

    last_check = (len(bank) // 100) * 100  # next check threshold

    weights = [s["weight"] for s in sections]
    print(f"  {event}: {len(bank)}/{TARGET_PER_EVENT} questions, "
          f"{len(sections)} sections")

    while len(bank) < TARGET_PER_EVENT:
        section = random.choices(sections, weights=weights, k=1)[0]
        n = min(BATCH_SIZE, TARGET_PER_EVENT - len(bank))
        prompt = PROMPT_TEMPLATE.format(rules=rules, event=event,
                                        area=section["name"],
                                        body=section["body"][:6000], n=n,
                                        difficulty=difficulty)
        got = None
        for attempt in (1, 2):                      # retry bad JSON once
            try:
                raw = call_model(client, prompt)
                parsed = enforce_difficulty(parse_questions(raw, section["name"]), difficulty)
                got = shuffle_answer_positions(parsed, position_counts)
                break
            except ValueError as e:
                print(f"    bad JSON from model (attempt {attempt}): {e}")
            except Exception as e:
                print(f"    API error: {e} — waiting {RATE_LIMIT_WAIT}s")
                time.sleep(RATE_LIMIT_WAIT)
        if got:
            bank.extend(got)
            with open(bank_path, "w", encoding="utf-8") as f:
                json.dump(bank, f, indent=1, ensure_ascii=False)
            print(f"    +{len(got)} ({section['name']}) "
                  f"-> {len(bank)}/{TARGET_PER_EVENT}")
            # Print distribution check every 100 questions
            if len(bank) >= last_check + 100:
                last_check += 100
                check_distribution(bank)
        time.sleep(RATE_DELAY)

    print(f"  DONE {event}: {len(bank)} questions saved to "
          f"{os.path.relpath(bank_path, BASE)}")
    check_distribution(bank, label="final")
    push_event(event, bank_path, len(bank))

# ------------------------------ MAIN --------------------------------
def main():
    args = [a for a in sys.argv[1:]]
    dry_run = "--dry-run" in args
    args = [a for a in args if not a.startswith("--")]

    events = sorted(d for d in os.listdir(MATERIALS)
                    if os.path.isdir(os.path.join(MATERIALS, d)))
    if args:
        events = [e for e in events if e in args]
        if not events:
            sys.exit(f"No matching event folder. Options: use folder names "
                     f"from study-materials/")

    with open(RULES_FILE, encoding="utf-8") as f:
        rules = f.read()

    client = None if dry_run else get_client()
    print(f"Events to process: {len(events)}"
          + (" (DRY RUN — no API calls)" if dry_run else ""))
    for event in events:
        generate_event(client, event, rules, dry_run, difficulty="hard")
    print("All done.")

if __name__ == "__main__":
    main()
