import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DossierListPage } from "../components/dossiers/DossierListPage";
import { DossierDetailPage } from "../components/dossiers/DossierDetailPage";

const fetchDossiers = vi.fn();
const fetchDossier = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/dossiers",
}));

vi.mock("@/lib/api", () => ({
  fetchDossiers: (...args: unknown[]) => fetchDossiers(...args),
  fetchDossier: (...args: unknown[]) => fetchDossier(...args),
  fetchMe: async () => null,
  fetchUserStats: async () => null,
  logout: async () => ({ ok: true }),
  googleAuthUrl: () => "http://localhost:4000/api/auth/google",
}));

describe("Dossier pages", () => {
  beforeEach(() => {
    fetchDossiers.mockReset();
    fetchDossier.mockReset();
  });

  it("lists published dossiers", async () => {
    fetchDossiers.mockResolvedValue({
      items: [
        {
          id: "d1",
          slug: "marvel-avengers",
          title: "Marvel Avengers",
          description: "Earth's Mightiest Heroes",
          coverImage: null,
          caseCount: 6,
        },
      ],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    render(<DossierListPage />);
    expect(await screen.findByText("Marvel Avengers")).toBeInTheDocument();
    expect(screen.getByText(/6 Case Files/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Marvel Avengers/ })).toHaveAttribute(
      "href",
      "/dossiers/marvel-avengers",
    );
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Search dossiers"), "d1");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() => {
      expect(fetchDossiers).toHaveBeenCalledWith(1, 20, "d1");
    });
  });

  it("shows case files and completion", async () => {
    fetchDossier.mockResolvedValue({
      id: "d1",
      slug: "marvel-avengers",
      title: "Marvel Avengers",
      description: "Earth's Mightiest Heroes",
      coverImage: null,
      status: "PUBLISHED",
      caseCount: 2,
      solvedCount: 1,
      closed: false,
      cases: [
        {
          id: "c1",
          position: 1,
          title: "Iron Man",
          titleWordLengths: [4, 3],
          puzzleId: "p1",
          playState: "SOLVED",
        },
        {
          id: "c2",
          position: 2,
          title: null,
          titleWordLengths: [4],
          puzzleId: "p2",
          playState: "UNSOLVED",
        },
      ],
    });
    render(<DossierDetailPage slug="marvel-avengers" />);
    expect(await screen.findByText("Iron Man")).toBeInTheDocument();
    expect(screen.queryByText("Thor")).not.toBeInTheDocument();
    expect(screen.getByText("Solved")).toBeInTheDocument();
    expect(screen.getByText("Unsolved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue dossier" })).toHaveAttribute(
      "href",
      "/dossiers/marvel-avengers/cases/c2",
    );
    expect(screen.getByRole("link", { name: "Case 01, solved" })).toHaveAttribute(
      "href",
      "/dossiers/marvel-avengers/cases/c1",
    );
    expect(screen.getByLabelText("Redacted case title")).toBeInTheDocument();
  });
});
