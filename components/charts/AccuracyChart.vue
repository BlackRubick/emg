<template>
  <canvas ref="canvasRef" :height="height"></canvas>
</template>

<script setup lang="ts">
import { Chart, LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend } from 'chart.js'

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip, Legend)

const props = defineProps<{
  data: { label: string; value: number }[]
  height?: number
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let chart: Chart | null = null

const height = computed(() => props.height || 200)

onMounted(() => {
  if (!canvasRef.value) return
  chart = new Chart(canvasRef.value, {
    type: 'line',
    data: {
      labels: props.data.map(d => d.label),
      datasets: [{
        label: 'Accuracy %',
        data: props.data.map(d => d.value),
        borderColor: '#14b8a6',
        backgroundColor: '#14b8a615',
        borderWidth: 2,
        pointRadius: 4,
        pointBackgroundColor: '#14b8a6',
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: '#1f2937', titleColor: '#9ca3af', bodyColor: '#fff', borderColor: '#374151', borderWidth: 1 },
      },
      scales: {
        x: { grid: { color: '#1f2937' }, ticks: { color: '#6b7280' } },
        y: { grid: { color: '#1f2937' }, ticks: { color: '#6b7280' }, min: 0, max: 100 },
      },
    },
  })
})

watch(() => props.data, (newData) => {
  if (!chart) return
  chart.data.labels = newData.map(d => d.label)
  chart.data.datasets[0].data = newData.map(d => d.value)
  chart.update()
}, { deep: true })

onUnmounted(() => chart?.destroy())
</script>
