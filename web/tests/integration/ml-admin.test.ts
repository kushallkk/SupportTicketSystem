import { describe, expect, it, vi } from "vitest";
import { GET as modelInfo } from "@/app/api/ml/model/route";
import { POST as retrain } from "@/app/api/ml/retrain/route";
import { getModelInfo, retrainModel } from "@/lib/ml-client";
import { loginAs, logout, makeUser } from "./helpers";

describe("admin-only ML endpoints", () => {
  it.each(["USER", "AGENT"] as const)("refuse %s and never call the ML service", async (role) => {
    loginAs(await makeUser(role));
    expect((await modelInfo()).status).toBe(403);
    expect((await retrain()).status).toBe(403);
    expect(getModelInfo).not.toHaveBeenCalled();
    expect(retrainModel).not.toHaveBeenCalled();
  });

  it("401 when logged out", async () => {
    logout();
    expect((await modelInfo()).status).toBe(401);
    expect((await retrain()).status).toBe(401);
  });

  it("GET /api/ml/model reports available:false when the ML service is down", async () => {
    loginAs(await makeUser("ADMIN"));
    vi.mocked(getModelInfo).mockResolvedValue(null);
    expect(await (await modelInfo()).json()).toEqual({ available: false });
  });

  it("GET /api/ml/model passes the model details through", async () => {
    loginAs(await makeUser("ADMIN"));
    vi.mocked(getModelInfo).mockResolvedValue({ source: "built-in", trained_at: "2026-01-01T00:00:00+00:00", sources: { builtin: 54 }, benchmark: null });
    expect(await (await modelInfo()).json()).toMatchObject({ available: true, source: "built-in", sources: { builtin: 54 } });
  });

  it("POST /api/ml/retrain returns the outcome on success", async () => {
    loginAs(await makeUser("ADMIN"));
    vi.mocked(retrainModel).mockResolvedValue({ ok: true, promoted: true, saved: true, reason: "fine", sources: { builtin: 54 } });
    const res = await retrain();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, promoted: true, saved: true });
  });

  it.each([[409, "busy"], [502, "unreachable"], [503, "not configured"]])(
    "POST /api/ml/retrain passes through a %i failure with its message", async (status, error) => {
      loginAs(await makeUser("ADMIN"));
      vi.mocked(retrainModel).mockResolvedValue({ ok: false, status, error });
      const res = await retrain();
      expect(res.status).toBe(status);
      expect(await res.json()).toEqual({ error });
    }
  );
});
