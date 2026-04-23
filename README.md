# Linq Advisors — Intelligence Report

An AI-powered daily briefing tool that monitors news coverage for clients and prospects, generates executive intelligence reports, and delivers them by email every weekday morning.

---

## What It Does

- Monitors a configurable list of companies (clients & prospects) for news coverage
- Fetches articles in real time using Perplexity AI
- Generates structured, executive-ready intelligence briefings per company
- Exports reports as PDF — individual company reports or a combined morning brief
- Sends briefings automatically every weekday at 8am Oslo time
- Fully manageable via the web interface — no code required for day-to-day use

---

## Using the App

### Managing Companies
Click **Entities** in the top navigation bar to open the company manager.

- **Add** a new company using the Add entity button
- **Edit** any company to update its details or classification
- **Delete** companies that are no longer relevant
- **Drag** to reorder the list

When adding a company, fill in:

| Field | Description |
|---|---|
| Name | Company display name |
| Country | Two-letter country code (e.g. GB, NO, US) |
| Industry | Sector (e.g. Technology, Banking, Energy) |
| Type | Client or Prospect |
| Search Query Override | Use this when the company name is ambiguous — e.g. set `bgts.com IT services London` instead of just `BGTS` to avoid fetching unrelated news |
| Tags | Optional keywords for filtering |

### Running a Daily Report
1. Select the companies you want to include (all are selected by default)
2. Click **Fetch latest articles** — this searches for recent news per company
3. Once complete, click **Generate Daily Report**
4. Briefings appear below, one card per company

### Exporting
- **PDF button** on any company card — exports that company's report
- **Export all** — combined PDF covering all completed reports
- **Morning Brief** — concise single-page summary PDF

### Sending the Briefing
Click **Send Briefing** to email the full intelligence report to all configured recipients.

---

## Automated Daily Emails

The app is configured to run automatically every weekday at **9am Oslo time**. It fetches news, generates reports, and emails the briefing without any manual action required.

> The automated schedule requires a Vercel Pro plan. On the free plan, everything works manually — only the automation is disabled.

To trigger it manually, visit:
```
https://vercel.com/linqs-projects/inteligence-report
```

To change the schedule, edit `vercel.json`:
```json
"schedule": "0 7 * * 1-5"
```

---

## Deployment

The app is hosted on Vercel and connected to GitHub. Any push to the `main` branch automatically triggers a new deployment.

```bash
git add .
git commit -m "your message"
git push origin main
```

**Repository:** github.com/Linqadv/inteligence-report  
**Hosting:** Vercel — Linqadv account

---

## Environment Variables

All secrets are stored in **Vercel → Project → Settings → Environment Variables**. Never commit them to GitHub.

| Variable | Description |
|---|---|
| `PERPLEXITY_API_KEY` | News fetching and report generation |
| `RESEND_API_KEY` | Email delivery |
| `BRIEFING_FROM` | Sender email (must be from verified domain) |
| `BRIEFING_RECIPIENTS` | Comma-separated list of recipient emails |
| `ANTHROPIC_API_KEY` | Claude AI (used in legacy features) |
| `CRON_SECRET` | Secures the automated cron endpoint |
| `NEXT_PUBLIC_BASE_URL` | Full URL of the deployed app |

---

## Local Development

```bash
git clone https://github.com/Linqadv/inteligence-report.git
cd inteligence-report
npm install
```

Create a `.env.local` file in the project root with all the variables listed above, then:

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Wrong news being fetched for a company | Edit the company → add a Search Query Override |
| "No meaningful coverage found" | Normal for low-profile companies — no action needed |
| Emails not sending | Check `RESEND_API_KEY` and `BRIEFING_FROM` in Vercel env variables |
| Build failing on Vercel | Check the build logs — usually a missing environment variable |
| Cron job not running | Requires Vercel Pro plan |

---

## Project Structure

```
app/
  actions/
    generate-report.ts        — AI report generation
  api/
    companies/                — Company list CRUD
    scrape-news/              — Article fetching via Perplexity
    send-briefing/            — Email delivery via Resend
    export/                   — PDF generation
    cron/daily-briefing/      — Automated morning run
components/
  MotionGeneratorForm.tsx     — Main UI
data/
  companies.json              — Company list (editable via UI or directly)
  companies.ts                — Company type definitions
vercel.json                   — Hosting config and cron schedule
```

---

## Tech Stack

| | |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| AI | Perplexity AI (Sonar) |
| Email | Resend |
| PDF | pdfkit, pdf-lib |
| Hosting | Vercel |

---

*Built by Keita — Linq Advisors — 2026*
