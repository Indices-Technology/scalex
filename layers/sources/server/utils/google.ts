/**
 * Google service-account access (Search Console, Merchant API), read-only.
 * Key: GOOGLE_SA_JSON (the JSON itself, for Vercel) or GOOGLE_SA_FILE (a path, for local runs).
 * Signs the OAuth JWT with node:crypto; no googleapis dependency for two REST calls.
 */
import { createSign } from 'node:crypto'
import { readFileSync } from 'node:fs'

type Key = { client_email: string; private_key: string }
const tokens = new Map<string, { token: string; exp: number }>()

function key(): Key {
  const raw = process.env.GOOGLE_SA_JSON ?? (process.env.GOOGLE_SA_FILE && readFileSync(process.env.GOOGLE_SA_FILE, 'utf8'))
  if (!raw) throw new Error('GOOGLE_SA_JSON or GOOGLE_SA_FILE not set')
  return JSON.parse(raw)
}

const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url')

export async function googleToken(scope: string): Promise<string> {
  const hit = tokens.get(scope)
  if (hit && hit.exp > Date.now() + 60_000) return hit.token
  const k = key()
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64(
    JSON.stringify({ iss: k.client_email, scope, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }),
  )}`
  const jwt = `${unsigned}.${createSign('RSA-SHA256').update(unsigned).sign(k.private_key, 'base64url')}`
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  })
  const out = await res.json()
  if (!res.ok) throw new Error(`Google token: ${out.error_description ?? out.error}`)
  tokens.set(scope, { token: out.access_token, exp: Date.now() + out.expires_in * 1000 })
  return out.access_token
}

export const SCOPE = {
  searchConsole: 'https://www.googleapis.com/auth/webmasters.readonly',
  merchant: 'https://www.googleapis.com/auth/content',
}

export async function googleJson<T = any>(scope: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${await googleToken(scope)}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const out = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Google ${res.status}: ${out.error?.message ?? res.statusText}`)
  return out
}

export type SearchRow = { keys: string[]; clicks: number; impressions: number; ctr: number; position: number }

/** Search Console Search Analytics for one property (e.g. "sc-domain:marketx.africa"). */
export const searchAnalytics = (site: string, body: object) =>
  googleJson<{ rows?: SearchRow[] }>(
    SCOPE.searchConsole,
    `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
    body,
  ).then((r) => r.rows ?? [])

/** Merchant API report query (MCQL). Needs the Cloud project registered with the account once. */
export const merchantReport = (account: string, query: string) =>
  googleJson<{ results?: any[] }>(SCOPE.merchant, `https://merchantapi.googleapis.com/reports/v1/accounts/${account}/reports:search`, {
    query,
    pageSize: 1000,
  }).then((r) => r.results ?? [])
