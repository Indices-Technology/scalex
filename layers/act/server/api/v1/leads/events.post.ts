// POST /api/v1/leads/events — { inviteCode, type } → { inviteCode, status }. Safe to retry.
// The tenant calls this when a lead signs up, opens a store, lists, or gets a first order;
// staff call it for CONTACTED / NOT_INTERESTED.
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { eventSchema } from '../../../schemas/lead.schema'
import { leadService } from '../../../services/lead.service'

export default defineApiHandler(async (event) =>
  leadService.recordEvent(event.context.tenant, eventSchema.parse(await readBody(event))),
)
