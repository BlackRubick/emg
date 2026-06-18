<template>
  <ClientOnly>
    <div
      ref="wrapRef"
      class="relative w-full rounded-xl border border-gray-700/60 overflow-hidden"
      style="height: 320px; background: #07111f;"
    >
      <canvas ref="canvasRef" style="display:block; width:100%; height:100%;" />

      <!-- Paused overlay -->
      <div
        v-if="!isActive"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3"
        style="background: rgba(7,17,31,0.85);"
      >
        <UIcon name="i-heroicons-signal-slash" class="w-10 h-10 text-gray-600" />
        <p class="text-sm text-gray-500">Inicia la simulacion para ver la senal EMG</p>
      </div>
    </div>

    <!-- fallback while client JS loads -->
    <template #fallback>
      <div class="w-full rounded-xl border border-gray-700/60 flex items-center justify-center" style="height:320px; background:#07111f;">
        <p class="text-xs text-gray-600">Cargando monitor...</p>
      </div>
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

const props    = defineProps<{ isActive: boolean }>()
const emgStore = useEMGStore()

const canvasRef = ref<HTMLCanvasElement | null>(null)
const wrapRef   = ref<HTMLDivElement | null>(null)

let rafId: number | null = null
let ro: ResizeObserver | null = null
let cw = 0
let ch = 0

const N      = 150
const COLORS = ['#2dd4bf', '#60a5fa', '#a78bfa', '#fbbf24', '#34d399', '#f472b6', '#fb923c', '#818cf8']
const MUSCLE = ['Flex.Carpi.R', 'Flex.Dig', 'Ext.Carpi.R', 'Ext.Dig', 'Biceps', 'Triceps', 'Pronator', 'Supinator']

function syncSize() {
  const canvas = canvasRef.value
  const wrap   = wrapRef.value
  if (!canvas || !wrap || wrap.clientWidth === 0) return
  const w = wrap.clientWidth
  const h = wrap.clientHeight
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width  = w
    canvas.height = h
    cw = w
    ch = h
  }
}

function draw() {
  const canvas = canvasRef.value
  if (!canvas || canvas.width === 0 || canvas.height === 0) return
  const ctx = canvas.getContext('2d')!
  const W = canvas.width
  const H = canvas.height

  ctx.fillStyle = '#07111f'
  ctx.fillRect(0, 0, W, H)

  const LW     = 58    // label column width
  const plotW  = W - LW - 2
  const rowH   = H / 8

  // Vertical time-grid lines (subtle)
  ctx.strokeStyle = '#ffffff08'
  ctx.lineWidth   = 1
  for (let t = 1; t < 5; t++) {
    const x = LW + (t / 5) * plotW
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }

  const frames = emgStore.buffer.slice(-N)

  for (let i = 0; i < 8; i++) {
    const top   = i * rowH
    const cy    = top + rowH / 2
    const color = COLORS[i]

    // Row background (alternating slightly)
    if (i % 2 === 1) {
      ctx.fillStyle = '#ffffff03'
      ctx.fillRect(LW, top, plotW, rowH)
    }

    // Row separator
    ctx.strokeStyle = '#1e3050'
    ctx.lineWidth   = 1
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke()

    // Baseline dashed
    ctx.strokeStyle = color + '30'
    ctx.lineWidth   = 1
    ctx.setLineDash([3, 6])
    ctx.beginPath(); ctx.moveTo(LW, cy); ctx.lineTo(W - 2, cy); ctx.stroke()
    ctx.setLineDash([])

    // Channel label
    ctx.fillStyle = color
    ctx.font      = 'bold 11px ui-monospace,monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`CH${i + 1}`, LW - 6, cy - 2)
    ctx.fillStyle = '#4b5563'
    ctx.font      = '8px ui-monospace,monospace'
    ctx.fillText(MUSCLE[i], LW - 6, cy + 10)

    if (frames.length < 2) continue

    // Clip to row plot area
    ctx.save()
    ctx.beginPath()
    ctx.rect(LW, top + 1, plotW, rowH - 2)
    ctx.clip()

    // Glow (two passes: wide soft + narrow bright)
    const ampScale = (rowH / 2) * 0.78

    const drawLine = (lw: number, blur: number, alpha: string) => {
      ctx.strokeStyle = color + alpha
      ctx.lineWidth   = lw
      ctx.lineJoin    = 'round'
      ctx.shadowColor = color
      ctx.shadowBlur  = blur
      ctx.beginPath()
      frames.forEach((frame, idx) => {
        const amp = (frame as any).channels?.find((c: any) => c.channel === i + 1)?.amplitude ?? 0
        const x   = LW + (idx / (N - 1)) * plotW
        const y   = cy - (amp / 80) * ampScale
        idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      })
      ctx.stroke()
      ctx.shadowBlur = 0
    }

    drawLine(4, 12, '33')   // wide glow
    drawLine(2, 6,  'cc')   // medium
    drawLine(1.5, 0, 'ff')  // crisp top

    ctx.restore()

    // Live µV readout
    const last = (frames.at(-1) as any)?.channels?.find((c: any) => c.channel === i + 1)?.amplitude ?? 0
    ctx.fillStyle = color + 'cc'
    ctx.font      = 'bold 10px ui-monospace,monospace'
    ctx.textAlign = 'right'
    ctx.fillText(`${last >= 0 ? '+' : ''}${last.toFixed(0)}`, W - 2, cy + 4)
  }
}

function loop() {
  syncSize()
  draw()
  rafId = requestAnimationFrame(loop)
}

watch(wrapRef, (el) => {
  if (!el) return
  ro?.disconnect()
  ro = new ResizeObserver(() => syncSize())
  ro.observe(el)
  if (!rafId) {
    nextTick(() => {
      syncSize()
      loop()
    })
  }
}, { immediate: true })

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  ro?.disconnect()
})
</script>
