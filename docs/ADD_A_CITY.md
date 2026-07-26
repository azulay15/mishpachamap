# Adding a city

The whole data pipeline is city-parameterized (`--city <id>`), driven by two
registries: `scripts/ingest/cities.ts` (build config) and `lib/cities.ts` (app
config). Adding a city is a scaffold → research → build → QA loop.

## 1. Scaffold

```bash
npm run city:scaffold -- --semel 6900     # or:  --name "כפר סבא"
```

Confirms the CBS **semel** + name + population, counts the city's **2022
statistical areas** (authoritative), and drafts **anchor** candidates from OSM
`place` nodes — filtered to points inside the city's statistical areas (prunes
neighbors the bbox pulls in). Prints a ready-to-paste `CityConfig`.

> The stat-area **count is authoritative**; the **anchor list is a draft**. OSM
> is often incomplete (a 32-area city may surface only 3 clean nodes), so you
> must supplement it — see step 2.

## 2. Get the authoritative neighborhood list

OSM alone misses/duplicates neighborhoods. Cross-check Wikipedia + the municipal
site, or run a **neighborhood-research agent** (as done for Or Yehuda / Rishon
LeZion), to produce:

- the full **anchors** (id, name_he, name_en, lng, lat per neighborhood),
- the **`STAT_2022` → neighborhood crosswalk** → `statOverrides` for boundary
  areas the nearest-anchor rule misassigns; route industrial / non-residential
  areas to a discard id with **no matching anchor** so the builder drops them.

## 3. Add the config

- **`scripts/ingest/cities.ts`** — the `CityConfig` (anchors, statOverrides,
  output filenames, `moeCityName`, `gtfsCityName`) + register it in `CITIES`.
- **`lib/cities.ts`** — the app `City` (slug, name, center, zoom, `files`);
  start `status: "coming-soon"`.

## 4. Build the data

```bash
npm run city:build -- --city <id>
```

Runs, in dependency order: **polygons → demographics → transit → green/quiet →
schools → prices** (slow — Govmap) **→ safety**, with a pass/fail summary. Re-run
any single step with its own `ingest:*` / `polygons:build` script.

## 5. QA

```bash
npm run city:qa -- --city <id>
```

Per-layer coverage + a **"review these"** list (no-price / no-safety /
GreenScore-0 / thin / tiny-polygon) and a shippable/not verdict. Spot-check the
flagged bits with local knowledge.

## 6. Go live

Flip the city's `status` to `"live"` in `lib/cities.ts`, commit, deploy.

## What still needs a human/agent (per city)

- **`statOverrides`** (cities.ts) — boundary statistical areas.
- **`CROSSWALKS[city]`** (crime.ts) — police areas whose names don't auto-match,
  plus city-center / commercial exclusions. Safety also **suppresses implausible
  rates** (police area ⊋ census neighborhood → denominator too small).
- **prices / safety coverage is expected to be partial** — honest empty states
  ("אין נתונים") cover the gaps; the app never fabricates.
```
