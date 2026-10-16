import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeEach, vi } from "vitest";
import { assertNotMainDatabase, readMainDatabaseUrl } from "./guard";

// Second line of defence (the config already checked): never truncate unless this
// worker is really connected to a database that isn't the main one.
assertNotMainDatabase(process.env.DATABASE_URL, readMainDatabaseUrl(path.resolve(__dirname, "../..")));

// Auth, the ML service and realtime are replaced; the routes, Prisma and Postgres are real.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/ml-client", () => ({
  classifyTicket: vi.fn(),
  findDuplicates: vi.fn(),
  routeTicket: vi.fn(),
  getModelInfo: vi.fn(),
  retrainModel: vi.fn(),
}));
vi.mock("@/lib/socket-server", () => ({
  emitTicketEvent: vi.fn(),
  emitToAdmins: vi.fn(),
  emitToUser: vi.fn(),
  setIO: vi.fn(),
  getIO: vi.fn(),
}));

const TABLES = [
  "AssignmentLog", "Rating", "Attachment", "Comment", "Ticket",
  "AgentCategoryStat", "AgentProfile", "Category", "User",
];

beforeEach(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);

  await fs.rm(process.env.UPLOAD_DIR!, { recursive: true, force: true });

  vi.resetAllMocks();
  // Default: ML service is down (every call fails soft to null). Tests opt in to ML behaviour.
  const ml = await import("@/lib/ml-client");
  vi.mocked(ml.classifyTicket).mockResolvedValue(null);
  vi.mocked(ml.findDuplicates).mockResolvedValue(null);
  vi.mocked(ml.routeTicket).mockResolvedValue(null);
});

afterAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  await prisma.$disconnect();
});
