/**
 * The rules of the leads loop, pure so they test without a database:
 * reading a CSV row, cleaning contacts, spotting duplicates, ranking, and moving a lead forward.
 */

export const FUNNEL = ['NEW', 'CONTACTED', 'SIGNED_UP', 'STORE_CREATED', 'FIRST_LISTING', 'FIRST_ORDER'] as const
export type FunnelStatus = (typeof FUNNEL)[number]
export type LeadStatus = FunnelStatus | 'NOT_INTERESTED'

export interface LeadInput {
  name: string
  phone: string | null
  email: string | null
  instagram: string | null
  city: string | null
  category: string | null
  notes: string
}

/** Nigerian numbers in any common shape → +234XXXXXXXXXX. Anything else → null. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = (raw ?? '').replace(/\D/g, '')
  if (d.length === 13 && d.startsWith('234')) return `+${d}`
  if (d.length === 11 && d.startsWith('0')) return `+234${d.slice(1)}`
  if (d.length === 10 && /^[789]/.test(d)) return `+234${d}`
  return null
}

/** "@Shop.Name", "instagram.com/shop.name/" → "shop.name". Not a valid handle → null. */
export function normalizeInstagram(raw: string | null | undefined): string | null {
  const v = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '')
    .replace(/^@/, '')
    .replace(/[/?#].*$/, '')
  return /^[a-z0-9._]{1,30}$/.test(v) ? v : null
}

export function normalizeEmail(raw: string | null | undefined): string | null {
  const v = (raw ?? '').trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

const blank = (v: string | undefined) => (v?.trim() ? v.trim() : null)

/**
 * Header row + data rows → leads. Columns are matched by name, any order, any case:
 * name, phone, email, instagram, city, category, notes. A row needs a name and at least one
 * way to reach the business, otherwise it is reported back with its line number.
 */
export function toLeads(rows: string[][]): { leads: LeadInput[]; invalid: { line: number; reason: string }[] } {
  const [header = [], ...data] = rows
  const col = (name: string) => header.findIndex((h) => h.trim().toLowerCase() === name)
  const idx = {
    name: col('name'),
    phone: col('phone'),
    email: col('email'),
    instagram: col('instagram'),
    city: col('city'),
    category: col('category'),
    notes: col('notes'),
  }
  const leads: LeadInput[] = []
  const invalid: { line: number; reason: string }[] = []
  if (idx.name < 0) return { leads, invalid: [{ line: 1, reason: 'No "name" column' }] }

  data.forEach((r, i) => {
    const line = i + 2 // 1-based, after the header
    const at = (k: keyof typeof idx) => (idx[k] < 0 ? undefined : r[idx[k]])
    const name = blank(at('name'))
    const lead: LeadInput = {
      name: name ?? '',
      phone: normalizePhone(at('phone')),
      email: normalizeEmail(at('email')),
      instagram: normalizeInstagram(at('instagram')),
      city: blank(at('city'))?.toLowerCase() ?? null,
      category: blank(at('category'))?.toLowerCase() ?? null,
      notes: blank(at('notes')) ?? '',
    }
    if (!name) invalid.push({ line, reason: 'No name' })
    else if (!lead.phone && !lead.email && !lead.instagram) invalid.push({ line, reason: 'No phone, email or Instagram we can use' })
    else leads.push(lead)
  })
  return { leads, invalid }
}

/** Same business = same phone, else same email, else same Instagram handle. */
export function dedupeKey(l: Pick<LeadInput, 'phone' | 'email' | 'instagram'>): string {
  if (l.phone) return `tel:${l.phone}`
  if (l.email) return `email:${l.email}`
  return `ig:${l.instagram}`
}

export interface Targets {
  categories: string[]
  cities: string[]
}

export function targetsFromEnv(env = process.env): Targets {
  const list = (v?: string) => (v ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
  return { categories: list(env.SCALEX_TARGET_CATEGORIES), cities: list(env.SCALEX_TARGET_CITIES) }
}

/**
 * Who to contact first. Explicit points, not a model: reachable person-to-person beats
 * everything, already selling online next, then fit with the category and cities we're
 * focusing on. Max 100.
 */
// ponytail: fixed weights; once a few batches have outcomes, re-weight from which signals
// actually led to FIRST_ORDER.
export function scoreLead(l: LeadInput, t: Targets): number {
  let s = 0
  if (l.phone) s += 30
  if (l.instagram) s += 20
  if (l.email) s += 10
  if (l.category && t.categories.some((c) => l.category!.includes(c))) s += 25
  if (l.city && t.cities.includes(l.city)) s += 15
  return s
}

/**
 * Where a lead goes when a step is reported. Steps only move forward (a late or repeated
 * report never moves a lead back). NOT_INTERESTED only applies before sign-up, and a lead who
 * said no but signs up anyway moves on.
 */
export function nextStatus(current: LeadStatus, reported: LeadStatus): LeadStatus {
  if (reported === 'NOT_INTERESTED') {
    return current === 'NEW' || current === 'CONTACTED' ? 'NOT_INTERESTED' : current
  }
  if (current === 'NOT_INTERESTED') return FUNNEL.indexOf(reported) >= FUNNEL.indexOf('SIGNED_UP') ? reported : current
  return FUNNEL.indexOf(reported) > FUNNEL.indexOf(current) ? reported : current
}

/**
 * How many leads reached each step, per group (batch or source). A lead at STORE_CREATED counts
 * for NEW, CONTACTED, SIGNED_UP and STORE_CREATED. NOT_INTERESTED leads count as contacted.
 */
export function funnel(leads: { group: string; status: LeadStatus }[]): Record<string, Record<FunnelStatus | 'NOT_INTERESTED', number>> {
  const out: Record<string, Record<FunnelStatus | 'NOT_INTERESTED', number>> = {}
  for (const { group, status } of leads) {
    const row = (out[group] ??= Object.fromEntries([...FUNNEL, 'NOT_INTERESTED'].map((s) => [s, 0])) as Record<
      FunnelStatus | 'NOT_INTERESTED',
      number
    >)
    const reached = status === 'NOT_INTERESTED' ? FUNNEL.indexOf('CONTACTED') : FUNNEL.indexOf(status)
    for (let i = 0; i <= reached; i++) row[FUNNEL[i]!]++
    if (status === 'NOT_INTERESTED') row.NOT_INTERESTED++
  }
  return out
}
