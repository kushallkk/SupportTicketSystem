import { beforeAll, describe, expect, it } from "vitest";
import { POST as authorize } from "@/app/api/realtime/auth/route";
import { loginAs, logout, makeUser } from "./helpers";

// Fake credentials: authorizeChannel only signs locally, nothing is sent to Pusher.
beforeAll(() => {
  process.env.PUSHER_APP_ID = "1";
  process.env.PUSHER_KEY = "testkey";
  process.env.PUSHER_SECRET = "testsecret";
  process.env.PUSHER_CLUSTER = "mt1";
});

const subscribe = (channel: string) => {
  const body = new URLSearchParams({ socket_id: "1234.5678", channel_name: channel });
  return authorize(new Request("http://localhost/api/realtime/auth", { method: "POST", body }));
};

describe("POST /api/realtime/auth (Pusher private channel authorisation)", () => {
  it("401 when signed out", async () => {
    logout();
    expect((await subscribe("private-user-anyone")).status).toBe(401);
  });

  it("signs a subscription to your own channel", async () => {
    const customer = await makeUser("USER");
    loginAs(customer);
    const res = await subscribe(`private-user-${customer.id}`);
    expect(res.status).toBe(200);
    expect((await res.json()).auth).toMatch(/^testkey:[0-9a-f]{64}$/);
  });

  it("refuses another user's channel, so nobody can read someone else's ticket events", async () => {
    const customer = await makeUser("USER");
    const other = await makeUser("USER");
    loginAs(customer);
    expect((await subscribe(`private-user-${other.id}`)).status).toBe(403);
  });

  it("keeps the admin channel to admins", async () => {
    const customer = await makeUser("USER");
    const agent = await makeUser("AGENT");
    const admin = await makeUser("ADMIN");

    loginAs(customer);
    expect((await subscribe("private-role-ADMIN")).status).toBe(403);
    loginAs(agent);
    expect((await subscribe("private-role-ADMIN")).status).toBe(403);
    loginAs(admin);
    expect((await subscribe("private-role-ADMIN")).status).toBe(200);
  });

  it("refuses channels that are not ours, and malformed requests", async () => {
    const admin = await makeUser("ADMIN");
    loginAs(admin);
    expect((await subscribe("public-news")).status).toBe(403);
    expect((await subscribe("presence-user-1")).status).toBe(403);

    const bad = await authorize(new Request("http://localhost/api/realtime/auth", { method: "POST", body: new URLSearchParams({}) }));
    expect(bad.status).toBe(400);
  });
});
