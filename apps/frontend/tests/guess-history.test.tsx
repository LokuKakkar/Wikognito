import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GuessHistory } from "../components/GuessHistory";

describe("GuessHistory", () => {
  it("marks a title-word hit with a bullseye and leaves body-only hits unmarked", () => {
    render(
      <GuessHistory
        guesses={["ada", "english"]}
        hitCounts={
          new Map([
            ["ada", 2],
            ["english", 1],
          ])
        }
        titleMatchKeys={new Set(["ada"])}
      />,
    );

    expect(screen.getByLabelText("Title word")).toBeInTheDocument();
    expect(screen.getByText("ada").closest("li")?.querySelector(".title-hit")).toBeTruthy();
    expect(screen.getByText("english").closest("li")?.querySelector(".title-hit")).toBeNull();
    expect(screen.getByText("english").closest("li")?.getAttribute("data-pen-anchor")).toBe("true");
    expect(screen.getByText("ada").closest("li")?.getAttribute("data-pen-anchor")).toBeNull();
  });

  it("calls onGuessFocus for hits and skips misses", async () => {
    const user = userEvent.setup();
    const onGuessFocus = vi.fn();
    render(
      <GuessHistory
        guesses={["ada", "zzzz"]}
        hitCounts={
          new Map([
            ["ada", 2],
            ["zzzz", 0],
          ])
        }
        onGuessFocus={onGuessFocus}
      />,
    );

    await user.click(screen.getByRole("button", { name: /ada/i }));
    expect(onGuessFocus).toHaveBeenCalledWith("ada");
    expect(screen.getByText("zzzz").closest("button")).toBeDisabled();
  });
});
