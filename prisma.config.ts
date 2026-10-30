import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // The CLI (migrate) needs a session connection; Supabase's 6543 transaction pooler hangs on
  // migrate's advisory lock. The app keeps DATABASE_URL (db.ts).
  datasource: {
    url: process.env['DIRECT_URL'] || process.env['DATABASE_URL'],
  },
})
