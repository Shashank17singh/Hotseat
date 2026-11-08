# Hotseat

A spoken mock interview that builds questions from your resume, presses you with follow-ups, and scores every answer. Runs in the browser with your mic and camera.

```
Interviewer: "You led the move from cron jobs to a queue. What failed first?"
You:         "Retries. We hit the same job twice until we added idempotency keys."
Interviewer: "How did you test that the keys actually held under load?"
```

Each question builds on what you just said, and the report scores only what you actually answered.

## Overview

Hotseat is a mock interview you take out loud. Upload a resume, pick a role and difficulty, and an AI interviewer asks questions, listens to your answers and follows up on what you said. At the end you get a scored report with written feedback, a stronger version of each answer, and measured delivery stats such as pace and filler words.

Not ready to be tested yet? The Learn section builds a course from your resume or a list of topics and teaches it from the beginning. It finds what you already know, makes you explain each idea back, and shows which resume lines you could not defend yet. Every lesson is fact-checked before you see it, against the official documentation where it exists. A mock interview then tests the same skills, and weak answers go back to the course for review.

There are no accounts and no database. Sessions and courses live in your browser, and video never leaves your device.

---

### Interview Pipeline

```mermaid
graph TD
    subgraph "Setup"
    A[Resume PDF / DOCX / TXT] -->|unpdf / mammoth| B(Raw Text)
    B -->|Groq LLM + Zod Schema| C[Structured Profile]
    D[Role, Difficulty, Job Description] --> E{Interview Plan}
    C --> E
    end

    subgraph "Interview Loop"
    E --> F[Question Read Aloud with Subtitles]
    F --> G[Mic and Camera Recording]
    G -->|Silence Check| H(Whisper Transcript)
    H --> I{Groq Interviewer}
    I -->|Follow-Up or Adapted Question| F
    end

    subgraph "Report"
    I --> J[Scores and Feedback]
    G --> K[Pace, Fillers, Pauses]
    J --> L[Report and History in Browser]
    K --> L
    end

    classDef io fill:#f9f0ff,stroke:#8a2be2,stroke-width:2px,color:#000;
    classDef core fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,color:#000;
    classDef logic fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000;

    class A,D,L io;
    class B,C,F,G,H,J,K core;
    class E,I logic;
```

### Learning Loop

```mermaid
graph TD
    A[Resume or Topics] -->|Groq LLM + Zod Schema| B[Skill Path, Foundations First]
    B --> C[Placement Quiz]
    C --> H[Draft Lesson Built on Your Projects]
    I[Official Docs via Context7] --> J{AI Fact-Check}
    H --> J
    J --> D[Lesson]
    D --> E[Explain It Back]
    E -->|Below 70| D
    E -->|70 or Above| F[Spaced Review]
    F --> D
    F --> G[Focused Mock Interview]
    G -->|Weak Answer| D

    classDef io fill:#f9f0ff,stroke:#8a2be2,stroke-width:2px,color:#000;
    classDef core fill:#e1f5fe,stroke:#0288d1,stroke-width:2px,color:#000;
    classDef logic fill:#e8f5e9,stroke:#388e3c,stroke-width:2px,color:#000;

    class A,I io;
    class B,C,D,G,H core;
    class E,F,J logic;
```

Passing, review dates and the resume audit are computed in the app, not decided by the model. Resume lines in the audit are checked against the parsed resume, so it never quotes something you did not write.

A learner cannot spot a wrong explanation, so lessons are never shown straight from the model. A second AI pass checks each claim and line of code, and quizzes are checked for questions with more than one defensible answer. When a trusted library's documentation matches the skill, such as FastAPI, Docker, Kafka or PostgreSQL, the check reads it and the lesson names it. Broad concepts with no library of their own, such as multithreading, are checked without documentation, and the lesson says so.

## Features

|                               |                                                                                                       |
| ----------------------------- | ----------------------------------------------------------------------------------------------------- |
| **Resume-Based Questions**    | Upload a PDF, DOCX or TXT, or paste the text. Questions are tied to your own projects and roles       |
| **Role and Job Targeting**    | 22 preset roles or any job title, with seniority, company and an optional job description             |
| **Four Difficulty Levels**    | Easy to Bar Raiser, changing the questions, follow-up depth and time target                           |
| **Interview Formats**         | Behavioural, technical, system design, HR screening or mixed, with three interviewer personas         |
| **Voice Interviewer**         | Questions are read aloud, with subtitles you can turn off                                             |
| **Mic and Camera**            | Device check, self-view, mic and camera toggles, and live captions in Chrome and Edge                 |
| **Adaptive Questions**        | Each question builds on your earlier answers, and new interviews avoid repeating past ones            |
| **Silence Detection**         | Silent recordings are caught before they reach the AI, so it only reacts to what you actually said    |
| **Editable Transcripts**      | Review and correct each transcript before sending, or type your answer instead                        |
| **Code Questions**            | A code box for questions that ask you to write code                                                   |
| **Scored Reports**            | Per-question and competency scores, written feedback and a stronger version of each answer            |
| **Measured Delivery**         | Pace, filler words and pauses, measured from your recordings and kept separate from your score        |
| **Answer Replay**             | Replay each recorded answer next to its feedback                                                      |
| **History and Export**        | Score trend over time, print to PDF, export as JSON, and delete all your data in one click            |
| **Resilient Sessions**        | Reloading resumes the interview, and a failed reply can be retried or passed                          |
| **Bring Your Own Key**        | Visitors can add their own free Groq key in Settings, which skips the site's hourly limit             |
| **Courses From Your Resume**  | Upload a resume, list topics, or both, and get a path of the skills an interview would test           |
| **Placement Quiz**            | One question per skill, with "I don't know" as an answer, so you skip what you already know           |
| **Lessons From Scratch**      | Each skill starts from the problem it solves, with a worked example set in your own projects          |
| **Fact-Checked Lessons**      | Each lesson and quiz is reviewed by a second AI pass, against official documentation where it exists  |
| **Explain It Back**           | A skill is ready only once you explain it yourself, and anything missed is taught again another way   |
| **Own Words Only**            | An explanation copied from the lesson is caught before grading, so a pass means you can say it        |
| **Spaced Review**             | Passed skills return after 1, 3, 7, 14 and 30 days                                                    |
| **Resume Audit**              | Shows each resume line an interviewer could press on and whether you can defend it so far             |
| **Interview Feedback Loop**   | A mock interview tests your shakiest skills first, and weak answers send those skills back for review |
| **Busy Service Handling**     | A lesson waits and retries by itself when Groq is briefly rate limited                                |

---

## Tech Stack

| Component          | Technology                                                 |
| ------------------ | ---------------------------------------------------------- |
| Framework          | Next.js 16 (App Router), React 19, TypeScript              |
| Interview LLM      | Groq - `openai/gpt-oss-120b` and `openai/gpt-oss-20b`      |
| LLM Fallback       | Gemini (optional), via its OpenAI-compatible API           |
| Speech to Text     | Groq Whisper - `whisper-large-v3-turbo`                    |
| Text to Speech     | Browser Web Speech API                                     |
| Live Captions      | Browser SpeechRecognition API                              |
| Recording          | MediaRecorder and Web Audio API                            |
| Camera Check       | MediaPipe Face Landmarker, running on the device           |
| Resume Parsing     | unpdf and mammoth                                          |
| Lesson Fact-Check  | Context7 documentation API, used without a key             |
| Schema Validation  | Zod                                                        |
| Storage            | IndexedDB in the browser, via idb-keyval                   |
| Testing            | Vitest and Playwright                                      |
| Hosting            | Vercel                                                     |

---

## Project Structure

```
Hotseat/
├── app/
│   ├── api/              # plan, turn, report, resume, transcribe, health, learn
│   ├── interview/        # The interview room
│   ├── learn/            # Courses, placement quiz and lessons
│   ├── report/[id]/      # Scored report
│   ├── setup/            # Resume, role, format and device check
│   ├── history/          # Past sessions and score trend
│   ├── settings/         # API key, voice, subtitles, privacy
│   └── page.tsx          # Landing page
├── components/           # Top bar, score curve, notices, resume input
├── hooks/                # Mic and camera, recording, camera check
├── lib/
│   ├── server/           # LLM providers, prompts, lesson fact-check, docs lookup, rate limit
│   ├── session.ts        # Interview state machine
│   ├── score.ts          # Report scoring
│   ├── learn.ts          # Course path, mastery, review dates, resume audit
│   ├── metrics.ts        # Pace, fillers, pauses, silence check
│   ├── speech.ts         # Voice, subtitles and live captions
│   └── storage.ts        # Browser storage
├── tests/
│   ├── unit/             # Vitest
│   └── e2e/              # Playwright, with a fake camera and mic and a silenced voice
└── .env.example
```

---

## Setup and Installation

### Prerequisites

- Node.js 20+
- A [Groq API key](https://console.groq.com/keys)

### 1. Clone the repository

```bash
git clone https://github.com/Shashank17singh/Hotseat.git
cd Hotseat
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set your Groq API key

```bash
cp .env.example .env.local
# then edit .env.local and add: GROQ_API_KEY=your_api_key_here
```

To try the interface without a key, set `LLM_PROVIDER=mock` in `.env.local` instead.

### 4. Start the app

```bash
npm run dev
```

Open <http://localhost:3000>, set up an interview and allow mic and camera access.

---

## Running the Tests

```bash
npm test                        # Unit tests
npx playwright install chromium # Once, for the browser tests
npm run build
npm run e2e                     # Browser tests with a fake camera and mic
```

Browser tests run on scripted AI replies, so they need no API key, and they never call the documentation service. The interviewer's voice is stubbed out in every test, so a test run makes no sound.

---

## Deployment

- **Live URL:** <https://hotseat-black-chi.vercel.app/>

To deploy your own copy for free, import this repository at [vercel.com/new](https://vercel.com/new) and add `GROQ_API_KEY` under Environment Variables. No database is needed, and the documentation lookup needs no key. Vercel's HTTPS matters here, because browsers only allow mic and camera access on HTTPS or localhost.

| Variable              | Required | Purpose                                                    |
| --------------------- | -------- | ---------------------------------------------------------- |
| `GROQ_API_KEY`        | Yes      | Runs the interview and speech-to-text                      |
| `GEMINI_API_KEY`      | No       | Chat fallback when Groq is rate limited                    |
| `RATE_LIMIT_PER_HOUR` | No       | Hourly requests per visitor on the shared key. Default 60  |

---

## Known Limitations

- Transcription and scoring are English only.
- The interviewer's voice comes from the browser, so it varies by device and can sound robotic.
- Speech-to-text has no fallback, so voice answers stop if Groq is rate limited. Typing still works.
- History and courses are stored per browser and do not sync between devices. Export reports you want to keep.
- The fact-check is the same AI model, and it only reads documentation for skills that match a trusted library. Mistakes are rarer but can still get through, and each lesson says so and links to searches for the official material.
- Only a skill's name is sent to Context7 to find documentation, never resume text. Its limits for keyless requests from a hosted server are untested, and if it fails, lessons are checked without documentation.
- Each lesson takes two AI calls, so a free Groq key can hit its per-minute limit after a few lessons in a row. The page waits and retries once by itself.
- Explain-back answers are typed, not spoken.
- Review dates are only shown when you open the app. There are no reminders.
- Automated tests use scripted AI replies. Lesson accuracy has been spot-checked by hand on a few real lessons, not measured.
- The rate limit is held in memory per server instance, so it slows casual abuse but is not a strict quota.
- The camera-facing figure estimates head direction, not eye contact, and is never scored.
- Vercel's free Hobby plan is for non-commercial use only.

---

## License

MIT. See [LICENSE](LICENSE).
