import { db, resetAndSeed } from "./db";

export default async function globalSetup() {
  await resetAndSeed();
  await db.$disconnect();
}
