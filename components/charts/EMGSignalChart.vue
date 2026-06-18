<template>
  <div class="relative">
    <canvas ref="canvasRef" :height="height"></canvas>
    <div v-if="!hasData" class="absolute inset-0 flex items-center justify-center text-gray-500 text-sm">
      No signal data
    </div>
  </div>
</template>

<script setup lang="ts">
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip } from 'chart.js'
import { useEMGStore } from '~/stores/emg'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip)

const props = defineProps<{
  channelIndex?: number
  height?: number
  color?: string
  realtime?: boolean
}>()

const emgStore = useEMGStore()
const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const height = computed(() => props.height || 120)
const color = computed(() => props.color || '#14b8a6')
const channelIndex = computed(() => props.channelIndex ?? 0)

const hasData = computed(() => emgStore.buffer.length > 0)

function buildChartData() {
  const history = emgStore.channelHistory(channelIndex.value + 1)
  return {
    labels: history.map((_, i) => i),
    datasets: [{
      data: history.map(h => h.v),
      borderColor: color.value,
      borderWidth: 1.5,
      pointRadius: 0,
      fill: true,
      backgroundColor: `${color.value}15`,
      tension: 0.3,
    }],
  }
}

onMounted(() => {
  if (!canvasRef.value) return
  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: buildChartData(),
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        x: { display: false },
        y: { display: true, grid: { color: '#1f2937' }, ticks: { color: '#6b7280', maxTicksLimit: 4, font: { size: 10 } } },
      },
    },
  })
})

onUnmounted(() => chart?.destroy())

if (props.realtime) {
  watch(() => emgStore.buffer.length, () => {
    if (!chart) return
    chart.data = buildChartData()
    chart.update('none')
  })
}
</script>
