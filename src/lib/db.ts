import { PrismaClient } from "@prisma/client";

// Next dev-mode hot reload would otherwise open a new connection pool on every
// edit until SQLite runs out of handles.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/** The profile row is a singleton; create it lazily on first read. */
export async function getProfile() {
  const existing = await prisma.profile.findUnique({ where: { id: "singleton" } });
  if (existing) return existing;
  return prisma.profile.create({ data: { id: "singleton" } });
}

/** Read a Setting value with a fallback. */
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key } });
  return row?.value ?? fallback;
}

export async function setSetting(key: string, value: string) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}
