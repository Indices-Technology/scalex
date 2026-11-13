import { buildMetrics } from '../../utils/metrics'

// Behind the dashboard password (middleware/dashboard-auth.ts), not an API key.
export default defineApiHandler(() => buildMetrics())
