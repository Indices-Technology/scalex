import { ZodError } from 'zod'
import type { H3Event } from 'h3'
import { AppError } from '../types/errors'

/**
 * Every API route is wrapped in this. It does MarketX's per-route try/catch once, in one place:
 *   1. errors already shaped for HTTP (createError) pass through untouched
 *   2. AppError → its status and message, plus { code, field } for the page
 *   3. ZodError → 400 with the first problem, in the words the schema gave it
 *   4. anything else is a bug → logged with the request id, generic 500 to the caller
 *
 * Successful responses are wrapped as { success: true, data } (MarketX's envelope).
 */
export function defineApiHandler<T>(handler: (event: H3Event) => Promise<T> | T) {
  return defineEventHandler(async (event) => {
    try {
      return { success: true as const, data: await handler(event) }
    } catch (error) {
      if (isError(error)) throw error
      if (error instanceof AppError) {
        throw createError({
          statusCode: error.status,
          statusMessage: error.message,
          data: { code: error.code, field: error.field },
        })
      }
      if (error instanceof ZodError) {
        const issue = error.issues[0]
        throw createError({
          statusCode: 400,
          statusMessage: issue?.message ?? 'Invalid request',
          data: { code: 'INVALID_INPUT', field: issue?.path.join('.') },
        })
      }
      logger.logError(`[${event.method} ${event.path.split('?')[0]}]`, error, { requestId: event.context.requestId })
      throw createError({ statusCode: 500, statusMessage: 'Something went wrong. Try again.' })
    }
  })
}
