-- Neighborhood-level Knesset election results, aggregated from polling
-- station data published by the Central Elections Committee (bechirot.gov.il).
--
-- Modeled per (neighborhood × election × party) rather than per polling
-- station because the UI only ever shows the aggregated view, and per-station
-- raw data isn't all needed in the request path. Station-level data, if/when
-- we ingest it, will land in a separate `polling_stations` table — this view
-- is the "computed metric" surface.

create table if not exists elections (
  id        text primary key,       -- "knesset-25"
  name_he   text not null,          -- "כנסת ה-25"
  date      date not null
);

create table if not exists parties (
  id        text primary key,       -- "likud"
  name_he   text not null,          -- "הליכוד"
  name_en   text,
  color     text                    -- hex brand color
);

create table if not exists neighborhood_election_results (
  neighborhood  text not null references neighborhoods(id) on delete cascade,
  election      text not null references elections(id) on delete cascade,
  party         text not null references parties(id) on delete cascade,
  votes         int  not null,
  pct           numeric,            -- 0-100, share within (neighborhood, election)
  primary key (neighborhood, election, party)
);

create index if not exists ner_election_idx on neighborhood_election_results (election);
create index if not exists ner_neighborhood_idx on neighborhood_election_results (neighborhood);

alter table elections enable row level security;
alter table parties enable row level security;
alter table neighborhood_election_results enable row level security;

create policy "public read" on elections for select using (true);
create policy "public read" on parties for select using (true);
create policy "public read" on neighborhood_election_results for select using (true);
