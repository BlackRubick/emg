<template>
  <div class="space-y-4">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">Reconocimiento de Gestos</h2>
        <p class="text-sm text-gray-400 mt-0.5">Clasificación de gestos EMG en tiempo real</p>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <!-- Classification Panel -->
      <div class="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold text-gray-300">Clasificación en Vivo</h3>
          <div class="flex gap-2">
            <USelect v-model="selectedModelId" :options="modelOptions" size="xs" class="w-48" placeholder="Seleccionar modelo" />
            <UButton
              size="xs"
              :color="classifying ? 'red' : 'teal'"
              @click="toggleClassification"
            >
              {{ classifying ? 'Detener' : 'Clasificar' }}
            </UButton>
          </div>
        </div>

        <!-- Current Gesture Display -->
        <div class="bg-gray-800/50 rounded-xl p-8 text-center mb-4">
          <div v-if="currentResult" class="space-y-2">
            <UIcon :name="gestureIconMap[currentResult.gesture.code] || 'i-heroicons-hand-raised'" class="w-14 h-14 text-teal-400 mb-2 mx-auto" />
            <p class="text-2xl font-bold text-white">{{ currentResult.gesture.name }}</p>
            <div class="flex items-center justify-center gap-2">
              <div class="h-1.5 w-32 bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full bg-teal-500 rounded-full transition-all duration-300"
                  :style="{ width: `${(currentResult.confidence * 100).toFixed(0)}%` }"></div>
              </div>
              <span class="text-sm font-mono text-teal-400">{{ (currentResult.confidence * 100).toFixed(1) }}%</span>
            </div>
          </div>
          <div v-else class="text-gray-600">
            <UIcon name="i-heroicons-hand-raised" class="w-16 h-16 mx-auto mb-2" />
            <p class="text-sm">Selecciona un modelo e inicia la clasificación</p>
          </div>
        </div>

        <!-- All Gesture Probabilities -->
        <div v-if="currentResult" class="space-y-2">
          <div v-for="score in currentResult.allScores" :key="score.gesture.code" class="flex items-center gap-3">
            <span class="text-xs text-gray-400 w-32 truncate">{{ score.gesture.name }}</span>
            <div class="flex-1 h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-300"
                :class="score.gesture.code === currentResult.gesture.code ? 'bg-teal-500' : 'bg-gray-600'"
                :style="{ width: `${(score.probability * 100).toFixed(0)}%` }"
              ></div>
            </div>
            <span class="text-xs font-mono text-gray-500 w-10 text-right">{{ (score.probability * 100).toFixed(0) }}%</span>
          </div>
        </div>
      </div>

      <!-- Gesture Catalog -->
      <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Catálogo de Gestos</h3>
        <div class="space-y-2">
          <div
            v-for="gesture in gestures"
            :key="gesture.id"
            class="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-800 transition-colors"
            :class="currentResult?.gesture.code === gesture.code ? 'bg-teal-900/30 border border-teal-800/50' : ''"
          >
            <UIcon :name="gestureIconMap[gesture.code] || 'i-heroicons-hand-raised'" class="w-5 h-5 text-teal-400 flex-shrink-0" />
            <div class="flex-1">
              <p class="text-sm font-medium text-white">{{ gesture.name }}</p>
              <p class="text-xs text-gray-500">{{ gesture.code }}</p>
            </div>
            <UBadge color="gray" variant="soft" size="xs">{{ gesture._count?.classifications || 0 }}</UBadge>
          </div>
        </div>
      </div>
    </div>

    <!-- Classification History -->
    <div class="bg-gray-900 border border-gray-800 rounded-xl p-5">
      <h3 class="text-sm font-semibold text-gray-300 mb-4">Clasificaciones Recientes</h3>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-gray-800 text-xs text-gray-500 uppercase">
              <th class="text-left pb-2 pr-4">Hora</th>
              <th class="text-left pb-2 pr-4">Gesto</th>
              <th class="text-left pb-2 pr-4">Confianza</th>
              <th class="text-left pb-2">Sesión</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in history" :key="c.id" class="border-b border-gray-800/50 hover:bg-gray-800/20">
              <td class="py-2 pr-4 text-xs text-gray-500 font-mono">{{ new Date(c.timestamp).toLocaleTimeString('es') }}</td>
              <td class="py-2 pr-4">
                <span class="text-gray-300">{{ c.gesture?.name }}</span>
              </td>
              <td class="py-2 pr-4">
                <div class="flex items-center gap-2">
                  <div class="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div class="h-full bg-teal-500 rounded-full" :style="{ width: `${(c.confidence * 100).toFixed(0)}%` }"></div>
                  </div>
                  <span class="text-xs font-mono text-teal-400">{{ (c.confidence * 100).toFixed(0) }}%</span>
                </div>
              </td>
              <td class="py-2 text-xs text-gray-600 font-mono">{{ c.sessionId?.slice(0, 8) || '-' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

definePageMeta({ layout: 'default' })
const emgStore = useEMGStore()
const toast = useToast()

const { data: gesturesData } = await useFetch('/api/gestures')
const gestures = computed(() => (gesturesData.value as any)?.data || [])

const { data: modelsData } = await useFetch('/api/models', { query: { limit: 50 } })
const modelOptions = computed(() =>
  ((modelsData.value as any)?.data || [])
    .filter((m: any) => m.status === 'ready')
    .map((m: any) => ({ label: m.name, value: String(m.id) }))
)

const selectedModelId = ref('')
const classifying = ref(false)
const currentResult = ref<any>(null)
const history = ref<any[]>([])

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

let classifyInterval: ReturnType<typeof setInterval>

const toggleClassification = () => {
  if (!selectedModelId.value) {
    toast.add({ title: 'Selecciona un modelo primero', color: 'orange' })
    return
  }
  classifying.value = !classifying.value
  if (classifying.value) {
    if (!emgStore.isConnected) emgStore.connect()
    classifyInterval = setInterval(classifyGesture, 500)
  } else {
    clearInterval(classifyInterval)
  }
}

const classifyGesture = async () => {
  const features = Array.from({ length: 40 }, () => Math.random() * 100)
  try {
    const result = await $fetch<any>('/api/gestures/classify', {
      method: 'POST',
      body: { modelId: Number(selectedModelId.value), featureVector: features, sessionId: emgStore.sessionId },
    })
    currentResult.value = result.data
    emgStore.setCurrentGesture(result.data)
    history.value.unshift({ id: result.data.classificationId, ...result.data, timestamp: new Date() })
    if (history.value.length > 20) history.value.pop()
  } catch {}
}

onUnmounted(() => clearInterval(classifyInterval))
</script>
