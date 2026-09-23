"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ArticleSummary } from "@redactle/shared";
import { fetchAdminArticles } from "@/lib/api";
import { AdminNav } from "./AdminNav";

export function AdminPlayPickerPage() {
  const router = useRouter();
  const [articleId, setArticleId] = useState("");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [listError, setListError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchAdminArticles();
        if (!cancelled) {
          setArticles(data.items);
          setListError(null);
        }
      } catch {
        if (!cancelled) {
          setListError("Could not load stored articles.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function onSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const id = articleId.trim();
    if (!id) {
      setFormError("Enter a stored article id or external id.");
      return;
    }
    setFormError(null);
    router.push(`/admin/play/${encodeURIComponent(id)}`);
  }

  return (
    <main className="page">
      <AdminNav />
      <header className="header">
        <h1>Play a stored article</h1>
        <p className="muted">
          Generate a redacted puzzle from any article already in the database. This does not
          change today&apos;s official puzzle.
        </p>
      </header>

      <form className="admin-import-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="article-id">
          Article ID
        </label>
        <input
          id="article-id"
          type="text"
          name="articleId"
          placeholder="article-ada-lovelace or wikipedia:en:Pinocchio"
          value={articleId}
          onChange={(event) => setArticleId(event.target.value)}
        />
        <button type="submit">Play</button>
      </form>
      {formError ? <p className="error">{formError}</p> : null}

      <section>
        <h2>Stored articles</h2>
        {listError ? <p className="error">{listError}</p> : null}
        {articles.length === 0 && !listError ? (
          <p className="muted">No articles stored yet.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-article-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>ID</th>
                  <th>External ID</th>
                  <th>Source</th>
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
      </section>
    </main>
  );
}
