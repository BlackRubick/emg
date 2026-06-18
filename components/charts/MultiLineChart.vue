<template>
  <ClientOnly>
    <div class="relative w-full" :style="{ height: (height ?? 200) + 'px' }">
      <canvas ref="canvasRef" style="display:block; width:100%; height:100%;"></canvas>
    </div>
    <template #fallback>
      <div class="w-full bg-gray-900/60 rounded-xl animate-pulse" :style="{ height: (height ?? 200) + 'px' }" />
    </template>
  </ClientOnly>
</template>

<script setup lang="ts">
import {
  Chart, LineController, LineElement, PointElement, LinearScale,
  CategoryScale, Filler, Tooltip, Legend, BarController, BarElement,
} from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend, BarController, BarElement)

const props = defineProps<{
  datasets: { label: string; data: number[]; color: string }[]
  labels: string[]
  height?: number
  type?: 'line' | 'bar'
  yMin?: number
  yMax?: number
  yLabel?: string
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

function makeGradient(ctx: CanvasRenderingContext2D, color: string) {
  const g = ctx.createLinearGradient(0, 0, 0, props.height ?? 200)
  g.addColorStop(0, color + '40')
  g.addColorStop(1, color + '00')
  return g
}

function buildChart() {
  if (!canvasRef.value) return
  const ctx = canvasRef.value.getContext('2d')!

  chart = new Chart(canvasRef.value, {
    type: props.type ?? 'line',
    data: {
      labels: props.labels,
      datasets: props.datasets.map(ds => ({
        label: ds.label,
        data: ds.data,
        borderColor: ds.color,
        backgroundColor: props.type === 'bar' ? ds.color + '80' : makeGradient(ctx, ds.color),
        borderWidth: props.type === 'bar' ? 0 : 2,
        pointRadius: props.type === 'bar' ? 0 : 3,
        pointBackgroundColor: ds.color,
        pointHoverRadius: 5,
        fill: props.type !== 'bar',
        tension: 0.4,
        borderRadius: props.type === 'bar' ? 4 : 0,
      })),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: props.datasets.length > 1,
          position: 'top',
          labels: {
            color: '#9ca3af',
            font: { size: 11 },
            boxWidth: 12,
            boxHeight: 2,
            padding: 16,
            usePointStyle: true,
            pointStyleWidth: 16,
          },
        },
        tooltip: {
          backgroundColor: '#111827',
          titleColor: '#9ca3af',
          bodyColor: '#f9fafb',
          borderColor: '#374151',
          borderWidth: 1,
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => ` ${ctx.dataset.label}: ${Number(ctx.raw).toFixed(1)}${props.yLabel ?? ''}`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: '#1f2937' },
          ticks: { color: '#6b7280', font: { size: 11 }, maxRotation: 0 },
          border: { display: false },
        },
        y: {
          grid: { color: '#1f2937' },
          ticks: { color: '#6b7280', font: { size: 11 }, callback: v => `${v}${props.yLabel ?? ''}` },
          border: { display: false },
          min: props.yMin,
          max: props.yMax,
        },
      },
    },
  })
}

onMounted(() => buildChart())

watch([() => props.datasets, () => props.labels], () => {
  if (!chart) return
  chart.data.labels = props.labels
  chart.data.datasets.forEach((ds, i) => {
    ds.data = props.datasets[i]?.data ?? []
  })
  chart.update('active')
}, { deep: true })

onUnmounted(() => chart?.destroy())
</script>
