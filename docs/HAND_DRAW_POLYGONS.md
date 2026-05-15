# Drawing real neighborhood polygons (GeoJSON.io workflow)

The 13 Modi'in neighborhoods currently render as ~300m rectangles centered on
their OSM-published centroids. Accurate enough for V1 demo; you'll want real
shapes before going public. This is the 5-minute hand-draw path.

## TL;DR

1. Open [geojson.io](https://geojson.io)
2. Paste the contents of `public/neighborhoods.geo.json` into the right-side editor
3. For each of the 13 polygons that appear on the map, drag its vertices to match the real neighborhood boundary
4. Save → "Save → GeoJSON" → download the file
5. Replace `public/neighborhoods.geo.json` with the downloaded file
6. `npm run polygons:validate` to verify the format
7. `npm run ingest:seed` to sync to Supabase
8. Hard refresh — done

## Why GeoJSON.io and not CBS / Overpass

- **OSM** has the neighborhood **centroids** but **no polygons** (we verified — 13 nodes returned, zero ways/relations). 
- **CBS 2008** has statistical area polygons but they're 17+ years old — the newer neighborhoods (Hatsiporim, modern Avnei Chen post-Kaiser rename) won't exist there.
- **Ministry of Construction** has only "rehabilitation/renewal" zones, not regular neighborhood boundaries.

GeoJSON.io is the canonical "do it once, manually, get it right" workflow for small datasets.

## The canonical 13 IDs

You **must** keep these IDs intact in `properties.id`. They're the DB join key — renaming an ID requires a migration.

| id | Hebrew | Aliases (search) |
|---|---|---|
| `hareut` | הרעות | רעות, Re'ut, Reut |
| `hamakkabim` | המכבים | מכבים, Maccabim |
| `masuah` | משואה | גבעת C, Givat C |
| `avneichen` | אבני חן | קייזר, Kaiser |
| `nofim` | נופים | — |
| `haprachim` | הפרחים | מירומי, Miromi |
| `hanechalim` | הנחלים | ספדיה, Safdie |
| `hakramim` | הכרמים | כרמים, Kramim |
| `hashvatim` | השבטים | בוכמן צפון, Buchman North |
| `moriah` | מוריה | בוכמן דרום, Buchman South |
| `hanevim` | הנביאים | שמשוני צפון, Shimshoni North |
| `hameginim` | המגינים | שמשוני דרום, Shimshoni South |
| `hatsiporim` | הציפורים | ציפורים, Tsiporim |

## File format

Output of GeoJSON.io is already in the right shape. Each Feature needs:

```json
{
  "type": "Feature",
  "properties": {
    "id": "hashvatim",
    "name_he": "השבטים",
    "name_en": "HaShvatim"
  },
  "geometry": {
    "type": "Polygon",
    "coordinates": [[[lng, lat], [lng, lat], ..., [lng, lat]]]
  }
}
```

- `id` is required (DB join key).
- `name_he` and `name_en` are also required for the seed step.
- Polygon coordinates must be `[lng, lat]` order (GeoJSON spec) and the ring must be closed (first point === last point). GeoJSON.io handles this automatically.
- If you accidentally get a `MultiPolygon`, just split it into separate `Polygon` features or merge to one.

## Validation

```bash
npm run polygons:validate
```

Checks:
- File parses as a FeatureCollection
- All 13 canonical IDs are present (no missing, no extras)
- Every feature is a `Polygon` with at least 4 points and a closed ring
- All vertices fall inside the Modi'in bbox (`34.93°–35.08° lng`, `31.84°–31.95° lat`)

Fails loudly on the first issue with a clear message.

## After dropping in the file

```bash
npm run polygons:validate   # sanity check format
npm run ingest:seed         # push to Supabase so PostGIS queries use them too
```

Then **hard refresh** the dev page. No code or migration changes — the architecture is set up so the static file is the source of truth.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Map shows white area, no polygons | File parse error. Run `npm run polygons:validate` to see what failed. |
| "Missing IDs" error | Make sure every feature's `properties.id` matches one of the 13 listed above. |
| Point outside bbox | A vertex is way off (mis-clicked when drawing). Open the file, find the offending coordinate, fix in GeoJSON.io. |
| Polygons render but in wrong places after a refresh | Did you run `npm run ingest:seed`? The DB is what `app/page.tsx` queries for metadata; geometry comes from the file but you need both in sync. |
