"use client";

import { ACTIVITY_CALENDAR_START, type ActivityDay } from "@redactle/shared";
import { formatDurationMs } from "@/lib/share";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

interface ActivityCalendarProps {
  activity: ActivityDay[];
  calendarStart?: string;
  now?: Date;
  compact?: boolean;
}

function utcKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return utcKey(date);
}

function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000);
}

function monthName(iso: string): string {
  return MONTHS[new Date(`${iso}T00:00:00.000Z`).getUTCMonth()];
}

export function ActivityCalendar({
  activity,
  calendarStart = ACTIVITY_CALENDAR_START,
  now = new Date(),
  compact = false,
}: ActivityCalendarProps) {
  const byDate = new Map(activity.map((day) => [day.date, day]));
  const today = utcKey(now);
  const start = calendarStart && calendarStart <= today ? calendarStart : today;
  const startPad = new Date(`${start}T00:00:00.000Z`).getUTCDay();
  const firstCell = addDays(start, -startPad);
  const span = daysBetween(firstCell, today);
  const cells: Array<{ date: string; day: ActivityDay | undefined; inRange: boolean }> = [];
  for (let index = 0; index <= span; index += 1) {
    const date = addDays(firstCell, index);
    cells.push({ date, day: byDate.get(date), inRange: date >= start && date <= today });
  }

  const monthLabels: string[] = [];
  let lastMonth = "";
  for (let index = 0; index < cells.length; index += 7) {
    const week = cells.slice(index, index + 7);
    const firstOfMonth = week.find((cell) => {
      const day = new Date(`${cell.date}T00:00:00.000Z`).getUTCDate();
      return day === 1;
    });
    const month = firstOfMonth
      ? monthName(firstOfMonth.date)
      : index === 0
        ? monthName(start)
        : "";
    if (month && month !== lastMonth) {
      monthLabels.push(month);
      lastMonth = month;
    } else {
      monthLabels.push("");
    }
  }

  return (
    <div className={`activity-heatmap${compact ? " compact" : ""}`}>
      <div className="activity-scroll">
        <div className="activity-heatmap-inner">
          <div className="activity-months-row" aria-hidden>
            <span className="activity-weekday-gutter" />
            <div className="activity-months">
              {monthLabels.map((label, index) => (
                <span key={`${label}-${index}`}>{label}</span>
              ))}
            </div>
          </div>
          <div className="activity-grid-row">
            <div className="activity-weekdays" aria-hidden>
              {WEEKDAY_LABELS.map((label, index) => (
                <span key={`dow-${index}`}>{label}</span>
              ))}
            </div>
            <div
              className="activity-calendar"
              role="img"
              aria-label={`Daily play calendar from ${start} to ${today}`}
            >
              {cells.map(({ date, day, inRange }) => {
                const state = !inRange ? "pad" : day?.status === "WON" ? "played" : day?.status === "GAVE_UP" ? "gave-up" : "";
                const label = !inRange
                  ? `${date}: Outside calendar range`
                  : day
                    ? `${date}: Puzzle #${day.puzzleNumber}. ${day.status === "WON" ? "Won" : "Gave up"}. ${day.guessCount} guesses, ${formatDurationMs(day.durationMs)}`
                    : `${date}: No daily game played`;
                return (
                  <span key={date} className={`activity-cell${state ? ` ${state}` : ""}`} title={label}>
                    <span className="sr-only">{label}</span>
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      {compact ? null : (
        <ul className="activity-legend">
          <li>
            <span className="activity-cell" aria-hidden />
            Not played
          </li>
          <li>
            <span className="activity-cell gave-up" aria-hidden />
            Gave up
          </li>
          <li>
            <span className="activity-cell played" aria-hidden />
            Won
          </li>
        </ul>
      )}
    </div>
  );
}
