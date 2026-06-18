<template>
  <div class="overflow-auto">
    <table class="text-xs border-collapse w-full">
      <thead>
        <tr>
          <th class="p-2 text-gray-500 text-left">Pred →</th>
          <th v-for="label in props.labels" :key="label" class="p-1.5 text-gray-400 font-medium whitespace-nowrap" style="writing-mode: vertical-lr; transform: rotate(180deg); height: 80px; vertical-align: bottom;">
            {{ label }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in props.matrix" :key="i">
          <td class="p-1.5 text-gray-400 font-medium whitespace-nowrap pr-3">{{ props.labels[i] }}</td>
          <td
            v-for="(cell, j) in row"
            :key="j"
            class="p-1.5 text-center font-mono rounded text-xs"
            :style="{ backgroundColor: getCellColor(cell, i, j), color: cell > 0 ? '#fff' : '#4b5563' }"
          >
            {{ cell }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  labels: string[]
  matrix: number[][]
}>()

const maxVal = computed(() => Math.max(...props.matrix.flat()))

function getCellColor(val: number, row: number, col: number): string {
  if (val === 0) return '#1f2937'
  const intensity = val / maxVal.value
  if (row === col) {
    const g = Math.round(50 + intensity * 120)
    return `rgba(20, ${g + 100}, 100, ${0.3 + intensity * 0.7})`
  }
  const r = Math.round(intensity * 200)
  return `rgba(${r + 50}, 20, 20, ${0.3 + intensity * 0.5})`
}
</script>
