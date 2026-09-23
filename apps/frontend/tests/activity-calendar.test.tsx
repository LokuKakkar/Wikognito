import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ActivityCalendar } from "../components/stats/ActivityCalendar";

describe("ActivityCalendar", () => {
  it("starts at 2026-07-01, labels weekdays and months, and distinguishes won, gave-up, and empty", () => {
    render(
      <ActivityCalendar
        now={new Date("2026-08-21T12:00:00.000Z")}
        calendarStart="2026-07-01"
        activity={[
          {
            date: "2026-08-21",
            puzzleNumber: 183,
            status: "WON",
            guessCount: 42,
            durationMs: 312_000,
          },
          {
            date: "2026-08-19",
            puzzleNumber: 181,
            status: "GAVE_UP",
            guessCount: 12,
            durationMs: 40_000,
          },
        ]}
      />,
    );

    expect(screen.getByText(/Puzzle #183/)).toBeInTheDocument();
    expect(screen.getByText(/Puzzle #181/)).toBeInTheDocument();
    expect(screen.getAllByText(/No daily game played/).length).toBeGreaterThan(0);
    expect(document.querySelectorAll(".activity-calendar .activity-cell.played")).toHaveLength(1);
    expect(document.querySelectorAll(".activity-calendar .activity-cell.gave-up")).toHaveLength(1);
    expect(document.querySelectorAll(".activity-calendar .activity-cell.active")).toHaveLength(0);

    const startPad = new Date("2026-07-01T00:00:00.000Z").getUTCDay();
    expect(startPad).toBe(3);
    expect(document.querySelectorAll(".activity-calendar .activity-cell.pad")).toHaveLength(startPad);
    expect(document.querySelectorAll(".activity-calendar .activity-cell:not(.pad)")).toHaveLength(52);

    expect(screen.getByText("Jul")).toBeInTheDocument();
    expect(screen.getByText("Aug")).toBeInTheDocument();
    expect(screen.getByText("Mon")).toBeInTheDocument();
    expect(screen.getByText("Wed")).toBeInTheDocument();
    expect(screen.getByText("Fri")).toBeInTheDocument();
    expect(screen.getByText("Won", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Gave up", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Not played", { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText(/Daily play calendar from 2026-07-01/)).toBeInTheDocument();
  });

  it("does not activate archive or replay days that are absent from activity", () => {
    render(
      <ActivityCalendar
        now={new Date("2026-08-21T12:00:00.000Z")}
        calendarStart="2026-08-20"
        activity={[
          {
            date: "2026-08-21",
            puzzleNumber: 183,
            status: "WON",
            guessCount: 42,
            durationMs: 312_000,
          },
        ]}
      />,
    );
    expect(document.querySelectorAll(".activity-calendar .activity-cell.played")).toHaveLength(1);
    expect(document.querySelectorAll(".activity-calendar .activity-cell.gave-up")).toHaveLength(0);
    expect(screen.getByText(/2026-08-20: No daily game played/)).toBeInTheDocument();
  });
});
