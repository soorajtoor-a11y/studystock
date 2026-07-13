"""
generate_bank.py — FBLA StudyBot question factory
==================================================
Batch-generates multiple-choice questions for every event in
study-materials/, following question-generation-rules.txt.

Three tiers, each its own bank file per event:
  --tier event      50 questions total     -> question-bank.json
  --tier section    25 questions/section   -> question-bank-sections.json
  --tier objective  15 questions/objective -> question-bank-objectives.json

USAGE
  python3 generate_bank.py --tier event                 # all events
  python3 generate_bank.py --tier section accounting    # one event only
  python3 generate_bank.py --tier objective --dry-run   # no API calls

CHECKPOINTING (see generation_checkpoint.json)
  One global, persistent A/B/C/D position counter and question-type counter
  spans the ENTIRE run across all tiers — not reset per file. Every time the
  running total crosses a multiple of 1,000 questions, the script:
    1. Prints the exact cumulative A/B/C/D distribution and type mix.
    2. If any letter is outside 25% +/- 3%, every bank generated so far
       (any tier) is automatically re-shuffled back into balance. This is
       mandatory, not advisory.
  The script exits when a tier finishes — it does NOT auto-chain into the
  next tier. Re-run with the next --tier value to continue.

DESIGN (matches the plan we made)
  - 5 questions per API request (small batches = reliable JSON)
  - Sends ONLY the relevant knowledge-area section, not whole files
  - Validates every question; retries once on bad JSON, then skips
  - Sleeps between requests to respect rate limits; on a rate-limit
    error, waits 60s and continues
  - Saves progress after every batch -> safe to stop and resume
  - Weights section-tier questions by "(N test items)" counts when present
"""

import json
import os
import random
import re
import sys
import time

# ----------------------------- SETTINGS -----------------------------
MODEL = "claude-haiku-4-5-20251001"  # cheapest Claude model; swap to sonnet for higher quality
BATCH_SIZE = 5               # questions per API request
RATE_DELAY = 7               # seconds between requests (rate-limit safe)
RATE_LIMIT_WAIT = 60         # seconds to wait after a 429/quota error
BASE = os.path.dirname(os.path.abspath(__file__))
MATERIALS = os.path.join(BASE, "study-materials")
RULES_FILE = os.path.join(BASE, "question-generation-rules.txt")
CHECKPOINT_FILE = os.path.join(BASE, "generation_checkpoint.json")

# The one calibrated FBLA-caliber standard (see question-generation-rules.txt
# RULE 1) — there is no easy/medium/hard variance anymore, only this.
DIFFICULTY = "hard"

TIER_TARGET = {"event": 50, "section": 25, "objective": 15}
TIER_BANK_FILENAME = {
    "event": "question-bank.json",
    "section": "question-bank-sections.json",
    "objective": "question-bank-objectives.json",
}

# RULE 1's five question categories and their target mix (must sum to 100).
QUESTION_TYPES = {
    "definition_recall":  38,
    "concept_completion": 27,
    "which_of_following": 22,
    "all_except":         8,
    "scenario_judgment":  5,
}

CHECKPOINT_EVERY = 1000
DISTRIBUTION_TOLERANCE = 3  # percentage points either side of 25%

# Difficulty tier is mechanical, per RULE 1B in question-generation-rules.txt:
# every "introduction-to-*" event is INTRO tier, everything else is STANDARD
# tier. This is independent of the --tier CLI flag (event/section/objective
# generation scope) and does not change if an event's source material does.
INTRO_EVENT_PREFIX = "introduction-to-"

def difficulty_tier(event):
    return "INTRO" if event.startswith(INTRO_EVENT_PREFIX) else "STANDARD"

def discover_events():
    """Return sorted (org, event) tuples for every event folder nested one
    level under an organization folder in study-materials/ (e.g. fbla/,
    deca/, hosa/). Non-directory entries (README.md, stray .txt files) at
    either level are skipped."""
    pairs = []
    for org in sorted(os.listdir(MATERIALS)):
        org_dir = os.path.join(MATERIALS, org)
        if not os.path.isdir(org_dir):
            continue
        for event in sorted(os.listdir(org_dir)):
            if os.path.isdir(os.path.join(org_dir, event)):
                pairs.append((org, event))
    return pairs

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
    """Concatenate every .txt in the event folder except the banks."""
    parts = []
    for name in sorted(os.listdir(event_dir)):
        if name.endswith(".txt"):
            with open(os.path.join(event_dir, name), encoding="utf-8") as f:
                parts.append(f.read())
    return "\n\n".join(parts)

SECTION_RE   = re.compile(r"^([A-Z]{1,2})\.\s+(.+)$")   # "A. Journalizing"
PART_RE      = re.compile(r"^PART\s+\d+\s*[—-]\s*(.+)$")  # "PART 2 — HISTORY"
WEIGHT_RE    = re.compile(r"\((\d+)\s*(?:test\s*)?items?\)", re.I)
OBJECTIVE_RE = re.compile(r"^(\d+)\.\s+(.+)$")          # "1. Prepare a ..."

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

def split_objectives(section_body):
    """Return [{num, text}, ...] objective lines within a section body."""
    objs = []
    for line in section_body.splitlines():
        m = OBJECTIVE_RE.match(line.strip())
        if m:
            objs.append({"num": m.group(1), "text": m.group(2).strip()})
    return objs

# --------------------------- GENERATION -----------------------------
PROMPT_TEMPLATE = """{rules}

============================================================
SOURCE MATERIAL (generate questions ONLY from this section):

Event: {event}
Knowledge area: {area}
Difficulty tier: {difficulty_tier} — follow RULE 1B's distribution for this
tier exactly. Do not drift toward "hard" as a goal; match what would
realistically appear on this specific event's real objective test.
{focus}
{type_focus}
{body}
============================================================
{already_asked}
============================================================

Generate exactly {n} multiple-choice questions from the source material
above, following every generation rule — including the RULE 1 question-type
mix (38% definition_recall / 27% concept_completion / 22% which_of_following
/ 8% all_except / 5% scenario_judgment), the concrete per-batch type-mix
target stated above, and the RULE 1B difficulty tier distribution stated
above. Every question must test a fact DIFFERENT from everything in the
ALREADY ASKED list above — see RULE 8c.

Respond with ONLY a JSON array (no code fences, no other text) of
{n} objects, each with exactly these fields:
  "question": string,
  "options": array of exactly 4 strings,
  "correct_index": integer 0-3,
  "explanation": 2-3 sentence string,
  "type": one of "definition_recall", "concept_completion",
          "which_of_following", "all_except", "scenario_judgment"
"""

def type_mix_directive(n):
    """Compute which question types are most under-represented relative to
    RULE 1's 38/27/22/8/5 target, and tell the model exactly how many of each
    type to write for THIS batch. Static prompt text alone ("aim for these
    proportions") was proven insufficient — a real regenerated 50-question
    event tier drifted to all_except 14% (target 8%) and scenario_judgment
    14% (target 5%) while concept_completion fell to 12% (target 27%),
    because nothing made the target concrete on a per-batch basis. This is
    the same lever that fixed topic-clustering (see the objective-rotation
    focus text below) — turn a static aspiration into a live, adaptive,
    per-batch instruction.

    Deliberately scoped to THIS RUN's own type counts (_run_state), not the
    global checkpoint's lifetime type_counts — the global counts span every
    event ever generated (contaminated by ~1,550 pre-fix questions from
    before "type" even existed, and by other events' own independent drift),
    so using them here suppressed all_except/scenario_judgment for an entire
    fresh event bank for the wrong reason (they were globally, not locally,
    over-represented). A fresh run should self-correct against its OWN
    drift, not inherit unrelated history."""
    run_types = {}
    for q in _run_state["questions"]:
        t = q.get("type")
        if t in QUESTION_TYPES:
            run_types[t] = run_types.get(t, 0) + 1
    total = sum(run_types.values())
    if total < 20:
        # Too little history to compute a meaningful deficit yet — fall back
        # to the flat target so early batches aren't skewed by noise.
        deficits = dict(QUESTION_TYPES)
    else:
        deficits = {
            t: target_pct - (run_types.get(t, 0) / total * 100)
            for t, target_pct in QUESTION_TYPES.items()
        }

    ranked = sorted(deficits.items(), key=lambda kv: -kv[1])
    weights = [(t, max(d, 0.1)) for t, d in ranked]
    weight_sum = sum(w for _, w in weights)
    counts = {}
    remaining = n
    for i, (t, w) in enumerate(weights):
        if i == len(weights) - 1:
            c = remaining
        else:
            c = min(round(n * w / weight_sum), remaining)
        counts[t] = c
        remaining -= c
    counts = {t: c for t, c in counts.items() if c > 0}
    parts = ", ".join(f"{c} {t}" for t, c in counts.items())
    return (f"TYPE MIX FOR THIS BATCH (RULE 1, made concrete using this "
            f"run's own mix so far — not optional): write exactly "
            f"{parts}. These counts already account for which types have "
            f"been over/under-used so far in this run — follow them.")

def already_asked_block(prior_questions):
    """Render the list of question stems AND the list of correct-answer
    concepts already used in this pool, so a stateless API call has real
    memory of what to avoid repeating (see RULE 8c). The question-text list
    alone was proven insufficient — a real 25-question pool had the same
    fact (copyright, information security, virtualization's core definition,
    etc.) retested 2-5 times with different wording, because the model
    doesn't reliably recognize its own reworded version as "the same thing"
    from question text alone. Naming the exact answer CONCEPT directly, as
    its own explicit banned list, is a much harder-to-ignore signal — same
    principle as RULE 8c, made concrete. `prior_questions` is the list of
    full prior question dicts (needs both .question and
    .options/.correct_index, not just text)."""
    prior_questions = prior_questions or []
    if not prior_questions:
        return ("ALREADY ASKED IN THIS KNOWLEDGE AREA: (none yet — this is "
                "the first batch, no restrictions from prior questions.)")
    q_lines = "\n".join(f"  {i+1}. {p['question']}" for i, p in enumerate(prior_questions))
    answers = [a for a in (answer_text(p) for p in prior_questions) if a]
    a_lines = "\n".join(f"  - {a}" for a in dict.fromkeys(answers))
    return (
        "ALREADY ASKED IN THIS KNOWLEDGE AREA — every one of these facts is "
        "now OFF LIMITS, including asking about it again with different "
        "wording (RULE 8c):\n" + q_lines + "\n\n"
        "CORRECT ANSWERS ALREADY USED IN THIS POOL — do NOT write a new "
        "question whose correct answer is any of these concepts, even "
        "phrased completely differently or asked from a different angle. "
        "Pick a genuinely DIFFERENT fact from the source material instead:\n"
        + a_lines
    )

ANSWER_INDICATOR_RE = re.compile(
    r"\s*(?:✓|✔|☑|✅|\*+|\(\s*correct\s*\)|\[\s*correct\s*\]|<-+\s*correct)\s*$",
    re.IGNORECASE,
)

def strip_answer_indicators(text):
    """Defense-in-depth against leaked answer-indicators (RULE 4f). The
    rules-file fix (removing inline check-mark annotations from illustrative
    examples, which the model was literally copying into real option text)
    addresses the root cause, but this strips any indicator that slips
    through anyway. Mirrors server.js's stripAnswerIndicators exactly."""
    cleaned = text
    while True:
        new = ANSWER_INDICATOR_RE.sub("", cleaned).rstrip()
        if new == cleaned:
            return cleaned
        cleaned = new

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
            q["options"] = [strip_answer_indicators(o) for o in q["options"]]
            q["knowledge_area"] = area_name
            q["difficulty"] = DIFFICULTY
            if q.get("type") not in QUESTION_TYPES:
                q["type"] = None  # flagged, not guessed
            good.append(q)
    if not good:
        raise ValueError("no valid questions in response")
    return good

def word_count(s):
    return len((s or "").strip().split())

def has_obvious_length_tell(q):
    """Mechanical, code-level port of server.js's hasObviousLengthTell.
    Prompt-only instructions (RULE 2) were proven insufficient at scale: the
    pre-generated Intro-to-IT banks shipped with the same length-bias problem
    live generation had, because nothing actually checked the output here —
    only server.js's live path had a real enforcement gate. Combined
    relative+absolute threshold, calibrated against a real observed failure
    (the security-breach example in RULE 2)."""
    options = q.get("options")
    idx = q.get("correct_index")
    if not isinstance(options, list) or len(options) != 4 or not isinstance(idx, int):
        return False
    correct_count = word_count(options[idx])
    if not correct_count:
        return False
    other_counts = [word_count(o) for i, o in enumerate(options) if i != idx]
    avg_other = sum(other_counts) / len(other_counts)
    return (correct_count - avg_other) >= 3 and correct_count > avg_other * 1.2

def find_length_violations(questions):
    return [q for q in questions if has_obvious_length_tell(q)]

def answer_text(q):
    idx = q.get("correct_index")
    options = q.get("options")
    if not isinstance(options, list) or not isinstance(idx, int) or not (0 <= idx < len(options)):
        return ""
    return options[idx]

# Generic "wrapper" words that vary between two phrasings of the SAME fact
# (e.g. "antivirus program" vs "antivirus software") — stripped before
# comparing concept words so they don't count as the meaningful part of the
# answer. Deliberately does NOT include words like "storage", "data",
# "network", "information", "security" — those ARE meaningful differentiators
# ("local storage" vs "cloud storage" are genuinely different facts and must
# never be flagged as the same concept).
GENERIC_ANSWER_WORDS = {
    "software", "program", "programs", "tool", "tools", "utility", "utilities",
    "system", "systems", "application", "applications", "service", "services",
    "feature", "features", "technology", "technologies", "method", "methods",
    "practice", "practices", "measure", "measures", "process", "processes",
    "management", "manager", "control", "controls", "planning", "protection",
    "capability", "capabilities", "function", "functions", "operation",
    "operations", "concept", "concepts", "type", "types", "device", "devices",
}

def concept_words(text):
    """Reduce an answer's text to its core concept word(s) for duplicate-FACT
    detection (distinct from find_duplicate_violations's exact-text check).
    Strips generic wrapper words so two phrasings of the same fact reduce to
    the same set (e.g. "antivirus program" and "antivirus software" both
    become {"antivirus"}). A mechanical PROXY for "is this the same
    underlying fact", not true semantic understanding — see
    find_duplicate_violations for why this exists and what it caught."""
    words = re.findall(r"[a-z]+", (text or "").lower())
    return {w for w in words if len(w) >= 4 and w not in GENERIC_ANSWER_WORDS}

def _word_fuzzy_match(a, b, min_len=4, fuzzy_floor=5):
    """Two words "match" if identical, or — ONLY when both are at least
    `fuzzy_floor` characters long — share a >=min_len-character prefix
    (catches word-form variants like "defragmentation"/"defragmenter" or
    "caching"/"cache" without needing real stemming). The fuzzy_floor guard
    is load-bearing: without it, a short word like "data" (4 chars) prefix-
    matches "database" (also starts "data") even though they're different
    concepts — a real false-positive storm found in review, where 5
    unrelated questions (data governance, data selling, data breaches,
    network encryption, data loss) all got flagged as duplicates of a
    "database" question purely because they each contained some word
    starting with "data". Below the floor, only an EXACT match counts."""
    if a == b:
        return True
    if min(len(a), len(b)) < fuzzy_floor:
        return False
    return a[:min_len] == b[:min_len]

# Words that are too common/generic WITHIN this IT-heavy source material to
# trust as a lone, single-word match signal — e.g. "file" alone shows up in
# "file system", "file permissions", "file compression", "file sharing",
# none of which are the same fact. Unlike GENERIC_ANSWER_WORDS (stripped
# everywhere), these words still count as part of a MULTI-word concept set
# (e.g. "access permissions" is fine) — they're only disqualified from
# single-handedly triggering a match on their own. Found via real false
# positives: "operating" (from "operating system") trivially matched inside
# an unrelated 9-word troubleshooting-scenario answer; "file" (from "file
# system") trivially matched "file permissions", a genuinely different fact.
WEAK_ANCHOR_WORDS = {
    "file", "files", "data", "access", "user", "users", "resource",
    "resources", "operating", "information", "network", "networks",
    "digital",
}

def _set_covered(small, big):
    """True if every word in `small` has a fuzzy match somewhere in `big`.
    A single-word `small` set is refused if that word is a weak anchor (see
    WEAK_ANCHOR_WORDS) — one generic word incidentally appearing inside an
    unrelated answer is not enough evidence of a real duplicate."""
    if not small:
        return False
    if len(small) == 1 and next(iter(small)) in WEAK_ANCHOR_WORDS:
        return False
    return all(any(_word_fuzzy_match(w, bw) for bw in big) for w in small)

def is_concept_repeat(text_a, text_b):
    """True if two answer texts are almost certainly testing the SAME
    underlying fact, just phrased differently. Verified against every real
    case found in a manual 175-question review: antivirus, backup,
    defragmentation, caching, virtualization, copyright, information
    security, data collection, and database operations/management were each
    tested 2+ times per 25-question pool with different wording, none of it
    caught by exact-text matching. Also verified NOT to false-positive on
    genuinely different facts that happen to share a word, e.g. "local
    storage" vs "cloud storage" (correctly NOT flagged — different concepts,
    good complementary distractors)."""
    a, b = concept_words(text_a), concept_words(text_b)
    if not a or not b:
        return False
    return _set_covered(a, b) or _set_covered(b, a)

def normalize_question_text(s):
    s = (s or "").lower()
    s = re.sub(r"[^a-z0-9\s]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s

def find_duplicate_violations(questions, prior_questions=None):
    """Mechanical, code-level duplicate check. Catches two DIFFERENT failure
    modes:
      1. EXACT/near-exact question-TEXT repeats (normalized string match) —
         the original check, mirrors server.js's findDuplicateViolations.
      2. CONCEPT repeats — the SAME underlying fact retested with different
         wording, which (1) can never catch. Real, severe failure found by a
         manual 175-question review: one 25-question pool had copyright
         defined twice, information security defined twice, data collection
         defined twice, database operations/management defined twice, and a
         disaster-recovery theme spanning 5 of 25 questions — NONE of them
         exact-text matches, all of them the model gravitating back to the
         same "safe" high-salience facts despite already_asked_block()
         listing the prior question text. Detected via is_concept_repeat()
         comparing each new question's correct-answer text against every
         prior correct answer in this pool (both within the new batch and
         against everything already accumulated).
    `prior_questions` is now the list of full prior question DICTS (not just
    text) so both question-text and correct-answer text are available —
    every caller must pass full question objects."""
    prior_questions = prior_questions or []
    seen_text = {normalize_question_text(p.get("question")) for p in prior_questions}
    seen_answers = [a for a in (answer_text(p) for p in prior_questions) if a]
    violations = []
    batch_answers = []
    for q in questions:
        norm = normalize_question_text(q.get("question"))
        ans = answer_text(q)
        is_text_dupe = norm in seen_text
        is_concept_dupe = bool(ans) and (
            any(is_concept_repeat(ans, prior_ans) for prior_ans in seen_answers)
            or any(is_concept_repeat(ans, prev) for prev in batch_answers)
        )
        if is_text_dupe or is_concept_dupe:
            violations.append(q)
        else:
            seen_text.add(norm)
            if ans:
                batch_answers.append(ans)
    return violations

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

def push_event(org, event, bank_path, n):
    """Commit and push the question bank for one event to GitHub."""
    import subprocess
    rel = os.path.relpath(bank_path, BASE)
    try:
        subprocess.run(["git", "add", rel], cwd=BASE, check=True, capture_output=True)
        subprocess.run(
            ["git", "commit", "-m", f"Add {n} questions for {org}/{event}"],
            cwd=BASE, check=True, capture_output=True, text=True,
        )
        subprocess.run(["git", "push", "origin", "main"], cwd=BASE, check=True, capture_output=True)
        print(f"  Pushed to GitHub: {rel}")
    except subprocess.CalledProcessError as e:
        print(f"  Git push failed for {org}/{event}: {getattr(e, 'stderr', '') or e}")

# ------------------------- GLOBAL CHECKPOINT -------------------------
def load_checkpoint():
    if os.path.exists(CHECKPOINT_FILE):
        with open(CHECKPOINT_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {
        "position_counts": [0, 0, 0, 0],
        "type_counts": {k: 0 for k in QUESTION_TYPES},
        "total": 0,
        "last_checkpoint_total": 0,
        "tiers_completed": [],
    }

def save_checkpoint(state):
    with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=1)

def assign_positions(questions, state):
    """Greedy least-used-position assignment — always place the next correct
    answer at whichever of A/B/C/D is currently most under-represented,
    globally across the whole run. Updates `state` in place."""
    for q in questions:
        correct_text = q["options"][q["correct_index"]]
        min_count = min(state["position_counts"])
        candidates = [i for i, c in enumerate(state["position_counts"]) if c == min_count]
        target = random.choice(candidates)
        others = [o for o in q["options"] if o != correct_text]
        random.shuffle(others)
        q["options"] = others[:target] + [correct_text] + others[target:]
        q["correct_index"] = target
        state["position_counts"][target] += 1
        if q.get("type") in state["type_counts"]:
            state["type_counts"][q["type"]] += 1
        state["total"] += 1
    return questions

def distribution_lines(counts):
    total = sum(counts) or 1
    letters = "ABCD"
    pct = [c / total * 100 for c in counts]
    lines = [f"    {letters[i]}: {counts[i]:5d}  ({pct[i]:5.2f}%)" for i in range(4)]
    return lines, pct

def type_lines(type_counts):
    total = sum(type_counts.values())
    lines = []
    for t, target_pct in QUESTION_TYPES.items():
        c = type_counts.get(t, 0)
        actual = (c / total * 100) if total else 0.0
        lines.append(f"    {t:20s} {c:5d}  ({actual:5.2f}%, target {target_pct}%)")
    return lines

def rebalance_all_banks(state):
    """Re-shuffle every existing bank's answer positions from scratch so the
    GLOBAL distribution snaps back to 25/25/25/25. This is the mandatory,
    no-exceptions correction path — triggered whenever a checkpoint finds
    any letter more than 3 points off 25%."""
    print("    !! distribution out of tolerance — rebalancing every generated bank...")
    state["position_counts"] = [0, 0, 0, 0]
    state["type_counts"] = {k: 0 for k in QUESTION_TYPES}
    pairs = discover_events()
    for tier, filename in TIER_BANK_FILENAME.items():
        for org, event in pairs:
            path = os.path.join(MATERIALS, org, event, filename)
            if not os.path.exists(path):
                continue
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            pools = list(data.values()) if isinstance(data, dict) else [data]
            for pool in pools:
                assign_positions(pool, state)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=1, ensure_ascii=False)
    save_checkpoint(state)
    print("    rebalance complete — every bank now reflects the corrected positions.")

SELF_CHECK_EVERY = 100
_run_state = {"questions": [], "last_self_check": 0}

def _length_tell_rate(questions):
    if not questions:
        return 0.0
    flagged = sum(1 for q in questions if has_obvious_length_tell(q))
    return flagged / len(questions) * 100

def self_check(event, area_label):
    """Fires automatically every SELF_CHECK_EVERY (100) questions generated
    within this run — silent, no stop, no user interaction. Per the user's
    explicit request: check every 100 on our own, only report to the user at
    the real 1,000-question global checkpoint (maybe_checkpoint, unchanged).
    Verifies the 3 axes the user asked to be held consistent across the
    whole run: answer distribution, difficulty-tier conformity, and
    distractor quality/length. This is IN ADDITION TO, not a replacement
    for, the per-batch mechanical checks in _generate_batch (which reject
    and retry a batch outright) — this is a rolling audit of the last 100
    questions actually accepted, to catch slow drift a single-batch check
    can't see."""
    qs = _run_state["questions"]
    total = len(qs)
    if total - _run_state["last_self_check"] < SELF_CHECK_EVERY:
        return
    _run_state["last_self_check"] = (total // SELF_CHECK_EVERY) * SELF_CHECK_EVERY

    window = qs[-SELF_CHECK_EVERY:]
    letters = "ABCD"
    pos_counts = [0, 0, 0, 0]
    for q in window:
        pos_counts[q["correct_index"]] += 1
    pct = [c / len(window) * 100 for c in pos_counts]

    type_counts = {}
    for q in window:
        t = q.get("type")
        if t:
            type_counts[t] = type_counts.get(t, 0) + 1

    length_rate = _length_tell_rate(window)

    print(f"\n  --- self-check @ {total} questions this run ({area_label}) ---")
    print("    distribution (last %d): %s" % (
        len(window), ", ".join(f"{letters[i]} {pct[i]:.1f}%" for i in range(4))))
    dist_bad = any(abs(p - 25) > DISTRIBUTION_TOLERANCE for p in pct)
    if dist_bad:
        print("    FLAG: distribution drifted >3pts off 25% in this window "
              "(global checkpoint auto-rebalances at the next 1,000 boundary)")

    type_summary = ", ".join(
        f"{t} {c}/{len(window)} ({c/len(window)*100:.0f}%)"
        for t, c in sorted(type_counts.items())
    ) or "n/a"
    print(f"    type mix (last {len(window)}): {type_summary}")
    print(f"    difficulty tier: {difficulty_tier(event)} (mechanical, per RULE 1B — event name unchanged mid-run)")

    print(f"    length-tell rate: {length_rate:.1f}% of window flagged as obviously-longest-correct-answer")
    if length_rate > 15:
        print(f"    FLAG: length-tell rate {length_rate:.1f}% is high — distractor length balance may be drifting")

    print("  --- end self-check ---\n")

def maybe_checkpoint(state):
    """Called after every batch is appended. Fires once per 1,000-question
    boundary crossed since the last checkpoint."""
    if state["total"] // CHECKPOINT_EVERY <= state["last_checkpoint_total"] // CHECKPOINT_EVERY:
        return
    print(f"\n  === CHECKPOINT @ {state['total']} questions (global, all tiers) ===")
    lines, pct = distribution_lines(state["position_counts"])
    for line in lines:
        print(line)
    print("    --- question-type mix ---")
    for line in type_lines(state["type_counts"]):
        print(line)

    bad = any(abs(p - 25) > DISTRIBUTION_TOLERANCE for p in pct)
    if bad:
        rebalance_all_banks(state)
        lines, _ = distribution_lines(state["position_counts"])
        print("    post-rebalance distribution:")
        for line in lines:
            print(line)
    else:
        print(f"    distribution within tolerance (25% +/- {DISTRIBUTION_TOLERANCE}%) — no action needed")

    state["last_checkpoint_total"] = state["total"]
    save_checkpoint(state)

def final_tier_report(state, tier):
    print(f"\n=== TIER COMPLETE: {tier} ===")
    lines, _ = distribution_lines(state["position_counts"])
    print("  cumulative global A/B/C/D distribution:")
    for line in lines:
        print(line)
    print("  cumulative question-type mix:")
    for line in type_lines(state["type_counts"]):
        print(line)
    print(f"  total questions generated so far (all tiers): {state['total']}")
    state["tiers_completed"] = sorted(set(state.get("tiers_completed", [])) | {tier})
    save_checkpoint(state)

# ---------------------------- TIER: EVENT ----------------------------
def generate_event_tier(client, org, event, rules, state, dry_run=False):
    event_dir = os.path.join(MATERIALS, org, event)
    bank_path = os.path.join(event_dir, TIER_BANK_FILENAME["event"])
    target = TIER_TARGET["event"]

    text = read_event_text(event_dir)
    sections = split_sections(text)
    if not sections:
        print(f"  !! {event}: no knowledge-area sections found, skipping")
        return

    if dry_run:
        print(f"  {event}: {len(sections)} sections")
        return

    bank = []
    if os.path.exists(bank_path):
        with open(bank_path, encoding="utf-8") as f:
            bank = json.load(f)
    if len(bank) >= target:
        print(f"  {event}: already has {len(bank)}/{target} — skipping")
        return

    weights = [s["weight"] for s in sections]
    print(f"  {event}: {len(bank)}/{target} questions, {len(sections)} sections")

    while len(bank) < target:
        section = random.choices(sections, weights=weights, k=1)[0]
        n = min(BATCH_SIZE, target - len(bank))
        prior = [q for q in bank if q.get("knowledge_area") == section["name"]]
        # Same rotation fix as the section tier: whenever this section gets
        # picked again, focus on different objectives within it rather than
        # whichever one the model reaches for by default every time.
        objectives = split_objectives(section["body"])
        if objectives:
            batch_index = len(prior) // BATCH_SIZE
            picks = [objectives[(batch_index * 2 + k) % len(objectives)]["text"]
                     for k in range(min(2, len(objectives)))]
            focus = ("Distribute this batch's questions across these specific "
                      "objectives from within the section — don't fixate on "
                      "just one topic: " + " | ".join(picks))
        else:
            focus = ""
        prompt = PROMPT_TEMPLATE.format(
            rules=rules, event=event, area=section["name"],
            difficulty_tier=difficulty_tier(event),
            focus=focus, type_focus=type_mix_directive(n),
            body=section["body"][:6000], n=n,
            already_asked=already_asked_block(prior),
        )
        got = _generate_batch(client, prompt, section["name"], state, prior, event)
        if got:
            bank.extend(got)
            with open(bank_path, "w", encoding="utf-8") as f:
                json.dump(bank, f, indent=1, ensure_ascii=False)
            print(f"    +{len(got)} ({section['name']}) -> {len(bank)}/{target}")
        time.sleep(RATE_DELAY)

    print(f"  DONE {event}: {len(bank)} questions saved to {os.path.relpath(bank_path, BASE)}")
    push_event(org, event, bank_path, len(bank))

# --------------------------- TIER: SECTION ---------------------------
def generate_section_tier(client, org, event, rules, state, dry_run=False):
    event_dir = os.path.join(MATERIALS, org, event)
    bank_path = os.path.join(event_dir, TIER_BANK_FILENAME["section"])
    target = TIER_TARGET["section"]

    text = read_event_text(event_dir)
    sections = split_sections(text)
    if not sections:
        print(f"  !! {event}: no knowledge-area sections found, skipping")
        return

    if dry_run:
        print(f"  {event}: {len(sections)} sections x {target} questions each")
        return

    banks = {}
    if os.path.exists(bank_path):
        with open(bank_path, encoding="utf-8") as f:
            banks = json.load(f)

    for section in sections:
        key = section["name"]
        bank = banks.get(key, [])
        if len(bank) >= target:
            continue
        print(f"  {event} / {key}: {len(bank)}/{target}")
        # Without explicit rotation, every batch sees the same whole-section
        # body and gravitates toward whichever one objective it finds most
        # salient (e.g. a 25-question Computer Hardware pool turning into
        # mostly "types of computers / supercomputers" questions and never
        # touching the other 9 objectives). Rotate 2 objectives into focus
        # per batch so a section's full breadth actually gets covered.
        objectives = split_objectives(section["body"])
        batch_index = len(bank) // BATCH_SIZE
        while len(bank) < target:
            n = min(BATCH_SIZE, target - len(bank))
            if objectives:
                picks = [objectives[(batch_index * 2 + k) % len(objectives)]["text"]
                         for k in range(min(2, len(objectives)))]
                focus = ("Distribute this batch's questions across these specific "
                          "objectives from within the section — don't fixate on "
                          "just one topic: " + " | ".join(picks))
            else:
                focus = ""
            prompt = PROMPT_TEMPLATE.format(
                rules=rules, event=event, area=key,
                difficulty_tier=difficulty_tier(event),
                focus=focus, type_focus=type_mix_directive(n),
                body=section["body"][:6000], n=n,
                already_asked=already_asked_block(bank),
            )
            got = _generate_batch(client, prompt, key, state, bank, event)
            if got:
                bank.extend(got)
                banks[key] = bank
                with open(bank_path, "w", encoding="utf-8") as f:
                    json.dump(banks, f, indent=1, ensure_ascii=False)
                print(f"    +{len(got)} -> {len(bank)}/{target}")
            batch_index += 1
            time.sleep(RATE_DELAY)

    push_event(org, event, bank_path, sum(len(v) for v in banks.values()))

# -------------------------- TIER: OBJECTIVE --------------------------
def generate_objective_tier(client, org, event, rules, state, dry_run=False):
    event_dir = os.path.join(MATERIALS, org, event)
    bank_path = os.path.join(event_dir, TIER_BANK_FILENAME["objective"])
    target = TIER_TARGET["objective"]

    text = read_event_text(event_dir)
    sections = split_sections(text)
    if not sections:
        print(f"  !! {event}: no knowledge-area sections found, skipping")
        return

    all_objectives = [(s, o) for s in sections for o in split_objectives(s["body"])]
    if dry_run:
        print(f"  {event}: {len(all_objectives)} objectives x {target} questions each")
        return

    banks = {}
    if os.path.exists(bank_path):
        with open(bank_path, encoding="utf-8") as f:
            banks = json.load(f)

    for section, obj in all_objectives:
        key = obj["text"]
        bank = banks.get(key, [])
        if len(bank) >= target:
            continue
        print(f"  {event} / {section['name']} #{obj['num']}: {len(bank)}/{target}")
        while len(bank) < target:
            n = min(BATCH_SIZE, target - len(bank))
            focus = f"Focus ONLY on this specific objective — do not draw questions from the rest of the section: \"{obj['text']}\""
            prompt = PROMPT_TEMPLATE.format(
                rules=rules, event=event, area=section["name"],
                difficulty_tier=difficulty_tier(event),
                focus=focus, type_focus=type_mix_directive(n),
                body=section["body"][:6000], n=n,
                already_asked=already_asked_block(bank),
            )
            got = _generate_batch(client, prompt, section["name"], state, bank, event)
            if got:
                bank.extend(got)
                banks[key] = bank
                with open(bank_path, "w", encoding="utf-8") as f:
                    json.dump(banks, f, indent=1, ensure_ascii=False)
                print(f"    +{len(got)} -> {len(bank)}/{target}")
            time.sleep(RATE_DELAY)

    push_event(org, event, bank_path, sum(len(v) for v in banks.values()))

# --------------------------- SHARED HELPER ---------------------------
def _generate_batch(client, prompt, area_name, state, prior_questions=None, event=None):
    """Retry-guarded batch call: parse -> mechanical quality checks ->
    assign positions -> checkpoint -> rolling self-check.

    The quality checks (length-tell, duplicates) are CODE-LEVEL, not just
    prompt instructions — prompt-only enforcement was proven insufficient at
    scale (see RULE 2/8c in the rules file and
    feedback_fbla_question_generation_rules.md): each batch is an
    independent, stateless API call, and across hundreds of them some will
    drift even with perfect prompt text. This mirrors server.js's live-path
    enforcement exactly so bulk-generated banks get the same guarantee.
    Tracks the least-bad attempt across retries so one stubborn batch never
    silently produces nothing — worst case it keeps the best available
    attempt instead of skipping the batch outright.

    The "best" comparison ranks by (dupe_count, length_count) as a tuple, NOT
    a flat sum — a real bug shipped where a 3-attempt tie (1 dupe on attempt
    1, 1 length-tell on attempts 2 and 3 — all "1 total violation") kept
    attempt 1 by default (first-seen wins ties under strict <), landing an
    actual duplicate question in a live bank. A duplicate is strictly worse
    than a length-tell (it's a wasted, unusable question; a length-tell is a
    partial quality issue), so it must never lose a tie-break to one."""
    best = None
    best_rank = None
    for attempt in (1, 2, 3):
        try:
            raw = call_model(client, prompt)
            parsed = parse_questions(raw, area_name)
            length_violations = find_length_violations(parsed)
            dupe_violations = find_duplicate_violations(parsed, prior_questions)
            rank = (len(dupe_violations), len(length_violations))

            if best is None or rank < best_rank:
                best = parsed
                best_rank = rank

            if dupe_violations or length_violations:
                reasons = []
                if length_violations:
                    reasons.append(f"{len(length_violations)} length-tell")
                if dupe_violations:
                    reasons.append(f"{len(dupe_violations)} duplicate")
                print(f"    {', '.join(reasons)} violation(s) (attempt {attempt}) — retrying")
                continue

            got = assign_positions(parsed, state)
            maybe_checkpoint(state)
            _run_state["questions"].extend(got)
            self_check(event, area_name)
            return got
        except ValueError as e:
            print(f"    bad JSON from model (attempt {attempt}): {e}")
        except Exception as e:
            print(f"    API error: {e} — waiting {RATE_LIMIT_WAIT}s")
            time.sleep(RATE_LIMIT_WAIT)

    if best is not None:
        dupe_n, length_n = best_rank
        print(f"    all attempts had violations — using least-bad available "
              f"({dupe_n} duplicate, {length_n} length-tell)")
        got = assign_positions(best, state)
        maybe_checkpoint(state)
        _run_state["questions"].extend(got)
        self_check(event, area_name)
        return got
    return None

# ------------------------------ MAIN --------------------------------
TIER_FN = {
    "event":     generate_event_tier,
    "section":   generate_section_tier,
    "objective": generate_objective_tier,
}

def main():
    args = list(sys.argv[1:])
    dry_run = "--dry-run" in args
    args = [a for a in args if not a.startswith("--dry-run")]

    tier = "event"
    if "--tier" in args:
        i = args.index("--tier")
        tier = args[i + 1]
        args = args[:i] + args[i + 2:]
    if tier not in TIER_FN:
        sys.exit(f"--tier must be one of {list(TIER_FN)}")

    pairs = discover_events()
    if args:
        # Accept either a bare event slug ("accounting") or an org-qualified
        # one ("fbla/accounting") since event names are no longer guaranteed
        # unique across organizations.
        pairs = [(o, e) for (o, e) in pairs if e in args or f"{o}/{e}" in args]
        if not pairs:
            sys.exit("No matching event folder. Use folder names from study-materials/<org>/")

    with open(RULES_FILE, encoding="utf-8") as f:
        rules = f.read()

    client = None if dry_run else get_client()
    state = load_checkpoint()
    print(f"Tier: {tier} | Events to process: {len(pairs)}"
          + (" (DRY RUN — no API calls)" if dry_run else ""))
    print(f"Starting from global checkpoint: {state['total']} questions generated so far.")

    for org, event in pairs:
        TIER_FN[tier](client, org, event, rules, state, dry_run)

    if not dry_run:
        final_tier_report(state, tier)
        print(f"\n{tier} tier finished. Re-run with a different --tier to continue —"
              f" this script does not auto-chain into the next tier.")
    else:
        print("Dry run complete — no changes made.")

if __name__ == "__main__":
    main()
