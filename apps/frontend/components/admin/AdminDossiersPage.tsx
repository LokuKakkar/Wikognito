"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import type { AdminDossierSummary } from "@redactle/shared";
import { createAdminDossier, fetchAdminDossiers } from "@/lib/api";
import { ListPager, ListSearch } from "../list/ListControls";
import { AdminNav } from "./AdminNav";

const PAGE_SIZE = 20;

export function AdminDossiersPage() {
  const [items, setItems] = useState<AdminDossierSummary[]>([]);
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  async function load(nextPage = page, nextQuery = query): Promise<void> {
    try {
      const data = await fetchAdminDossiers(nextPage, PAGE_SIZE, nextQuery || undefined);
      setItems(data.items);
      setPage(data.page);
      setTotal(data.total);
      setError(null);
    } catch {
      setError("Could not load dossiers.");
    }
  }

  useEffect(() => {
    void load(page, query);
  }, [page, query]);

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    try {
      await createAdminDossier({ slug, title, description });
      setSlug("");
      setTitle("");
      setDescription("");
      setPage(1);
      setQuery("");
      setSearchInput("");
      await load(1, "");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create dossier.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="page">
      <AdminNav />
      <header className="header">
        <h1>Dossiers</h1>
        <p className="muted">Create themed collections, then add case files from existing puzzles.</p>
      </header>
      <form className="admin-import-form" onSubmit={(event) => void onCreate(event)}>
        <input
          value={slug}
          onChange={(event) => setSlug(event.target.value)}
          placeholder="slug"
          disabled={loading}
        />
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Title"
          disabled={loading}
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          disabled={loading}
        />
        <button type="submit" disabled={loading}>
          Create
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      <ListSearch
        id="dossier-admin-search"
        label="Search dossiers"
        value={searchInput}
        onChange={setSearchInput}
        onSubmit={() => {
          setPage(1);
          setQuery(searchInput.trim());
        }}
        placeholder="Search by name or ID"
      />
      {items.length === 0 && !error ? (
        <p className="muted">{query ? "No dossiers match this search." : "No dossiers yet."}</p>
      ) : null}
      <div className="admin-table-wrap">
        <table className="admin-article-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Slug</th>
              <th>Status</th>
              <th>Cases</th>
              <th>Edit</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.title}</td>
                <td>{item.slug}</td>
                <td>{item.status}</td>
                <td>{item.caseCount}</td>
                <td>
                  <Link className="admin-play-link" href={`/admin/dossiers/${item.id}`}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ListPager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
    </main>
  );
}
