// GET /api/v1/optimizations?status=READY&sellerRef=&productRef=&limit= — newest first.
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { listSchema } from '../../../schemas/optimization.schema'
import { optimizationService } from '../../../services/optimization.service'

export default defineApiHandler(async (event) =>
  optimizationService.list(event.context.tenant, listSchema.parse(getQuery(event))),
)
