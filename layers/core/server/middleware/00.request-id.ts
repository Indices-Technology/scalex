import { randomUUID } from 'node:crypto'

// One id per request, in every log line and in the response, so a person's error report
// can be traced. Runs first (00. prefix), like MarketX's.
export default defineEventHandler((event) => {
  const incoming = getHeader(event, 'x-request-id')
  const id = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID()
  event.context.requestId = id
  setResponseHeader(event, 'x-request-id', id)
})
