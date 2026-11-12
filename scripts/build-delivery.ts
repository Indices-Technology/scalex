/**
 * Turn an optimizer-dry-run JSON into a deliver-optimizations payload.
 *
 *   npx tsx scripts/build-delivery.ts reports/optimizer-dry-run-<store>-<date>.json <runId>
 *
 * improved: proposals that passed every code check (title, description, specs; MarketX writes
 *           title/description only if the store opted in, specs only where none exist).
 * toCheck:  the optimizer's flags and any check problems, sent to the seller as notes.
 * A product can be in both: an improved title and "remove the phone number from your photo".
 */
import { readFileSync, writeFileSync } from 'node:fs'

const [file, runId] = process.argv.slice(2)
if (!file || !runId) throw new Error('usage: <dry-run.json> <runId>')

type Row = {
  product: { ref: string }
  proposal?: { title: string; description: string; specs: { label: string; value: string }[]; flags: string[] }
  problems: string[]
}
const rows: Row[] = JSON.parse(readFileSync(file, 'utf8'))

// A flag that hits most of the store (e.g. the shop's phone number on every photo) is one
// store-level message, not N identical lines in the seller's email. Dropped here; tell the
// seller once by hand. ponytail: regex match; a store-level note field in the deliver API if this recurs.
const PHOTO_CONTACT = /phone|whatsapp|website/i
const allFlags = rows.flatMap((r) => r.proposal?.flags ?? [])
const storeWide = new Set(
  rows.filter((r) => r.proposal).length > 3 && allFlags.filter((f) => PHOTO_CONTACT.test(f)).length >= rows.length / 2
    ? allFlags.filter((f) => PHOTO_CONTACT.test(f))
    : [],
)

const improved = rows
  .filter((r) => r.proposal && r.problems.length === 0)
  .map((r) => ({
    productId: Number(r.product.ref),
    title: r.proposal!.title,
    description: r.proposal!.description,
    specs: r.proposal!.specs.slice(0, 12),
  }))
const toCheck = rows
  .map((r) => ({ productId: Number(r.product.ref), notes: [...(r.proposal?.flags ?? []), ...r.problems].filter((n) => !storeWide.has(n)).slice(0, 6).map((n) => n.slice(0, 400)) }))
  .filter((c) => c.notes.length)

const out = file.replace(/optimizer-dry-run-/, 'deliver-')
writeFileSync(out, JSON.stringify({ runId, improved, toCheck }, null, 2))
console.log(`${improved.length} improved, ${toCheck.length} to check → ${out}`)
