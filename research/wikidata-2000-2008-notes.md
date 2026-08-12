# Wikidata Telugu-film dataset notes

Retrieved `2026-08-11T12:55:38Z`. The JSON contains 30 records, spanning 2000-2008 inclusive (30 unique film QIDs). It is a CC0 research dataset: Wikidata entity identifiers, labels, and public claims are facts/data; no posters, artwork, or copyrighted media were copied.

## Inclusion and rejection

The candidate query required a film (`P31/P279* Q11424`), a release date (`P577`) whose year is 2000-2008, and original language Telugu (`P364 Q8097`). The selected records were then checked for India as country of origin (`P495 Q668`). This rejects records that are only Telugu dubs when Wikidata does not identify Telugu as an original language. A film can still have additional language claims (for example, Simhadri also has German and Italian language claims); it is retained because Telugu is explicitly present and the country is India. Remakes are not automatically rejected: the criterion is a Telugu-original production, not “never remade elsewhere.”

All 30 selected records have a Wikidata QID, English label, Telugu language claim, and India country claim. `releaseDatePrecision: "year"` means Wikidata supplied a year-level date represented as January 1; `day` means an exact day was supplied. Empty arrays mean the requested Wikidata property was absent for that entity, not that the real-world credit does not exist.

## Cast handling

`principalCast` is capped at nine distinct English labels from Wikidata `P161` cast statements. The query did not find `P1545` ordinal qualifiers for the selected statements, so this is a bounded clue set, not a claim that Wikidata’s statement order is billing order. Records with fewer than nine statements retain all available cast labels.

## Exact SPARQL query

The following query was used against `https://query.wikidata.org/sparql` with `format=json` and the `User-Agent: tollyriddl-research/1.0` header. The candidate VALUES list is the 30 QIDs in the JSON; the query also performs the language/country eligibility check and retrieves the requested clue properties.

```sparql
SELECT ?film ?filmLabel (SAMPLE(?date) AS ?releaseDate)
       (GROUP_CONCAT(DISTINCT ?genreLabel; separator="||") AS ?genres)
       (GROUP_CONCAT(DISTINCT ?directorLabel; separator="||") AS ?directors)
       (GROUP_CONCAT(DISTINCT ?composerLabel; separator="||") AS ?composers)
       (GROUP_CONCAT(DISTINCT ?writerLabel; separator="||") AS ?writers)
       (GROUP_CONCAT(DISTINCT ?companyLabel; separator="||") AS ?companies)
       (GROUP_CONCAT(DISTINCT ?castLabel; separator="||") AS ?cast)
WHERE {
  VALUES ?film {
    wd:Q4768044 wd:Q5102337 wd:Q6353191 wd:Q7070649
    wd:Q7070655 wd:Q7070653 wd:Q7627724 wd:Q3764560
    wd:Q4661137 wd:Q13637926 wd:Q6750638
    wd:Q3524809 wd:Q4699308 wd:Q7517709 wd:Q4747092
    wd:Q4802580 wd:Q7916121 wd:Q7660264
    wd:Q3568217 wd:Q4900534 wd:Q3536188
    wd:Q3630260 wd:Q3536183 wd:Q7929598
    wd:Q3765015 wd:Q5652625
    wd:Q3424087 wd:Q5520428 wd:Q4805922 wd:Q6433960
  }
  ?film wdt:P31/wdt:P279* wd:Q11424;
        wdt:P577 ?date;
        wdt:P364 wd:Q8097;
        wdt:P495 wd:Q668.
  FILTER(YEAR(?date) >= 2000 && YEAR(?date) <= 2008)
  ?film rdfs:label ?filmLabel . FILTER(LANG(?filmLabel)="en")
  OPTIONAL { ?film wdt:P136 ?genre . ?genre rdfs:label ?genreLabel . FILTER(LANG(?genreLabel)="en") }
  OPTIONAL { ?film wdt:P57 ?director . ?director rdfs:label ?directorLabel . FILTER(LANG(?directorLabel)="en") }
  OPTIONAL { ?film wdt:P86 ?composer . ?composer rdfs:label ?composerLabel . FILTER(LANG(?composerLabel)="en") }
  OPTIONAL { ?film wdt:P58 ?writer . ?writer rdfs:label ?writerLabel . FILTER(LANG(?writerLabel)="en") }
  OPTIONAL { ?film wdt:P272 ?company . ?company rdfs:label ?companyLabel . FILTER(LANG(?companyLabel)="en") }
  OPTIONAL { ?film wdt:P161 ?castPerson . ?castPerson rdfs:label ?castLabel . FILTER(LANG(?castLabel)="en") }
}
GROUP BY ?film ?filmLabel
ORDER BY ?releaseDate
```

The eligibility verification was a second Wikidata query over the same QIDs, checking `P364` labels and `P495` labels. The JSON's `musicDirectors` maps Wikidata `P86` (composer), `writers` maps `P58`, `productionCompanies` maps `P272`, and `principalCast` maps `P161`.
