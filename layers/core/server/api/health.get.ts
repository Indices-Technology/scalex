// GET /api/health — for the host's health check and uptime monitoring. Public, says nothing private.
import { prisma } from '~~/layers/core/server/utils/db'

export default defineEventHandler(async (event) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    return { ok: true }
  } catch (error) {
    logger.logError('[health] database unreachable', error, { requestId: event.context.requestId })
    setResponseStatus(event, 503)
    return { ok: false }
  }
})
