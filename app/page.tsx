"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import catalogMeta from "@/data/catalog-meta.json";
import { emptyStats, formatShareResult, normalizeStats, summarizeStats, type StatsSummary, type StoredStats } from "@/lib/stats";
import type {
  ClueCategory,
  GameBootstrap,
  GameSnapshot,
  GuessRequest,
  MovieSearchResult,
} from "@/lib/types";

type JsonRecord = Record<string, unknown>;
type BootstrapShape = GameBootstrap & JsonRecord;
type SnapshotShape = GameSnapshot & JsonRecord;
type SearchShape = MovieSearchResult & JsonRecord;

type ClueView = {
  key: string;
  label: string;
  value: string;
  revealed: boolean;
};

type GuessView = {
  id?: string;
  title: string;
  year?: string;
  correct: boolean;
  score?: number;
};

type PuzzleView = {
  date: string;
  clues: ClueView[];
  maxGuesses: number;
  attempts: number;
  solved: boolean;
  complete: boolean;
  extraGuesses: boolean;
  lifelineOptions: ClueCategory[];
  gameId?: string;
};

const CLUE_ORDER = [
  ["year", "Year"],
  ["genres", "Genres"],
  ["cast", "Cast"],
  ["directors", "Director"],
  ["production", "Production"],
  ["music", "Music"],
  ["writers", "Writers"],
] as const;

const FALLBACK_CLUES: ClueView[] = CLUE_ORDER.map(([key, label]) => ({
  key,
  label,
  value: "Waiting for today’s reel",
  revealed: false,
}));

function today() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date())
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function previousDates(count: number) {
  const [year, month, day] = today().split("-").map(Number);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  return Array.from({ length: count }, (_, index) => {
    const value = new Date(cursor);
    value.setUTCDate(value.getUTCDate() - index);
    return value.toISOString().slice(0, 10);
  });
}
const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" ? (value as JsonRecord) : {};
const text = (value: unknown, fallback = "") => {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
};
const first = (...values: unknown[]) => values.map((value) => text(value)).find(Boolean) ?? "";

function getSource(payload: unknown): JsonRecord {
  const root = asRecord(payload);
  return asRecord(root.snapshot ?? root.game ?? root.data ?? root);
}

function clueValue(source: JsonRecord, key: string): string {
  const clues = asRecord(source.clues);
  const value = clues[key] ?? source[key] ?? asRecord(source.movie)[key];
  return text(value, "Not revealed");
}

function normalizePuzzle(payload: unknown, date: string): PuzzleView {
  const source = getSource(payload) as SnapshotShape;
  const root = asRecord(payload) as BootstrapShape;
  const rawClues = asRecord(source.clues);
  const yearClue = asRecord(source.yearClue);
  const lifelines = Array.isArray(source.lifelines) ? source.lifelines : [];
  const lifelineSlots = Array.isArray(source.lifelineSlots) ? source.lifelineSlots : [];
  const guesses = Array.isArray(source.guesses) ? source.guesses : [];
  const answer = asRecord(source.answer);
  const complete = Boolean(source.complete);
  const won = Boolean(source.won);
  const clues = CLUE_ORDER.map(([key, label]) => {
    const raw = asRecord(rawClues[key]);
    const lifeline = lifelines.map(asRecord).find((item) => isClueCategory(item.category) && item.category === key);
    const shared = guesses.flatMap((guess) => {
      const sharedClues = asRecord(guess).shared;
      return Array.isArray(sharedClues)
        ? sharedClues.filter((item) => isClueCategory(asRecord(item).category) && asRecord(item).category === key).flatMap((item) => {
            const values = asRecord(item).values;
            return Array.isArray(values) ? values : [];
          })
        : [];
    });
    const answerValue = key === "year" ? first(answer.year) : first(answer[key]);
    const value = complete
      ? (answerValue || "Not listed in Wikidata")
      : key === "year"
        ? (yearClue.from !== undefined ? (yearClue.exact ? String(yearClue.from) : `${yearClue.from} — ${yearClue.to}`) : "Not revealed")
        : first(lifeline?.values, shared) || clueValue(source, key);
    return {
      key,
      label,
      value,
      revealed: complete || (Boolean(raw.revealed ?? raw.isRevealed ?? (lifeline || shared.length || (key === "year" && yearClue.from !== undefined) || asRecord(source.revealedClues)[key])) && value !== "Not revealed"),
    };
  });

  const lifelineOptions = Array.from(new Set(
    lifelineSlots.flatMap((slot) => {
      const categories = asRecord(slot).categories;
      return Array.isArray(categories) ? categories.filter(isClueCategory) : [];
    }),
  ));

  return {
    date: first(source.date, root.date, date),
    clues,
    maxGuesses: Number(source.maxGuesses ?? root.maxGuesses ?? 10) || 10,
    attempts: Number(source.attempts ?? source.guessesUsed ?? 0) || 0,
    solved: won,
    complete,
    extraGuesses: Boolean(source.extraGuesses),
    lifelineOptions,
    gameId: first(source.id, root.id, source.gameId) || undefined,
  };
}

function normalizeResults(payload: unknown): SearchShape[] {
  const root = asRecord(payload);
  const list = Array.isArray(payload) ? payload : root.results ?? root.movies ?? root.data ?? [];
  return Array.isArray(list) ? (list.filter((item) => item && typeof item === "object") as SearchShape[]) : [];
}

function resultTitle(result: SearchShape) {
  return first(result.title, result.name, result.movieTitle) || "Untitled film";
}

function resultYear(result: SearchShape) {
  return first(result.year, result.releaseYear, result.release_date);
}

function isClueCategory(value: unknown): value is ClueCategory {
  return ["genres", "cast", "directors", "production", "music", "writers"].includes(String(value));
}

function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => !element.hasAttribute("hidden") && element.getAttribute("aria-hidden") !== "true");
}

type StoredRound = {
  guesses: GuessView[];
  revealed: ClueCategory[];
  solved: boolean;
  complete: boolean;
  extraGuesses: boolean;
};

function emptyStoredRound(): StoredRound {
  return { guesses: [], revealed: [], solved: false, complete: false, extraGuesses: false };
}

function readStored(date: string): StoredRound {
  if (typeof window === "undefined") return emptyStoredRound();
  try {
    const value = JSON.parse(window.localStorage.getItem(`tollyriddl:${date}`) ?? "null") as JsonRecord | null;
    return {
      guesses: Array.isArray(value?.guesses) ? (value.guesses as GuessView[]) : [],
      revealed: Array.isArray(value?.revealed) ? value.revealed.filter(isClueCategory) : [],
      solved: Boolean(value?.solved),
      complete: Boolean(value?.complete),
      extraGuesses: Boolean(value?.extraGuesses),
    };
  } catch {
    return emptyStoredRound();
  }
}

function writeStored(date: string, value: StoredRound) {
  try {
    window.localStorage.setItem(`tollyriddl:${date}`, JSON.stringify(value));
    const current = normalizeStats(JSON.parse(window.localStorage.getItem("tollyriddl:stats") ?? "null"));
    const playedDates = [...current.playedDates];
    const wonDates = [...current.wonDates];
    const guessCounts = { ...current.guessCounts };
    if (!playedDates.includes(date)) playedDates.push(date);
    if (value.solved) {
      if (!wonDates.includes(date)) wonDates.push(date);
      guessCounts[date] = value.guesses.length;
    }
    const bestGuesses = Object.values(guessCounts);
    const best = bestGuesses.length ? Math.min(...bestGuesses) : current.best;
    window.localStorage.setItem("tollyriddl:stats", JSON.stringify({ playedDates, wonDates, guessCounts, best }));
  } catch {
    // Storage is optional; the active round remains usable in memory.
  }
}

function readStoredStats(): StoredStats {
  if (typeof window === "undefined") return { ...emptyStats, guessCounts: {} };
  try {
    return normalizeStats(JSON.parse(window.localStorage.getItem("tollyriddl:stats") ?? "null"));
  } catch {
    return { ...emptyStats, guessCounts: {} };
  }
}

export default function HomePage() {
  const [screen, setScreen] = useState<"landing" | "play">("landing");
  const [date, setDate] = useState(today);
  const [puzzle, setPuzzle] = useState<PuzzleView | null>(null);
  const [guesses, setGuesses] = useState<GuessView[]>([]);
  const [revealed, setRevealed] = useState<ClueCategory[]>([]);
  const [solved, setSolved] = useState(false);
  const [complete, setComplete] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchShape[]>([]);
  const [activeResult, setActiveResult] = useState(-1);
  const [selected, setSelected] = useState<SearchShape | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [showHowTo, setShowHowTo] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<StatsSummary>(() => summarizeStats(emptyStats, today()));
  const [shareFeedback, setShareFeedback] = useState("");
  const [archive, setArchive] = useState<PuzzleView[]>([]);
  const [lifelineOpen, setLifelineOpen] = useState(false);
  const [extraGuesses, setExtraGuesses] = useState(false);
  const searchAbort = useRef<AbortController | null>(null);

  const effectiveLimit = puzzle?.maxGuesses ?? (extraGuesses ? 10 : 7);
  const canGuess = Boolean(selected && !submitting && !complete && guesses.length < effectiveLimit);
  const unlockedLifelines = guesses.length >= 6 ? 2 : guesses.length >= 4 ? 1 : 0;
  const lifelineAvailable = revealed.length < unlockedLifelines;
  const extendAvailable = guesses.length >= 7 && !extraGuesses && !complete;

  const loadPuzzle = useCallback(async (targetDate: string) => {
    setLoading(true);
    setHydrated(false);
    setError("");
    setShareFeedback("");
    searchAbort.current?.abort();
    setQuery("");
    setResults([]);
    setActiveResult(-1);
    setSelected(null);
    setSearchError("");
    setLifelineOpen(false);
    try {
      const response = await fetch(`/api/game?date=${encodeURIComponent(targetDate)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Game request returned ${response.status}`);
      let payload = (await response.json()) as unknown;
      const stored = readStored(targetDate);
      const storedIds = stored.guesses.map((guess) => guess.id).filter((id): id is string => Boolean(id));
      if (storedIds.length || stored.revealed.length || stored.extraGuesses) {
        const stateResponse = await fetch("/api/guess", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action: "state",
            date: targetDate,
            guesses: storedIds,
            selectedLifelines: stored.revealed,
            extraGuesses: stored.extraGuesses,
          } satisfies GuessRequest),
        });
        if (stateResponse.ok) payload = await stateResponse.json();
      }
      const next = normalizePuzzle(payload, targetDate);
      setPuzzle(next);
      setDate(targetDate);
      setGuesses(stored.guesses);
      setRevealed(stored.revealed);
      setSolved(next.solved);
      setComplete(next.complete);
      setExtraGuesses(next.extraGuesses);
    } catch (cause) {
      setPuzzle({ date: targetDate, clues: FALLBACK_CLUES, maxGuesses: 7, attempts: 0, solved: false, complete: false, extraGuesses: false, lifelineOptions: [] });
      setError(cause instanceof Error ? cause.message : "The reel is out of sync.");
    } finally {
      setLoading(false);
      setHydrated(true);
    }
  }, []);

  const begin = () => {
    setScreen("play");
    setHydrated(false);
    void loadPuzzle(today());
  };

  useEffect(() => {
    const handler = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowHowTo(false);
        setShowArchive(false);
        setShowStats(false);
        setLifelineOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (screen !== "play" || query.trim().length < 2 || selected) {
      searchAbort.current?.abort();
      return;
    }
    const timeout = window.setTimeout(async () => {
      searchAbort.current?.abort();
      const controller = new AbortController();
      searchAbort.current = controller;
      setSearching(true);
      setSearchError("");
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error("Search is unavailable");
        setResults(normalizeResults(await response.json()));
        setActiveResult(-1);
      } catch (cause) {
        if ((cause as Error).name !== "AbortError") {
          setSearchError(cause instanceof Error ? cause.message : "Search is unavailable");
          setResults([]);
          setActiveResult(-1);
        }
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [query, screen, selected]);

  useEffect(() => {
    if (screen === "play" && hydrated) {
      writeStored(date, { guesses, revealed, solved, complete, extraGuesses });
    }
  }, [complete, date, extraGuesses, guesses, hydrated, revealed, screen, solved]);

  const chooseResult = (result: SearchShape) => {
    setSelected(result);
    setQuery(resultTitle(result));
    setResults([]);
    setActiveResult(-1);
  };

  const submitGuess = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!selected || !puzzle || !canGuess) return;
    setSubmitting(true);
    setError("");
    try {
      const request = {
        date,
        guessId: first(selected.wikidataId, selected.id, selected.movieId) || undefined,
        guesses: guesses.map((guess) => guess.id).filter((id): id is string => Boolean(id)),
        extraGuesses,
        selectedLifelines: revealed,
      } satisfies GuessRequest;
      const response = await fetch("/api/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = asRecord(await response.json());
      if (!response.ok) throw new Error(first(payload.error) || `Guess request returned ${response.status}`);
      const correct = Boolean(payload.correct ?? payload.isCorrect ?? payload.solved);
      const returnedGuesses = Array.isArray(payload.guesses) ? payload.guesses : [];
      const nextGuesses: GuessView[] = returnedGuesses.length
        ? returnedGuesses.map((item) => {
            const guess = asRecord(item);
            return { id: first(guess.wikidataId, guess.id) || undefined, title: first(guess.title) || "Untitled film", year: first(guess.year) || undefined, correct: Boolean(guess.correct) };
          })
        : [...guesses, { id: first(selected.wikidataId, selected.id) || undefined, title: resultTitle(selected), year: resultYear(selected), correct, score: Number(payload.score) || undefined }];
      setGuesses(nextGuesses);
      const nextPuzzle = normalizePuzzle(payload, date);
      setPuzzle((current) => current ? { ...nextPuzzle, attempts: nextGuesses.length, maxGuesses: Number(payload.maxGuesses ?? nextPuzzle.maxGuesses ?? current.maxGuesses) || current.maxGuesses } : current);
      setSolved(nextPuzzle.solved || correct);
      setComplete(nextPuzzle.complete);
      setExtraGuesses(nextPuzzle.extraGuesses);
      setSelected(null);
      setQuery("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your guess missed the projector.");
    } finally {
      setSubmitting(false);
    }
  };

  const revealClue = async (key: ClueCategory) => {
    if (revealed.includes(key) || !puzzle || !lifelineAvailable) return;
    setSubmitting(true);
    setError("");
    try {
      const nextRevealed = [...revealed, key];
      const response = await fetch("/api/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "lifeline",
          date,
          guesses: guesses.map((guess) => guess.id).filter((id): id is string => Boolean(id)),
          selectedLifelines: nextRevealed,
          extraGuesses,
        } satisfies GuessRequest),
      });
      const payload = asRecord(await response.json());
      if (!response.ok) throw new Error(first(payload.error) || `Lifeline request returned ${response.status}`);
      const nextPuzzle = normalizePuzzle(payload, date);
      setRevealed(nextRevealed);
      setPuzzle(nextPuzzle);
      setSolved(nextPuzzle.solved);
      setComplete(nextPuzzle.complete);
      setExtraGuesses(nextPuzzle.extraGuesses);
      setLifelineOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The lifeline could not be opened.");
    } finally {
      setSubmitting(false);
    }
  };

  const extendRound = async () => {
    if (!extendAvailable || !puzzle) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/guess", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "extra",
          date,
          guesses: guesses.map((guess) => guess.id).filter((id): id is string => Boolean(id)),
          selectedLifelines: revealed,
          extraGuesses: false,
        } satisfies GuessRequest),
      });
      const payload = asRecord(await response.json());
      if (!response.ok) throw new Error(first(payload.error) || `Extension request returned ${response.status}`);
      const nextPuzzle = normalizePuzzle(payload, date);
      setPuzzle(nextPuzzle);
      setSolved(nextPuzzle.solved);
      setComplete(nextPuzzle.complete);
      setExtraGuesses(nextPuzzle.extraGuesses);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The extra guesses could not be added.");
    } finally {
      setSubmitting(false);
    }
  };

  const openArchive = async () => {
    setShowArchive(true);
    if (archive.length) return;
    const dates = previousDates(14);
    const items = await Promise.all(
      dates.map(async (item) => {
        try {
          const response = await fetch(`/api/game?date=${item}`, { cache: "no-store" });
          if (!response.ok) return null;
          const round = readStored(item);
          return {
            ...normalizePuzzle(await response.json(), item),
            attempts: round.guesses.length,
            solved: round.solved,
            complete: round.complete,
            extraGuesses: round.extraGuesses,
          };
        } catch {
          return null;
        }
      }),
    );
    setArchive(items.filter(Boolean) as PuzzleView[]);
  };

  const openStats = () => {
    setStats(summarizeStats(readStoredStats(), today()));
    setShowStats(true);
  };

  const showShareFeedback = (message: string) => {
    setShareFeedback(message);
    window.setTimeout(() => setShareFeedback(""), 2200);
  };

  const shareResult = async () => {
    if (!complete) return;
    const content = formatShareResult({ date, guesses, maxGuesses: effectiveLimit, solved });
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "TollyRiddl result", text: content });
        showShareFeedback("Shared");
        return;
      }
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
    }
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(content);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = content;
        textarea.setAttribute("readonly", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      showShareFeedback("Copied");
    } catch {
      showShareFeedback("Copy failed");
    }
  };

  const clueRows = useMemo(() => (puzzle?.clues ?? FALLBACK_CLUES).map((clue) => ({
    ...clue,
    revealed: clue.revealed || revealed.includes(clue.key as ClueCategory),
  })), [puzzle?.clues, revealed]);
  const visibleResults = query.trim().length >= 2 ? results.slice(0, 6) : [];

  const selectArchiveDate = (archiveDate: string) => {
    setShowArchive(false);
    setScreen("play");
    void loadPuzzle(archiveDate);
  };

  if (screen === "landing") {
    return (
      <main className="landing-shell">
        <nav className="topbar landing-nav" aria-label="Primary navigation">
          <Link className="brand" href="/" aria-label="TollyRiddl home"><span className="brand-mark">TR</span><span>Tolly<span>Riddl</span></span></Link>
          <div className="nav-actions"><button className="text-button" onClick={openStats}>Stats</button><button className="text-button" onClick={() => setShowHowTo(true)}>How to play</button><button className="outline-button" onClick={openArchive}>Archive</button></div>
        </nav>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow"><span className="live-dot" /> DAILY FILM RIDDLE · {today()}</p>
            <h1 id="hero-title">Name the film.<br /><em>Own the frame.</em></h1>
            <p className="hero-lede">Seven clues. One Tollywood story. How quickly can you find today’s title?</p>
            <button className="primary-button hero-cta" onClick={begin}>Play today’s riddle <span aria-hidden="true">→</span></button>
            <p className="streak-note"><span className="tiny-ticket" aria-hidden="true" /> A fresh Telugu film every day</p>
          </div>
          <div className="hero-art" aria-hidden="true">
            <div className="reel-ring reel-ring-one"><span /><span /><span /><span /><span /><span /></div>
            <div className="reel-ring reel-ring-two"><span /><span /><span /><span /><span /><span /></div>
            <div className="hero-ticket"><span className="ticket-kicker">THE DAILY REEL</span><strong>తెర</strong><span className="ticket-line" /><small>TOLLYRiddl / 01</small></div>
          </div>
        </section>
        <section className="landing-strip" aria-label="Game facts"><div><strong>01</strong><span>puzzle a day</span></div><div><strong>07</strong><span>clue categories</span></div><div><strong>∞</strong><span>film memories</span></div></section>
        <HowToDialog open={showHowTo} onClose={() => setShowHowTo(false)} />
        <ArchiveDialog open={showArchive} archive={archive} onSelect={selectArchiveDate} onClose={() => setShowArchive(false)} />
        <StatsDialog open={showStats} stats={stats} onClose={() => setShowStats(false)} />
      </main>
    );
  }

  return (
    <main className="app-shell">
      <nav className="topbar" aria-label="Primary navigation">
        <button className="brand brand-button" onClick={() => setScreen("landing")} aria-label="Back to TollyRiddl home"><span className="brand-mark">TR</span><span>Tolly<span>Riddl</span></span></button>
        <div className="nav-actions"><span className="date-chip">{date}</span><button className="text-button" onClick={openStats}>Stats</button><button className="text-button" onClick={() => setShowHowTo(true)}>How to play</button><button className="outline-button" onClick={openArchive}>Archive</button></div>
      </nav>
      <div className="play-layout">
        <section className="game-column" aria-labelledby="puzzle-title">
          <header className="play-heading"><div><p className="eyebrow">{date === today() ? "TODAY’S RIDDLE" : "ARCHIVE RIDDLE"} <span className="slash">/</span> {date}</p><h1 id="puzzle-title">What film is this?</h1></div><div className="guess-counter" aria-label={`${guesses.length} of ${effectiveLimit} guesses used`}><span>{String(Math.max(effectiveLimit - guesses.length, 0)).padStart(2, "0")}</span><small>guesses left</small></div></header>
          {loading && <div className="state-card" role="status"><span className="spinner" /> Loading the day’s reel…</div>}
          {error && <div className="error-banner" role="alert"><span>!</span><span>{error}</span><button onClick={() => void loadPuzzle(date)}>Retry</button></div>}
          {!loading && <>
            <div className="clue-board" aria-label="Film clues">
              <div className="board-topline"><span>CLUE BOARD</span><span>{revealed.length} / 2 lifelines used</span></div>
              <div className="clue-grid">{clueRows.map((clue, index) => <div className={`clue-card ${clue.revealed ? "is-revealed" : ""}`} key={clue.key}><div className="clue-number">0{index + 1}</div><div className="clue-content"><span>{clue.label}</span><strong>{clue.revealed ? clue.value : "••••••••"}</strong></div><div className="clue-state" aria-label={clue.revealed ? "Revealed" : "Hidden"}>{clue.revealed ? "OPEN" : "LOCK"}</div></div>)}</div>
              {lifelineAvailable && <button className="lifeline-button" onClick={() => setLifelineOpen(true)} disabled={submitting}>Pick a lifeline <b>{unlockedLifelines - revealed.length} available</b></button>}
            </div>
            {extendAvailable && <div className="extend-banner"><span><strong>Need one more scene?</strong> Add three guesses to this round.</span><button onClick={() => void extendRound()} disabled={submitting}>Extend +3</button></div>}
            <form className="guess-form" onSubmit={submitGuess}>
              <label htmlFor="movie-search">Your guess</label>
              <div className="search-wrap"><input id="movie-search" value={query} onChange={(event) => { setQuery(event.target.value); setSelected(null); setActiveResult(-1); }} onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => { if (!visibleResults.length) return; if (event.key === "ArrowDown") { event.preventDefault(); setActiveResult((current) => (current + 1) % visibleResults.length); } else if (event.key === "ArrowUp") { event.preventDefault(); setActiveResult((current) => (current <= 0 ? visibleResults.length - 1 : current - 1)); } else if (event.key === "Escape") { event.preventDefault(); setResults([]); setActiveResult(-1); } else if (event.key === "Enter") { event.preventDefault(); chooseResult(visibleResults[activeResult] ?? visibleResults[0]); } }} aria-controls={visibleResults.length ? "movie-search-results" : undefined} aria-activedescendant={activeResult >= 0 && activeResult < visibleResults.length ? `movie-search-result-${activeResult}` : undefined} placeholder="Search a film title…" autoComplete="off" disabled={complete || guesses.length >= effectiveLimit} /><span className="search-icon" aria-hidden="true">⌕</span>{searching && query.trim().length >= 2 && <span className="search-spinner" />}</div>
              {visibleResults.length > 0 && <div className="search-results" id="movie-search-results" role="listbox" aria-label="Film search results">{visibleResults.map((result, index) => <button type="button" role="option" id={`movie-search-result-${index}`} aria-selected={index === activeResult} key={`${resultTitle(result)}-${index}`} onClick={() => chooseResult(result)}><span>{resultTitle(result)}</span><small>{resultYear(result) || "Telugu film"}</small></button>)}</div>}
              {query.trim().length >= 2 && !selected && !searching && !results.length && <div className="empty-search">{searchError || "No films found. Try another title."}</div>}
              <button className="primary-button guess-button" disabled={!canGuess}>{submitting ? "Rolling…" : solved ? "Solved" : complete ? "Round complete" : "Lock in guess"}<span aria-hidden="true">↗</span></button>
            </form>
            {guesses.length > 0 && <section className="history" aria-labelledby="history-title"><div className="section-label"><h2 id="history-title">Your reel</h2><span>{guesses.length} {guesses.length === 1 ? "guess" : "guesses"}</span></div>{guesses.map((guess, index) => <div className={`history-row ${guess.correct ? "correct" : "miss"}`} key={`${guess.title}-${index}`}><span className="history-index">{String(index + 1).padStart(2, "0")}</span><span className="history-title">{guess.title}<small>{guess.year || "Film search"}</small></span><strong>{guess.correct ? "MATCH" : "MISS"}</strong></div>)}</section>}
            {complete && <div className={`result-card ${solved ? "" : "loss-card"}`} role="status">{solved && <span className="success-mark" aria-hidden="true" />}<div className="result-copy"><strong>{solved ? "That’s a wrap." : "End of the reel."}</strong><span>{solved ? `You found the film in ${guesses.length} ${guesses.length === 1 ? "guess" : "guesses"}.` : "The answer is open on the clue board."}</span>{shareFeedback && <small className="share-feedback" aria-live="polite">{shareFeedback}</small>}</div><div className="result-actions"><button className="share-button" onClick={() => void shareResult}>Share result</button><button className="result-secondary" onClick={openArchive}>See archive</button></div></div>}
          </>}
        </section>
        <aside className="side-rail" aria-label="Round information"><div className="rail-filmstrip" aria-hidden="true">{Array.from({ length: 8 }, (_, index) => <span key={index} />)}</div><div className="rail-card"><span className="rail-kicker">THE TOLLYWOOD EDIT</span><h2>Every day,<br /><em>one more story.</em></h2><p>Built for the films that stay with you.</p><div className="rail-divider" /><div className="rail-telugu">మన సినిమా</div><span className="rail-serial">TR / {date.replaceAll("-", ".")}</span></div><div className="rail-tip"><div><strong>Play fair</strong><small>Clues reveal on their own. Your memory does the rest.</small></div></div><a className="data-source" href="https://www.wikidata.org/wiki/Wikidata:Licensing" target="_blank" rel="noreferrer">Seed catalog: {catalogMeta.count} films · {catalogMeta.startYear}–{catalogMeta.endYear} ↗</a></aside>
      </div>
      <HowToDialog open={showHowTo} onClose={() => setShowHowTo(false)} />
      <ArchiveDialog open={showArchive} archive={archive} onSelect={selectArchiveDate} onClose={() => setShowArchive(false)} />
      <StatsDialog open={showStats} stats={stats} onClose={() => setShowStats(false)} />
      {lifelineOpen && <LifelineDialog clues={clueRows} options={puzzle?.lifelineOptions ?? []} onChoose={revealClue} onClose={() => setLifelineOpen(false)} />}
    </main>
  );
}

function ModalFrame({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const modalRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const modal = modalRef.current;
    const focusables = modal ? focusableElements(modal) : [];
    (focusables[0] ?? modal)?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab" || !modalRef.current) return;
    const focusables = focusableElements(modalRef.current);
    if (!focusables.length) {
      event.preventDefault();
      modalRef.current.focus();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section ref={modalRef} className="modal" role="dialog" tabIndex={-1} aria-modal="true" aria-labelledby={titleId} onKeyDown={handleKeyDown}><button className="modal-close" onClick={onClose} aria-label="Close dialog">×</button><p className="eyebrow">TOLLYRIDDL</p><h2 id={titleId}>{title}</h2>{children}</section></div>;
}

function HowToDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <ModalFrame title="How to play" onClose={onClose}><div className="howto-list"><div><b>01</b><span>Find the Telugu film in seven guesses. Every title in the game was released in 2000 or later.</span></div><div><b>02</b><span>Each guess narrows the year and opens any matching genre, cast, director, production, music, or writer clues.</span></div><div><b>03</b><span>Choose one lifeline after guess four and another after guess six. After guess seven, you can add three final guesses.</span></div><div><b>04</b><span>Finish the round to share a spoiler-free result grid and keep your local stats moving.</span></div></div><button className="primary-button modal-action" onClick={onClose}>Got it <span>→</span></button></ModalFrame>;
}

function StatsDialog({ open, stats, onClose }: { open: boolean; stats: StatsSummary; onClose: () => void }) {
  if (!open) return null;
  const maxDistribution = Math.max(...stats.distribution, 1);
  return <ModalFrame title="Your stats" onClose={onClose}><div className="stats-grid"><div><strong>{stats.played}</strong><span>played</span></div><div><strong>{stats.winRate}%</strong><span>win rate</span></div><div><strong>{stats.currentStreak}</strong><span>current streak</span></div><div><strong>{stats.maxStreak}</strong><span>max streak</span></div></div><div className="stats-distribution"><div className="stats-label">WIN DISTRIBUTION</div>{stats.distribution.map((count, index) => <div className="distribution-row" key={index}><b>{index + 1}</b><span><i style={{ width: `${(count / maxDistribution) * 100}%` }} /><em>{count}</em></span></div>)}</div><p className="archive-foot">Best solve: {stats.best ? `${stats.best} ${stats.best === 1 ? "guess" : "guesses"}` : "—"}. Stats stay on this device.</p></ModalFrame>;
}

function ArchiveDialog({ open, archive, onSelect, onClose }: { open: boolean; archive: PuzzleView[]; onSelect: (date: string) => void; onClose: () => void }) {
  if (!open) return null;
  return <ModalFrame title="The archive" onClose={onClose}><div className="archive-list">{archive.length ? archive.map((item) => <button type="button" className="archive-row" key={item.date} onClick={() => onSelect(item.date)}><span>{item.date}</span><strong>{item.solved ? "Completed" : "Play round"}</strong><b aria-hidden="true">→</b></button>) : <div className="archive-loading"><span className="spinner" /> Loading the last 14 days…</div>}</div><p className="archive-foot">One round per date. Progress stays on this device.</p></ModalFrame>;
}

function LifelineDialog({ clues, options, onChoose, onClose }: { clues: ClueView[]; options: ClueCategory[]; onChoose: (key: ClueCategory) => Promise<void> | void; onClose: () => void }) {
  const available = clues.filter((clue) => isClueCategory(clue.key) && options.includes(clue.key) && !clue.revealed);
  return <ModalFrame title="Choose a lifeline" onClose={onClose}><p className="modal-intro">Open one clue. Choose the detail that will move your investigation.</p><div className="lifeline-options">{available.map((clue) => <button key={clue.key} onClick={() => void onChoose(clue.key as ClueCategory)}><span>{clue.label}</span><b>Reveal →</b></button>)}</div></ModalFrame>;
}
