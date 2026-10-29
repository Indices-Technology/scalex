// What the core middleware puts on every request.
declare module 'h3' {
  interface H3EventContext {
    /** 00.request-id */
    requestId: string
    /** 01.api-key: the app the API key belongs to. Set on every /api/v1 route. */
    tenant: string
  }
}

export {}
