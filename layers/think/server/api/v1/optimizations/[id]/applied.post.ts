// POST /api/v1/optimizations/:id/applied — { productRef?, values } → the client published it.
// `values` is what actually went live, seller's edits included. Safe to retry.
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { appliedSchema } from '../../../../schemas/optimization.schema'
import { optimizationService } from '../../../../services/optimization.service'

export default defineApiHandler(async (event) =>
  optimizationService.applied(
    event.context.tenant,
    getRouterParam(event, 'id')!,
    appliedSchema.parse(await readBody(event)),
  ),
)
