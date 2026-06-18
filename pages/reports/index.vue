<template>
  <div class="space-y-4">
    <div>
      <h2 class="text-xl font-bold text-white">Reportes del Sistema</h2>
      <p class="text-sm text-gray-400 mt-0.5">Genera y descarga reportes del sistema</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      <div
        v-for="reportType in reportTypes"
        :key="reportType.type"
        class="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-gray-700 transition-colors"
      >
        <div class="flex items-start gap-4">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0" :class="reportType.bgColor">
            <UIcon :name="reportType.icon" class="w-6 h-6" :class="reportType.iconColor" />
          </div>
          <div class="flex-1">
            <h3 class="font-semibold text-white">{{ reportType.title }}</h3>
            <p class="text-xs text-gray-500 mt-1">{{ reportType.description }}</p>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-2">
          <UButton
            block
            variant="soft"
            color="teal"
            size="xs"
            icon="i-heroicons-document-text"
            :loading="generating[reportType.type + '_json']"
            @click="generate(reportType.type, 'json')"
          >
            JSON
          </UButton>
          <UButton
            block
            variant="soft"
            color="blue"
            size="xs"
            icon="i-heroicons-table-cells"
            :loading="generating[reportType.type + '_csv']"
            @click="generate(reportType.type, 'csv')"
          >
            Exportar CSV
          </UButton>
        </div>
      </div>
    </div>

    <!-- Generated Report Preview -->
    <div v-if="lastReport" class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-sm font-semibold text-gray-300">{{ lastReport.title }}</h3>
          <p class="text-xs text-gray-500">Generado: {{ new Date(lastReport.generatedAt).toLocaleString('es') }}</p>
        </div>
        <UButton size="xs" variant="ghost" color="gray" icon="i-heroicons-x-mark" @click="lastReport = null" />
      </div>
      <pre class="text-xs text-gray-400 bg-gray-950 rounded-lg p-4 overflow-auto max-h-64">{{ JSON.stringify(lastReport.data, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
const toast = useToast()

const generating = reactive<Record<string, boolean>>({})
const lastReport = ref<any>(null)

const reportTypes = [
  { type: 'users', title: 'Reporte de Usuarios', description: 'Todos los usuarios del sistema con roles y actividad', icon: 'i-heroicons-users', bgColor: 'bg-teal-900/50', iconColor: 'text-teal-400' },
  { type: 'signals', title: 'Reporte de Señales EMG', description: 'Estadísticas de señales agrupadas por canal', icon: 'i-heroicons-chart-bar-square', bgColor: 'bg-blue-900/50', iconColor: 'text-blue-400' },
  { type: 'gestures', title: 'Clasificaciones de Gestos', description: 'Todos los gestos clasificados con puntajes de confianza', icon: 'i-heroicons-hand-raised', bgColor: 'bg-purple-900/50', iconColor: 'text-purple-400' },
  { type: 'models', title: 'Reporte de Modelos Entrenados', description: 'Métricas de rendimiento de modelos LDA', icon: 'i-heroicons-cpu-chip', bgColor: 'bg-orange-900/50', iconColor: 'text-orange-400' },
  { type: 'performance', title: 'Rendimiento del Sistema', description: 'Exactitud general del sistema y estadísticas de uso', icon: 'i-heroicons-chart-bar', bgColor: 'bg-green-900/50', iconColor: 'text-green-400' },
]

const generate = async (type: string, format: string) => {
  const key = `${type}_${format}`
  generating[key] = true
  try {
    const result = await $fetch<any>('/api/reports/generate', {
      method: 'POST',
      body: { type, format },
    })
    lastReport.value = result.data

    if (format === 'csv') {
      const data = Array.isArray(result.data.data) ? result.data.data : [result.data.data]
      if (data.length > 0) {
        const headers = Object.keys(data[0]).join(',')
        const rows = data.map((r: any) => Object.values(r).map(v => JSON.stringify(v)).join(',')).join('\n')
        const csv = `${headers}\n${rows}`
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${type}_reporte_${Date.now()}.csv`
        a.click()
        URL.revokeObjectURL(url)
      }
    }

    toast.add({ title: `Reporte de ${type} generado`, color: 'teal' })
  } catch (e: any) {
    toast.add({ title: 'Error al generar reporte', description: e?.data?.message, color: 'red' })
  } finally {
    generating[key] = false
  }
}
</script>
