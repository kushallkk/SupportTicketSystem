import { describe, expect, it } from "vitest";
import { canJoinRoom, channelToRoom, roomToChannel } from "./realtime-channels";

describe("realtime channel mapping", () => {
  it("maps rooms to private Pusher channels and back", () => {
    expect(roomToChannel("user:abc123")).toBe("private-user-abc123");
    expect(roomToChannel("role:ADMIN")).toBe("private-role-ADMIN");
    expect(channelToRoom("private-user-abc123")).toBe("user:abc123");
    expect(channelToRoom("private-role-ADMIN")).toBe("role:ADMIN");
  });

  it("rejects channels that are not ours", () => {
    expect(channelToRoom("public-news")).toBeNull();
    expect(channelToRoom("private-other-thing")).toBeNull();
    expect(channelToRoom("presence-user-1")).toBeNull();
  });
});

describe("canJoinRoom", () => {
  const customer = { id: "u1", role: "USER" };
  const agent = { id: "a1", role: "AGENT" };
  const admin = { id: "m1", role: "ADMIN" };

  it("lets a user listen only to their own room", () => {
    expect(canJoinRoom("user:u1", customer)).toBe(true);
    expect(canJoinRoom("user:someone-else", customer)).toBe(false);
    expect(canJoinRoom("user:a1", agent)).toBe(true);
  });

  it("keeps the admin room to admins", () => {
    expect(canJoinRoom("role:ADMIN", admin)).toBe(true);
    expect(canJoinRoom("role:ADMIN", agent)).toBe(false);
    expect(canJoinRoom("role:ADMIN", customer)).toBe(false);
  });

  it("denies unknown rooms", () => {
    expect(canJoinRoom("role:AGENT", admin)).toBe(false);
    expect(canJoinRoom("", admin)).toBe(false);
  });
});
