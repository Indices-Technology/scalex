import { defineConfig } from 'vitest/config'

// Unit tests cover pure server logic (parsing, rules, ranking), so plain Node is enough.
// Tests live next to the code they test, in __tests__/*.spec.ts (same as MarketX and Posta).
export default defineConfig({
  test: {
    environment: 'node',
    include: ['layers/**/__tests__/*.spec.ts', 'tests/*.spec.ts'],
  },
})
