import { describe, it, expect } from 'vitest'
import { addDays, fillDays, totals } from '../metrics'

describe('metrics helpers', () => {
  it('fills missing days with zeros, across a month end', () => {
    const out = fillDays('2026-10-30', '2026-11-02', [{ date: '2026-10-31', clicks: 2, impressions: 9 }])
    expect(out.map((d) => [d.date, d.clicks])).toEqual([
      ['2026-10-30', 0],
      ['2026-10-31', 2],
      ['2026-11-01', 0],
      ['2026-11-02', 0],
    ])
    expect(addDays('2026-11-12', -28)).toBe('2026-10-15')
  })

  it('averages position weighted by impressions, null when none', () => {
    expect(totals([{ clicks: 1, impressions: 10, position: 2 }, { clicks: 0, impressions: 30, position: 10 }])).toEqual({ clicks: 1, impressions: 40, position: 8 })
    expect(totals([]).position).toBeNull()
  })
})
