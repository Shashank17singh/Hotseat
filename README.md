# Hotseat

A spoken AI mock interview. Upload a resume, pick a role and difficulty, and answer out loud to an interviewer that asks follow-ups. You get a scored report with feedback on every answer.

## Features

### Setup

- Resume upload (PDF, DOCX, TXT) or pasted text, read into a structured profile
- 22 preset roles, or any job title, with seniority, company and job description
- Four difficulty levels that change the questions, follow-up depth and time target
- Five interview types, three interviewer personas, and 3, 5 or 8 questions
- Mic, camera and speaker check

### The interview

- The interviewer reads questions aloud
- Answers are recorded and transcribed, with an editable transcript before sending
- Live captions in Chrome and Edge
- Self-view camera, plus mic and camera toggles
- Adaptive follow-ups, capped by difficulty
- A code editor for coding questions
- Typing as an alternative to speaking, hints, skip, and ending early
- Reloading the page resumes the interview
- Space starts and stops an answer

### The report

- Per-question scores, a score curve, and competency ratings with evidence
- Written feedback and a stronger version of each answer
- Measured delivery: pace, filler words and pauses, kept separate from the score
- Replay of each recorded answer
- Print to PDF, and export as JSON
- History with a score trend

### Privacy

- Video never leaves the browser
- There are no accounts or database: sessions live in the browser's IndexedDB
- One action deletes everything

## Stack

Next.js 16 and TypeScript. Groq runs the interview model and Whisper transcription, with Gemini as an optional chat fallback. The interviewer's voice uses the browser's built-in speech. MediaPipe runs the optional camera check on the device.

## Run it locally

Requires Node 20 or later.

```bash
npm install
cp .env.example .env.local   # then add GROQ_API_KEY
npm run dev
```

Open <http://localhost:3000>. To try the interface without a key, set `LLM_PROVIDER=mock` in `.env.local`.

## Deploy for free

The recommended setup is Vercel Hobby with a free Groq key. No database is needed.

1. Get a key at [console.groq.com/keys](https://console.groq.com/keys).
2. Push this folder to a GitHub repository.
3. Import the repository at [vercel.com/new](https://vercel.com/new). It detects Next.js.
4. Add `GROQ_API_KEY` under Environment Variables, then deploy.

Vercel's HTTPS matters here: browsers only allow microphone and camera access on HTTPS or localhost.

Limits to know:

| Service | Limit | Effect |
| --- | --- | --- |
| Vercel Hobby | Non-commercial use only | Move to a paid plan or another host if you charge for this |
| Vercel Hobby | 4.5 MB request body | Audio is compressed to fit about 20 minutes per answer. Video is never uploaded |
| Vercel Hobby | Usage over the free allowance can pause a feature for up to 30 days | Watch usage if traffic grows |
| Groq free plan | Per-model rate limits, shown under Settings, Limits in your Groq console | Busy periods return a clear rate-limit message. Add `GEMINI_API_KEY` as a chat fallback |

To protect the shared key, each visitor gets `RATE_LIMIT_PER_HOUR` requests. This limit is held in memory per server instance, so it slows casual abuse but is not a strict quota. Visitors can bring their own free key in Settings, which skips the limit. Free plans have no card attached, so the worst case is hitting a limit, not a bill.

## Tests

```bash
npm test                # unit tests
npm run build
npm run e2e             # browser tests with a fake camera and microphone
```

Browser tests run against scripted AI replies, so they need no key. Run `npx playwright install chromium` once first.

## Known limits

- Browser voices vary by device, and some sound robotic.
- Transcription and scoring are English only.
- The camera-facing figure estimates head direction, not eye contact, and is never scored.
- History does not sync between devices.
- A browser's IndexedDB can be cleared by the user or by storage pressure, so export reports you want to keep.
