// ScaleX: one Nuxt app split into layers, like MarketX and Posta. Server-only for now: other apps
// call it with an API key.
export default defineNuxtConfig({
  compatibilityDate: '2026-10-01',
  devtools: { enabled: false },
  // marketX dev owns 3000, Posta 3100.
  devServer: { port: 3200 },

  // One layer per responsibility, lowest first. Who may use whom: CLAUDE.md, enforced by tests/layering.spec.ts.
  extends: [
    './layers/core',
    './layers/sources',
    './layers/evidence',
    './layers/outcomes',
    './layers/think',
    './layers/decide',
    './layers/act',
    './layers/ops',
  ],

  // On Vercel: a listing proposal is a vision-model round trip (~6-10 s, MarketX waits up to 60 s).
  nitro: { vercel: { functions: { maxDuration: 60 } } },

  routeRules: {
    '/**': {
      headers: {
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'referrer-policy': 'no-referrer',
      },
    },
  },
})
