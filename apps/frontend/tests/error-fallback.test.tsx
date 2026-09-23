import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorFallback } from "../components/ErrorFallback";

describe("ErrorFallback", () => {
  it("offers retry and a path back to today's puzzle", async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(
      <ErrorFallback title="Something went wrong" message="This page failed to load." onRetry={onRetry} />,
    );
    expect(screen.getByRole("heading", { name: "Something went wrong" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Back to today’s puzzle" })).toHaveAttribute("href", "/");
  });
});
