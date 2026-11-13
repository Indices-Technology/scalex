<script setup lang="ts">
// One series per day as thin bars, with a hover/focus tooltip and an optional dated marker
// (e.g. "titles changed"). One measure per chart: clicks and impressions never share an axis.
const props = defineProps<{
  title: string
  days: { date: string; value: number }[]
  markers?: { date: string; label: string }[]
}>()

const W = 720
const H = 140
const step = computed(() => W / Math.max(props.days.length, 1))
const max = computed(() => Math.max(1, ...props.days.map((d) => d.value)))
const y = (v: number) => H - (v / max.value) * (H - 8)
const hover = ref<number | null>(null)
const tip = computed(() => (hover.value === null ? null : props.days[hover.value]))
const fmtDate = (s: string) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const markerX = (date: string) => {
  const i = props.days.findIndex((d) => d.date === date)
  return i < 0 ? null : i * step.value
}
const total = computed(() => props.days.reduce((a, d) => a + d.value, 0))
</script>

<template>
  <figure class="chart">
    <figcaption>
      <span class="t">{{ title }}</span>
      <span class="sub">{{ total.toLocaleString() }} in {{ days.length }} days · peak {{ max.toLocaleString() }}</span>
    </figcaption>
    <div class="plot" @mouseleave="hover = null">
      <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" role="img" :aria-label="`${title}, daily, ${days.length} days, total ${total}`">
        <line :x1="0" :x2="W" :y1="H - 0.5" :y2="H - 0.5" class="base" />
        <line :x1="0" :x2="W" :y1="y(max)" :y2="y(max)" class="grid" />
        <rect
          v-for="(d, i) in days"
          :key="d.date"
          :x="i * step + 1"
          :y="d.value ? y(d.value) : H"
          :width="Math.max(step - 2, 1)"
          :height="d.value ? H - y(d.value) : 0"
          rx="2"
          class="bar"
          :class="{ dim: hover !== null && hover !== i }"
        />
        <template v-for="m in markers ?? []" :key="m.date">
          <line v-if="markerX(m.date) !== null" :x1="markerX(m.date)!" :x2="markerX(m.date)!" y1="0" :y2="H" class="marker" />
        </template>
        <rect
          v-for="(d, i) in days"
          :key="'hit' + d.date"
          :x="i * step"
          y="0"
          :width="step"
          :height="H"
          fill="transparent"
          @mouseenter="hover = i"
        />
      </svg>
      <div v-for="m in markers ?? []" :key="'l' + m.date" class="mlabel" :style="{ left: `${((markerX(m.date) ?? -999) / W) * 100}%` }">
        {{ m.label }}
      </div>
      <div v-if="tip" class="tip" :style="{ left: `${(((hover ?? 0) + 0.5) * step / W) * 100}%` }">
        <b>{{ tip.value.toLocaleString() }}</b> {{ fmtDate(tip.date) }}
      </div>
    </div>
    <div class="axis">
      <span>{{ days[0] && fmtDate(days[0].date) }}</span>
      <span>{{ days.at(-1) && fmtDate(days.at(-1)!.date) }}</span>
    </div>
  </figure>
</template>

<style scoped>
.chart { margin: 0; }
figcaption { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.t { font-weight: 600; color: var(--text-primary); }
.sub { color: var(--text-secondary); font-size: 13px; }
.plot { position: relative; }
svg { display: block; width: 100%; height: 140px; }
.bar { fill: var(--series-1); transition: opacity 0.1s; }
.bar.dim { opacity: 0.45; }
.base { stroke: var(--border-strong); stroke-width: 1; vector-effect: non-scaling-stroke; }
.grid { stroke: var(--border); stroke-width: 1; stroke-dasharray: 2 4; vector-effect: non-scaling-stroke; }
.marker { stroke: var(--text-secondary); stroke-width: 1.5; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
.mlabel { position: absolute; top: -2px; transform: translateX(calc(-100% - 6px)); background: var(--surface-1); padding: 0 2px; font-size: 12px; color: var(--text-secondary); white-space: nowrap; pointer-events: none; }
.tip {
  position: absolute; bottom: calc(100% + 4px); transform: translateX(-50%);
  background: var(--surface-raised); color: var(--text-primary); border: 1px solid var(--border);
  border-radius: 6px; padding: 4px 8px; font-size: 12px; white-space: nowrap; pointer-events: none;
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
}
.axis { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); margin-top: 4px; }
</style>
