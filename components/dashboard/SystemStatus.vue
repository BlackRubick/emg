<template>
  <div class="flex items-center gap-6">
    <div v-for="item in statusItems" :key="item.label" class="flex items-center gap-2">
      <span
        class="w-2 h-2 rounded-full flex-shrink-0"
        :class="[item.ok ? 'bg-green-400' : 'bg-red-400', item.ok ? 'animate-pulse' : '']"
      />
      <span class="text-xs text-gray-400">{{ item.label }}</span>
      <span class="text-xs font-medium" :class="item.ok ? 'text-green-400' : 'text-red-400'">
        {{ item.ok ? item.okText : item.failText }}
      </span>
    </div>

    <div class="ml-auto flex items-center gap-2 text-xs text-gray-600">
      <UIcon name="i-heroicons-clock" class="w-3.5 h-3.5" />
      Actualizado {{ lastUpdated }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

const props = defineProps<{
  stats: any
}>()

const emgStore = useEMGStore()
const lastUpdated = ref('ahora')
let tick: ReturnType<typeof setInterval>

onMounted(() => {
  let secs = 0
  tick = setInterval(() => {
    secs++
    lastUpdated.value = secs < 60 ? `hace ${secs}s` : `hace ${Math.floor(secs / 60)}m`
  }, 1000)
})

onUnmounted(() => clearInterval(tick))

const statusItems = computed(() => [
  {
    label: 'Base de datos',
    ok: !!(props.stats?.totalUsers >= 0),
    okText: 'Online',
    failText: 'Error',
  },
  {
    label: 'WebSocket',
    ok: emgStore.isConnected,
    okText: `${emgStore.latency}ms`,
    failText: 'Desconectado',
  },
  {
    label: 'Señal EMG',
    ok: emgStore.isStreaming,
    okText: 'Activa',
    failText: 'Inactiva',
  },
  {
    label: 'Modelos LDA',
    ok: (props.stats?.totalModels ?? 0) > 0,
    okText: `${props.stats?.totalModels ?? 0} listos`,
    failText: 'Sin modelos',
  },
])
</script>
