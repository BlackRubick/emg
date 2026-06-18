<template>
  <canvas ref="canvasRef" :height="height"></canvas>
</template>

<script setup lang="ts">
import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js'

Chart.register(DoughnutController, ArcElement, Tooltip, Legend)

const props = defineProps<{
  labels: string[]
  values: number[]
  height?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const colors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1', '#84cc16']

onMounted(() => {
  if (!canvasRef.value) return
  chart = new Chart(canvasRef.value, {
    type: 'doughnut',
    data: {
      labels: props.labels,
      datasets: [{
        data: props.values,
        backgroundColor: colors.slice(0, props.labels.length),
        borderColor: '#111827',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { color: '#9ca3af', font: { size: 11 }, padding: 12 } },
        tooltip: { backgroundColor: '#1f2937', titleColor: '#9ca3af', bodyColor: '#fff' },
      },
    },
  })
})

onUnmounted(() => chart?.destroy())
</script>
