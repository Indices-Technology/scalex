import { z } from 'zod'

// Client refs are opaque to us: any short id the client uses (a product id, a seller uuid).
const ref = z.string().trim().min(1).max(100)

export const productSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(300),
  description: z.string().max(10_000).default(''),
  price: z.number().nonnegative(),
  currency: z.string().length(3).default('NGN'),
  categories: z.array(z.string().max(100)).max(20).default([]),
  city: z.string().max(100).nullable().default(null),
  storeName: z.string().max(200).optional(),
  // The model fetches these itself, so they must be public https URLs. 4 keeps cost per product low.
  imageUrls: z.array(z.string().url().startsWith('https://', 'Image URLs must be https')).min(1, 'At least one photo').max(4),
})

const answer = z.object({ question: z.string().max(200), answer: z.string().max(500) })

/**
 * POST /api/v1/optimizations. A first round sends `product` + `allowedCategories`; a later round
 * sends `parentId` + the seller's `answers` and may leave the rest out to reuse the parent's.
 */
export const createSchema = z
  .object({
    sellerRef: ref,
    productRef: ref.optional(),
    parentId: z.string().uuid().optional(),
    product: productSchema.optional(),
    allowedCategories: z.array(z.string().trim().min(1).max(100)).min(1).max(500).optional(),
    answers: z.array(answer).max(10).default([]),
  })
  .refine((b) => b.parentId || (b.product && b.allowedCategories), {
    message: 'Send product and allowedCategories, or parentId',
    path: ['product'],
  })

export const listSchema = z.object({
  status: z.enum(['READY', 'NEEDS_REVIEW', 'APPLIED', 'REJECTED', 'SUPERSEDED']).optional(),
  sellerRef: ref.optional(),
  productRef: ref.optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
})

/** What the client actually published, after the seller's edits. */
export const appliedSchema = z.object({
  productRef: ref.optional(),
  values: z
    .object({
      title: z.string().max(300),
      description: z.string().max(10_000),
      category: z.string().max(100),
    })
    .partial(),
})

export const rejectedSchema = z.object({ reason: z.string().trim().min(1).max(500) })
