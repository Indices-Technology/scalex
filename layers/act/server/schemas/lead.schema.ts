import { z } from 'zod'

const batch = z
  .string()
  .trim()
  .regex(/^[a-z0-9][a-z0-9-]{1,59}$/, 'Batch: 2–60 lower-case letters, digits or dashes, e.g. "oct-balogun-walk"')

export const importSchema = z.object({
  // ~2 MB is thousands of rows, far more than one batch should be.
  csv: z.string().min(1, 'The CSV is empty').max(2_000_000, 'CSV too large, split it into batches'),
  batch,
  source: z.enum(['CSV', 'INTERNAL', 'PLACES']).default('CSV'),
})

export const listSchema = z.object({
  batch: batch.optional(),
  status: z
    .enum(['NEW', 'CONTACTED', 'SIGNED_UP', 'STORE_CREATED', 'FIRST_LISTING', 'FIRST_ORDER', 'NOT_INTERESTED'])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
})

/** A step the tenant reports for one lead. NEW is where every lead starts, so it is never reported. */
export const eventSchema = z.object({
  inviteCode: z.string().regex(/^[\w-]{8}$/, 'Unknown invite code'),
  type: z.enum(['CONTACTED', 'SIGNED_UP', 'STORE_CREATED', 'FIRST_LISTING', 'FIRST_ORDER', 'NOT_INTERESTED']),
})
