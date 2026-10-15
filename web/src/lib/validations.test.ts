import { describe, expect, it } from "vitest";
import { commentCreateSchema, loginSchema, ratingSchema, signupSchema, ticketCreateSchema } from "./validations";

describe("signupSchema", () => {
  const ok = { name: "Priya Sharma", email: "priya@example.com", password: "password123" };

  it("accepts USER and AGENT, defaulting to USER", () => {
    expect(signupSchema.parse(ok).role).toBe("USER");
    expect(signupSchema.parse({ ...ok, role: "AGENT" }).role).toBe("AGENT");
  });

  it("refuses to let anyone self-register as ADMIN", () => {
    expect(signupSchema.safeParse({ ...ok, role: "ADMIN" }).success).toBe(false);
  });

  it.each([
    [{ ...ok, email: "not-an-email" }],
    [{ ...ok, password: "short" }],
    [{ ...ok, name: "A" }],
  ])("rejects %j", (body) => {
    expect(signupSchema.safeParse(body).success).toBe(false);
  });
});

describe("ticketCreateSchema", () => {
  it("requires a meaningful title and description", () => {
    expect(ticketCreateSchema.safeParse({ title: "Hi", description: "A long enough description" }).success).toBe(false);
    expect(ticketCreateSchema.safeParse({ title: "Valid title", description: "short" }).success).toBe(false);
    expect(ticketCreateSchema.safeParse({ title: "Valid title", description: "A long enough description" }).success).toBe(true);
  });

  it("caps length", () => {
    expect(ticketCreateSchema.safeParse({ title: "x".repeat(201), description: "A long enough description" }).success).toBe(false);
  });
});

describe("ratingSchema", () => {
  it.each([0, 6, 3.5])("rejects score %s", (score) => {
    expect(ratingSchema.safeParse({ ticketId: "t", score }).success).toBe(false);
  });
  it.each([1, 3, 5])("accepts score %s", (score) => {
    expect(ratingSchema.safeParse({ ticketId: "t", score }).success).toBe(true);
  });
});

describe("commentCreateSchema / loginSchema", () => {
  it("rejects empty comments and defaults isInternal to false", () => {
    expect(commentCreateSchema.safeParse({ ticketId: "t", body: "" }).success).toBe(false);
    expect(commentCreateSchema.parse({ ticketId: "t", body: "hi" }).isInternal).toBe(false);
  });
  it("requires a password to log in", () => {
    expect(loginSchema.safeParse({ email: "a@b.co", password: "" }).success).toBe(false);
  });
});
