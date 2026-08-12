# Wikidata Telugu feature-film dataset (2009–2017)

Retrieved: 2026-08-11T18:25:02+05:30

## Scope and provenance

This is a curated 35-record subset of Telugu-original feature films released from 2009 through 2017 inclusive. Every record is keyed by a stable Wikidata QID and uses a Wikidata entity URL as `sourceUrl`. The structured data is from Wikidata, whose data is CC0; no posters, thumbnails, or image files were fetched or copied.

The initial discovery/eligibility query was run against the Wikidata Query Service:

```sparql
SELECT ?item ?itemLabel ?date WHERE {
  ?item wdt:P31 wd:Q11424;
        wdt:P364 wd:Q8097;
        wdt:P577 ?date.
  FILTER(YEAR(?date)>=2009 && YEAR(?date)<=2017)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
ORDER BY ?date
```

- `Q11424` is film; `Q8097` is Telugu.
- Candidate claims were then read from the current Wikidata API (`wbgetentities`, `props=info|labels|claims`) for the selected QIDs and referenced entities.
- English labels were used for titles and people/organizations/genres.
- `P57` = director, `P161` = cast member, `P136` = genre, `P86` = composer, `P58` = screenwriter, `P272` = production company, `P364` = original language, `P577` = publication/release date.
- The cast list is capped at nine names per film. No posters or other copyrighted media are represented.
- Bilingual originals are retained when Telugu is among Wikidata's original-language claims (for example, `Eega` and the `Baahubali` films). A Telugu dub with no Telugu original-language claim was not eligible. This is not a claim that every Wikidata statement is complete or error-free; it is a source-bounded game dataset.

## Counts

- Records: 35
- Year distribution: 2009 (4), 2010 (4), 2011 (4), 2012 (4), 2013 (4), 2014 (4), 2015 (4), 2016 (3), 2017 (4)
- Exact day-level release dates (`P577` precision >= 11): 17
- Year-only release claims (date left `null` rather than invented): 18
- Directors: 35/35
- Cast: 35/35 (all lists <= 9)
- Genres: 33/35
- Music directors/composers: 34/35
- Writers: 30/35
- Production companies: 24/35
- Original-language Telugu claim: 35/35

## Known gaps

Wikidata has no genre claim for `Swamy Ra Ra` or `Pellichoopulu`, no composer claim for `Kshanam`, no writer claim for `Arya 2`, `100% Love`, `Ala Modalaindi`, `Swamy Ra Ra`, or `Kanche`, and no production-company claim for `Arya 2`, `Kick`, `100% Love`, `Ala Modalaindi`, `Panjaa`, `Businessman`, `Race Gurram`, `Oohalu Gusagusalade`, `Kanche`, `Pellichoopulu`, or `Arjun Reddy`. These fields are represented as empty arrays, not guessed.

For the 18 year-only dates, `releaseYear` is retained from Wikidata and `releaseDate` is `null`; this avoids presenting Wikidata's `YYYY-01-01` year-precision placeholder as a real day. `retrievedAt` is recorded on every record.

## Validation

- JSON parses successfully as an array of 35 objects.
- QIDs and `sourceUrl` values are unique and stable.
- All release years are within 2009–2017.
- All records have an English title, a Telugu original-language claim, at least one director, at least one cast member, and a `retrievedAt` timestamp.
- No field contains poster/image URLs or copied poster content.

