# NagrikAI — नागरिक AI

**Know your benefits. Understand your eligibility. Never miss an opportunity.**

NagrikAI tells a family in Madhya Pradesh which government schemes each member qualifies for, why, which documents to collect and where to apply — in Hindi or English, with pictures and voice, so that a person who cannot read can still use it.

Theme: AI innovation for public services and citizen-centric governance
Team Tech Geeks · Vikrant University, Gwalior

> NagrikAI is a hackathon prototype. It is not a government website.

## The problem

Welfare schemes exist, but eligible families miss them: they do not know a scheme exists, cannot work out the eligibility rules, do not know which documents to prepare, and face language and literacy barriers.

## What NagrikAI does

**For the citizen**

- **Register once.** Enter the family's Samagra ID and the whole family is linked, or answer one picture question per screen. Details are never asked again.
- **Whole-family results.** Every member is checked against every scheme; family-level schemes are counted once.
- **Schemes by category**, each marked eligible, possibly eligible or not eligible, with the reason in plain language.
- **Ask anything.** Type or speak a question about any scheme and get an answer grounded in the scheme record.
- **Built for low literacy.** Large picture tiles, read-aloud on every screen, answers by voice, a big number keypad.
- **Documents and dates.** One merged document checklist for the family, a printable slip, and calendar reminders.
- **Benefit tracking.** Mark a scheme as applied, receiving or rejected; alerts appear on life events such as a child reaching school age.

**For the officer**

- **Saturation dashboard** by district: how many families are eligible for a scheme, how many receive it, and how many are left out.
- **CSV export** without names, for follow-up camps.

## How it works — rules decide, AI explains

1. **Knowledge base** — 76 schemes available in Madhya Pradesh (23 state, 53 central), each stored as structured rules with documents, official source link and helpline.
2. **Eligibility engine** — deterministic rules give `eligible`, `possible` or `ineligible` with reasons for every member. No AI is involved in this decision, so the result is auditable and repeatable.
3. **Language model (optional)** — Google Gemini understands free-form Hindi or English, picks the relevant schemes and rephrases the engine's answer. It is given only the facts from the engine and the scheme record.
4. **Fallback** — without an API key, or if the model is unavailable, the app keeps working on rules and templates.

## Run it

Needs Node.js 22.5 or newer.

```bash
git clone https://github.com/Alok-sharma-001/NagrikAI.git
cd NagrikAI
./start.sh
```

The script installs dependencies, picks a free port and opens the app. Use `./start.sh prod` for a production build.

To turn on AI mode, copy `nagrikai/.env.example` to `nagrikai/.env.local` and set `GEMINI_API_KEY`.

## Try the demo

| What | How |
|---|---|
| Register with Samagra ID | Use a demo family: `31245678`, `42876501`, `50917342` or `27654019`. The OTP is shown on screen. |
| Register without an ID | Choose the picture questions on `/register`. |
| Check without registering | Open `/chat` and describe yourself. |
| Officer dashboard | Open `/officer`, access code `181181`, then load the demo families. |

## Prototype scope

- The Samagra registry, its OTP and the officer dashboard's demo families are simulated with fictional data. Connecting the real registry needs departmental approval.
- Scheme records are compiled from official scheme pages and each carries its source link. Final eligibility is always decided by the government office.
- The app never asks for Aadhaar or bank account numbers.

## Tech stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · SQLite (built into Node) · Google Gemini API · Web Speech API · Vitest

## Repository layout

| Path | Contents |
|---|---|
| `nagrikai/app` | Pages and API routes |
| `nagrikai/components` | Interface components |
| `nagrikai/lib` | Eligibility engine, family model, assistant, voice, database |
| `nagrikai/data` | Scheme knowledge base, documents, how-to guides, demo families |
| `nagrikai/tests` | Automated tests |
| `start.sh` | One-command launcher |
