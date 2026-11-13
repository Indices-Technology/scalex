import { timingSafeEqual } from 'node:crypto'

// The dashboard shows Search Console and AI spend: browser Basic auth, password from
// SCALEX_DASHBOARD_PASSWORD (any username). Unset = locked, never open.
// ponytail: one shared password; per-person sign-in through Eigen when more people need it.
export default defineEventHandler((event) => {
  const path = event.path.split('?')[0]!
  if (path !== '/dashboard' && !path.startsWith('/api/ops/')) return
  const want = process.env.SCALEX_DASHBOARD_PASSWORD
  if (!want) throw createError({ statusCode: 503, statusMessage: 'Dashboard not configured' })
  const basic = (getHeader(event, 'authorization') ?? '').replace(/^Basic /, '')
  const given = Buffer.from(Buffer.from(basic, 'base64').toString('utf8').split(':').slice(1).join(':'))
  if (given.length !== Buffer.byteLength(want) || !timingSafeEqual(given, Buffer.from(want))) {
    setHeader(event, 'www-authenticate', 'Basic realm="ScaleX", charset="UTF-8"')
    throw createError({ statusCode: 401, statusMessage: 'Sign in' })
  }
})
