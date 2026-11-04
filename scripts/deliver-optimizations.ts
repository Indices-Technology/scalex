/**
 * Hand a finished optimizer run to MarketX: specs written for `improved`, notes
 * sent to sellers for `toCheck`, one in-app + one email per seller (MarketX
 * POST /api/internal/optimizations/deliver). Then the improved proposals are
 * marked APPLIED in ScaleX.
 *
 * Usage:
 *   npx tsx scripts/deliver-optimizations.ts <payload.json>           # dry run
 *   npx tsx scripts/deliver-optimizations.ts <payload.json> --apply
 *
 * payload.json: { runId, improved: [{productId, optimizationId?, specs}], toCheck: [{productId, notes}] }
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'

const [file, flag] = process.argv.slice(2)
const apply = flag === '--apply'
const MARKETX = process.env.MARKETX_URL || 'https://marketx.africa'
const SCALEX = process.env.SCALEX_PUBLIC_URL || 'https://scalex-flame.vercel.app'
const key = process.env.MARKETX_INBOUND_KEY
const sxKey = process.env.SCALEX_API_KEYS?.match(/marketx:([^,\s]+)/)?.[1]
if (!file || !key || !sxKey) throw new Error('usage: <payload.json> [--apply]; needs MARKETX_INBOUND_KEY + SCALEX_API_KEYS')

const payload = JSON.parse(readFileSync(file, 'utf8'))
const res = await fetch(`${MARKETX}/api/internal/optimizations/deliver`, {
  method: 'POST',
  headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
  body: JSON.stringify({
    runId: payload.runId,
    improved: payload.improved.map(({ productId, specs }: any) => ({ productId, specs })),
    toCheck: payload.toCheck,
    dryRun: !apply,
  }),
})
const out = await res.json().catch(() => null)
if (!res.ok) throw new Error(`MarketX ${res.status}: ${out?.message ?? out?.statusMessage ?? ''}`)
console.log(apply ? 'APPLIED' : 'DRY RUN (nothing written or sent)')
console.log('specs written for:', out.data.written.join(', ') || 'none')
for (const s of out.data.sellers) console.log(`- ${s.store}: ${s.improved} improved, ${s.toCheck} to check, email=${s.email}\n  "${s.message}"`)

if (apply) {
  const ids = new Map(payload.improved.map((x: any) => [x.productId, x.optimizationId]))
  for (const productId of out.data.written) {
    const id = ids.get(productId)
    if (!id) continue
    const r = await fetch(`${SCALEX}/api/v1/optimizations/${id}/applied`, {
      method: 'POST',
      headers: { authorization: `Bearer ${sxKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ productRef: String(productId), values: {} }),
    })
    if (!r.ok) console.log(`ScaleX applied #${productId}: ${r.status}`)
  }
  console.log('ScaleX: improved proposals marked applied')
}
