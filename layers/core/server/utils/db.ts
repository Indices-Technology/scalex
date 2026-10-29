import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

// Small pool per running copy (same reasoning as Posta's db.ts). Raise DATABASE_POOL_MAX on a
// single long-running server.
const max = Number(process.env.DATABASE_POOL_MAX) || 3

// Reused across dev hot reloads so we don't open a new pool on every save.
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL, max, idleTimeoutMillis: 10_000 }) })

globalForPrisma.prisma = prisma
