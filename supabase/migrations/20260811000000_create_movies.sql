-- Tollyriddl movie catalog.
-- Provenance: seeded rows are generated from the CC0 Wikidata extracts under research/.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.movies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wikidata_id text NOT NULL UNIQUE,
  title text NOT NULL,
  release_date date,
  release_year integer NOT NULL CHECK (release_year BETWEEN 2000 AND 2026),
  genres text[] NOT NULL DEFAULT ARRAY[]::text[],
  "cast" text[] NOT NULL DEFAULT ARRAY[]::text[],
  directors text[] NOT NULL DEFAULT ARRAY[]::text[],
  production text[] NOT NULL DEFAULT ARRAY[]::text[],
  music text[] NOT NULL DEFAULT ARRAY[]::text[],
  writers text[] NOT NULL DEFAULT ARRAY[]::text[],
  source_url text NOT NULL,
  retrieved_at timestamptz NOT NULL,
  search_text text NOT NULL,
  is_eligible boolean NOT NULL DEFAULT true,
  CONSTRAINT movies_wikidata_id_format CHECK (wikidata_id ~ '^Q[0-9]+$'),
  CONSTRAINT movies_title_not_blank CHECK (length(btrim(title)) > 0),
  CONSTRAINT movies_release_date_matches_year CHECK (
    release_date IS NULL OR EXTRACT(YEAR FROM release_date)::integer = release_year
  ),
  CONSTRAINT movies_genres_required CHECK (cardinality(genres) > 0),
  CONSTRAINT movies_cast_required CHECK (cardinality("cast") > 0 AND cardinality("cast") <= 9),
  CONSTRAINT movies_directors_required CHECK (cardinality(directors) > 0),
  CONSTRAINT movies_source_url_wikidata CHECK (source_url ~ '^https://www[.]wikidata[.]org/entity/Q[0-9]+$'),
  CONSTRAINT movies_search_text_not_blank CHECK (length(btrim(search_text)) > 0)
);

CREATE INDEX IF NOT EXISTS movies_release_year_idx ON public.movies (release_year);
CREATE INDEX IF NOT EXISTS movies_genres_idx ON public.movies USING gin (genres);
CREATE INDEX IF NOT EXISTS movies_cast_idx ON public.movies USING gin ("cast");
CREATE INDEX IF NOT EXISTS movies_directors_idx ON public.movies USING gin (directors);
CREATE INDEX IF NOT EXISTS movies_search_text_idx ON public.movies USING gin (to_tsvector('simple', search_text));

ALTER TABLE public.movies ENABLE ROW LEVEL SECURITY;
-- Deliberately no anon policies: the catalog is not publicly readable until an explicit policy is added.
