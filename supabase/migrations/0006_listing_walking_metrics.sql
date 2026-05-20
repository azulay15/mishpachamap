-- Per-listing walking accessibility, computed via Mapbox Isochrone API.
-- Cached so repeat opens are instant. Cache rows are upserted by the
-- /api/listing-walking-metrics route via the service-role key.

create table listing_walking_metrics (
  listing_id    text primary key references listings(id) on delete cascade,
  -- Isochrone polygons (5/10/15-min walk from the listing point). Stored as
  -- geography so we can reuse them later for a "walking-radius" map layer.
  iso_5_min     geography(polygon, 4326),
  iso_10_min    geography(polygon, 4326),
  iso_15_min    geography(polygon, 4326),
  -- POI counts per ring per type. Shape:
  -- { "5": { "preschool": 3, "park": 2 }, "10": {...}, "15": {...} }
  pois_within   jsonb not null default '{}'::jsonb,
  -- Nearest POI of each type, straight-line distance in meters. Shape:
  -- { "preschool": { "id": "...", "name_he": "...", "meters": 320 }, ... }
  nearest_pois  jsonb not null default '{}'::jsonb,
  computed_at   timestamptz not null default now()
);

create index listing_walking_metrics_iso_15_gix on listing_walking_metrics using gist (iso_15_min);

alter table listing_walking_metrics enable row level security;
create policy "public read" on listing_walking_metrics for select using (true);

-- Client-friendly view: omits the bulky geography columns.
create or replace view listing_walking_metrics_json as
  select listing_id, pois_within, nearest_pois, computed_at
  from listing_walking_metrics;

grant select on listing_walking_metrics_json to anon, authenticated, service_role;

-- ============================================================================
-- Spatial helpers
-- ============================================================================

-- Count POIs inside a polygon, grouped by `pois.type`. Returns `{ type: n }`.
create or replace function count_pois_in_polygon(poly geography)
returns jsonb
language sql
stable
as $$
  select coalesce(jsonb_object_agg(t.type, t.n), '{}'::jsonb)
  from (
    select p.type, count(*)::int as n
    from pois p
    where st_within(p.point::geometry, poly::geometry)
    group by p.type
  ) t;
$$;

grant execute on function count_pois_in_polygon(geography) to anon, authenticated, service_role;

-- Nearest POI of each type within `max_meters` straight-line distance.
-- Returns `{ type: { id, name_he, meters } }`.
create or replace function nearest_poi_by_type(origin geography, max_meters int default 5000)
returns jsonb
language sql
stable
as $$
  select coalesce(
    jsonb_object_agg(
      t.type,
      jsonb_build_object('id', t.id, 'name_he', t.name_he, 'meters', t.meters)
    ),
    '{}'::jsonb
  )
  from (
    select distinct on (p.type)
      p.type, p.id, p.name_he,
      st_distance(p.point, origin)::int as meters
    from pois p
    where st_dwithin(p.point, origin, max_meters)
    order by p.type, p.point <-> origin
  ) t;
$$;

grant execute on function nearest_poi_by_type(geography, int) to anon, authenticated, service_role;

-- ============================================================================
-- Upsert helper: API route calls this after fetching isochrones from Mapbox.
-- Takes GeoJSON polygon strings (so the route doesn't need to convert to WKT)
-- and a lat/lng for the nearest-POI lookup. Computes counts + nearest in-DB
-- and writes the cache row atomically.
-- ============================================================================

create or replace function upsert_listing_walking_metrics(
  p_listing_id  text,
  p_iso_5       text,
  p_iso_10      text,
  p_iso_15      text,
  p_lng         double precision,
  p_lat         double precision
)
returns void
language plpgsql
as $$
declare
  poly5    geography;
  poly10   geography;
  poly15   geography;
  origin   geography;
begin
  poly5  := st_setsrid(st_geomfromgeojson(p_iso_5),  4326)::geography;
  poly10 := st_setsrid(st_geomfromgeojson(p_iso_10), 4326)::geography;
  poly15 := st_setsrid(st_geomfromgeojson(p_iso_15), 4326)::geography;
  origin := st_setsrid(st_makepoint(p_lng, p_lat),   4326)::geography;

  insert into listing_walking_metrics (
    listing_id, iso_5_min, iso_10_min, iso_15_min,
    pois_within, nearest_pois, computed_at
  ) values (
    p_listing_id, poly5, poly10, poly15,
    jsonb_build_object(
      '5',  count_pois_in_polygon(poly5),
      '10', count_pois_in_polygon(poly10),
      '15', count_pois_in_polygon(poly15)
    ),
    nearest_poi_by_type(origin, 5000),
    now()
  )
  on conflict (listing_id) do update set
    iso_5_min    = excluded.iso_5_min,
    iso_10_min   = excluded.iso_10_min,
    iso_15_min   = excluded.iso_15_min,
    pois_within  = excluded.pois_within,
    nearest_pois = excluded.nearest_pois,
    computed_at  = excluded.computed_at;
end;
$$;

grant execute on function upsert_listing_walking_metrics(text, text, text, text, double precision, double precision)
  to service_role;
