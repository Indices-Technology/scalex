// POST /api/v1/optimizations — propose a better listing for one product (step 0.4b).
// { sellerRef, product, allowedCategories } or { sellerRef, parentId, answers } → the proposal.
// 503 AI_UNAVAILABLE / 429 AI_CAP_REACHED mean "show your normal form": never block the seller.
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { createSchema } from '../../../schemas/optimization.schema'
import { optimizationService } from '../../../services/optimization.service'

export default defineApiHandler(async (event) =>
  optimizationService.create(
    { tenant: event.context.tenant, requestId: event.context.requestId },
    createSchema.parse(await readBody(event)),
  ),
)
