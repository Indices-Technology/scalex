// GET /api/v1/leads?batch=&status=&limit= — leads in the order to contact them (highest score first)
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { listSchema } from '../../../schemas/lead.schema'
import { leadService } from '../../../services/lead.service'

export default defineApiHandler((event) => leadService.list(event.context.tenant, listSchema.parse(getQuery(event))))
