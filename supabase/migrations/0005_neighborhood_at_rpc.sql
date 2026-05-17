-- Optional helper: resolve a (lng, lat) point to the neighborhood id whose
-- polygon contains it. Called by scripts/ingest/elections_stations.ts to
-- spatially join polling-station coordinates to neighborhoods.
--
-- The ingest script falls back to a per-row JS polygon scan when this RPC
-- isn't installed, so this migration is non-blocking — apply it for a faster
-- ingest, skip it if you prefer the fallback.

create or replace function neighborhood_at(lng_in numeric, lat_in numeric)
returns text
language sql
stable
as $$
  select id
  from neighborhoods
  where st_contains(
    polygon::geometry,
    st_setsrid(st_makepoint(lng_in, lat_in), 4326)
  )
  limit 1;
$$;

grant execute on function neighborhood_at(numeric, numeric) to anon, authenticated, service_role;
