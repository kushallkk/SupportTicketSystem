import { afterEach, describe, expect, it, vi } from "vitest";
import { classifyTicket, findDuplicates, routeTicket } from "./ml-client";

afterEach(() => vi.restoreAllMocks());

function mockFetch(impl: () => Promise<Response>) {
  return vi.spyOn(globalThis, "fetch").mockImplementation(impl as typeof fetch);
}

const json = (body: unknown, status = 200) =>
  Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));

describe("ML client fails soft so ticket creation never blocks on the ML service", () => {
  it("returns null when the service is unreachable", async () => {
    mockFetch(() => Promise.reject(new TypeError("fetch failed")));
    expect(await classifyTicket("t", "d")).toBeNull();
    expect(await findDuplicates([0.1])).toBeNull();
    expect(await routeTicket("billing", [])).toBeNull();
  });

  it("returns null on a non-2xx response", async () => {
    mockFetch(() => json({ detail: "boom" }, 500));
    expect(await classifyTicket("t", "d")).toBeNull();
  });

  it("returns null when the request times out", async () => {
    mockFetch(() => Promise.reject(new DOMException("timed out", "TimeoutError")));
    expect(await routeTicket("billing", [])).toBeNull();
  });
});

describe("ML client happy path", () => {
  it("posts title+description to /classify and returns the parsed body", async () => {
    const payload = { category: "account", priority: "HIGH", confidence: 0.9, embedding: [0.1] };
    const spy = mockFetch(() => json(payload));
    expect(await classifyTicket("Reset", "Cannot reset")).toEqual(payload);
    const [url, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/classify$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ title: "Reset", description: "Cannot reset" });
  });

  it("sends the snake_case exclude_ticket_id field the FastAPI model expects", async () => {
    const spy = mockFetch(() => json({ matches: [] }));
    await findDuplicates([0.1, 0.2], "t-1");
    const [, init] = spy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ embedding: [0.1, 0.2], exclude_ticket_id: "t-1" });
  });
});
