-- Extra school fields used by the right-rail "בתי ספר במרחק הליכה" panel.
-- All optional; OSM ingest populates `orientation` opportunistically from
-- school:religion / religion tags. The remaining columns (bagrut, student
-- count) are placeholders for a future data.gov.il ingest.

alter table schools
  add column if not exists orientation       text,
  add column if not exists bagrut_pass_rate  numeric,
  add column if not exists student_count     int,
  add column if not exists principal_he      text,
  add column if not exists website_url       text;

create or replace view schools_geojson as
  select
    id, name_he, level, meitzav_score, rating_year,
    orientation, bagrut_pass_rate, student_count, principal_he, website_url,
    st_asgeojson(point::geometry)::jsonb as point
  from schools;

grant select on schools_geojson to anon, authenticated, service_role;
