<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Señales EMG</h2>
        <p class="text-sm text-gray-400 mt-0.5">Visualización de señales EMG en tiempo real e históricas</p>
      </div>
      <div class="flex gap-2">
        <UButton
          :icon="emgStore.isStreaming ? 'i-heroicons-stop-circle' : 'i-heroicons-play-circle'"
          :color="emgStore.isStreaming ? 'red' : 'teal'"
          @click="toggleStream"
        >
          {{ emgStore.isStreaming ? 'Detener Sesión' : 'Iniciar Sesión' }}
        </UButton>
      </div>
    </div>

    <!-- Connection Status -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-4">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full" :class="emgStore.isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'"></div>
            <span class="text-sm text-gray-300">{{ emgStore.isConnected ? 'WebSocket Conectado' : 'Desconectado' }}</span>
          </div>
          <div class="text-xs text-gray-500">Latencia: {{ emgStore.latency }}ms</div>
          <div v-if="emgStore.sessionId" class="text-xs text-gray-500 font-mono">Sesión: {{ emgStore.sessionId?.slice(0, 8) }}...</div>
        </div>
        <div class="text-xs text-gray-500">Buffer: {{ emgStore.buffer.length }} frames</div>
      </div>
    </div>

    <!-- Real-time Signal Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div
        v-for="i in 8"
        :key="i"
        class="bg-gray-900 border border-gray-800 rounded-xl p-4"
        :class="emgStore.isStreaming ? 'border-teal-800/50' : ''"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <div class="w-2 h-2 rounded-full" :style="{ backgroundColor: channelColors[i - 1] }"></div>
            <span class="text-xs font-medium text-gray-300">CH {{ i }}</span>
          </div>
          <span class="text-xs text-gray-500 font-mono">
            {{ getLastAmplitude(i).toFixed(1) }} µV
          </span>
        </div>
        <EMGSignalChart :channel-index="i - 1" :height="80" :color="channelColors[i - 1]" :realtime="true" />
        <div class="mt-1 text-xs text-gray-600 truncate">{{ muscleLabels[i - 1] }}</div>
      </div>
    </div>

    <!-- Historical Signals Table -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <div class="flex items-center justify-between mb-4">
        <h3 class="text-sm font-semibold text-gray-300">Historial de Señales</h3>
        <USelect v-model="selectedChannel" :options="channelOptions" size="xs" class="w-40" @change="refresh()" />
      </div>

      <DataTable
        :rows="signals"
        :columns="signalColumns"
        :total="total"
        :loading="pending"
        @update:page="p => { query.page = p; refresh() }"
        @update:limit="l => { query.limit = l; refresh() }"
      >
        <template #amplitude-data="{ row }">
          <span class="font-mono text-teal-400">{{ Number(row.amplitude).toFixed(3) }} µV</span>
        </template>
        <template #frequency-data="{ row }">
          <span class="font-mono text-blue-400">{{ row.frequency ? Number(row.frequency).toFixed(1) + ' Hz' : '-' }}</span>
        </template>
        <template #timestamp-data="{ row }">
          <span class="text-gray-500 text-xs font-mono">{{ new Date(row.timestamp).toLocaleTimeString('es') }}</span>
        </template>
        <template #channel-data="{ row }">
          <span class="text-xs text-gray-400">CH{{ row.channel?.channelNumber }} - {{ row.channel?.muscleLocation }}</span>
        </template>
      </DataTable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

definePageMeta({ layout: 'default' })
const emgStore = useEMGStore()
const toast = useToast()

const selectedChannel = ref('')
const channelOptions = [
  { label: 'Todos los canales', value: '' },
  ...Array.from({ length: 8 }, (_, i) => ({ label: `Canal ${i + 1}`, value: String(i + 1) })),
]

const query = reactive({ page: 1, limit: 30, channelId: '' })
watch(selectedChannel, v => { query.channelId = v; query.page = 1 })

const { data, pending, refresh } = await useFetch('/api/signals', { query })
const signals = computed(() => (data.value as any)?.data || [])
const total = computed(() => (data.value as any)?.meta?.total || 0)

const channelColors = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#6366f1']
const muscleLabels = [
  'Flexor Carpi Radialis', 'Flexor Digitorum', 'Ext. Carpi Radialis', 'Ext. Digitorum',
  'Biceps Brachii', 'Triceps Brachii', 'Pronator Teres', 'Supinator',
]

const getLastAmplitude = (ch: number) => {
  const frame = emgStore.lastFrame
  if (!frame) return 0
  return frame.channels.find((c: any) => c.channel === ch)?.amplitude ?? 0
}

const signalColumns = [
  { key: 'channel', label: 'Canal' },
  { key: 'amplitude', label: 'Amplitud' },
  { key: 'frequency', label: 'Frecuencia' },
  { key: 'timestamp', label: 'Marca de Tiempo' },
  { key: 'sessionId', label: 'Sesión' },
]

const toggleStream = () => {
  if (!emgStore.isConnected) emgStore.connect()
  if (emgStore.isStreaming) {
    emgStore.stopStreaming()
    toast.add({ title: 'Sesión detenida', color: 'gray' })
  } else {
    emgStore.startStreaming()
    toast.add({ title: 'Sesión iniciada', color: 'teal' })
  }
}

onMounted(() => emgStore.connect())
onUnmounted(() => emgStore.disconnect())

const refreshInterval = setInterval(() => { if (emgStore.isStreaming) refresh() }, 5000)
onUnmounted(() => clearInterval(refreshInterval))
</script>
