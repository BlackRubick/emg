<template>
  <div class="flex flex-col gap-4">
    <!-- Confidence ring + gesture name -->
    <div class="flex flex-col items-center pt-2">
      <div class="relative mb-3">
        <svg width="128" height="128" class="absolute inset-0 -rotate-90">
          <circle cx="64" cy="64" r="56" fill="none" stroke="#1f2937" stroke-width="7"/>
          <circle
            cx="64" cy="64" r="56" fill="none"
            :stroke="gesture ? '#14b8a6' : '#374151'"
            stroke-width="7"
            stroke-linecap="round"
            :stroke-dasharray="`${351.8 * confidence} 351.8`"
            class="transition-all duration-700 ease-out"
          />
        </svg>
        <div class="w-[128px] h-[128px] rounded-full flex flex-col items-center justify-center bg-gray-800/50 gap-1">
          <UIcon
            :name="gestureIcon"
            class="transition-all duration-300"
            :class="[
              gesture ? 'text-teal-400 w-10 h-10' : 'text-gray-600 w-8 h-8 opacity-40',
            ]"
          />
          <span v-if="gesture" class="text-xs font-mono text-teal-400/70">
            {{ (confidence * 100).toFixed(0) }}%
          </span>
        </div>
      </div>

      <p class="text-base font-bold text-white text-center leading-tight transition-all duration-300">
        {{ gesture?.name ?? 'Sin clasificar' }}
      </p>
      <p v-if="gesture" class="text-xs font-mono text-gray-500 mt-0.5">{{ gesture.code }}</p>
      <p v-else class="text-xs text-gray-600 mt-1">Inicia la simulacion</p>

      <div v-if="gesture" class="w-full mt-3 px-2">
        <div class="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Confianza</span>
          <span class="font-mono text-teal-400">{{ (confidence * 100).toFixed(1) }}%</span>
        </div>
        <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-700"
            :style="{ width: `${confidence * 100}%`, background: 'linear-gradient(90deg, #0d9488, #14b8a6)' }"
          />
        </div>
      </div>
    </div>

    <!-- History -->
    <div class="border-t border-gray-800 pt-3">
      <p class="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Recientes</p>
      <div class="space-y-0.5 max-h-36 overflow-y-auto">
        <div
          v-for="(entry, i) in history"
          :key="entry.id"
          class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
          :class="i === 0 ? 'bg-teal-900/20 border border-teal-900/40' : 'hover:bg-gray-800/40'"
        >
          <UIcon
            :name="gestureIconMap[entry.code] ?? 'i-heroicons-hand-raised'"
            class="w-3.5 h-3.5 flex-shrink-0"
            :class="i === 0 ? 'text-teal-400' : 'text-gray-600'"
          />
          <span class="flex-1 text-gray-400 truncate">{{ entry.name }}</span>
          <span class="font-mono text-gray-600 tabular-nums">{{ (entry.conf * 100).toFixed(0) }}%</span>
          <span class="text-gray-700 tabular-nums">{{ entry.time }}</span>
        </div>
        <p v-if="!history.length" class="text-center text-gray-700 py-3 text-xs">Sin historial</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

const emgStore   = useEMGStore()
const gesture    = computed(() => emgStore.currentGesture?.gesture ?? null)
const confidence = computed(() => emgStore.currentGesture?.confidence ?? 0)

const gestureIconMap: Record<string, string> = {
  HAND_OPEN:        'i-heroicons-hand-raised',
  HAND_CLOSE:       'i-heroicons-hand-raised',
  FINE_PINCH:       'i-heroicons-cursor-arrow-ripple',
  CYLINDRICAL_GRIP: 'i-heroicons-hand-raised',
  WRIST_FLEX:       'i-heroicons-arrow-uturn-down',
  WRIST_EXT:        'i-heroicons-arrow-uturn-up',
  PRONATION:        'i-heroicons-arrow-path',
  SUPINATION:       'i-heroicons-arrow-path',
}

const gestureIcon = computed(() =>
  gestureIconMap[gesture.value?.code ?? ''] ?? 'i-heroicons-hand-raised'
)

interface HistoryEntry { id: number; code: string; name: string; conf: number; time: string }
const history = ref<HistoryEntry[]>([])
let hid = 0

watch(() => emgStore.currentGesture, (g) => {
  if (!g) return
  history.value.unshift({
    id:   ++hid,
    code: g.gesture.code,
    name: g.gesture.name,
    conf: g.confidence,
    time: new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  })
  if (history.value.length > 8) history.value.pop()
})
</script>
