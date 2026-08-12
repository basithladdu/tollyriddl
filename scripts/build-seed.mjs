#!/usr/bin/env node

/**
 * Build the Tollyriddl movie seed from the three CC0 Wikidata extracts.
 *
 * Provenance: all movie values come from research/wikidata-2000-2008.json,
 * research/wikidata-2009-2017.json, and research/wikidata-2018-2026.json.
 * The source extracts were retrieved on 2026-08-11 and retain each source's
 * Wikidata entity URL and retrieval timestamp in the generated seed.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESEARCH_DIR = path.join(ROOT, 'research');
const DATA_DIR = path.join(ROOT, 'data');
const SUPABASE_DIR = path.join(ROOT, 'supabase');
const START_YEAR = 2000;
const END_YEAR = 2026;
const SOURCE_FILES = [
  'wikidata-2000-2008.json',
  'wikidata-2009-2017.json',
  'wikidata-2018-2026.json',
];

const INVALID_GENRES = new Set([
  'album',
  'film soundtrack',
  'music album',
  'soundtrack',
  'soundtrack album',
]);

function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === '') return [];
  return [value];
}

function cleanList(value) {
  const seen = new Set();
  const result = [];
  for (const item of asArray(value)) {
    if (typeof item !== 'string') continue;
    const clean = item.trim().replace(/\s+/g, ' ');
    if (!clean) continue;
    const key = clean.toLocaleLowerCase('en-US');
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
  }
  return result;
}

function mergeLists(records, key) {
  return cleanList(records.flatMap((record) => asArray(record[key])));
}

function firstValue(records, key) {
  return records.map((record) => record[key]).find((value) => value !== undefined && value !== null && value !== '') ?? null;
}

function parseYear(record) {
  const directYear = Number(record.releaseYear);
  if (Number.isInteger(directYear)) return directYear;
  const releaseDate = typeof record.releaseDate === 'string' ? record.releaseDate : '';
  const dateYear = Number(releaseDate.slice(0, 4));
  return Number.isInteger(dateYear) ? dateYear : null;
}

function parseFirstYear(records) {
  for (const record of records) {
    const year = parseYear(record);
    if (year !== null) return year;
  }
  return null;
}

function titleCase(value) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeGenres(values) {
  const result = [];
  const seen = new Set();
  for (const rawValue of cleanList(values)) {
    const lowered = rawValue.toLocaleLowerCase('en-US').replace(/\s+/g, ' ').trim();
    if (!lowered || INVALID_GENRES.has(lowered)) continue;

    const withoutFilm = lowered.replace(/\s+film$/, '').trim();
    const labels = /^(?:the )?romantic comedy$/.test(withoutFilm)
      ? ['Romance', 'Comedy']
      : [titleCase(withoutFilm)];
    for (const label of labels) {
      const key = label.toLocaleLowerCase('en-US');
      if (!label || seen.has(key)) continue;
      seen.add(key);
      result.push(label);
    }
  }
  return result;
}

function mergeRecords(entries) {
  const byQid = new Map();
  for (const entry of entries) {
    const qid = typeof entry.record.qid === 'string' ? entry.record.qid.trim() : '';
    const key = qid || `__missing_${entry.index}`;
    const current = byQid.get(key);
    if (current) {
      current.records.push(entry.record);
      current.retrievedAt ??= entry.retrievedAt;
      current.sourceFiles.add(entry.sourceFile);
    } else {
      byQid.set(key, {
        qid,
        records: [entry.record],
        retrievedAt: entry.retrievedAt,
        sourceFiles: new Set([entry.sourceFile]),
      });
    }
  }
  return [...byQid.values()];
}

function normalizeRecord(group) {
  const records = group.records;
  const reasons = [];
  const qid = group.qid;

  if (!qid) reasons.push('missing wikidata QID');
  const languages = cleanList(mergeLists(records, 'originalLanguages').concat(mergeLists(records, 'originalLanguage')));
  const countries = cleanList(mergeLists(records, 'countries').concat(mergeLists(records, 'country')));
  if (languages.length && !languages.some((value) => value.toLocaleLowerCase('en-US') === 'telugu')) {
    reasons.push('non-Telugu original language');
  }
  if (countries.length && !countries.some((value) => value.toLocaleLowerCase('en-US') === 'india')) {
    reasons.push('non-India country of origin');
  }

  const title = String(firstValue(records, 'title') ?? '').trim();
  const releaseYear = parseFirstYear(records);
  const directors = mergeLists(records, 'directors');
  const cast = cleanList(mergeLists(records, 'cast').concat(mergeLists(records, 'principalCast')));
  const rawGenres = cleanList(records.flatMap((record) => asArray(record.genres)));
  const genres = normalizeGenres(rawGenres);

  if (!title) reasons.push('missing title');
  if (releaseYear === null) reasons.push('missing year');
  else if (releaseYear < START_YEAR || releaseYear > END_YEAR) reasons.push(`year outside ${START_YEAR}-${END_YEAR}`);
  if (!directors.length) reasons.push('missing director');
  if (!cast.length) reasons.push('missing cast');
  if (!genres.length) reasons.push(rawGenres.length ? 'genre only invalid values' : 'genre empty');

  const sourceUrl = String(firstValue(records, 'sourceUrl') ?? '').trim();
  const retrievedAt = String(firstValue(records, 'retrievedAt') ?? group.retrievedAt ?? '').trim();
  if (!sourceUrl) reasons.push('missing source URL');
  if (!retrievedAt || Number.isNaN(Date.parse(retrievedAt))) reasons.push('missing or invalid retrievedAt');

  if (reasons.length) return { qid, reasons };

  const releaseDate = records
    .map((record) => record.releaseDate)
    .find((value) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) ?? null;
  const production = mergeLists(records, 'productionCompanies');
  const music = mergeLists(records, 'musicDirectors');
  const writers = mergeLists(records, 'writers');
  const boundedCast = cast.slice(0, 9);
  const searchText = cleanList([title, ...genres, ...directors, ...boundedCast, ...production, ...music, ...writers]).join(' ');

  return {
    wikidata_id: qid,
    title,
    release_date: releaseDate,
    release_year: releaseYear,
    genres,
    cast: boundedCast,
    directors,
    production,
    music,
    writers,
    source_url: sourceUrl,
    retrieved_at: retrievedAt,
    search_text: searchText,
    is_eligible: true,
  };
}

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlArray(values) {
  if (!values.length) return "ARRAY[]::text[]";
  return `ARRAY[${values.map(sqlString).join(', ')}]::text[]`;
}

function buildSeedSql(movies, sourceMeta) {
  const columns = [
    'wikidata_id', 'title', 'release_date', 'release_year', 'genres', '"cast"',
    'directors', 'production', 'music', 'writers', 'source_url', 'retrieved_at',
    'search_text', 'is_eligible',
  ];
  const rows = movies.map((movie) => [
    sqlString(movie.wikidata_id),
    sqlString(movie.title),
    movie.release_date ? sqlString(movie.release_date) : 'NULL',
    String(movie.release_year),
    sqlArray(movie.genres),
    sqlArray(movie.cast),
    sqlArray(movie.directors),
    sqlArray(movie.production),
    sqlArray(movie.music),
    sqlArray(movie.writers),
    sqlString(movie.source_url),
    `(${sqlString(movie.retrieved_at)})::timestamptz`,
    sqlString(movie.search_text),
    movie.is_eligible ? 'TRUE' : 'FALSE',
  ]);
  const lines = [
    '-- Generated by scripts/build-seed.mjs; do not edit by hand.',
    '-- Provenance: CC0 Wikidata extracts in research/; source_url and retrieved_at are retained per row.',
    `-- Sources: ${sourceMeta.map((source) => `${source.file} (${source.retrievedAt})`).join('; ')}`,
    `-- Included records: ${movies.length}`,
    'BEGIN;',
  ];
  for (const row of rows) {
    lines.push(
      `INSERT INTO public.movies (${columns.join(', ')}) VALUES (${row.join(', ')})`,
      'ON CONFLICT (wikidata_id) DO UPDATE SET',
      '  title = EXCLUDED.title, release_date = EXCLUDED.release_date, release_year = EXCLUDED.release_year,',
      '  genres = EXCLUDED.genres, "cast" = EXCLUDED."cast", directors = EXCLUDED.directors,',
      '  production = EXCLUDED.production, music = EXCLUDED.music, writers = EXCLUDED.writers,',
      '  source_url = EXCLUDED.source_url, retrieved_at = EXCLUDED.retrieved_at,',
      '  search_text = EXCLUDED.search_text, is_eligible = EXCLUDED.is_eligible;',
    );
  }
  lines.push('COMMIT;', '');
  return lines.join('\n');
}

function validateMovies(movies) {
  const qids = movies.map((movie) => movie.wikidata_id);
  if (new Set(qids).size !== qids.length) throw new Error('Validation failed: duplicate QIDs in generated JSON');
  for (const movie of movies) {
    if (!/^Q\d+$/.test(movie.wikidata_id)) throw new Error(`Validation failed: invalid QID ${movie.wikidata_id}`);
    if (!Number.isInteger(movie.release_year) || movie.release_year < START_YEAR || movie.release_year > END_YEAR) {
      throw new Error(`Validation failed: year out of range for ${movie.wikidata_id}`);
    }
    if (!movie.title || !movie.directors.length || !movie.cast.length || !movie.genres.length) {
      throw new Error(`Validation failed: required field missing for ${movie.wikidata_id}`);
    }
    if (!movie.source_url || !movie.retrieved_at || Number.isNaN(Date.parse(movie.retrieved_at))) {
      throw new Error(`Validation failed: provenance missing for ${movie.wikidata_id}`);
    }
    if (movie.cast.length > 9) throw new Error(`Validation failed: cast exceeds 9 for ${movie.wikidata_id}`);
    for (const field of ['genres', 'cast', 'directors', 'production', 'music', 'writers']) {
      if (!Array.isArray(movie[field])) throw new Error(`Validation failed: ${field} is not an array for ${movie.wikidata_id}`);
    }
  }
}

function validateSeedSql(seedSql, movies) {
  const insertCount = (seedSql.match(/INSERT INTO public\.movies \(/g) ?? []).length;
  if (insertCount !== movies.length) {
    throw new Error(`Validation failed: seed SQL has ${insertCount} inserts, expected ${movies.length}`);
  }
  const seededQids = [...seedSql.matchAll(/VALUES \('((?:''|[^'])+)'/g)].map((match) => match[1].replaceAll("''", "'"));
  if (new Set(seededQids).size !== seededQids.length || seededQids.length !== movies.length) {
    throw new Error('Validation failed: seed SQL QIDs are duplicated or incomplete');
  }
}

function main() {
  const entries = [];
  const sourceMeta = [];
  for (const file of SOURCE_FILES) {
    const fullPath = path.join(RESEARCH_DIR, file);
    const document = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    const records = Array.isArray(document) ? document : document.records;
    if (!Array.isArray(records)) throw new Error(`Expected an array of records in ${file}`);
    const retrievedAt = Array.isArray(document) ? null : document.retrievedAt;
    sourceMeta.push({ file, retrievedAt: retrievedAt ?? 'per-record timestamps' });
    records.forEach((record, index) => entries.push({ record, index, sourceFile: file, retrievedAt }));
  }

  const groups = mergeRecords(entries);
  const normalized = groups.map(normalizeRecord);
  const rejected = normalized.filter((record) => record.reasons);
  const movies = normalized.filter((record) => !record.reasons);
  validateMovies(movies);

  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(SUPABASE_DIR, { recursive: true });
  const moviesJson = `${JSON.stringify(movies, null, 2)}\n`;
  const seedSql = buildSeedSql(movies, sourceMeta);
  const years = movies.map((movie) => movie.release_year);
  const catalogMeta = {
    source: 'Wikidata',
    license: 'CC0',
    count: movies.length,
    startYear: Math.min(...years),
    endYear: Math.max(...years),
  };
  JSON.parse(moviesJson);
  validateSeedSql(seedSql, movies);
  fs.writeFileSync(path.join(DATA_DIR, 'movies.json'), moviesJson);
  fs.writeFileSync(path.join(DATA_DIR, 'catalog-meta.json'), `${JSON.stringify(catalogMeta, null, 2)}\n`);
  fs.writeFileSync(path.join(SUPABASE_DIR, 'seed.sql'), seedSql);

  const reasons = new Map();
  for (const record of rejected) {
    for (const reason of record.reasons) reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
  }
  console.log(`Source records: ${entries.length}`);
  console.log(`Unique QIDs: ${groups.length}`);
  console.log(`Included: ${movies.length}`);
  console.log(`Rejected: ${rejected.length}`);
  console.log(`Field coverage: title ${movies.filter((movie) => movie.title).length}/${movies.length}, year ${movies.filter((movie) => movie.release_year !== null).length}/${movies.length}, genres ${movies.filter((movie) => movie.genres.length).length}/${movies.length}, directors ${movies.filter((movie) => movie.directors.length).length}/${movies.length}, cast ${movies.filter((movie) => movie.cast.length).length}/${movies.length}`);
  console.log('Rejection reasons:');
  for (const [reason, count] of reasons) console.log(`- ${reason}: ${count}`);
  console.log(`Generated ${path.relative(ROOT, path.join(DATA_DIR, 'movies.json'))}`);
  console.log(`Generated ${path.relative(ROOT, path.join(DATA_DIR, 'catalog-meta.json'))}`);
  console.log(`Generated ${path.relative(ROOT, path.join(SUPABASE_DIR, 'seed.sql'))}`);
}

main();
