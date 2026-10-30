// POST /api/v1/optimizations/:id/rejected — { reason } → the seller (or client) said no. Safe to retry.
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { rejectedSchema } from '../../../../schemas/optimization.schema'
import { optimizationService } from '../../../../services/optimization.service'

export default defineApiHandler(async (event) =>
  optimizationService.rejected(
    event.context.tenant,
    getRouterParam(event, 'id')!,
    rejectedSchema.parse(await readBody(event)).reason,
  ),
)
