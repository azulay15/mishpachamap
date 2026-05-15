-- Aliases for free-text search: residents say "קייזר", not "אבני חן".
-- Column + GIN index + view refresh so the API returns aliases too.

alter table neighborhoods add column if not exists aliases text[] default '{}'::text[];

create index if not exists neighborhoods_aliases_gin on neighborhoods using gin (aliases);

-- Refresh the GeoJSON view to surface the aliases column.
drop view if exists neighborhoods_geojson;
create view neighborhoods_geojson as
  select id, name_he, name_en, family_label, summary_he, tags, aliases,
    st_asgeojson(polygon::geometry)::jsonb as polygon,
    st_asgeojson(center::geometry)::jsonb as center
  from neighborhoods;

grant select on neighborhoods_geojson to anon, authenticated, service_role;
