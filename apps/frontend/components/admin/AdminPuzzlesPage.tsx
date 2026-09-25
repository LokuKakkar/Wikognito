"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type {
  GeneratePuzzleResponse,
  PublishTodayResponse,
  PuzzlePoolStats,
  PuzzleSummary,
  ValidatePuzzlesResponse,
} from "@redactle/shared";
import {
  fetchAdminPuzzles,
  fetchPuzzlePoolStats,
  generateAdminPuzzle,
  publishTodayPuzzle,
  validateAdminPuzzles,
} from "@/lib/api";
import { ListPager, ListSearch } from "../list/ListControls";
import { AdminNav } from "./AdminNav";

const PAGE_SIZE = 20;

export function AdminPuzzlesPage() {
  const [puzzles, setPuzzles] = useState<PuzzleSummary[]>([]);
  const [articleId, setArticleId] = useState("");
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateResult, setGenerateResult] = useState<GeneratePuzzleResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishTodayResponse | null>(null);
  const [validateResult, setValidateResult] = useState<ValidatePuzzlesResponse | null>(null);
  const [pool, setPool] = useState<PuzzlePoolStats | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  async function loadList(nextPage = page, nextQuery = query): Promise<void> {
    try {
      const [data, stats] = await Promise.all([
        fetchAdminPuzzles(nextPage, PAGE_SIZE, nextQuery || undefined),
        fetchPuzzlePoolStats(),
      ]);
      setPuzzles(data.items);
      setPage(data.page);
      setTotal(data.total);
      setPool(stats);
      setListError(null);
    } catch {
      setListError("Could not load puzzles.");
    }
  }

  useEffect(() => {
    void loadList(page, query);
  }, [page, query]);

  async function onGenerate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!articleId.trim()) {
      setError("Please enter an article ID.");
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    setGenerateResult(null);
    try {
      const result = await generateAdminPuzzle(articleId.trim(), force);
      setGenerateResult(result);
      if (result.status === "GENERATED") {
        setMessage(`Puzzle generated successfully. Status: READY`);
      } else if (result.status === "ALREADY_EXISTS") {
        setMessage("A puzzle already exists for this article and generator version.");
      } else {
        setError(result.reason ?? result.status);
      }
      await loadList();
    } catch {
      setError("Could not generate a puzzle from this article.");
    } finally {
      setLoading(false);
    }
  }

  async function onValidate(): Promise<void> {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await validateAdminPuzzles();
      setValidateResult(result);
      setMessage(
        result.failed === 0
          ? `Validated ${result.items.length} puzzles.`
          : `Validated ${result.items.length} puzzles; ${result.failed} failed.`,
      );
    } catch {
      setError("Could not validate puzzles.");
    } finally {
      setLoading(false);
    }
  }

  async function onPublishToday(): Promise<void> {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const result = await publishTodayPuzzle();
      setPublishResult(result);
      setMessage(
        result.status === "ALREADY_PUBLISHED"
          ? `Already published: Puzzle #${result.puzzleNumber}`
          : result.status === "NO_CANDIDATE"
            ? `No eligible READY puzzle for ${result.date}. DailyPuzzle was not changed.`
            : `Published Puzzle #${result.puzzleNumber} for ${result.date}`,
      );
      await loadList();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish today's puzzle.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <AdminNav />
      <header className="header">
        <h1>Puzzle Pool</h1>
        <p className="muted">Generate, validate, and publish daily puzzles from stored articles.</p>
      </header>
      {pool ? (
        <p className={pool.lowPool ? "error" : "muted"}>
          READY unused daily pool: {pool.readyUnused}
          {pool.lowPool
            ? ` — DAILY POOL LOW. Only ${pool.readyUnused} unused puzzles remain (threshold ${pool.warningThreshold}).`
            : ` · Used in daily: ${pool.usedInDaily} · Dossier-linked: ${pool.dossierLinked}`}
        </p>
      ) : null}

      <form className="admin-import-form" onSubmit={(event) => void onGenerate(event)}>
        <label className="sr-only" htmlFor="article-id">
          Article ID
        </label>
        <input
          id="article-id"
          type="text"
          name="articleId"
          placeholder="Article ID"
          value={articleId}
          onChange={(event) => setArticleId(event.target.value)}
          disabled={loading}
        />
        <label className="admin-force">
          <input
            type="checkbox"
            checked={force}
            onChange={(event) => setForce(event.target.checked)}
            disabled={loading}
          />
          Force regenerate
        </label>
        <button type="submit" disabled={loading}>
          Generate
        </button>
        <button type="button" disabled={loading} onClick={() => void onValidate()}>
          Validate
        </button>
        <button type="button" disabled={loading} onClick={() => void onPublishToday()}>
          Publish Today
        </button>
      </form>

      {loading ? <p className="muted">Working...</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="admin-result">{message}</p> : null}
      {generateResult?.reason ? <p className="muted">{generateResult.reason}</p> : null}
      {publishResult ? (
        <p className="muted">
          {publishResult.title} ({publishResult.puzzleId})
        </p>
      ) : null}
      {validateResult && validateResult.failed > 0 ? (
        <ul>
          {validateResult.items
            .filter((item) => !item.ok)
            .map((item) => (
              <li key={item.puzzleId}>
                {item.title}: {item.reason}
              </li>
            ))}
        </ul>
      ) : null}

      <section>
        <h2>Puzzles</h2>
        <ListSearch
          id="puzzle-search"
          label="Search puzzles"
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => {
            setPage(1);
            setQuery(searchInput.trim());
          }}
          placeholder="Search by name or ID"
        />
        {listError ? <p className="error">{listError}</p> : null}
        {puzzles.length === 0 && !listError ? (
          <p className="muted">{query ? "No puzzles match this search." : "No puzzles generated yet."}</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-article-table">
              <thead>
                <tr>
                  <th>Puzzle ID</th>
                  <th>Article</th>
                  <th>Status</th>
                  <th>Generator</th>
                  <th>Created</th>
                  <th>Published</th>
                  <th>Preview</th>
                </tr>
              </thead>
              <tbody>
                {puzzles.map((puzzle) => (
                  <tr key={puzzle.id}>
                    <td>{puzzle.id}</td>
                    <td>{puzzle.title}</td>
                    <td>{puzzle.status}</td>
                    <td>{puzzle.generatorVersion}</td>
                    <td>{new Date(puzzle.createdAt).toLocaleString()}</td>
                    <td>
                      {puzzle.publishedAt ? new Date(puzzle.publishedAt).toLocaleString() : "—"}
                    </td>
                    <td>
                      <Link
                        className="admin-play-link"
                        href={`/admin/play/${encodeURIComponent(puzzle.articleId)}`}
                      >
                        Preview
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <ListPager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      </section>
    </main>
  );
}
