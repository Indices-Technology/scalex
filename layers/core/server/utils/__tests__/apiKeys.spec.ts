import { describe, it, expect } from 'vitest'
import { tenantForKey } from '../apiKeys'

const KEY_A = 'a'.repeat(32)
const KEY_B = 'b'.repeat(32)
const config = `marketx:${KEY_A}, posta:${KEY_B}`

describe('tenantForKey', () => {
  it('maps a key to its tenant', () => {
    expect(tenantForKey(KEY_A, config)).toBe('marketx')
    expect(tenantForKey(KEY_B, config)).toBe('posta')
  })
  it.each(['', null, undefined, 'wrong', KEY_A.slice(1)])('rejects %s', (key) =>
    expect(tenantForKey(key, config)).toBeNull(),
  )
  it('ignores short or malformed keys in the config', () => {
    expect(tenantForKey('short', 'marketx:short')).toBeNull()
    expect(tenantForKey(KEY_A, `:${KEY_A}`)).toBeNull()
    expect(tenantForKey(KEY_A, '')).toBeNull()
  })
})
