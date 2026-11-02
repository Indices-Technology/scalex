/**
 * Listing proposal: a better title, one category, a plain description and the questions to ask
 * the seller, for one product. Step 0.4b, the product optimizer.
 *
 * The model proposes; `checkProposal` (plain code) decides whether the proposal is usable.
 * Nothing here writes anywhere: the client applies changes in its own system (ARCHITECTURE §1a).
 */
import { z } from 'zod/v4'
import { callModel, type CallContext, type ModelBlock, type ModelResult } from '../../../core/server/utils/modelGateway'

// @2: store name (own branding is not "another shop"), uses, seller's answers folded in.
// @3: any product type, not just fashion; questions come with tap-to-answer choices.
// @4: specs, label/value facts for the product page Specifications section.
export const LISTING_PROMPT_VERSION = 'listing-proposal@4'
export const MAX_QUESTIONS = 4
export const MAX_TITLE = 70
export const MAX_SPECS = 10

/** A product as the client's catalogue describes it. Refs are the client's, opaque to us. */
export interface CatalogueProduct {
  ref: string
  title: string
  description: string
  price: number
  currency: string
  categories: string[]
  city: string | null
  imageUrls: string[]
  storeName?: string
  /** The seller's answers to an earlier proposal's askSeller questions. */
  answers?: { question: string; answer: string }[]
}

export const ListingProposalSchema = z.object({
  title: z.string().describe('The new title, in the words a buyer would search with'),
  category: z.string().describe('Exactly one category name, copied from the allowed list'),
  description: z
    .string()
    .describe('3 to 5 short sentences: what it is, who it is for and what it is for, then the facts'),
  specs: z
    .array(z.object({ label: z.string(), value: z.string() }))
    .describe(`Up to ${MAX_SPECS} label/value facts for the Specifications table, e.g. Brand: LG, Capacity: 34 litres`),
  uses: z.array(z.string()).describe('2 to 5 short moments or needs a buyer shops for, e.g. "owambe", "NEPA outages"'),
  searchPhrases: z.array(z.string()).describe('3 to 6 phrases a buyer in Nigeria would type to find this'),
  askSeller: z
    .array(
      z.object({
        question: z.string(),
        choices: z.array(z.string()).describe('Likely answers the seller can tap; empty only if no guess is possible'),
        multiple: z.boolean().describe('True if the seller may tap more than one choice, e.g. sizes'),
      }),
    )
    .describe(`At most ${MAX_QUESTIONS} questions, most important first`),
  flags: z.array(z.string()).describe('Problems with the listing a human should look at; empty if none'),
  confidence: z.enum(['high', 'medium', 'low']),
  reason: z.string().describe('One or two sentences on why this title and category'),
})
export type ListingProposal = z.infer<typeof ListingProposalSchema>

const SYSTEM = `You improve product listings for a Nigerian online marketplace so that real buyers find them in Google and in the marketplace's own search.

How to think about the title:
- Write what a buyer types, not what the seller sees. A buyer searches "adire gown" or "Dubai abaya", not "gold stone abaya" or "elegant flowing piece". Use the plain, common Nigerian name for the item first, then at most two details a buyer would actually filter on (for clothes: colour, fabric, style; for appliances and electronics: brand, size or capacity, model).
- Pattern: "<common item name>, <detail>, <detail>, <stock code>". Examples: "Dubai abaya, black with stone work, BA 455"; "LG inverter fridge, 2 door, 423 litres, GN-B422".
- Brand and model are what buyers of electronics and appliances search for: keep them. Drop marketing names and trademark symbols.
- If the current title has a stock code (like "BA 455" or "ADR 529"), keep it at the end exactly as written. The seller uses it to find the item.
- No price, city, shop name, emojis, ALL CAPS or hype words ("quality", "classy", "best").
- At most ${MAX_TITLE} characters.

Facts:
- Only state what you can see in the photos or what the seller wrote. If you are unsure of the fabric, do not name it; ask the seller instead.
- Stock code prefixes are a hint, not proof (ADR may mean adire). Trust the photo over the prefix.

Selling: people buy for a moment or a problem in their life, not for a spec. Say who the item is for and what it is for, in Nigerian terms, whatever the product is:
- clothes and accessories: the occasion (owambe, wedding guest, aso ebi, Sunday service, Jumat, Eid, office, everyday). A heavy aso oke gown suits owambe; a plain crepe bubu suits everyday and church.
- appliances, solar, electronics: the problem it solves and where (NEPA outages, saving on fuel, a small shop, a family of five, hot weather).
- food, beauty, home and anything else: who uses it and when (school runs, gifting, a growing family).
Pick only what fits what you see and were told. Open the description with that, then give the facts. Warm and direct, like a good shop assistant; no exaggeration.

The seller's own shop name, sign, logo or website in a photo is normal, not "another shop". Still flag phone numbers, prices and websites written on photos: buyers should pay through the marketplace.

If the seller answered questions, use those answers as facts and do not ask them again.

specs: the facts a buyer compares before paying, as short label/value pairs for a Specifications table. Only facts you can read in the photos (labels, boxes, rating plates) or the seller wrote or answered; never guess. Clothes: Fabric, Colour, Style, Sizes, Length. Appliances and electronics: Brand, Model, Capacity or Size, Power, Features, What is included, Warranty. Others: Brand, Size or Weight, Material, What is included. Labels in Title Case, values short (no sentences). Leave out anything you would have to guess; an empty list is fine.

Category: choose the single most specific category from the allowed list that a buyer would browse for this item. Copy its name exactly.

askSeller: the seller is busy and on a phone, so every question must be answerable with a tap. Ask only for facts a buyer needs before paying that are missing and that you cannot see (sizes available, fabric, what is included, warranty). At most ${MAX_QUESTIONS}, most important first, each under 10 words. Give the likely answers as choices, best guess first (sizes: "Free size", "S", "M", "L", "XL", "XXL"; warranty: "No warranty", "6 months", "1 year", "2 years"). Never ask what the photo already shows. Never ask about delivery, payment or returns: the marketplace handles those.

flags: anything a human should check: the photo does not match the title, the photo shows a phone number, website or another shop's watermark, the item looks like a different product type than its category, the description contradicts the photo.`

function describeProduct(p: CatalogueProduct, allowedCategories: string[]): string {
  return [
    `Current title: ${p.title}`,
    `Seller's description: ${p.description || '(none)'}`,
    `Price: ${p.price} ${p.currency}`,
    `Current categories: ${p.categories.join(', ') || '(none)'}`,
    `Seller's city: ${p.city ?? 'unknown'}`,
    `Shop name: ${p.storeName ?? 'unknown'}`,
    `Allowed categories: ${allowedCategories.join(', ')}`,
    ...(p.answers?.length ? ['Seller answered:', ...p.answers.map((a) => `- ${a.question} ${a.answer}`)] : []),
  ].join('\n')
}

export function proposeListing(
  ctx: CallContext,
  product: CatalogueProduct,
  allowedCategories: string[],
): Promise<ModelResult<ListingProposal>> {
  const content: ModelBlock[] = [
    ...product.imageUrls.map((url): ModelBlock => ({ type: 'image', source: { type: 'url', url } })),
    { type: 'text', text: describeProduct(product, allowedCategories) },
  ]
  return callModel({
    ctx,
    task: 'listing-proposal',
    promptVersion: LISTING_PROMPT_VERSION,
    system: SYSTEM,
    content,
    schema: ListingProposalSchema,
  })
}

const STOCK_CODE = /\b[A-Z]{1,4}[\s-]?\d{2,5}[A-Za-z]?\b/

/** Code decides: the reasons a proposal can't be used as-is. Empty = usable. */
export function checkProposal(
  product: CatalogueProduct,
  proposal: ListingProposal,
  allowedCategories: string[],
): string[] {
  const problems: string[] = []
  const title = proposal.title.trim()
  if (!title) problems.push('empty title')
  if (title.length > MAX_TITLE) problems.push(`title over ${MAX_TITLE} chars`)
  if (!allowedCategories.includes(proposal.category)) problems.push(`unknown category "${proposal.category}"`)
  const code = product.title.match(STOCK_CODE)?.[0]
  if (code && !title.replace(/[\s-]/g, '').includes(code.replace(/[\s-]/g, ''))) {
    problems.push(`dropped stock code ${code}`)
  }
  if (/₦|\bNGN\b|\d{1,3},\d{3}/.test(title)) problems.push('price in title')
  if (proposal.specs.length > MAX_SPECS) problems.push(`over ${MAX_SPECS} specs`)
  if (proposal.specs.some((s) => !s.label.trim() || !s.value.trim())) problems.push('empty spec')
  return problems
}
