/**
 * What the ops dashboard would show, from the command line.
 *   npx tsx scripts/google-check.ts            → the metrics, summarised
 *   npx tsx scripts/google-check.ts register   → one-time: register the Cloud project with Merchant Center
 *                                                (the service account needs Admin on the MC account for this call)
 */
import 'dotenv/config'
import { googleJson, SCOPE } from '../layers/sources/server/utils/google'
import { buildMetrics } from '../layers/ops/server/utils/metrics'

if (process.argv[2] === 'register') {
  await googleJson(SCOPE.merchant, 'https://merchantapi.googleapis.com/accounts/v1/accounts/5842698553/developerRegistration:registerGcp', {})
  console.log('Registered. Merchant reports work after ~5 minutes.')
} else {
  const m = await buildMetrics()
  const brief = (p: { ok: boolean; error?: string }) => (p.ok ? 'ok' : `FAIL ${p.error}`)
  console.log('range', m.range)
  console.log('search', brief(m.search), m.search.ok ? `${m.search.daily.length} days, top query: ${m.search.topQueries[0]?.key}` : '')
  console.log('experiments', brief(m.experiments), m.experiments.ok ? JSON.stringify(m.experiments.list, null, 1) : '')
  console.log('shopping', brief(m.shopping))
  console.log('optimizer', brief(m.optimizer), m.optimizer.ok ? JSON.stringify(m.optimizer) : '')
}
process.exit(0)
