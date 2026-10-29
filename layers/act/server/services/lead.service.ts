import { randomBytes } from 'node:crypto'
import type { z } from 'zod'
import { prisma } from '~~/layers/core/server/utils/db'
import { notFound } from '~~/layers/core/server/types/errors'
import { parseCsv } from '../utils/csv'
import {
  FUNNEL,
  dedupeKey,
  funnel,
  nextStatus,
  scoreLead,
  targetsFromEnv,
  toLeads,
  type LeadStatus,
} from '../utils/leadRules'
import type { eventSchema, importSchema, listSchema } from '../schemas/lead.schema'

const ALL_STATUSES: LeadStatus[] = [...FUNNEL, 'NOT_INTERESTED']

/** 8 url-safe characters (48 bits): short enough for a WhatsApp link, too many to guess. */
const newInviteCode = () => randomBytes(6).toString('base64url')

export const leadService = {
  /**
   * Import one batch. A business already known to this tenant (same phone/email/Instagram) is
   * skipped, never overwritten: its status and invite code may already be in use.
   */
  async importCsv(tenant: string, input: z.infer<typeof importSchema>) {
    const { leads, invalid } = toLeads(parseCsv(input.csv))
    const targets = targetsFromEnv()

    const byKey = new Map<string, (typeof leads)[number]>()
    for (const l of leads) if (!byKey.has(dedupeKey(l))) byKey.set(dedupeKey(l), l)

    const { count } = await prisma.lead.createMany({
      data: [...byKey].map(([key, l]) => ({
        ...l,
        tenant,
        batch: input.batch,
        source: input.source,
        score: scoreLead(l, targets),
        inviteCode: newInviteCode(),
        dedupeKey: key,
      })),
      skipDuplicates: true,
    })
    return {
      created: count,
      alreadyKnown: byKey.size - count,
      duplicatesInFile: leads.length - byKey.size,
      invalid,
    }
  },

  /** Highest score first: the order to contact them in. */
  list(tenant: string, q: z.infer<typeof listSchema>) {
    return prisma.lead.findMany({
      where: { tenant, batch: q.batch, status: q.status },
      orderBy: [{ score: 'desc' }, { createdAt: 'asc' }],
      take: q.limit,
      select: {
        inviteCode: true,
        batch: true,
        name: true,
        phone: true,
        email: true,
        instagram: true,
        city: true,
        category: true,
        notes: true,
        score: true,
        status: true,
      },
    })
  },

  /**
   * Record a step for one lead. Safe to repeat: one event row per step, and the status update
   * only matches leads the step moves forward, so concurrent or late reports can't move a lead
   * back.
   */
  async recordEvent(tenant: string, { inviteCode, type }: z.infer<typeof eventSchema>) {
    const lead = await prisma.lead.findFirst({ where: { tenant, inviteCode }, select: { id: true } })
    if (!lead) throw notFound('Lead')

    await prisma.leadEvent.upsert({
      where: { leadId_type: { leadId: lead.id, type } },
      create: { leadId: lead.id, type },
      update: {},
    })
    const movesFrom = ALL_STATUSES.filter((s) => s !== type && nextStatus(s, type) === type)
    await prisma.lead.updateMany({ where: { id: lead.id, status: { in: movesFrom } }, data: { status: type } })

    const { status } = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id }, select: { status: true } })
    return { inviteCode, status }
  },

  /** How far each batch and each source got. */
  async report(tenant: string) {
    const leads = await prisma.lead.findMany({ where: { tenant }, select: { batch: true, source: true, status: true } })
    return {
      total: leads.length,
      byBatch: funnel(leads.map((l) => ({ group: l.batch, status: l.status }))),
      bySource: funnel(leads.map((l) => ({ group: l.source, status: l.status }))),
    }
  },
}
