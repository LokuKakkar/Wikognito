"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DossierListItem } from "@redactle/shared";
import { fetchDossiers } from "@/lib/api";
import { AppShell } from "../layout/AppShell";
import { Dossier } from "../layout/Dossier";
import { VerifyEmailBanner } from "../VerifyEmailBanner";
import { DeskProp } from "../desk/DeskProp";
import { ListPager, ListSearch } from "../list/ListControls";

const PAGE_SIZE = 20;

export function DossierListPage() {
  const [items, setItems] = useState<DossierListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    void fetchDossiers(page, PAGE_SIZE, query || undefined)
      .then((response) => {
        if (!cancelled) {
          setItems(response.items);
          setTotal(response.total);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load dossiers.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, query]);

  return (
    <AppShell>
      <main className="page">
        <VerifyEmailBanner />
        <Dossier
          wide
          kicker="Classified collections"
          title="Dossiers"
          decor={
            <DeskProp
              className="archive-stamp"
              src="/assets/detective/ui/stamp-archive.png"
              width={138}
              height={140}
              loading="eager"
            />
          }
        >
          <p className="muted">Themed investigations. Open a folder and work the case files in order.</p>
          <ListSearch
            id="dossier-search"
            label="Search dossiers"
            value={searchInput}
            onChange={setSearchInput}
            onSubmit={() => {
              setPage(1);
              setQuery(searchInput.trim());
            }}
            placeholder="Search by name or ID"
          />
          {error ? <p className="error">{error}</p> : null}
          {items.length === 0 && !error ? (
            <p className="muted">{query ? "No dossiers match this search." : "No published dossiers yet."}</p>
          ) : null}
          <ul className="archive-list dossier-collection">
            {items.map((item) => (
              <li key={item.id}>
                <Link href={`/dossiers/${item.slug}`}>
                  <img
                    className="archive-folder"
                    src="/assets/detective/ui/folder-available.png"
                    alt=""
                    width={160}
                    height={125}
                  />
                  <span className="archive-case-meta">
                    <strong>{item.title}</strong>
                    <span className="muted">
                      {item.caseCount} Case File{item.caseCount === 1 ? "" : "s"}
                    </span>
                    {item.description ? <span className="muted">{item.description}</span> : null}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <ListPager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </Dossier>
      </main>
    </AppShell>
  );
}
