# AI Research LMS

A small Learning Management System built to support a research study on how students
use an integrated AI assistant while completing quizzes — including coding-quiz questions
(code snippets with multiple-choice answers, e.g. "what does this print?") in Python, C#, or Java.

## What it does

- **Student registration & login** — email/password, bcrypt-hashed, with an explicit
  research-consent checkbox at registration (required — see `Ethics` below).
- **Admin login**, separate role, gated by an invite code (`ADMIN_INVITE_CODE` in `.env`),
  with a dashboard of logs and CSV export.
- **Quizzes** — multiple-choice, auto-graded. Questions and answer options support fenced
  code blocks (\`\`\`code\`\`\`) and inline code spans (\`code\`) so you can write coding-quiz
  questions with properly formatted, readable code snippets, without needing to execute
  any student-submitted code.
- **Integrated AI assistant** — a chat panel next to every quiz. Works with Anthropic,
  Azure/Foundry (Claude or GPT models), or OpenAI directly, set via `.env`
  (`AI_PROVIDER=anthropic|azure|azure-openai|openai`). Every message, in both
  directions, is logged with the student, task, timestamp and length.
- **Usage logging for the study** — the admin dashboard shows, per student: how many AI
  messages they sent, how many quiz attempts involved AI use vs. didn't, and when
  they last used it. Raw logs and three CSV exports (AI interactions, activity/focus-loss
  log, quiz attempts) are available for import into R/SPSS/Excel.
- **Focus-loss / "did they leave the tab" signals** — see the important caveat below.

## Important caveat: this cannot actually block other windows

No browser-based app can prevent someone from opening another tab, a phone, or a second
device — a request to "not allow" that isn't something any web app can genuinely enforce,
so this project doesn't pretend to. Instead it **detects and logs** every time a student's
tab loses focus, is hidden, exits fullscreen, or has a paste event, with timestamps, via
`public/js/proctoring.js` → `POST /api/activity`. That's arguably more useful for a
research study anyway: "how often did this student appear to look elsewhere" is itself
a data point about AI-avoidance/help-seeking behaviour, and it's queryable from the
`activity_logs` table / the "Activity / focus-loss log" CSV export.

If you need stronger lockdown (no way to switch apps, no way to open a browser tab at
all), that requires a native "locked" exam-mode client (e.g. Safe Exam Browser) running
on managed devices — that's outside what a website can do, and is a separate tool you'd
run alongside this one, not something to fake here.

## Setup

```bash
cd ai-research-lms
npm install
cp .env.example .env        # Windows: copy .env.example .env
# edit .env: set JWT_SECRET, ADMIN_INVITE_CODE, and your AI_PROVIDER + credentials
npm run seed        # creates the first admin account + a sample quiz (with a coding-quiz example)
npm start
```

Visit `http://localhost:3000`. Log in with the admin account printed by `npm run seed`
(default `admin@example.com` / `ChangeMe123!` unless you set `ADMIN_EMAIL` /
`ADMIN_PASSWORD` env vars when seeding) — **change that password immediately** if this
is a real deployment.

Students register themselves at `/#/register` (consent required). Admins register at
`/#/register-admin` using the `ADMIN_INVITE_CODE` from `.env` — keep that code private,
share it only with people who should have admin/log access.

## Configuring the AI assistant

Set in `.env`:
```
AI_PROVIDER=anthropic        # or "azure", "azure-openai", or "openai"
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6
# or, to bill Claude usage through Azure credit instead of a separate Anthropic bill:
AI_PROVIDER=azure
AZURE_AI_ENDPOINT=https://<resource>.services.ai.azure.com/anthropic/v1/messages
AZURE_AI_API_KEY=...
AZURE_AI_MODEL=claude-haiku-4-5
# or, for a GPT model deployed via Foundry (newer unified v1 endpoint):
AI_PROVIDER=azure-openai
AZURE_OPENAI_ENDPOINT=https://<resource>.services.ai.azure.com/openai/v1
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_DEPLOYMENT=gpt-5.4-nano
# or, calling OpenAI directly:
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```
The system prompt (`routes/ai.js` → `SYSTEM_PROMPT`) explicitly tells the model this is
a study where AI use is intentionally allowed and being measured, not something to
discourage — edit that prompt if you want the assistant to behave differently.

**Using Azure / Microsoft Foundry (Claude):** Claude models deployed through Microsoft
Foundry expose the same Messages API shape as Anthropic's own API, just at an Azure
endpoint with Azure-style `api-key` auth, so usage bills through your normal Azure
invoice / consumption credit. To set it up: in the Azure Portal, create or open a
Foundry resource, deploy a Claude model (Haiku 4.5 is the cheapest and plenty capable
for a tutoring-style assistant), then copy the **Target URI** and **key** shown on that
deployment's page into `AZURE_AI_ENDPOINT` and `AZURE_AI_API_KEY`, and put the
deployment/model name in `AZURE_AI_MODEL`. Only set `AZURE_AI_API_VERSION` if your
specific resource requires an `api-version` query parameter — leave it blank otherwise.
Note: Claude on Foundry currently only deploys in **East US 2** or **Sweden Central**.

**Using Azure / Microsoft Foundry (GPT / Azure OpenAI):** if you deploy a GPT model
(e.g. `gpt-5.4-nano`) via Foundry instead, use `AI_PROVIDER=azure-openai` — this uses
Foundry's newer unified `/openai/v1` endpoint, which mirrors OpenAI's own API shape
directly (Bearer auth, no `api-version` query param, model name goes in the request
body rather than the URL). On your deployment's page in the Foundry portal, copy the
**Project endpoint** shown there and append `/openai/v1` to it for
`AZURE_OPENAI_ENDPOINT` (e.g. `https://my-lms-ai.services.ai.azure.com/openai/v1`),
copy the **API Key** into `AZURE_OPENAI_API_KEY`, and set `AZURE_OPENAI_DEPLOYMENT` to
the deployment name shown (e.g. `gpt-5.4-nano`). Note some models in this family require
`max_completion_tokens` rather than `max_tokens` — the code already sends the correct
parameter, but if you see a `400 unsupported_parameter` error after changing models,
that's the family of issue to check for.

## Writing coding-quiz questions

Quiz question text and answer options support Markdown-style code formatting:

- Wrap a snippet in triple backticks for a formatted, monospaced code block:
  ````
  What does this print?

  ```python
  x = 3
  print(x * 2)
  ```
  ````
- Use single backticks for a short inline snippet within a sentence, e.g.
  `` What does `x + 1` evaluate to if x = 4? ``

This lets you write coding-comprehension questions (predict the output, spot the bug,
pick the correct fix) without needing to actually execute any student-submitted code —
no sandbox, no external code-execution service, no infrastructure to maintain. The
trade-off worth knowing: this tests reading/predicting code, not writing and debugging
it, which is a different skill than an actual "write code that passes these tests" task
would measure — worth thinking through against what your research question actually
needs.

## Deployment

This is a standard Node.js + SQLite app, deployable to any Node host (Render, Railway,
Fly.io, a university VM, etc.):
1. Set all `.env` values as environment variables on the host (never commit `.env`).
2. Make sure the `data/` directory is on **persistent** storage — some platforms wipe
   the filesystem on redeploy, which would delete the SQLite database and all logs.
   For serious multi-week studies, consider swapping `better-sqlite3` for a managed
   Postgres instance instead (the SQL is close to standard; `db/schema.sql` would need
   adapting).
3. Put it behind HTTPS (most platforms do this for you) — the session cookie is marked
   `secure` when `NODE_ENV=production`, so it won't be sent over plain HTTP.
4. Back up `data/lms.db` regularly — it's the entire dataset for your study.

## Security note: never share your .env or API keys

Treat every key/secret in `.env` (JWT_SECRET, ADMIN_INVITE_CODE, and every API key)
like a password. If one is ever pasted into a screenshot, chat, or committed to a public
repo, rotate/regenerate it immediately in the relevant provider's dashboard — assume it's
compromised the moment it's been visible anywhere outside your own machine.

## Ethics / data handling notes (for you, not built into the code)

This app collects fairly sensitive data about individual students' AI usage and focus
behaviour. Before running a real study you'll likely need: institutional ethics/IRB
approval, a clear consent process (a placeholder is included at registration — replace
the text in `public/js/views.js` → `Views.register` with your approved consent wording),
a data retention/deletion plan, and a way for students to withdraw. None of that is a
coding problem this app can solve for you — worth checking with your supervisor/ethics
board before deployment.

## Project structure

```
server.js            Express app entry point
db/schema.sql         SQLite schema
db/seed.js             Creates first admin + sample content
routes/auth.js         Register/login/logout
routes/quizzes.js      Quiz CRUD + attempt/submit
routes/ai.js            AI chat proxy + logging
routes/activity.js     Focus-loss/proctoring event logging
routes/admin.js         Stats, raw log browsing, CSV export
public/                 Frontend (vanilla JS, no build step)
```
