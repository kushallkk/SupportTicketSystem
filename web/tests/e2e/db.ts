import fs from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { assertNotMainDatabase, readMainDatabaseUrl, resolveTestDatabaseUrl } from "../integration/guard";

const webDir = path.resolve(__dirname, "../..");
const url = resolveTestDatabaseUrl(webDir);
assertNotMainDatabase(url, readMainDatabaseUrl(webDir));

export const db = new PrismaClient({ datasourceUrl: url });

export const UPLOAD_DIR = path.resolve(webDir, ".uploads-e2e");
export const PASSWORD = "Passw0rd!";
export const ADMIN = { name: "E2E Admin", email: "e2e-admin@test.dev" };
export const AGENT_A = { name: "Agent Alpha", email: "e2e-agent-a@test.dev" };
export const AGENT_B = { name: "Agent Beta", email: "e2e-agent-b@test.dev" };

const TABLES = [
  "AssignmentLog", "Rating", "Attachment", "Comment", "Ticket",
  "AgentCategoryStat", "AgentProfile", "Category", "User",
];

/** Wipes the test DB and seeds one admin and two agents (the signup UI can't create admins). */
export async function resetAndSeed() {
  await fs.rm(UPLOAD_DIR, { recursive: true, force: true });
  await db.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  const passwordHash = await bcrypt.hash(PASSWORD, 8);
  const admin = await db.user.create({ data: { ...ADMIN, passwordHash, role: "ADMIN" } });
  const agentA = await db.user.create({
    data: { ...AGENT_A, passwordHash, role: "AGENT", agentProfile: { create: {} } },
  });
  const agentB = await db.user.create({
    data: { ...AGENT_B, passwordHash, role: "AGENT", agentProfile: { create: {} } },
  });
  return { admin, agentA, agentB };
}
