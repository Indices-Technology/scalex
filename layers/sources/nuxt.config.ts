// L2 sources: the SourceAdapter contract, the registry, the runtime (schedule, checkpoint, retry,
// rate limit, cost cap, retention, SourceRun rows) and one folder per adapter in adapters/<id>/.
// Adapters fetch and map fields only. They never decide what the data means.
export default defineNuxtConfig({})
