import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { describe, it, expect } from 'vitest'

// The layering rule from CLAUDE.md: a layer may use only layers with a LOWER rank.
// Same rank (evidence, outcomes) may not use each other either.
const RANK: Record<string, number> = {
  core: 1,
  sources: 2,
  evidence: 3,
  outcomes: 3,
  think: 4,
  decide: 5,
  act: 6,
  ops: 7,
}

const ROOT = resolve(__dirname, '..')
const LAYERS = join(ROOT, 'layers')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : files(p)
    return /\.(ts|vue)$/.test(name) && !/\.spec\.ts$/.test(name) ? [p] : []
  })
}

const layerOf = (absPath: string) => relative(LAYERS, absPath).split(sep)[0]!

// Names a layer exports from server/utils. Nitro auto-imports these everywhere, so a lower layer
// could use one without an import line; we catch that by name.
// ponytail: plain word match, can false-positive on a same-named local; rename one if it does.
function autoImported(layer: string): string[] {
  const dir = join(LAYERS, layer, 'server', 'utils')
  let list: string[] = []
  try {
    list = files(dir)
  } catch {
    return []
  }
  return list.flatMap((f) =>
    [...readFileSync(f, 'utf8').matchAll(/export (?:async )?(?:function|const|class|let) (\w+)/g)].map((m) => m[1]!),
  )
}

describe('layer boundaries', () => {
  it('every folder in layers/ has a rank', () => {
    const dirs = readdirSync(LAYERS).filter((d) => statSync(join(LAYERS, d)).isDirectory())
    expect(dirs.filter((d) => !(d in RANK))).toEqual([])
  })

  it('no layer imports from a layer at the same or a higher rank', () => {
    const bad: string[] = []
    for (const file of files(LAYERS)) {
      const from = layerOf(file)
      const src = readFileSync(file, 'utf8')
      for (const [, spec] of src.matchAll(/from ['"]([^'"]+)['"]/g)) {
        const target = spec!.startsWith('~~/layers/')
          ? spec!.split('/')[2]!
          : spec!.startsWith('.')
            ? layerOf(resolve(file, '..', spec!))
            : spec!.startsWith('~~/') || spec!.startsWith('~/')
              ? '(root)'
              : null
        if (!target || target === from) continue
        if (target === '(root)' || !(target in RANK) || RANK[target]! >= RANK[from]!)
          bad.push(`${relative(ROOT, file)} imports ${spec}`)
      }
      for (const [other, rank] of Object.entries(RANK)) {
        if (other === from || rank < RANK[from]!) continue
        for (const name of autoImported(other))
          if (new RegExp(`\\b${name}\\b`).test(src)) bad.push(`${relative(ROOT, file)} uses ${other}'s ${name}`)
      }
    }
    expect(bad).toEqual([])
  })
})
