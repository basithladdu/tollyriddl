# TollyRiddl

A daily Telugu-film guessing game inspired by the clue structure of BollyRiddl, with its own Tollywood visual identity and a source-audited movie catalog.

## Rules

- Guess the mystery Telugu film in seven attempts.
- Every guess narrows the release year and reveals any shared genres, cast, directors, production companies, music directors, or writers.
- Choose one full clue after guess four and another after guess six.
- After guess seven, unlock three final attempts.
- Daily answers are selected deterministically in Indian Standard Time. The secret answer and game salt stay on the server.

## Movie data

The seed contains 89 Telugu-original Indian films released from 2000 through 2025. It uses Wikidata's CC0 structured data and stable QIDs; no posters or other media were copied. The raw research records, retrieval notes, SPARQL criteria, exclusions, and known source gaps are in [`research/`](research/).

Rebuild the normalized JSON, catalog metadata, and SQL seed with:

```powershell
npm.cmd run seed:build
```

The generator rejects records without a title, valid year, director, cast, or genre, and rejects soundtrack-only genre records.

## Local setup

Copy `.env.example` to `.env.local` and provide the server-only Supabase values:

```text
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
GAME_SALT=...
```

Apply `supabase/migrations/20260811000000_create_movies.sql`, then `supabase/seed.sql`. Start the app with `npm.cmd run dev`.

When Supabase variables are absent in development, the server uses the checked-in catalog in `data/movies.json` and a development-only game salt. Production still requires all three server-only values above.

## Verification

```powershell
npm.cmd run lint
npm.cmd run test
npm.cmd run build
```
