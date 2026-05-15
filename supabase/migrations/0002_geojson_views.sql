-- Views that expose geography columns as GeoJSON for the Next.js page.
-- PostgREST returns geography as hex EWKB by default — JS can't use that.
-- We read from these views; writes still hit the underlying tables.

create or replace view neighborhoods_geojson as
  select
    id, name_he, name_en, family_label, summary_he, tags,
    st_asgeojson(polygon::geometry)::jsonb as polygon,
    st_asgeojson(center::geometry)::jsonb as center
  from neighborhoods;

create or replace view pois_geojson as
  select
    id, type, name_he, meta,
    st_asgeojson(point::geometry)::jsonb as point
  from pois;

create or replace view schools_geojson as
  select
    id, name_he, level, meitzav_score, rating_year,
    st_asgeojson(point::geometry)::jsonb as point
  from schools;

create or replace view listings_geojson as
  select
    id, neighborhood, address, price_nis, price_per_m2, rooms, sqm,
    garden_sqm, parking, storage, elevator, floor_label, year_built,
    status_he, days_on_market, images_count, source,
    st_asgeojson(point::geometry)::jsonb as point
  from listings;

grant select on neighborhoods_geojson, pois_geojson, schools_geojson, listings_geojson
  to anon, authenticated, service_role;
