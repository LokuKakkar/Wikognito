import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ArticleImportPage } from "../components/admin/ArticleImportPage";
import { ApiRequestError } from "@/lib/api";

const importWikipediaArticle = vi.fn();
const fetchAdminArticles = vi.fn();

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    importWikipediaArticle: (...args: unknown[]) => importWikipediaArticle(...args),
    fetchAdminArticles: (...args: unknown[]) => fetchAdminArticles(...args),
  };
});

const PET_ARTICLE = {
  id: "article-pet",
  externalId: "wikipedia:en:Pet_door",
  title: "Pet door",
  source: "WIKIPEDIA",
  sourceUrl: "https://en.wikipedia.org/wiki/Pet_door",
  revisionId: "123",
  language: "en",
  wordCount: 12,
  createdAt: "2026-08-13T00:00:00.000Z",
};

describe("ArticleImportPage", () => {
  beforeEach(() => {
    importWikipediaArticle.mockReset();
    fetchAdminArticles.mockReset();
    fetchAdminArticles.mockResolvedValue({ items: [], page: 1, pageSize: 20, total: 0 });
  });

  it("shows a validation message for an empty URL", async () => {
    const user = userEvent.setup();
    render(<ArticleImportPage />);
    await user.click(screen.getByRole("button", { name: "Import Article" }));
    expect(await screen.findByText("Please enter a valid Wikipedia article URL.")).toBeInTheDocument();
    expect(importWikipediaArticle).not.toHaveBeenCalled();
  });

  it("shows a validation message for an invalid URL", async () => {
    const user = userEvent.setup();
    importWikipediaArticle.mockRejectedValue(
      new ApiRequestError("Please enter a valid Wikipedia article URL.", 400, "VALIDATION_ERROR"),
    );
    render(<ArticleImportPage />);
    await user.type(screen.getByLabelText("Wikipedia URL"), "https://google.com");
    await user.click(screen.getByRole("button", { name: "Import Article" }));
    expect(await screen.findByText("Please enter a valid Wikipedia article URL.")).toBeInTheDocument();
  });

  it("disables submit while importing", async () => {
    const user = userEvent.setup();
    let resolveImport: (value: unknown) => void = () => undefined;
    importWikipediaArticle.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveImport = resolve;
        }),
    );
    render(<ArticleImportPage />);
    await user.type(screen.getByLabelText("Wikipedia URL"), "https://en.wikipedia.org/wiki/Pet_door");
    await user.click(screen.getByRole("button", { name: "Import Article" }));
    expect(screen.getByText("Importing article...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import Article" })).toBeDisabled();
    resolveImport({
      status: "IMPORTED",
      article: PET_ARTICLE,
    });
    await waitFor(() => {
      expect(screen.getByText("Article imported successfully.")).toBeInTheDocument();
    });
  });

  it("shows a successful import result", async () => {
    const user = userEvent.setup();
    importWikipediaArticle.mockResolvedValue({
      status: "IMPORTED",
      article: PET_ARTICLE,
    });
    fetchAdminArticles
      .mockResolvedValueOnce({ items: [], page: 1, pageSize: 20, total: 0 })
      .mockResolvedValueOnce({ items: [PET_ARTICLE], page: 1, pageSize: 20, total: 1 });
    render(<ArticleImportPage />);
    await user.type(screen.getByLabelText("Wikipedia URL"), "https://en.wikipedia.org/wiki/Pet_door");
    await user.click(screen.getByRole("button", { name: "Import Article" }));
    expect(await screen.findByText("Article imported successfully.")).toBeInTheDocument();
    expect(screen.getByText(/Status: IMPORTED/)).toBeInTheDocument();
    expect(importWikipediaArticle).toHaveBeenCalledWith("https://en.wikipedia.org/wiki/Pet_door");
    expect(await screen.findByText("wikipedia:en:Pet_door")).toBeInTheDocument();
  });

  it("shows already-exists status", async () => {
    const user = userEvent.setup();
    importWikipediaArticle.mockResolvedValue({
      status: "ALREADY_EXISTS",
      article: PET_ARTICLE,
    });
    render(<ArticleImportPage />);
    await user.type(
      screen.getByLabelText("Wikipedia URL"),
      "https://en.wikipedia.org/w/index.php?title=Pet_door&action=raw",
    );
    await user.click(screen.getByRole("button", { name: "Import Article" }));
    expect(await screen.findByText("Article already exists.")).toBeInTheDocument();
    expect(screen.getByText(/Status: ALREADY_EXISTS/)).toBeInTheDocument();
  });

  it("shows a generic failure without stack traces", async () => {
    const user = userEvent.setup();
    importWikipediaArticle.mockRejectedValue(
      new ApiRequestError("Wikipedia API request failed.", 502, "WIKIPEDIA_ERROR"),
    );
    render(<ArticleImportPage />);
    await user.type(screen.getByLabelText("Wikipedia URL"), "https://en.wikipedia.org/wiki/Pet_door");
    await user.click(screen.getByRole("button", { name: "Import Article" }));
    expect(await screen.findByText("Could not import the Wikipedia article.")).toBeInTheDocument();
    expect(screen.queryByText(/stack/i)).not.toBeInTheDocument();
  });

  it("renders the imported article list", async () => {
    fetchAdminArticles.mockResolvedValue({
      items: [PET_ARTICLE],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    render(<ArticleImportPage />);
    expect(await screen.findByText("Pet door")).toBeInTheDocument();
    expect(screen.getByText("wikipedia:en:Pet_door")).toBeInTheDocument();
    expect(screen.getByText("WIKIPEDIA")).toBeInTheDocument();
    expect(screen.getByText("article-pet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Play" })).toHaveAttribute(
      "href",
      "/admin/play/article-pet",
    );
    expect(fetchAdminArticles).toHaveBeenCalled();
  });

  it("searches imported articles by name or id", async () => {
    const user = userEvent.setup();
    fetchAdminArticles
      .mockResolvedValueOnce({ items: [PET_ARTICLE], page: 1, pageSize: 20, total: 1 })
      .mockResolvedValueOnce({ items: [PET_ARTICLE], page: 1, pageSize: 20, total: 1 });
    render(<ArticleImportPage />);
    expect(await screen.findByText("Pet door")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Search articles"), "article-pet");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(fetchAdminArticles).toHaveBeenCalledWith(1, 20, "article-pet");
    });
  });
});
