# MishpachaMap — Setup Checklist

V1 = Phase 1 Foundation (per [the plan](../.claude/plans/crystalline-petting-cocke.md)).

## 1. Accounts you need to create (~15 min)

### Supabase
1. Sign up at https://supabase.com → create a new project (region: `eu-central-1` is closest to Israel).
2. Once the project is provisioned, go to **Database → Extensions** and enable `postgis`.
3. Copy these from **Project Settings → API**:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` `public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` `secret` key → `SUPABASE_SERVICE_ROLE_KEY` (keep server-side only)

### Mapbox
1. Sign up at https://account.mapbox.com → create a public access token.
2. Default scopes are fine for V1.
3. Copy the token → `NEXT_PUBLIC_MAPBOX_TOKEN`.

### Vercel
1. Sign up at https://vercel.com → connect your GitHub account.
2. After you push this repo to GitHub, import it in Vercel.
3. Add the four env vars above in **Project → Settings → Environment Variables**.

### Anthropic API key — skip for V1
Phase 3 only.

## 2. Local env file

Copy `.env.local.example` to `.env.local` and fill in the values.

```bash
cp .env.local.example .env.local
```

## 3. Apply the database schema

Open the Supabase SQL editor and run the contents of `supabase/migrations/0001_init.sql` in one shot. This creates the tables, enables PostGIS indexes, and turns on RLS with public read.

## 4. Seed and ingest

In repo root:

```bash
npm run ingest:seed       # neighborhood polygons (the 7 from the handoff, hand-aligned to WGS84)
npm run ingest:osm        # POIs from OpenStreetMap Overpass API
npm run ingest:schools    # Education Ministry / Meitzav school data
npm run ingest:nadlan     # data.gov.il Nadlan transactions
npm run metrics:recompute # populates neighborhood_metrics
```

Each script is idempotent — safe to re-run. The ingest scripts read from `.env.local` and use the `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS.

## 5. Run the app

```bash
npm run dev
```

Open http://localhost:3000.

## 6. Deploy to Vercel

```bash
git push origin main
```

Vercel auto-deploys from `main`. Preview deploys on every branch. Ingest scripts run **locally** against your Supabase project — they are not Vercel functions.
