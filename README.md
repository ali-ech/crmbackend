# CRM Backend

Express + MongoDB API for the brokerage CRM.

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## Deploy (Vercel)

This project uses a serverless entry at `api/index.js`. Set all variables from `.env.example` in the Vercel project settings.

After deploying the frontend, set:

- `FRONTEND_URL` — frontend production URL
- `PUBLIC_SITE_URL` — same as frontend URL (used in emails/links)

## Seed

```bash
npm run seed        # superadmin only
npm run seed:demo   # demo data
```
