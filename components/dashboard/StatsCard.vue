<template>
  <div
    class="relative overflow-hidden rounded-2xl border transition-all duration-300 group cursor-default"
    :class="[
      'bg-gray-900/80 backdrop-blur',
      active ? borderActive : 'border-gray-800 hover:border-gray-700',
    ]"
  >
    <!-- Glow top edge -->
    <div
      class="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
      :style="{ background: `linear-gradient(90deg, transparent, ${glowColor}, transparent)` }"
    />

    <div class="p-5">
      <!-- Top row -->
      <div class="flex items-start justify-between mb-3">
        <div
          class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          :class="iconBg"
        >
          <UIcon :name="icon" class="w-4.5 h-4.5" :class="iconColor" />
        </div>

        <!-- Trend badge -->
        <div v-if="trend !== undefined" class="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" :class="trend >= 0 ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'">
          <UIcon :name="trend >= 0 ? 'i-heroicons-arrow-up' : 'i-heroicons-arrow-down'" class="w-3 h-3" />
          {{ Math.abs(trend) }}%
        </div>
        <div v-else-if="badge" class="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-500">
          {{ badge }}
        </div>
      </div>

      <!-- Value -->
      <div class="mb-1">
        <span class="text-2xl font-bold text-white tracking-tight tabular-nums" :class="valueColor">
          {{ animatedValue }}
        </span>
        <span v-if="unit" class="text-sm font-medium ml-1" :class="iconColor">{{ unit }}</span>
      </div>

      <!-- Label -->
      <p class="text-xs font-medium text-gray-500 uppercase tracking-wider">{{ label }}</p>

      <!-- Sparkline -->
      <div v-if="sparkline.length" class="mt-3">
        <svg :width="sparkWidth" height="32" class="w-full overflow-visible">
          <defs>
            <linearGradient :id="`sg-${uid}`" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="sparkColor" stop-opacity="0.4" />
              <stop offset="100%" :stop-color="sparkColor" stop-opacity="0" />
            </linearGradient>
          </defs>
          <path :d="sparkFillPath" :fill="`url(#sg-${uid})`" />
          <path :d="sparkLinePath" :stroke="sparkColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          <!-- Last point dot -->
          <circle v-if="lastPoint" :cx="lastPoint.x" :cy="lastPoint.y" r="2.5" :fill="sparkColor" />
        </svg>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  label: string
  value: number | string
  icon: string
  trend?: number
  badge?: string
  unit?: string
  color?: 'teal' | 'blue' | 'purple' | 'orange' | 'green' | 'red' | 'pink'
  sparkline?: number[]
  active?: boolean
}>()

const uid = Math.random().toString(36).slice(2, 8)
const sparkWidth = 160

const colorMap = {
  teal:   { bg: 'bg-teal-950/80',   icon: 'text-teal-400',   glow: '#14b8a6', spark: '#14b8a6', border: 'border-teal-800/60',   value: 'text-white' },
  blue:   { bg: 'bg-blue-950/80',   icon: 'text-blue-400',   glow: '#3b82f6', spark: '#3b82f6', border: 'border-blue-800/60',   value: 'text-white' },
  purple: { bg: 'bg-purple-950/80', icon: 'text-purple-400', glow: '#8b5cf6', spark: '#8b5cf6', border: 'border-purple-800/60', value: 'text-white' },
  orange: { bg: 'bg-orange-950/80', icon: 'text-orange-400', glow: '#f97316', spark: '#f97316', border: 'border-orange-800/60', value: 'text-white' },
  green:  { bg: 'bg-green-950/80',  icon: 'text-green-400',  glow: '#22c55e', spark: '#22c55e', border: 'border-green-800/60',  value: 'text-green-400' },
  red:    { bg: 'bg-red-950/80',    icon: 'text-red-400',    glow: '#ef4444', spark: '#ef4444', border: 'border-red-800/60',    value: 'text-white' },
  pink:   { bg: 'bg-pink-950/80',   icon: 'text-pink-400',   glow: '#ec4899', spark: '#ec4899', border: 'border-pink-800/60',   value: 'text-white' },
}

const key = computed(() => props.color || 'teal')
const iconBg     = computed(() => colorMap[key.value].bg)
const iconColor  = computed(() => colorMap[key.value].icon)
const glowColor  = computed(() => colorMap[key.value].glow)
const sparkColor = computed(() => colorMap[key.value].spark)
const borderActive = computed(() => colorMap[key.value].border)
const valueColor = computed(() => colorMap[key.value].value)

// Animated number count-up
const animatedNum = ref(0)
const animatedValue = computed(() => {
  const v = props.value
  if (typeof v !== 'number') return v
  const n = animatedNum.value
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return Number.isInteger(n) ? n.toString() : n.toFixed(1)
})

watch(() => props.value, (newVal) => {
  if (typeof newVal !== 'number') return
  const start = animatedNum.value
  const end = newVal
  const duration = 800
  const startTime = performance.now()
  const tick = (now: number) => {
    const elapsed = now - startTime
    const progress = Math.min(elapsed / duration, 1)
    const ease = 1 - Math.pow(1 - progress, 3)
    animatedNum.value = Math.round(start + (end - start) * ease * 10) / 10
    if (progress < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}, { immediate: true })

// SVG Sparkline
const spark = computed(() => props.sparkline ?? [])

const sparkLinePath = computed(() => {
  const data = spark.value
  if (data.length < 2) return ''
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = sparkWidth
  const h = 28
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * w,
    y: h - ((v - min) / range) * h,
  }))
  return pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
})

const sparkFillPath = computed(() => {
  const data = spark.value
  if (data.length < 2) return ''
  return sparkLinePath.value + ` L${sparkWidth},32 L0,32 Z`
})

const lastPoint = computed(() => {
  const data = spark.value
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const last = data[data.length - 1]
  return {
    x: sparkWidth,
    y: 28 - ((last - min) / range) * 28,
  }
})
</script>
