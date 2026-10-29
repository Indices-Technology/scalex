// GET /api/v1/leads/report — how many leads reached each step, by batch and by source
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { leadService } from '../../../services/lead.service'

export default defineApiHandler((event) => leadService.report(event.context.tenant))
