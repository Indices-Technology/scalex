// POST /api/v1/leads/import — { csv, batch, source? } → { created, alreadyKnown, duplicatesInFile, invalid[] }
import { defineApiHandler } from '~~/layers/core/server/utils/handler'
import { importSchema } from '../../../schemas/lead.schema'
import { leadService } from '../../../services/lead.service'

export default defineApiHandler(async (event) =>
  leadService.importCsv(event.context.tenant, importSchema.parse(await readBody(event))),
)
