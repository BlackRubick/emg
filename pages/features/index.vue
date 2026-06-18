<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Extracción de Características</h2>
        <p class="text-sm text-gray-400 mt-0.5">Extrae características MAV, RMS, WL, ZC, SSC de señales EMG</p>
      </div>
      <UButton icon="i-heroicons-beaker" color="teal" @click="showExtractModal = true">
        Extraer Características
      </UButton>
    </div>

    <!-- Feature Formula Cards -->
    <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
      <div v-for="feat in featureInfo" :key="feat.name" class="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div class="flex items-center justify-between mb-2">
          <span class="font-bold text-lg" :class="feat.color">{{ feat.name }}</span>
          <UIcon :name="feat.icon" class="w-4 h-4 text-gray-500" />
        </div>
        <p class="text-xs text-gray-500 mb-1">{{ feat.fullName }}</p>
        <p class="text-xs font-mono text-gray-600">{{ feat.formula }}</p>
      </div>
    </div>

    <DataTable
      :rows="features"
      :columns="columns"
      :total="total"
      :loading="pending"
      @update:page="p => { query.page = p; refresh() }"
      @update:limit="l => { query.limit = l; refresh() }"
    >
      <template #mav-data="{ row }">
        <span class="font-mono text-teal-400 text-xs">{{ row.mav?.toFixed(4) ?? '-' }}</span>
      </template>
      <template #rms-data="{ row }">
        <span class="font-mono text-blue-400 text-xs">{{ row.rms?.toFixed(4) ?? '-' }}</span>
      </template>
      <template #wl-data="{ row }">
        <span class="font-mono text-purple-400 text-xs">{{ row.wl?.toFixed(4) ?? '-' }}</span>
      </template>
      <template #zc-data="{ row }">
        <span class="font-mono text-orange-400 text-xs">{{ row.zc ?? '-' }}</span>
      </template>
      <template #ssc-data="{ row }">
        <span class="font-mono text-pink-400 text-xs">{{ row.ssc ?? '-' }}</span>
      </template>
      <template #channel-data="{ row }">
        <span class="text-xs text-gray-400">CH{{ row.channel?.channelNumber }}</span>
      </template>
      <template #createdAt-data="{ row }">
        <span class="text-xs text-gray-500">{{ new Date(row.createdAt).toLocaleString('es') }}</span>
      </template>
    </DataTable>

    <!-- Extract Modal -->
    <UModal v-model="showExtractModal">
      <UCard>
        <template #header>
          <h3 class="font-semibold text-white">Extraer Características</h3>
        </template>
        <div class="space-y-4">
          <UFormGroup label="ID de Canal">
            <UInput v-model.number="extractForm.channelId" type="number" />
          </UFormGroup>
          <UFormGroup label="ID de Sesión (opcional)">
            <UInput v-model="extractForm.sessionId" placeholder="ej. session-001" />
          </UFormGroup>
          <UFormGroup label="Valores de muestra (separados por coma)">
            <UTextarea v-model="extractForm.samplesRaw" placeholder="0.1, -0.3, 0.5, ..." rows="4" />
          </UFormGroup>
          <div class="flex justify-end gap-3">
            <UButton color="gray" variant="ghost" @click="showExtractModal = false">Cancelar</UButton>
            <UButton color="teal" :loading="extracting" @click="extractFeatures">Extraer</UButton>
          </div>
        </div>
      </UCard>
    </UModal>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'default' })
const toast = useToast()

const query = reactive({ page: 1, limit: 20 })
const { data, pending, refresh } = await useFetch('/api/features', { query })
const features = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const showExtractModal = ref(false)
const extracting = ref(false)
const extractForm = reactive({ channelId: 1, sessionId: '', samplesRaw: '' })

const featureInfo = [
  { name: 'MAV', fullName: 'Valor Medio Absoluto', formula: 'Σ|x(i)| / N', color: 'text-teal-400', icon: 'i-heroicons-calculator' },
  { name: 'RMS', fullName: 'Raíz Media Cuadrática', formula: '√(Σx(i)² / N)', color: 'text-blue-400', icon: 'i-heroicons-variable' },
  { name: 'WL', fullName: 'Longitud de Onda', formula: 'Σ|x(i+1)-x(i)|', color: 'text-purple-400', icon: 'i-heroicons-chart-bar' },
  { name: 'ZC', fullName: 'Cruces por Cero', formula: 'Σ|sgn(x(i))≠sgn(x(i+1))|', color: 'text-orange-400', icon: 'i-heroicons-arrows-right-left' },
  { name: 'SSC', fullName: 'Cambios de Signo de Pendiente', formula: 'Σ|slope changes|', color: 'text-pink-400', icon: 'i-heroicons-arrow-trending-up' },
]

const columns = [
  { key: 'channel', label: 'Canal' },
  { key: 'mav', label: 'MAV' },
  { key: 'rms', label: 'RMS' },
  { key: 'wl', label: 'WL' },
  { key: 'zc', label: 'ZC' },
  { key: 'ssc', label: 'SSC' },
  { key: 'sessionId', label: 'Sesión' },
  { key: 'createdAt', label: 'Extraído' },
]

const extractFeatures = async () => {
  extracting.value = true
  try {
    const samples = extractForm.samplesRaw.split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n))
    if (samples.length < 10) {
      toast.add({ title: 'Proporciona al menos 10 muestras', color: 'orange' })
      return
    }
    await $fetch('/api/features/extract', {
      method: 'POST',
      body: { channelId: extractForm.channelId, sessionId: extractForm.sessionId || undefined, samples },
    })
    toast.add({ title: 'Características extraídas exitosamente', color: 'teal' })
    showExtractModal.value = false
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Error', description: e?.data?.message, color: 'red' })
  } finally {
    extracting.value = false
  }
}
</script>
