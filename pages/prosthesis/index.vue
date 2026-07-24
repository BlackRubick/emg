<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Control de Prótesis</h2>
        <p class="text-sm text-gray-400 mt-0.5">Panel de control de mano protésica en tiempo real</p>
      </div>
      <div class="flex items-center gap-2">
        <UBadge :color="emgStore.esp32Connected ? 'teal' : 'gray'" variant="soft">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full" :class="emgStore.esp32Connected ? 'bg-teal-400 animate-pulse' : 'bg-gray-500'"></span>
            {{ emgStore.esp32Connected ? 'ESP32 Conectado' : 'ESP32 Sin Conexión' }}
          </span>
        </UBadge>
        <UBadge v-if="prosthesis" :color="prosthesis.status === 'active' ? 'green' : 'red'" variant="soft">
          <span class="flex items-center gap-1.5">
            <span class="w-1.5 h-1.5 rounded-full" :class="prosthesis.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-red-400'"></span>
            {{ prosthesis.status }}
          </span>
        </UBadge>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Control Panel -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Control Manual</h3>

        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="gesture in controlGestures"
            :key="gesture.code"
            class="p-3 rounded-xl border text-center transition-all"
            :class="activeGesture === gesture.code
              ? 'bg-teal-900/50 border-teal-500 text-teal-400'
              : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:border-gray-600 hover:text-white'"
            @click="sendCommand(gesture.code, gesture.id)"
          >
            <UIcon :name="gesture.icon" class="w-6 h-6 mx-auto mb-1" />
            <span class="text-xs">{{ gesture.shortName }}</span>
          </button>
        </div>

        <div class="mt-4 flex gap-2">
          <UButton block color="red" variant="soft" icon="i-heroicons-stop" :loading="stopping" @click="stopProsthesis">
            DETENER
          </UButton>
        </div>
      </div>

      <!-- Status & Info -->
      <div class="space-y-4">
        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 mb-3">Info del Dispositivo</h3>
          <div v-if="prosthesis" class="space-y-2 text-sm">
            <div class="flex justify-between">
              <span class="text-gray-500">Nombre</span>
              <span class="text-white">{{ prosthesis.name }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Serie</span>
              <span class="text-white font-mono">{{ prosthesis.serialNumber }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">IP</span>
              <span class="text-white font-mono">{{ prosthesis.ipAddress }}:{{ prosthesis.port }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Tipo</span>
              <span class="text-white">{{ prosthesis.type }}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-500">Último acceso</span>
              <span class="text-white text-xs">{{ prosthesis.lastSeen ? new Date(prosthesis.lastSeen).toLocaleString('es') : 'Nunca' }}</span>
            </div>
          </div>
        </div>

        <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <h3 class="text-sm font-semibold text-gray-300 mb-3">Latencia</h3>
          <div class="text-3xl font-mono font-bold text-teal-400">
            {{ lastLatency.toFixed(1) }} <span class="text-sm text-gray-500">ms</span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Último viaje de ida y vuelta del comando</p>
        </div>
      </div>

      <!-- Movement History -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Historial de Movimientos</h3>
        <div class="space-y-2 max-h-80 overflow-y-auto">
          <div
            v-for="m in movements"
            :key="m.id"
            class="flex items-center gap-3 p-2 rounded-lg bg-gray-800/50"
          >
            <div class="w-7 h-7 rounded-full bg-teal-900/50 flex items-center justify-center flex-shrink-0">
              <UIcon :name="gestureIconMap[m.gesture?.code] || 'i-heroicons-bolt'" class="w-3.5 h-3.5 text-teal-400" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-xs font-medium text-white truncate">{{ m.gesture?.name || m.command }}</p>
              <p class="text-xs text-gray-500">{{ new Date(m.executedAt).toLocaleTimeString('es') }}</p>
            </div>
            <div class="text-right">
              <StatusBadge :status="m.status" />
              <p v-if="m.latency" class="text-xs text-gray-500 mt-0.5">{{ m.latency.toFixed(0) }}ms</p>
            </div>
          </div>
          <div v-if="!movements.length" class="text-center text-gray-600 text-sm py-4">Sin movimientos aún</div>
        </div>
      </div>
    </div>

    <!-- API Endpoints Reference -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 class="text-sm font-semibold text-gray-300 mb-3">Endpoints API Raspberry Pi</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div v-for="ep in endpoints" :key="ep.path" class="bg-gray-800/50 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-1">
            <UBadge :color="ep.method === 'POST' ? 'teal' : 'blue'" variant="soft" size="xs">{{ ep.method }}</UBadge>
            <span class="font-mono text-xs text-gray-300">{{ ep.path }}</span>
          </div>
          <p class="text-xs text-gray-500">{{ ep.description }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

definePageMeta({ layout: 'default' })
const toast = useToast()
const emgStore = useEMGStore()

onMounted(() => emgStore.connect())
onUnmounted(() => emgStore.disconnect())

const { data: statusData, refresh } = await useFetch('/api/prosthesis/estado')
const prostheses = computed(() => (statusData.value as any)?.data || [])
const prosthesis = computed(() => prostheses.value[0])
const movements = computed(() => prosthesis.value?.movements || [])

const activeGesture = ref('')
const stopping = ref(false)
const lastLatency = ref(0)

const gestureIconMap: Record<string, string> = {
  HAND_OPEN:        'i-heroicons-hand-raised',
  HAND_CLOSE:       'i-heroicons-hand-raised',
  FINE_PINCH:       'i-heroicons-cursor-arrow-ripple',
  CYLINDRICAL_GRIP: 'i-heroicons-hand-raised',
  WRIST_FLEX:       'i-heroicons-arrow-uturn-down',
  WRIST_EXT:        'i-heroicons-arrow-uturn-up',
  ROTATION:         'i-heroicons-arrow-path',
  PRONATION:        'i-heroicons-arrow-path',
  SUPINATION:       'i-heroicons-arrow-path',
}

const controlGestures = [
  { code: 'HAND_OPEN',        id: 1, icon: 'i-heroicons-hand-raised',        shortName: 'Abrir' },
  { code: 'HAND_CLOSE',       id: 2, icon: 'i-heroicons-hand-raised',        shortName: 'Cerrar' },
  { code: 'FINE_PINCH',       id: 3, icon: 'i-heroicons-cursor-arrow-ripple',shortName: 'Pinza' },
  { code: 'CYLINDRICAL_GRIP', id: 4, icon: 'i-heroicons-hand-raised',        shortName: 'Agarre' },
  { code: 'WRIST_FLEX',       id: 5, icon: 'i-heroicons-arrow-uturn-down',   shortName: 'Flexión' },
  { code: 'WRIST_EXT',        id: 6, icon: 'i-heroicons-arrow-uturn-up',     shortName: 'Extensión' },
  { code: 'ROTATION',         id: 7, icon: 'i-heroicons-arrow-path',         shortName: 'Rotación' },
  { code: 'PRONATION',        id: 8, icon: 'i-heroicons-arrow-path',         shortName: 'Pronación' },
  { code: 'SUPINATION',       id: 9, icon: 'i-heroicons-arrow-path',         shortName: 'Supinación' },
]

const endpoints = [
  { method: 'POST', path: '/api/prosthesis/mover', description: 'Enviar comando de movimiento a la prótesis' },
  { method: 'POST', path: '/api/prosthesis/detener', description: 'Detener todos los movimientos de la prótesis' },
  { method: 'GET', path: '/api/prosthesis/estado', description: 'Obtener estado de conexión de la prótesis' },
]

const sendCommand = async (code: string, gestureId: number) => {
  if (!prosthesis.value) {
    toast.add({ title: 'Sin prótesis conectada', color: 'orange' })
    return
  }
  activeGesture.value = code
  try {
    const result = await $fetch<any>('/api/prosthesis/mover', {
      method: 'POST',
      body: { prosthesisId: prosthesis.value.id, command: code, gestureId, source: 'manual' },
    })
    lastLatency.value = result.data.latency || 0
    toast.add({ title: `Comando: ${code}`, description: `${lastLatency.value.toFixed(1)}ms de latencia`, color: 'teal' })
    setTimeout(() => { activeGesture.value = '' }, 1500)
    refresh()
  } catch (e: any) {
    toast.add({ title: 'Comando fallido', description: e?.data?.message, color: 'red' })
    activeGesture.value = ''
  }
}

const stopProsthesis = async () => {
  if (!prosthesis.value) return
  stopping.value = true
  try {
    await $fetch('/api/prosthesis/detener', {
      method: 'POST',
      body: { prosthesisId: prosthesis.value.id },
    })
    activeGesture.value = ''
    toast.add({ title: 'Prótesis detenida', color: 'gray' })
    refresh()
  } finally {
    stopping.value = false
  }
}
</script>
