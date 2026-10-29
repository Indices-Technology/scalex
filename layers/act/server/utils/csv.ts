/**
 * Minimal CSV reader (RFC 4180): quoted fields, "" inside quotes, commas and line breaks inside
 * quotes, CRLF or LF, and the byte-order mark Excel puts at the start. Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  const s = text.replace(/^﻿/, '')

  const endRow = () => {
    row.push(field)
    if (row.some((f) => f.trim())) rows.push(row)
    row = []
    field = ''
  }

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quoted) {
      if (c !== '"') field += c
      else if (s[i + 1] === '"') field += s[++i]
      else quoted = false
    } else if (c === '"') quoted = true
    else if (c === ',') {
      row.push(field)
      field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++
      endRow()
    } else field += c
  }
  endRow()
  return rows
}
