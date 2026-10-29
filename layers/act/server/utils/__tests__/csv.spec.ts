import { describe, it, expect } from 'vitest'
import { parseCsv } from '../csv'

describe('parseCsv', () => {
  it('reads plain rows, CRLF and LF', () =>
    expect(parseCsv('name,phone\r\nAda,0803\nBola,0805')).toEqual([
      ['name', 'phone'],
      ['Ada', '0803'],
      ['Bola', '0805'],
    ]))

  it('handles quotes, escaped quotes, commas and line breaks inside quotes', () =>
    expect(parseCsv('name,notes\n"Ada, Balogun","says ""call after 4""\nshop 12"')).toEqual([
      ['name', 'notes'],
      ['Ada, Balogun', 'says "call after 4"\nshop 12'],
    ]))

  it('drops the Excel byte-order mark and blank lines', () =>
    expect(parseCsv('﻿name\n\n,\nAda\n')).toEqual([['name'], ['Ada']]))

  it('keeps empty fields', () => expect(parseCsv('a,,c')).toEqual([['a', '', 'c']]))
})
