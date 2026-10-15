import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initials, timeAgo } from "./ticket-display";

describe("initials", () => {
  it("uses first letters of up to two words, uppercased", () => {
    expect(initials("priya sharma")).toBe("PS");
    expect(initials("Alex")).toBe("A");
    expect(initials("Mary Jane Watson")).toBe("MJ");
  });
});

describe("timeAgo", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-15T12:00:00Z"));
  });
  afterEach(() => vi.useRealTimers());

  const ago = (ms: number) => new Date(Date.now() - ms);

  it.each([
    [10_000, "just now"],
    [5 * 60_000, "5m ago"],
    [3 * 3_600_000, "3h ago"],
    [2 * 86_400_000, "2d ago"],
  ])("%d ms ago -> %s", (ms, expected) => {
    expect(timeAgo(ago(ms))).toBe(expected);
  });

  it("accepts ISO strings (what the API returns)", () => {
    expect(timeAgo("2026-06-15T11:00:00Z")).toBe("1h ago");
  });
});
