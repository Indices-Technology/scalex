import { describe, it, expect } from 'vitest'
import {
  dedupeKey,
  funnel,
  nextStatus,
  normalizeInstagram,
  normalizePhone,
  scoreLead,
  targetsFromEnv,
  toLeads,
  type LeadInput,
} from '../leadRules'

describe('normalizePhone', () => {
  it.each([
    ['08031234567', '+2348031234567'],
    ['0803 123 4567', '+2348031234567'],
    ['+234 803 123 4567', '+2348031234567'],
    ['2348031234567', '+2348031234567'],
    ['8031234567', '+2348031234567'],
  ])('%s → %s', (raw, want) => expect(normalizePhone(raw)).toBe(want))
  it.each(['', null, '12345', '0803123456', '+44 7700 900123'])('rejects %s', (raw) =>
    expect(normalizePhone(raw)).toBeNull(),
  )
})

describe('normalizeInstagram', () => {
  it.each([
    ['@Grandeur.Wears', 'grandeur.wears'],
    ['https://www.instagram.com/grandeur.wears/?hl=en', 'grandeur.wears'],
    ['instagram.com/x_shop', 'x_shop'],
  ])('%s → %s', (raw, want) => expect(normalizeInstagram(raw)).toBe(want))
  it.each(['', 'has space', '@'])('rejects %s', (raw) => expect(normalizeInstagram(raw)).toBeNull())
})

describe('toLeads', () => {
  it('maps columns by name in any order and reports unusable rows by line', () => {
    const { leads, invalid } = toLeads([
      ['Phone', 'NAME', 'City', 'Category'],
      ['08031234567', 'Ada Fabrics', 'Lagos', 'Fashion'],
      ['', 'No Contact Shop', 'Ibadan', ''],
      ['08051234567', '', '', ''],
    ])
    expect(leads).toEqual([
      {
        name: 'Ada Fabrics',
        phone: '+2348031234567',
        email: null,
        instagram: null,
        city: 'lagos',
        category: 'fashion',
        notes: '',
      },
    ])
    expect(invalid).toEqual([
      { line: 3, reason: 'No phone, email or Instagram we can use' },
      { line: 4, reason: 'No name' },
    ])
  })
  it('refuses a file without a name column', () =>
    expect(toLeads([['phone'], ['0803']]).invalid).toEqual([{ line: 1, reason: 'No "name" column' }]))
})

describe('dedupeKey', () => {
  it('prefers phone, then email, then Instagram', () => {
    expect(dedupeKey({ phone: '+2348031234567', email: 'a@b.co', instagram: 'x' })).toBe('tel:+2348031234567')
    expect(dedupeKey({ phone: null, email: 'a@b.co', instagram: 'x' })).toBe('email:a@b.co')
    expect(dedupeKey({ phone: null, email: null, instagram: 'x' })).toBe('ig:x')
  })
})

describe('scoreLead', () => {
  const base: LeadInput = { name: 'A', phone: null, email: null, instagram: null, city: null, category: null, notes: '' }
  const t = targetsFromEnv({ SCALEX_TARGET_CATEGORIES: 'fashion, abaya', SCALEX_TARGET_CITIES: 'Lagos' })
  it('ranks a reachable, on-target seller above an email-only one', () => {
    const strong = scoreLead({ ...base, phone: '+2348031234567', instagram: 'x', category: 'modest fashion', city: 'lagos' }, t)
    const weak = scoreLead({ ...base, email: 'a@b.co', city: 'kano' }, t)
    expect(strong).toBe(90)
    expect(weak).toBe(10)
  })
})

describe('nextStatus', () => {
  it('only moves forward', () => {
    expect(nextStatus('NEW', 'SIGNED_UP')).toBe('SIGNED_UP')
    expect(nextStatus('STORE_CREATED', 'SIGNED_UP')).toBe('STORE_CREATED')
    expect(nextStatus('FIRST_ORDER', 'FIRST_ORDER')).toBe('FIRST_ORDER')
  })
  it('allows NOT_INTERESTED only before sign-up, and a later sign-up overrides it', () => {
    expect(nextStatus('CONTACTED', 'NOT_INTERESTED')).toBe('NOT_INTERESTED')
    expect(nextStatus('SIGNED_UP', 'NOT_INTERESTED')).toBe('SIGNED_UP')
    expect(nextStatus('NOT_INTERESTED', 'CONTACTED')).toBe('NOT_INTERESTED')
    expect(nextStatus('NOT_INTERESTED', 'SIGNED_UP')).toBe('SIGNED_UP')
  })
})

describe('funnel', () => {
  it('counts each lead at every step it passed, per group', () => {
    const f = funnel([
      { group: 'oct', status: 'STORE_CREATED' },
      { group: 'oct', status: 'NEW' },
      { group: 'oct', status: 'NOT_INTERESTED' },
      { group: 'nov', status: 'FIRST_ORDER' },
    ])
    expect(f.oct).toEqual({
      NEW: 3,
      CONTACTED: 2,
      SIGNED_UP: 1,
      STORE_CREATED: 1,
      FIRST_LISTING: 0,
      FIRST_ORDER: 0,
      NOT_INTERESTED: 1,
    })
    expect(f.nov!.FIRST_ORDER).toBe(1)
  })
})
