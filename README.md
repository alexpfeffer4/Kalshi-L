# Kalshi L Notifier

Track lawsuits, legal losses, regulatory heat, and bad press around Kalshi.

## What hosts where

- GitHub stores the code.
- Vercel runs the app.
- Supabase stores events and ingestion runs.
- CourtListener provides court data.
- News RSS provides bad-press and media signals.

## Deploy setup

1. Create a GitHub repo and push this project.
2. Import the GitHub repo into Vercel.
3. Add the environment variables from `.env.example` in Vercel.
4. Run the Supabase schema in the SQL editor once.
5. Deploy.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `COURTLISTENER_API_TOKEN`
- `COURTLISTENER_QUERY`
- `NEWS_RSS_QUERY`
- `ADMIN_PASSWORD`
- `CRON_SECRET` optional, if you want to lock the ingest cron endpoint

## Ingest automation

The app already includes a Vercel cron entry in `vercel.json` that hits:

- `/api/ingest/all`

That route runs both the court and news ingest flows.

## Local run

```bash
npm install
npm run dev
```

## Notes

- Public users see only confirmed items.
- Admin users can review queue items, edit writeups, and run ingest manually.
- Alerts are currently disabled by design.
