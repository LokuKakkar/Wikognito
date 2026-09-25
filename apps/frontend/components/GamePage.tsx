"use client";

import {
  LOCAL_STORAGE_ADMIN_PLAY_KEY,
  applyPlayDifficulty,
  emptyPuzzleStats,
  type DossierDetail,
  type PlayDifficulty,
  type PuzzleStats,
  type UserStatsResponse,
} from "@redactle/shared";
import { matchGuess } from "@redactle/puzzle-engine";
import { usePuzzle } from "@/features/game/usePuzzle";
import { useAdminPuzzle } from "@/features/game/useAdminPuzzle";
import { useDossierPuzzle } from "@/features/game/useDossierPuzzle";
import { useGame } from "@/features/game/useGame";
import { PuzzleArticle } from "./PuzzleArticle";
import { CaseDocument } from "./case/CaseDocument";
import { DetectiveNotepad } from "./notepad/DetectiveNotepad";
import { GuessInput } from "./GuessInput";
import { GuessHistory } from "./GuessHistory";
import { GuessSheet } from "./GuessSheet";
import { GameHud } from "./GameHud";
import { HitFeedback } from "./HitFeedback";
import { HowToPlay } from "./HowToPlay";
import { CaseIntro } from "./CaseIntro";
import { ResultCeremony } from "./ResultCeremony";
import { SolveStatsModal } from "./SolveStatsModal";
import { AdminNav } from "./admin/AdminNav";
import { AppShell } from "./layout/AppShell";
import { VerifyEmailBanner } from "./VerifyEmailBanner";
import { ShareModal } from "./ShareModal";
import { formatShareResult, type ShareVisualInput } from "@/lib/share";
import {
  hasSeenGuessTip,
  hasSeenHowTo,
  hasSeenLocateTip,
  markGuessTipSeen,
  markHowToSeen,
  markLocateTipSeen,
} from "@/lib/howto";
import { playGameSound } from "@/lib/sound";
import { readPlayDifficulty } from "@/lib/difficulty";
import { prefersReducedMotion } from "@/lib/motion";
import { CaseNotice } from "./case/CaseNotice";
import { advanceOccurrenceCursor } from "@/lib/cycle-occurrences";
import { useMe } from "@/features/auth/useMe";
import { fetchDossier, fetchPuzzleStats, fetchTodayLeaderboard, fetchUserStats } from "@/lib/api";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export interface GamePageProps {
  articleId?: string;
  archivePuzzleId?: string;
  dossierPlay?: { slug: string; caseId: string };
}

export function GamePage({ articleId, archivePuzzleId, dossierPlay }: GamePageProps = {}) {
  const isAdminPlay = Boolean(articleId);
  const isNonDailyPlay = Boolean(archivePuzzleId || dossierPlay);
  const daily = usePuzzle(!isAdminPlay && !dossierPlay, archivePuzzleId);
  const dossier = useDossierPuzzle(dossierPlay);
  const admin = useAdminPuzzle(articleId);
  const { puzzle, error, loading, officialResult } = isAdminPlay
    ? { ...admin, officialResult: null }
    : dossierPlay
      ? dossier
      : daily;
  const [difficulty, setDifficulty] = useState<PlayDifficulty>("easy");
  const [difficultyReady, setDifficultyReady] = useState(false);
  const playPuzzle = useMemo(
    () => (puzzle && difficultyReady ? applyPlayDifficulty(puzzle, difficulty) : null),
    [puzzle, difficulty, difficultyReady],
  );
  const playPuzzleRef = useRef(playPuzzle);
  playPuzzleRef.current = playPuzzle;
  const game = useGame(playPuzzle, {
    persistRemote: !isAdminPlay,
    storageKey: isAdminPlay ? LOCAL_STORAGE_ADMIN_PLAY_KEY : undefined,
  });
  const { user } = useMe();
  const [shareOpen, setShareOpen] = useState(false);
  const [replayFromOfficial, setReplayFromOfficial] = useState(false);
  const [currentStreak, setCurrentStreak] = useState<number | null>(null);
  const [rank, setRank] = useState<number | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [guessTipSeen, setGuessTipSeen] = useState(true);
  const [locateTipSeen, setLocateTipSeen] = useState(true);
  const [caseStarted, setCaseStarted] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  // Presentation-only counter: bumped on every submit so the pen can scribble.
  const [penTick, setPenTick] = useState(0);
  const [notepadReaction, setNotepadReaction] = useState<"idle" | "reject" | "confirm">("idle");
  const [paperReaction, setPaperReaction] = useState<"idle" | "hit" | "title">("idle");
  const [justWrittenGuess, setJustWrittenGuess] = useState<string | null>(null);
  const [stampMode, setStampMode] = useState<"striking" | "settled" | null>(null);
  const [justRevealed, setJustRevealed] = useState<string[]>([]);
  const [historyFocusId, setHistoryFocusId] = useState<string | null>(null);
  const [solveOpen, setSolveOpen] = useState(false);
  const [dossierFolder, setDossierFolder] = useState<DossierDetail | null>(null);
  const [userStats, setUserStats] = useState<UserStatsResponse | null>(null);
  const [fetchedPuzzleStats, setFetchedPuzzleStats] = useState<PuzzleStats | null>(null);
  const occurrenceCursor = useRef(new Map<string, number>());
  const openedForAttempt = useRef<string | null>(null);

  useEffect(() => {
    setDifficulty(readPlayDifficulty());
    setDifficultyReady(true);
  }, []);

  useEffect(() => {
    if (!dossierPlay) {
      setDossierFolder(null);
      return;
    }
    let cancelled = false;
    void fetchDossier(dossierPlay.slug)
      .then((folder) => {
        if (!cancelled) setDossierFolder(folder);
      })
      .catch(() => {
        if (!cancelled) setDossierFolder(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dossierPlay?.slug]);

  useEffect(() => {
    setReplayFromOfficial(false);
    setRank(null);
    setCaseStarted(false);
    setJustRevealed([]);
    setHistoryFocusId(null);
    setSolveOpen(false);
    setFetchedPuzzleStats(null);
    setNotepadReaction("idle");
    setPaperReaction("idle");
    setJustWrittenGuess(null);
    setStampMode(null);
    setPenTick(0);
    occurrenceCursor.current.clear();
    openedForAttempt.current = null;
  }, [archivePuzzleId, dossierPlay?.caseId, puzzle?.puzzleId]);

  useEffect(() => {
    if (isAdminPlay || isNonDailyPlay) {
      setHowToOpen(false);
      return;
    }
    setHowToOpen(!hasSeenHowTo());
    setGuessTipSeen(hasSeenGuessTip());
    setLocateTipSeen(hasSeenLocateTip());
  }, [isAdminPlay, isNonDailyPlay, puzzle?.puzzleId]);

  useEffect(() => {
    if (!user) {
      setUserStats(null);
      setCurrentStreak(null);
      return;
    }
    let cancelled = false;
    void fetchUserStats()
      .then((stats) => {
        if (cancelled) return;
        setUserStats(stats);
        setCurrentStreak(game.state?.status === "WON" ? stats.currentStreak : null);
      })
      .catch(() => {
        if (!cancelled) {
          setUserStats(null);
          setCurrentStreak(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, game.state?.status, game.state?.attemptId]);

  useEffect(() => {
    const result = game.completion;
    if (!result || !result.won || !result.isOfficial || result.source !== "DAILY" || result.scoreVersion !== 1) {
      setRank(null);
      return;
    }
    let cancelled = false;
    void fetchTodayLeaderboard()
      .then((board) => {
        if (!cancelled) setRank(board.me?.rank ?? null);
      })
      .catch(() => {
        if (!cancelled) setRank(null);
      });
    return () => {
      cancelled = true;
    };
  }, [game.completion]);

  const scrollToToken = useCallback((tokenId: string) => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const target = document.querySelector<HTMLElement>(`[data-token-id="${cssEscape(tokenId)}"]`);
    if (!reduced && target && typeof target.scrollIntoView === "function") {
      target.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, []);

  useEffect(() => {
    const result = game.lastResult;
    if (!result) return;
    const reduced = prefersReducedMotion();
    const current = playPuzzleRef.current;
    const titleHit = Boolean(current && result.matchedTokenIds.some((id) => current.titleTokenIds.includes(id)));
    const timers: number[] = [];

    if (result.isDuplicate) {
      playGameSound("miss");
      setNotepadReaction("reject");
      timers.push(window.setTimeout(() => setNotepadReaction("idle"), 360));
      return () => timers.forEach((id) => window.clearTimeout(id));
    }

    setJustWrittenGuess(result.normalizedGuess);
    timers.push(window.setTimeout(() => setJustWrittenGuess(null), 500));

    if (!result.isCorrect) {
      playGameSound("miss");
      setNotepadReaction("reject");
      timers.push(window.setTimeout(() => setNotepadReaction("idle"), 360));
      return () => timers.forEach((id) => window.clearTimeout(id));
    }

    setJustRevealed(result.matchedTokenIds);
    setHistoryFocusId(null);
    setNotepadReaction("confirm");
    setPaperReaction(titleHit ? "title" : "hit");
    playGameSound(result.gameCompleted && result.status === "WON" ? "win" : titleHit ? "title" : "hit");
    playGameSound("paper");
    scrollToToken(result.matchedTokenIds[0]);

    if (result.gameCompleted && result.status === "WON") {
      setStampMode(reduced ? "settled" : "striking");
      timers.push(
        window.setTimeout(() => {
          playGameSound("stamp");
        }, reduced ? 0 : 180),
      );
      timers.push(window.setTimeout(() => setStampMode("settled"), 420));
    }

    timers.push(window.setTimeout(() => setJustRevealed([]), 900));
    timers.push(window.setTimeout(() => setNotepadReaction("idle"), 400));
    timers.push(window.setTimeout(() => setPaperReaction("idle"), 420));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [game.lastResult, puzzle, scrollToToken]);

  useEffect(() => {
    if (game.state?.status === "WON") {
      if (game.lastResult?.gameCompleted && game.lastResult.status === "WON") return;
      setStampMode((mode) => mode ?? "settled");
      return;
    }
    if (game.state?.status === "IN_PROGRESS") {
      setStampMode(null);
    }
  }, [game.state?.status, game.lastResult]);

  const handleGuessFocus = useCallback(
    (guess: string) => {
      if (!playPuzzle) return;
      const match = matchGuess(playPuzzle.content, guess);
      if (match.hitCount === 0) return;
      const index = advanceOccurrenceCursor(occurrenceCursor.current, guess, match.matchedTokenIds.length);
      const tokenId = match.matchedTokenIds[index];
      if (!tokenId) return;
      setHistoryFocusId(tokenId);
      setJustRevealed([tokenId]);
      markLocateTipSeen();
      setLocateTipSeen(true);
      scrollToToken(tokenId);
      window.setTimeout(() => {
        setJustRevealed((current) => current.filter((id) => id !== tokenId));
      }, 900);
    },
    [playPuzzle, scrollToToken],
  );

  const recoveredLocally = Boolean(
    (game.state && game.state.status !== "IN_PROGRESS") || (game.state && game.state.guesses.length > 0),
  );
  const showOfficialGate = Boolean(
    officialResult &&
      !replayFromOfficial &&
      game.state?.status === "IN_PROGRESS" &&
      (game.state.guesses.length ?? 0) === 0 &&
      !recoveredLocally,
  );

  const clientAccuracy = useMemo(() => {
    const guesses = game.state?.guesses ?? [];
    if (guesses.length === 0) return null;
    const hits = guesses.filter((guess) => (game.hitCounts.get(guess) ?? 0) > 0).length;
    return hits / guesses.length;
  }, [game.state?.guesses, game.hitCounts]);

  const titleMatchKeys = useMemo(() => {
    const keys = new Set<string>();
    if (!playPuzzle) return keys;
    for (const token of playPuzzle.content) {
      if (token.inTitle && token.matchKey && playPuzzle.titleTokenIds.includes(token.tokenId)) {
        keys.add(token.matchKey);
      }
    }
    return keys;
  }, [playPuzzle]);

  const lastWasTitleHit = Boolean(
    game.lastResult &&
      playPuzzle &&
      game.lastResult.matchedTokenIds.some((id) => playPuzzle.titleTokenIds.includes(id)),
  );

  const shareVisual: ShareVisualInput | null = useMemo(() => {
    if (!puzzle || !game.state || game.state.status === "IN_PROGRESS") return null;
    return {
      puzzleNumber: puzzle.puzzleNumber,
      won: game.state.status === "WON",
      guessCount: game.state.guesses.length,
      durationMs: Math.max(0, (game.state.completedAt ?? Date.now()) - game.state.startedAt),
      accuracy: game.completion?.guessAccuracy ?? clientAccuracy,
      puzzleId: puzzle.puzzleId,
    };
  }, [puzzle, game.state, game.completion, clientAccuracy]);

  const shareText = useMemo(() => {
    if (!puzzle || !game.state || game.state.status === "IN_PROGRESS") return "";
    return formatShareResult({
      puzzleNumber: puzzle.puzzleNumber,
      won: game.state.status === "WON",
      guessCount: game.state.guesses.length,
      durationMs: Math.max(0, (game.state.completedAt ?? Date.now()) - game.state.startedAt),
      puzzleId: puzzle.puzzleId,
      accuracy: game.completion?.guessAccuracy ?? clientAccuracy,
    });
  }, [puzzle, game.state, game.completion, clientAccuracy]);

  const showCaseIntro = Boolean(
    !isAdminPlay &&
      !isNonDailyPlay &&
      !howToOpen &&
      !showOfficialGate &&
      !caseStarted &&
      !recoveredLocally &&
      (!game.state || game.state.status === "IN_PROGRESS"),
  );

  const shellVariant = showOfficialGate || error || loading || howToOpen || showCaseIntro ? "page" : "game";
  const terminal = game.state?.status === "WON" || game.state?.status === "GAVE_UP";
  const dossierCases = dossierFolder?.cases ?? [];
  const dossierIndex = dossierCases.findIndex((item) => item.id === dossierPlay?.caseId);
  const previousDossierCase = dossierIndex > 0 ? dossierCases[dossierIndex - 1] : undefined;
  const nextDossierCase =
    dossierIndex >= 0 && dossierIndex < dossierCases.length - 1
      ? dossierCases[dossierIndex + 1]
      : undefined;
  const nextDossierHref =
    dossierPlay && nextDossierCase
      ? `/dossiers/${dossierPlay.slug}/cases/${nextDossierCase.id}`
      : undefined;

  useEffect(() => {
    const key = terminal ? (game.state?.attemptId ?? null) : showOfficialGate ? officialResult?.completedAt ?? "filed" : null;
    if (!key) return;
    if (openedForAttempt.current === key) return;
    const delayMs = prefersReducedMotion() ? 0 : 2000;
    const timer = window.setTimeout(() => {
      openedForAttempt.current = key;
      setSolveOpen(true);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [terminal, game.state?.attemptId, showOfficialGate, officialResult?.completedAt, puzzle?.puzzleId, isNonDailyPlay]);

  useEffect(() => {
    if (isAdminPlay || !puzzle) return;
    if (!terminal && !showOfficialGate) return;
    if (game.completion?.puzzleStats) {
      setFetchedPuzzleStats(game.completion.puzzleStats);
      return;
    }
    let cancelled = false;
    void fetchPuzzleStats(puzzle.puzzleId)
      .then((stats) => {
        if (!cancelled) setFetchedPuzzleStats(stats);
      })
      .catch(() => {
        if (!cancelled) setFetchedPuzzleStats(emptyPuzzleStats(puzzle.puzzleId));
      });
    return () => {
      cancelled = true;
    };
  }, [isAdminPlay, puzzle, terminal, showOfficialGate, game.completion]);

  const body = renderBody();

  if (isAdminPlay) {
    return (
      <AppShell variant={shellVariant}>
        <AdminNav />
        {body}
      </AppShell>
    );
  }

  return (
    <AppShell variant={shellVariant}>
      <VerifyEmailBanner />
      {body}
    </AppShell>
  );

  function renderBody() {
    if (loading || !difficultyReady) {
      return (
        <CaseNotice title={dossierPlay ? "Dossier" : archivePuzzleId ? "Archive" : "Wikognito"}>
          <p>
            {dossierPlay
              ? "Opening case file…"
              : archivePuzzleId
                ? "Loading archive puzzle…"
                : "Opening today’s case…"}
          </p>
        </CaseNotice>
      );
    }

    if (error || !puzzle || !playPuzzle) {
      return (
        <CaseNotice
          title={isAdminPlay ? "Admin play" : dossierPlay ? "Dossier" : archivePuzzleId ? "Archive" : "Wikognito"}
          tone="error"
        >
          <p className="error">{error ?? "Puzzle unavailable."}</p>
          <p className="muted">
            {isAdminPlay
              ? "Check that the article id exists in the database."
              : "Today’s case isn’t ready. Confirm the API is running."}
          </p>
        </CaseNotice>
      );
    }

    const disabled = !game.ready || game.state?.status !== "IN_PROGRESS" || showOfficialGate || howToOpen || showCaseIntro;
    const showLeaderboardCta = Boolean(
      !isNonDailyPlay &&
        !isAdminPlay &&
        game.completion?.isOfficial &&
        game.completion.source === "DAILY" &&
        game.completion.won,
    );
    const durationMs = game.state
      ? Math.max(0, (game.state.completedAt ?? Date.now()) - game.state.startedAt)
      : 0;
    const score = game.completion?.scoreVersion === 1 ? game.completion.score : null;
    const puzzleStats =
      isAdminPlay
        ? emptyPuzzleStats(puzzle.puzzleId)
        : (game.completion?.puzzleStats ?? fetchedPuzzleStats ?? emptyPuzzleStats(puzzle.puzzleId));

    if (howToOpen) {
      return (
        <main className="page">
          <HowToPlay
            onDismiss={() => {
              markHowToSeen();
              setHowToOpen(false);
            }}
          />
        </main>
      );
    }

    if (showOfficialGate && officialResult) {
      return (
        <main className="page">
          <ResultCeremony
            variant="filed"
            status={officialResult.status}
            title={puzzle.title}
            puzzleNumber={puzzle.puzzleNumber}
            showShare={false}
            showLeaderboardCta={false}
            onReplay={() => setReplayFromOfficial(true)}
            nextHref={nextDossierHref}
            nextLabel={nextDossierHref ? "Next case" : undefined}
          />
          <SolveStatsModal
            open={solveOpen}
            onClose={() => setSolveOpen(false)}
            status={officialResult.status}
            guessCount={officialResult.guessCount}
            durationMs={officialResult.durationMs}
            accuracy={officialResult.guessAccuracy}
            puzzleStats={puzzleStats}
            activity={user ? userStats?.activity : undefined}
            calendarStart={userStats?.calendarStart}
            showGuestNudge={false}
          />
        </main>
      );
    }

    if (showCaseIntro) {
      return (
        <main className="page">
          <CaseIntro
            puzzleNumber={puzzle.puzzleNumber}
            scheduledDate={puzzle.scheduledDate}
            onBegin={() => setCaseStarted(true)}
            onBriefing={() => setHowToOpen(true)}
          />
        </main>
      );
    }

    const showGuessCoach =
      !guessTipSeen && (game.state?.guesses.length ?? 0) === 0 && game.state?.status === "IN_PROGRESS";
    const dismissGuessCoach = () => {
      markGuessTipSeen();
      setGuessTipSeen(true);
    };
    const dismissLocateHint = () => {
      markLocateTipSeen();
      setLocateTipSeen(true);
    };

    const history = (
      <GuessHistory
        guesses={game.state?.guesses ?? []}
        hitCounts={game.hitCounts}
        titleMatchKeys={titleMatchKeys}
        onGuessFocus={handleGuessFocus}
        justWrittenGuess={justWrittenGuess}
        showLocateHint={!locateTipSeen}
        onDismissLocateHint={dismissLocateHint}
      />
    );

    const ceremony =
      terminal && game.state && game.state.status !== "IN_PROGRESS" ? (
        <ResultCeremony
          variant="live"
          status={game.state.status}
          title={game.title}
          puzzleNumber={puzzle.puzzleNumber}
          score={score}
          rank={isAdminPlay ? null : rank}
          currentStreak={isAdminPlay ? null : currentStreak}
          showLeaderboardCta={showLeaderboardCta}
          showShare={!isAdminPlay}
          onReplay={() => {
            setCaseStarted(true);
            setSolveOpen(false);
            openedForAttempt.current = null;
            setStampMode(null);
            setNotepadReaction("idle");
            setPaperReaction("idle");
            setJustWrittenGuess(null);
            game.replay();
          }}
          onShare={() => setShareOpen(true)}
          nextHref={nextDossierHref}
          nextLabel={nextDossierHref ? "Next case" : undefined}
        />
      ) : null;

    return (
      <>
        <div className="game-shell">
          <section className="article-pane">
            {isAdminPlay ? <h1 className="page-title">Admin play</h1> : null}
            {ceremony}
            <CaseDocument
              caseNumber={isAdminPlay ? undefined : puzzle.puzzleNumber}
              label={
                isAdminPlay
                  ? "Stored article preview"
                  : dossierPlay
                    ? "Dossier case file"
                    : archivePuzzleId
                      ? "Archive case file"
                      : "Daily case file"
              }
              filedOn={isAdminPlay ? undefined : puzzle.scheduledDate}
              fileStatus={
                game.state?.status === "WON" ? "solved" : game.state?.status === "GAVE_UP" ? "closed" : "redacted"
              }
              paperReaction={paperReaction}
              stamp={game.state?.status === "WON" && stampMode ? { mode: stampMode } : null}
              banner={!terminal ? <HitFeedback lastResult={game.lastResult} titleHit={lastWasTitleHit} /> : null}
              meta={
                <span className="muted">
                  {isAdminPlay
                    ? "Preview from a stored article — not today's official puzzle."
                    : `Puzzle #${puzzle.puzzleNumber} · ${puzzle.scheduledDate}`}
                  {isAdminPlay ? (
                    <>
                      {" · "}
                      <Link href="/admin/play">All stored articles</Link>
                    </>
                  ) : dossierPlay ? (
                    <>
                      {dossierIndex >= 0 ? ` · Case ${String(dossierCases[dossierIndex]?.position ?? dossierIndex + 1).padStart(2, "0")} of ${dossierCases.length}` : ""}
                      {previousDossierCase ? (
                        <>
                          {" · "}
                          <Link href={`/dossiers/${dossierPlay.slug}/cases/${previousDossierCase.id}`}>
                            Previous
                          </Link>
                        </>
                      ) : null}
                      {nextDossierCase ? (
                        <>
                          {" · "}
                          <Link href={`/dossiers/${dossierPlay.slug}/cases/${nextDossierCase.id}`}>Next</Link>
                        </>
                      ) : null}
                      {" · "}
                      <Link href={`/dossiers/${dossierPlay.slug}`}>Back to dossier</Link>
                    </>
                  ) : archivePuzzleId ? (
                    <>
                      {" · "}
                      <Link href="/">Today</Link>
                    </>
                  ) : null}
                </span>
              }
            >
              <PuzzleArticle
                puzzle={playPuzzle}
                revealedTokenIds={game.revealedTokenIds}
                justRevealedTokenIds={new Set(justRevealed)}
                historyFocusTokenIds={historyFocusId ? new Set([historyFocusId]) : undefined}
                displayValueForToken={game.displayValueForToken}
              />
            </CaseDocument>
          </section>
          <aside className="control-pane">
            <DetectiveNotepad penTick={penTick} reaction={notepadReaction}>
              <GameHud
                guessCount={game.state?.guesses.length ?? 0}
                canGiveUp={game.state?.status === "IN_PROGRESS"}
                onBriefing={() => setBriefingOpen(true)}
                onGiveUp={() => {
                  void game.giveUp();
                }}
              />
              <div className="history-desktop">{history}</div>
              <div className="last-guess-mobile">
                <GuessHistory
                  guesses={game.state?.guesses ?? []}
                  hitCounts={game.hitCounts}
                  titleMatchKeys={titleMatchKeys}
                  onGuessFocus={handleGuessFocus}
                  limit={2}
                  justWrittenGuess={justWrittenGuess}
                  showLocateHint={!locateTipSeen}
                  onDismissLocateHint={dismissLocateHint}
                />
              </div>
              <GuessSheet
                open={historyOpen}
                guessCount={game.state?.guesses.length ?? 0}
                onOpen={() => setHistoryOpen(true)}
                onClose={() => setHistoryOpen(false)}
              >
                {history}
              </GuessSheet>
              <GuessInput
                disabled={disabled}
                coach={showGuessCoach}
                onDismissCoach={dismissGuessCoach}
                onGuess={(guess) => {
                  dismissGuessCoach();
                  setPenTick((tick) => tick + 1);
                  playGameSound("scribble");
                  game.submitGuess(guess);
                }}
              />
            </DetectiveNotepad>
          </aside>
        </div>
        {briefingOpen ? (
          <HowToPlay
            presentation="overlay"
            dismissLabel="Back to the case"
            onDismiss={() => {
              markHowToSeen();
              setBriefingOpen(false);
            }}
          />
        ) : null}
        <ShareModal
          open={shareOpen}
          text={shareText}
          visual={shareVisual}
          puzzleStats={puzzleStats}
          onClose={() => setShareOpen(false)}
        />
        {terminal && game.state && game.state.status !== "IN_PROGRESS" ? (
          <SolveStatsModal
            open={solveOpen}
            onClose={() => setSolveOpen(false)}
            status={game.state.status}
            guessCount={game.state.guesses.length}
            durationMs={durationMs}
            accuracy={game.completion?.guessAccuracy ?? clientAccuracy}
            puzzleStats={puzzleStats}
            activity={user ? userStats?.activity : undefined}
            calendarStart={userStats?.calendarStart}
            showGuestNudge={!isAdminPlay && !user && game.state.status === "WON"}
          />
        ) : null}
      </>
    );
  }
}

function cssEscape(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/"/g, '\\"');
}
