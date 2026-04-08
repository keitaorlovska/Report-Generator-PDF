# Linq Advisors — Daily Intelligence Reporting Tool

A Next.js web application that automatically scrapes news, generates AI-powered intelligence briefings, exports them as PDFs, and emails them daily.

## Live URL

[https://report-generator-pdf-git-main-keitaorlovska-2175s-projects.vercel.app/](https://report-generator-pdf-git-main-keitaorlovska-2175s-projects.vercel.app/)

---

## What it does

- Fetches latest news articles for selected companies using Perplexity AI
- Generates structured intelligence reports using Claude (Anthropic)
- Exports reports as formatted PDFs (Morning Brief + Full Intelligence Report)
- Sends both PDFs automatically every weekday morning at 8am via email
- Allows manual generation and export at any time via the web interface

---

## Tech Stack

- **Framework:** Next.js 14 (App Router)
- **Hosting:** Vercel
- **AI:** Anthropic Claude (report generation), Perplexity AI (news scraping)
- **Email:** Resend
- **Database:** Upstash Redis (company list storage)
- **PDF:** pdfkit, pdf-lib

---

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/your-org/report-generator-pdf.git
cd report-generator-pdf
npm install
```

### 2. Set up environment variables

Create a `.env.local` file in the root of the project:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
RESEND_API_KEY=your_resend_api_key
BRIEFING_FROM=briefing@linqadvisors.com
BRIEFING_RECIPIENTS=recipient@linqadvisors.com
UPSTASH_REDIS_REST_URL=your_upstash_redis_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_redis_token
PERPLEXITY_API_KEY=your_perplexity_api_key
CRON_SECRET=any_random_secret_string
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Deployment (Vercel)

1. Push the repository to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add all environment variables listed above in Vercel → Settings → Environment Variables
4. Set `NEXT_PUBLIC_BASE_URL` to your Vercel deployment URL
5. Deploy

> **Note:** The automated 8am cron job requires a Vercel Pro plan ($20/month). On the free plan everything else works — only the automation is disabled.

---

## Automated Daily Emails

The tool is configured to automatically run every weekday at 8am Oslo time (7am UTC). It:

1. Fetches all companies from the database
2. Generates intelligence reports for each
3. Emails both PDFs to all configured recipients

To test the automation manually, visit:
```
https://your-app-url.vercel.app/api/cron/daily-briefing
```

To change the schedule, edit `vercel.json`:
```json
"schedule": "0 7 * * 1-5"
```

---

## Environment Variables Reference

| Variable | Description | Where to get it |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude AI API key | [console.anthropic.com](https://console.anthropic.com) |
| `RESEND_API_KEY` | Email sending API key | [resend.com](https://resend.com) |
| `BRIEFING_FROM` | Sender email address | Must be from a verified Resend domain |
| `BRIEFING_RECIPIENTS` | Comma-separated recipient emails | Set manually |
| `UPSTASH_REDIS_REST_URL` | Redis database URL | [upstash.com](https://upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Redis auth token | [upstash.com](https://upstash.com) |
| `PERPLEXITY_API_KEY` | News scraping API key | [perplexity.ai](https://perplexity.ai) |
| `CRON_SECRET` | Secures the cron endpoint | Any random string |
| `NEXT_PUBLIC_BASE_URL` | App base URL | Your Vercel deployment URL |

---

## Project Structure

```
├── app/
│   ├── actions/
│   │   ├── generate-motions.ts       # Legacy report generation
│   │   └── generate-report.ts        # Main AI report generation
│   └── api/
│       ├── companies/                # Company CRUD endpoints
│       ├── export/pdf/               # PDF export endpoints
│       ├── scrape-news/              # News scraping endpoint
│       ├── send-briefing/            # Email sending endpoint
│       └── cron/daily-briefing/      # Automated 8am cron job
├── components/
│   └── MotionGeneratorForm.tsx       # Main UI component
├── data/
│   └── companies.ts                  # Company type definitions
├── vercel.json                        # Vercel config + cron schedule
└── .env.local                         # Local environment variables (not committed)
```

---

## Domain Setup

To send emails from `@linqadvisors.com`, the following DNS records must be added to the domain in Domeneshop (managed by Proccano):

| Type | Name | Content | Priority |
|---|---|---|---|
| TXT | `resend._domainkey` | `p=MIGfMA0GCSqG...` | - |
| MX | `send` | `feedback-smtp.eu-west-1.amazonses.com` | 10 |
| TXT | `send` | `v=spf1 include:amazonses.com ~all` | - |
| TXT | `_dmarc` | `v=DMARC1; p=none;` | - |

---

*Developed by Keita — Intern, Linq Advisors — 2026*