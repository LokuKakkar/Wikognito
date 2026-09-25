"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { ArticleSummary, ImportArticleResponse } from "@redactle/shared";
import {
  ApiRequestError,
  fetchAdminArticles,
  importWikipediaArticle,
} from "@/lib/api";
import { ListPager, ListSearch } from "../list/ListControls";
import { AdminNav } from "./AdminNav";

const PAGE_SIZE = 20;

export function ArticleImportPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportArticleResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  async function loadList(nextPage = page, nextQuery = query): Promise<void> {
    try {
      const data = await fetchAdminArticles(nextPage, PAGE_SIZE, nextQuery || undefined);
      setArticles(data.items);
      setPage(data.page);
      setTotal(data.total);
      setListError(null);
    } catch {
      setListError("Could not load imported articles.");
    }
  }

  useEffect(() => {
    void loadList(page, query);
  }, [page, query]);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setResult(null);
    if (!url.trim()) {
      setError("Please enter a valid Wikipedia article URL.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const imported = await importWikipediaArticle(url.trim());
      setResult(imported);
      setPage(1);
      setQuery("");
      setSearchInput("");
      await loadList(1, "");
    } catch (err) {
      if (err instanceof ApiRequestError && err.code === "VALIDATION_ERROR") {
        setError("Please enter a valid Wikipedia article URL.");
      } else {
        setError("Could not import the Wikipedia article.");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <AdminNav />
      <header className="header">
        <h1>Wikipedia Article Import</h1>
        <p className="muted">Paste a Wikipedia URL. The backend fetches and stores the article.</p>
      </header>

      <form className="admin-import-form" onSubmit={(event) => void onSubmit(event)}>
        <label className="sr-only" htmlFor="wikipedia-url">
          Wikipedia URL
        </label>
        <input
          id="wikipedia-url"
          type="text"
          name="url"
          placeholder="https://en.wikipedia.org/wiki/Pet_door"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Import Article
        </button>
      </form>

      {loading ? <p className="muted">Importing article...</p> : null}

      {error ? <p className="error">{error}</p> : null}

      {result ? (
        <section className="admin-result" aria-live="polite">
          <p>
            {result.status === "IMPORTED"
              ? "Article imported successfully."
              : "Article already exists."}
          </p>
          <p>
            Title: {result.article.title}
            <br />
            Status: {result.status}
          </p>
        </section>
      ) : null}

      <section>
        <h2>Imported articles</h2>
        <ListSearch
          id="article-search"
          label="Search articles"
          value={searchInput}
          onChange={setSearchInput}
          onSubmit={() => {
            setPage(1);
            setQuery(searchInput.trim());
          }}
          placeholder="Search by name or ID"
        />
        {listError ? <p className="error">{listError}</p> : null}
        {articles.length === 0 && !listError ? (
          <p className="muted">{query ? "No articles match this search." : "No articles imported yet."}</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-article-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>ID</th>
                  <th>External ID</th>
                  <th>Source</th>
                  <th>Revision ID</th>
                  <th>Imported At</th>
                  <th>Play</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>{article.title}</td>
                    <td>{article.id}</td>
                    <td>{article.externalId}</td>
                    <td>{article.source}</td>
                    <td>{article.revisionId ?? "—"}</td>
                    <td>{new Date(article.createdAt).toLocaleString()}</td>
                    <td>
                      <Link
                        className="admin-play-link"
                        href={`/admin/play/${encodeURIComponent(article.id)}`}
                      >
                        Play
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
