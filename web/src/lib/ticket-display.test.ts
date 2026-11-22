import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatTicketId, initials, parseTicketRef, timeAgo } from "./ticket-display";

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

describe("formatTicketId", () => {
  it("pads to four digits with a TKT- prefix and lets large numbers grow", () => {
    expect(formatTicketId(1)).toBe("TKT-0001");
    expect(formatTicketId(42)).toBe("TKT-0042");
    expect(formatTicketId(9999)).toBe("TKT-9999");
    expect(formatTicketId(10000)).toBe("TKT-10000");
  });
});

describe("parseTicketRef", () => {
  it("recognises the ways people type a ticket ID", () => {
    for (const input of ["TKT-0042", "tkt-42", "TKT42", "tkt 42", "#42", "42", "  42  "]) {
      expect(parseTicketRef(input), input).toBe(42);
    }
  });

  it("ignores ordinary search text and non-positive numbers", () => {
    for (const input of ["invoice", "invoice 42", "TKT-", "", "0", "TKT-0000", "-5", "4.2", "12345678901"]) {
      expect(parseTicketRef(input), input).toBeNull();
    }
  });
});
