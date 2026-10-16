import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { categoryDisplayName } from "@/lib/categories";

/**
 * Finds the category for a slug, creating it on first use. Safe under concurrency: Category has
 * two unique columns (slug and name), and a plain `upsert` throws a unique-constraint error
 * (a 500) when two requests create the same new category at the same moment.
 */
export async function getOrCreateCategory(slug: string) {
  const existing = await prisma.category.findUnique({ where: { slug } });
  if (existing) return existing;

  try {
    return await prisma.category.create({ data: { slug, name: categoryDisplayName(slug) } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      // Another request created it between our read and our insert.
      return prisma.category.findUniqueOrThrow({ where: { slug } });
    }
    throw error;
  }
}
