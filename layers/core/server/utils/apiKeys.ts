import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Server-to-server auth (docs/SCALEX.md §4 in marketX): each tenant app holds one key.
 * SCALEX_API_KEYS = "marketx:<key>,other:<key>". Returns the tenant the key belongs to, or null.
 *
 * Keys are compared as SHA-256 digests so every comparison is the same length and constant-time.
 */
export function tenantForKey(presented: string | null | undefined, config = process.env.SCALEX_API_KEYS ?? ''): string | null {
  if (!presented) return null
  const digest = (s: string) => createHash('sha256').update(s).digest()
  const want = digest(presented)
  let tenant: string | null = null
  for (const pair of config.split(',')) {
    const i = pair.indexOf(':')
    if (i < 1) continue
    const name = pair.slice(0, i).trim()
    const key = pair.slice(i + 1).trim()
    // Keep looping after a match so the time taken doesn't say which tenant matched.
    if (key.length >= 24 && timingSafeEqual(digest(key), want)) tenant = name
  }
  return tenant
}
