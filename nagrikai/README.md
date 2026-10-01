# NagrikAI — application

The Next.js application. For what the project is and how to try it, see the [main README](../README.md).

## Commands

```bash
npm install
npm run dev          # development server on http://localhost:3000
npm run build        # production build
npm start            # serve the production build
npm test             # automated tests
npm run lint
npm run kb:check     # validate the scheme knowledge base
```

Needs Node.js 22.5 or newer (uses the built-in `node:sqlite`).

## Configuration

Copy `.env.example` to `.env.local`. Every variable is optional.

| Variable | Purpose |
|---|---|
| `GEMINI_API_KEY` | Turns on AI mode: free-form understanding, natural replies, and voice input in every browser |
| `NAGRIK_LLM=off` | Forces rules mode even when a key is set |
| `NAGRIK_OFFICER_CODE` | Officer dashboard access code (demo code `181181` when unset) |

Without a key the app runs in rules mode, and voice input uses the browser's own recognition (Chrome or Edge). The microphone needs `localhost` or `https`.

## Structure

| Path | Contents |
|---|---|
| `app/` | Pages (`/`, `/schemes`, `/register`, `/home`, `/family`, `/scheme/[id]`, `/slip`, `/officer`, `/chat`) and API routes under `app/api/` |
| `components/` | Site shell, question wizard, ask sheet, results |
| `lib/eligibility.ts` | Three-valued rules engine |
| `lib/family.ts` | Household and member model, family-level totals |
| `lib/assistant.ts` | Question handling for "Ask" |
| `lib/llm.ts`, `lib/gemini.ts` | Language-model calls, grounded on engine output |
| `lib/voice.ts` | Speech input and read-aloud |
| `lib/server/` | SQLite storage, sessions, Samagra simulation, rate limiting |
| `data/schemes/` | Scheme knowledge base (JSON) |
| `data/demo/` | Fictional Samagra families for the demo |
| `tests/` | Engine, family, assistant, search, API and officer tests |

Registered families are stored in `data/runtime/nagrik.db`, which is git-ignored.
