FBLA STUDYBOT — KNOWLEDGE BASE
Built from the official FBLA 2025–2026 Competitive Events Guidelines
(fetched from fbla.org, November 2025 editions)
============================================================

WHAT THIS IS
The complete "brain on paper" for an FBLA study bot: the official
knowledge areas and objectives for all 31 High School OBJECTIVE TEST
events, organized one folder per event, plus the rules file that
turns a general AI into a quiz coach.

FOLDER STRUCTURE

fbla-studybot/
├── README.txt          <- you are here
├── bot-rules.txt       <- the coach's behavior rules (system prompt)
└── study-materials/
    ├── accounting/event-outline.txt
    ├── advanced-accounting/event-outline.txt
    ├── advertising/event-outline.txt
    ├── agribusiness/event-outline.txt
    ├── business-communication/event-outline.txt
    ├── business-law/event-outline.txt
    ├── computer-problem-solving/event-outline.txt
    ├── cybersecurity/event-outline.txt
    ├── data-science-and-ai/event-outline.txt
    ├── economics/event-outline.txt
    ├── healthcare-administration/event-outline.txt
    ├── human-resource-management/event-outline.txt
    ├── insurance-and-risk-management/event-outline.txt
    ├── introduction-to-business-communication/event-outline.txt
    ├── introduction-to-business-concepts/event-outline.txt
    ├── introduction-to-business-procedures/event-outline.txt
    ├── introduction-to-fbla/event-outline.txt
    ├── introduction-to-information-technology/event-outline.txt
    ├── introduction-to-marketing-concepts/event-outline.txt
    ├── introduction-to-parliamentary-procedure/event-outline.txt
    ├── introduction-to-retail-and-merchandising/event-outline.txt
    ├── introduction-to-supply-chain-management/event-outline.txt
    ├── journalism/event-outline.txt
    ├── networking-infrastructures/event-outline.txt
    ├── organizational-leadership/event-outline.txt
    ├── personal-finance/event-outline.txt
    ├── project-management/event-outline.txt
    ├── public-administration-and-management/event-outline.txt
    ├── real-estate/event-outline.txt
    ├── retail-management/event-outline.txt
    └── securities-and-investments/event-outline.txt

WHAT EACH OUTLINE CONTAINS
- Event description and test format (all: 100 MC questions, 50 min)
- Eligibility notes where relevant ("Introduction to..." events are
  9th-10th grade only)
- Every knowledge area with its official objectives
- Test-item counts per area where FBLA publishes them (use these to
  weight your studying — e.g., Personal Finance is 50% "Financial
  Literacy"; Economics is 25% "Global Trade")
- Official reference resources FBLA lists for study

TWO SPECIAL CASES
- introduction-to-fbla: FBLA publishes knowledge areas but no detailed
  objectives; study from fbla.org and FBLA documents.
- introduction-to-parliamentary-procedure: based on Robert's Rules of
  Order (90 questions) + FBLA bylaws (10 questions); no objective list
  is published, so a topic list is provided instead.

HOW TO GROW THIS INTO YOUR PERSONAL TUTOR
Add these files to any event folder you're competing in:
- notes.txt     -> your own class/study notes (the bot quizzes from them)
- vocab.txt     -> terms + definitions for flashcard mode
- mistakes.txt  -> topics you got wrong; the bot re-drills these

HOW TO WIRE IT INTO THE CHAT APP
Tell Claude Code (in your my-chat project folder):
"Turn this chat app into an FBLA study bot. Use bot-rules.txt as the
system prompt. Add a dropdown listing the folders in study-materials/;
when an event is selected, load all .txt files from that folder into
the model's context. Keep conversation memory as-is."

SOURCE & FRESHNESS
Compiled from official guideline PDFs at fbla.org (2025-26 season).
Guidelines change every season — re-check fbla.org each summer.
Objectives marked with MBA Research codes in the originals have had
the codes removed for readability; content is unchanged.
