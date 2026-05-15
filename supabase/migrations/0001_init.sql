-- MishpachaMap V1 — initial schema
-- Spatial reference: SRID 4326 (WGS84) throughout.

create extension if not exists postgis;

-- ============================================================================
-- Tables
-- ============================================================================

create table neighborhoods (
  id            text primary key,
  name_he       text not null,
  name_en       text not null,
  polygon       geography(polygon, 4326) not null,
  center        geography(point, 4326) not null,
  family_label  text,
  summary_he    text,
  tags          text[]
);
create index neighborhoods_polygon_gix on neighborhoods using gist (polygon);

create table transactions (
  id            bigserial primary key,
  neighborhood  text references neighborhoods(id),
  address       text,
  point         geography(point, 4326),
  rooms         numeric,
  sqm           numeric,
  price_nis     bigint,
  price_per_m2  integer,
  tx_date       date,
  source        text default 'data.gov.il'
);
create index transactions_point_gix on transactions using gist (point);
create index transactions_neighborhood_idx on transactions (neighborhood, tx_date);

create table listings (
  id              text primary key,
  neighborhood    text references neighborhoods(id),
  address         text,
  point           geography(point, 4326),
  price_nis       bigint,
  price_per_m2    integer,
  rooms           numeric,
  sqm             numeric,
  garden_sqm      numeric,
  parking         int,
  storage         boolean,
  elevator        boolean,
  floor_label     text,
  year_built      int,
  status_he       text,
  days_on_market  int,
  images_count    int,
  source          text,
  scraped_at      timestamptz default now()
);
create index listings_point_gix on listings using gist (point);
create index listings_neighborhood_idx on listings (neighborhood);

create table schools (
  id            text primary key,
  name_he       text not null,
  point         geography(point, 4326) not null,
  level         text,
  meitzav_score numeric,
  rating_year   int
);
create index schools_point_gix on schools using gist (point);

create table pois (
  id            text primary key,
  type          text not null,
  name_he       text,
  point         geography(point, 4326) not null,
  meta          jsonb default '{}'::jsonb
);
create index pois_point_gix on pois using gist (point);
create index pois_type_idx on pois (type);

create table neighborhood_metrics (
  neighborhood        text primary key references neighborhoods(id),
  avg_price_per_m2    integer,
  avg_price_yoy_pct   numeric,
  avg_listing_price   bigint,
  median_rooms        numeric,
  walk_score          int,
  green_score         int,
  school_score        int,
  quiet_score         int,
  computed_at         timestamptz default now()
);

-- ============================================================================
-- Row-Level Security: public read on all tables (no auth in V1)
-- ============================================================================

alter table neighborhoods         enable row level security;
alter table transactions          enable row level security;
alter table listings              enable row level security;
alter table schools               enable row level security;
alter table pois                  enable row level security;
alter table neighborhood_metrics  enable row level security;

create policy "public read" on neighborhoods         for select using (true);
create policy "public read" on transactions          for select using (true);
create policy "public read" on listings              for select using (true);
create policy "public read" on schools               for select using (true);
create policy "public read" on pois                  for select using (true);
create policy "public read" on neighborhood_metrics  for select using (true);

-- Writes happen only via the service-role key (ingest scripts), which bypasses RLS.

-- ============================================================================
-- Helpers
-- ============================================================================

-- Schools whose point lies within `meters` of a neighborhood's centroid.
-- Used by scripts/ingest/compute_metrics.ts.
create or replace function schools_within_meters(neighborhood_id text, meters integer)
returns table (id text, name_he text, meitzav_score numeric, level text)
language sql
stable
as $$
  select s.id, s.name_he, s.meitzav_score, s.level
  from schools s, neighborhoods n
  where n.id = neighborhood_id
    and st_dwithin(s.point, n.center, meters);
$$;

grant execute on function schools_within_meters(text, integer) to anon, authenticated, service_role;
