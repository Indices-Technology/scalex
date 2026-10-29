import { tenantForKey } from '../utils/apiKeys'

// Every /api/v1 route needs `Authorization: Bearer <key>`. The tenant comes from the key, so a
// caller can only ever touch its own rows. /api/health stays public for the host's checks.
export default defineEventHandler((event) => {
  if (!event.path.startsWith('/api/v1/')) return
  const header = getHeader(event, 'authorization') ?? ''
  const tenant = tenantForKey(header.startsWith('Bearer ') ? header.slice(7) : null)
  if (!tenant) throw createError({ statusCode: 401, statusMessage: 'Missing or unknown API key' })
  event.context.tenant = tenant
})
