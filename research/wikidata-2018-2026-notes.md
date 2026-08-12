# Wikidata Telugu film dataset notes

Retrieved at: 2026-08-11T12:57:16Z (UTC)
Endpoint: https://query.wikidata.org/sparql
Dataset: `research/wikidata-2018-2026.json`

## Scope and method

- 32 records, all with a stable Wikidata QID and an English Wikidata label.
- Candidate predicate required: film (or subclass of film), country of origin India (`P495=Q668`), original language Telugu (`P364=Q8097`), and a `P577` date whose year is 2018 through 2026.
- The final set excludes three sparse candidates from the ranked candidate pass: Shyam Singha Roy (Q105081950), Acharya (Q96371440), and Miss. Shetty Mr. Polishetty (Q122038718).
- No poster or other Wikimedia media was copied. Every record's `sourceUrl` is its Wikidata entity URL; Wikidata structured data is released under CC0.
- A title was retained only when the Wikidata record had an in-window release claim. The current retrieval date is 2026-08-11, so the 2026 record is not a future/unreleased title according to its Wikidata release claim.
- `releaseDate` is included only when the earliest in-window `P577` claim has day precision (Wikibase precision 11). Year-only or month-only claims retain `releaseYear` and use `releaseDate: null`.
- Cast is capped at nine names. Selection prioritizes Wikidata PreferredRank, then statement ordinal (`P1545`), then a deterministic name sort. These selected records had zero PreferredRank cast statements and zero ordinal cast qualifiers, so the fallback is explicitly deterministic rather than an assertion that Wikidata has a principal-cast ordering.

## Counts and gaps

- By release year: 2018=4, 2019=5, 2020=5, 2021=2, 2022=3, 2023=3, 2024=5, 2025=4, 2026=1.
- Exact day dates: 25/32.
- Non-empty genres: 29/32.
- Non-empty directors: 32/32.
- Non-empty music-director/composer values: 26/32.
- Non-empty writers: 15/32.
- Non-empty production companies: 16/32.
- Nine cast names: 28/32; the remainder have fewer than nine non-deprecated cast statements.
- Wikidata modeling is uneven: several release claims are year-only, and writer, genre, company, and music fields are absent for some otherwise prominent films. Empty arrays are intentional and mean no value was returned by the queried Wikidata properties; they are not inferred values.
- Because the selection is Wikidata-only, no external popularity, box-office, poster, or review signal was used.

## Exact discovery query

This is the exact SPARQL pattern used to discover candidates:

```sparql
SELECT ?film ?filmLabel ?date WHERE {
  ?film wdt:P31/wdt:P279* wd:Q11424;
        wdt:P495 wd:Q668;
        wdt:P364 wd:Q8097;
        wdt:P577 ?date .
  FILTER(YEAR(?date)>=2018 && YEAR(?date)<=2026)
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
  }
}
ORDER BY ?date
```

## Exact field query

The ranked field pass used this query. Its `VALUES` list includes the 32 final QIDs plus the three sparse candidates named above; the latter were removed before writing the JSON.

```sparql
SELECT ?film ?kind ?value ?valueLabel ?rank ?ordinal WHERE {
  VALUES ?film {
    wd:Q29832413 wd:Q38805191 wd:Q39048745 wd:Q56063323 wd:Q56278247
    wd:Q36801710 wd:Q60738016 wd:Q55611328 wd:Q64768638 wd:Q65052126
    wd:Q65057760 wd:Q85845509 wd:Q85770972 wd:Q85812404 wd:Q85216610
    wd:Q105081950 wd:Q60424165 wd:Q86751411 wd:Q96371440 wd:Q113455828
    wd:Q106298596 wd:Q110625349 wd:Q104904706 wd:Q118502010 wd:Q112430183
    wd:Q108940313 wd:Q123169099 wd:Q122038718 wd:Q112182731 wd:Q125453590
    wd:Q112083510 wd:Q131548050 wd:Q110917109 wd:Q105886670 wd:Q131583972
    wd:Q133573186
  }
  { BIND("genre" AS ?kind) ?film wdt:P136 ?value }
  UNION { BIND("director" AS ?kind) ?film wdt:P57 ?value }
  UNION { BIND("music" AS ?kind) ?film wdt:P86 ?value }
  UNION { BIND("writer" AS ?kind) ?film wdt:P58 ?value }
  UNION { BIND("writer" AS ?kind) ?film wdt:P50 ?value }
  UNION { BIND("productionCompany" AS ?kind) ?film wdt:P272 ?value }
  UNION {
    BIND("cast" AS ?kind)
    ?film p:P161 ?stmt .
    ?stmt ps:P161 ?value .
    ?stmt wikibase:rank ?rank .
    OPTIONAL { ?stmt pq:P1545 ?ordinal }
  }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language "en".
  }
}
ORDER BY ?film ?kind ?ordinal
```

Release date precision was obtained from the corresponding `p:P577` statements with `ps:P577` and `psv:P577/wikibase:timePrecision`, using the same `VALUES` list and the same 2018-2026 year filter.

