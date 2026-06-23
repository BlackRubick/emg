<template>
  <div class="relative w-full overflow-hidden rounded-xl border border-gray-700/40" style="background:#060e1a;">

    <!-- SVG de señales (viewBox fijo, se estira para llenar) -->
    <svg
      class="w-full"
      style="height:300px; display:block;"
      viewBox="0 0 820 300"
      preserveAspectRatio="none"
    >
      <!-- Grid vertical sutil -->
      <line v-for="t in [1,2,3,4]" :key="t"
        :x1="LX + (t/5)*PW" y1="0"
        :x2="LX + (t/5)*PW" y2="300"
        stroke="rgba(255,255,255,0.04)" stroke-width="1"
      />

      <g v-for="i in 8" :key="i">
        <!-- Separador de fila -->
        <line x1="0" :y1="(i-1)*RH" x2="820" :y2="(i-1)*RH" stroke="#1a2d45" stroke-width="1"/>
        <!-- Fondo alterno -->
        <rect v-if="i%2===0" :x="LX" :y="(i-1)*RH" :width="PW" :height="RH" fill="rgba(255,255,255,0.012)"/>
        <!-- Línea base punteada -->
        <line :x1="LX" :y1="(i-1)*RH + RH/2" :x2="820" :y2="(i-1)*RH + RH/2"
          :stroke="COLORS[i-1]+'25'" stroke-width="1" stroke-dasharray="3,7"
        />
        <!-- Señal: brillo ancho -->
        <path v-if="paths[i-1]" :d="paths[i-1]"
          :stroke="COLORS[i-1]+'44'" stroke-width="5" fill="none"
          stroke-linecap="round" stroke-linejoin="round"
        />
        <!-- Señal: línea nítida -->
        <path v-if="paths[i-1]" :d="paths[i-1]"
          :stroke="COLORS[i-1]" stroke-width="1.4" fill="none"
          stroke-linecap="round" stroke-linejoin="round"
        />
      </g>
    </svg>

    <!-- Etiquetas de canal (HTML, no se distorsionan) -->
    <div class="absolute inset-0 flex flex-col pointer-events-none" style="height:300px;">
      <div v-for="(muscle, i) in MUSCLES" :key="i" class="flex-1 flex items-center pl-2">
        <div class="w-14 flex-shrink-0">
          <p class="text-[10px] font-bold font-mono leading-none" :style="{ color: COLORS[i] }">CH{{ i+1 }}</p>
          <p class="text-[7px] text-gray-600 font-mono mt-0.5 truncate">{{ muscle }}</p>
        </div>
      </div>
    </div>

    <!-- Lecturas µV en vivo (derecha) -->
    <div class="absolute right-1 top-0 flex flex-col pointer-events-none" style="height:300px;">
      <div v-for="(val, i) in lastAmps" :key="i" class="flex-1 flex items-center">
        <span class="text-[9px] font-bold font-mono tabular-nums" :style="{ color: COLORS[i]+'bb' }">
          {{ val >= 0 ? '+' : '' }}{{ val.toFixed(0) }}
        </span>
      </div>
    </div>

    <!-- Overlay cuando está inactivo -->
    <Transition name="fade">
      <div v-if="!isActive"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3"
        style="background:rgba(6,14,26,0.88); height:300px;"
      >
        <UIcon name="i-heroicons-signal-slash" class="w-10 h-10 text-gray-700" />
        <p class="text-sm text-gray-500">Inicia la simulación para ver la señal EMG</p>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

defineProps<{ isActive: boolean }>()

const emgStore = useEMGStore()

const COLORS  = ['#2dd4bf','#60a5fa','#a78bfa','#fbbf24','#34d399','#f472b6','#fb923c','#818cf8']
const MUSCLES = ['Flex.Carpi.R','Flex.Dig','Ext.Carpi.R','Ext.Dig','Biceps','Triceps','Pronator','Supinator']

// Coordenadas fijas del viewBox
const LX = 70   // inicio del área de señal
const PW = 748  // ancho del área de señal (820 - 70 - 2)
const RH = 37.5 // alto de cada fila (300 / 8)
const N  = 150  // frames a mostrar

// Rutas SVG — se recalculan cada vez que cambia el buffer (reactivo Pinia)
const paths = computed(() => {
  const fs = emgStore.buffer.slice(-N)
  if (fs.length < 2) return Array(8).fill('')
  const len = fs.length
  const ampSc = (RH / 2) * 0.8

  return Array.from({ length: 8 }, (_, i) => {
    const cy = i * RH + RH / 2
    let d = ''
    for (let idx = 0; idx < len; idx++) {
      const amp = (fs[idx] as any).channels?.find((c: any) => c.channel === i + 1)?.amplitude ?? 0
      const x = LX + (idx / (len - 1)) * PW
      const y = cy - (amp / 80) * ampSc
      d += `${idx === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `
    }
    return d
  })
})

// Última amplitud por canal
const lastAmps = computed(() => {
  const last = emgStore.buffer.at(-1) as any
  if (!last) return Array(8).fill(0)
  return Array.from({ length: 8 }, (_, i) =>
    last.channels?.find((c: any) => c.channel === i + 1)?.amplitude ?? 0
  )
})
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.35s ease; }
.fade-enter-from, .fade-leave-to       { opacity: 0; }
</style>
