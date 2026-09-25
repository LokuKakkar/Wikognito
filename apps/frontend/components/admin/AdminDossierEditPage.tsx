"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { AdminDossierDetail, ArticleSummary } from "@redactle/shared";
import {
  addAdminDossierCase,
  fetchAdminArticles,
  fetchAdminDossier,
  removeAdminDossierCase,
  reorderAdminDossierCase,
  updateAdminDossier,
} from "@/lib/api";
import { AdminNav } from "./AdminNav";

export function AdminDossierEditPage({ id }: { id: string }) {
  const [dossier, setDossier] = useState<AdminDossierDetail | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [articles, setArticles] = useState<ArticleSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load(): Promise<void> {
    const data = await fetchAdminDossier(id);
    setDossier(data);
    setTitle(data.title);
    setDescription(data.description);
  }

  useEffect(() => {
    void load().catch(() => setError("Could not load dossier."));
  }, [id]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void fetchAdminArticles(1, 10, query || undefined)
        .then((data) => setArticles(data.items))
        .catch(() => undefined);
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  async function onSave(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    try {
      const updated = await updateAdminDossier(id, { title, description });
      setDossier(updated);
      setMessage("Saved.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    } finally {
      setLoading(false);
    }
  }

  async function setStatus(status: "DRAFT" | "PUBLISHED" | "ARCHIVED"): Promise<void> {
    setLoading(true);
    try {
      const updated = await updateAdminDossier(id, { status });
      setDossier(updated);
      setMessage(status === "PUBLISHED" ? "Dossier published." : `Status: ${status}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not update status.");
    } finally {
      setLoading(false);
    }
  }

  async function addArticle(articleId: string): Promise<void> {
    setLoading(true);
    try {
      const updated = await addAdminDossierCase(id, { articleId });
      setDossier(updated);
      setMessage("Case file added.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add case file.");
    } finally {
      setLoading(false);
    }
  }

  if (!dossier) {
    return (
      <main className="page">
        <AdminNav />
        {error ? <p className="error">{error}</p> : <p className="muted">Loading…</p>}
      </main>
    );
  }

  return (
    <main className="page">
      <AdminNav />
      <header className="header">
        <h1>{dossier.title}</h1>
        <p className="muted">
          {dossier.slug} · {dossier.status}
        </p>
      </header>
      <form className="admin-import-form" onSubmit={(event) => void onSave(event)}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} disabled={loading} />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Save
        </button>
        <button type="button" disabled={loading} onClick={() => void setStatus("PUBLISHED")}>
          Publish
        </button>
        <button type="button" disabled={loading} onClick={() => void setStatus("DRAFT")}>
          Unpublish
        </button>
        <button type="button" disabled={loading} onClick={() => void setStatus("ARCHIVED")}>
          Archive
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {message ? <p className="admin-result">{message}</p> : null}

      <section>
        <h2>Case files</h2>
        <ol className="admin-case-list">
          {dossier.cases.map((item) => (
            <li key={item.id}>
              <span>
                {String(item.position).padStart(2, "0")} {item.title} ({item.puzzleStatus})
              </span>
              <span className="admin-case-actions">
                <button
                  type="button"
                  disabled={loading || item.position === 1}
                  onClick={() =>
                    void reorderAdminDossierCase(id, item.id, item.position - 1).then(setDossier)
                  }
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={loading || item.position === dossier.cases.length}
                  onClick={() =>
                    void reorderAdminDossierCase(id, item.id, item.position + 1).then(setDossier)
                  }
                >
                  Down
                </button>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => void removeAdminDossierCase(id, item.id).then(setDossier)}
                >
                  Remove
                </button>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <h2>Add case file</h2>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search articles"
        />
        <ul className="admin-case-list">
          {articles.map((article) => (
            <li key={article.id}>
              <span>{article.title}</span>
              <button type="button" disabled={loading} onClick={() => void addArticle(article.id)}>
                Add
              </button>
            </li>
          ))}
        </ul>
      </section>
      <p>
        <Link href="/admin/dossiers">All dossiers</Link>
      </p>
    </main>
  );
}
