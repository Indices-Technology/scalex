import type { z } from 'zod'
import type { Optimization, Prisma } from '@prisma/client'
import { prisma } from '~~/layers/core/server/utils/db'
import { AppError, notFound } from '~~/layers/core/server/types/errors'
import type { CallContext } from '~~/layers/core/server/utils/modelGateway'
import { checkProposal, proposeListing, type CatalogueProduct } from '../utils/listingProposal'
import type { appliedSchema, createSchema, listSchema, productSchema } from '../schemas/optimization.schema'

/** What we keep as `input`: enough to re-run the same request later and compare prompt versions. */
interface StoredInput {
  product: z.infer<typeof productSchema>
  allowedCategories: string[]
  answers: { question: string; answer: string }[]
}

const OPEN = ['READY', 'NEEDS_REVIEW'] as const

const view = (o: Optimization) => ({
  id: o.id,
  status: o.status,
  sellerRef: o.sellerRef,
  productRef: o.productRef,
  parentId: o.parentId,
  promptVersion: o.promptVersion,
  proposal: o.proposal,
  problems: o.problems,
  applied: o.applied,
  rejectReason: o.rejectReason,
  createdAt: o.createdAt,
})

async function openRow(tenant: string, id: string) {
  const row = await prisma.optimization.findFirst({ where: { id, tenant } })
  if (!row) throw notFound('Optimization')
  return row
}

export const optimizationService = {
  /**
   * Propose a listing. A round with `parentId` refines the parent with the seller's answers and
   * retires it (SUPERSEDED), so each product has one open proposal at a time.
   */
  async create(ctx: CallContext, body: z.infer<typeof createSchema>) {
    const parent = body.parentId ? await openRow(ctx.tenant, body.parentId) : null
    if (parent && !(OPEN as readonly string[]).includes(parent.status)) {
      throw new AppError('NOT_OPEN', `That proposal is already ${parent.status.toLowerCase()}`, 409)
    }
    const prev = parent?.input as StoredInput | undefined
    const input: StoredInput = {
      product: body.product ?? prev!.product,
      allowedCategories: body.allowedCategories ?? prev!.allowedCategories,
      answers: [...(prev?.answers ?? []), ...body.answers],
    }
    const productRef = body.productRef ?? parent?.productRef ?? null
    const product: CatalogueProduct = { ...input.product, ref: productRef ?? 'new', answers: input.answers }

    let result
    try {
      result = await proposeListing(ctx, product, input.allowedCategories)
    } catch (err) {
      if (err instanceof AppError) throw err
      // Already recorded and logged by the gateway. The client shows its normal form instead.
      throw new AppError('AI_UNAVAILABLE', 'Suggestions are not available right now', 503)
    }
    const problems = checkProposal(product, result.output, input.allowedCategories)

    const row = await prisma.$transaction(async (tx) => {
      if (parent) await tx.optimization.update({ where: { id: parent.id }, data: { status: 'SUPERSEDED' } })
      return tx.optimization.create({
        data: {
          tenant: ctx.tenant,
          sellerRef: body.sellerRef,
          productRef,
          parentId: parent?.id,
          promptVersion: result.promptVersion,
          input: input as unknown as Prisma.InputJsonObject,
          proposal: result.output as unknown as Prisma.InputJsonObject,
          problems,
          status: problems.length ? 'NEEDS_REVIEW' : 'READY',
          modelCallId: result.callId,
        },
      })
    })
    return view(row)
  },

  async list(tenant: string, q: z.infer<typeof listSchema>) {
    const rows = await prisma.optimization.findMany({
      where: { tenant, status: q.status, sellerRef: q.sellerRef, productRef: q.productRef },
      orderBy: { createdAt: 'desc' },
      take: q.limit,
    })
    return rows.map(view)
  },

  /** The client published it. Safe to retry: a second report on an APPLIED row changes nothing. */
  async applied(tenant: string, id: string, body: z.infer<typeof appliedSchema>) {
    const row = await openRow(tenant, id)
    if (row.status === 'APPLIED') return view(row)
    if (!(OPEN as readonly string[]).includes(row.status)) {
      throw new AppError('NOT_OPEN', `That proposal is already ${row.status.toLowerCase()}`, 409)
    }
    const updated = await prisma.optimization.update({
      where: { id },
      data: { status: 'APPLIED', applied: body.values, productRef: body.productRef ?? row.productRef, decidedAt: new Date() },
    })
    return view(updated)
  },

  async rejected(tenant: string, id: string, reason: string) {
    const row = await openRow(tenant, id)
    if (row.status === 'REJECTED') return view(row)
    if (!(OPEN as readonly string[]).includes(row.status)) {
      throw new AppError('NOT_OPEN', `That proposal is already ${row.status.toLowerCase()}`, 409)
    }
    const updated = await prisma.optimization.update({
      where: { id },
      data: { status: 'REJECTED', rejectReason: reason, decidedAt: new Date() },
    })
    return view(updated)
  },
}
