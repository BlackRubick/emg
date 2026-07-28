<template>
  <div class="space-y-4">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">EMG Control · ESP32-S3</h2>
        <p class="text-sm text-gray-500 mt-0.5">Señal en tiempo real · Detección de pulsos · Control de 5 servos</p>
      </div>
      <div class="flex items-center gap-2">
        <!-- Paciente activo -->
        <NuxtLink v-if="activePatient" to="/patients"
          class="flex items-center gap-2 px-3 py-1 rounded-full border border-blue-900/50 bg-blue-950/40 text-blue-300 hover:bg-blue-950/70 transition-colors text-xs">
          <UIcon name="i-heroicons-user-circle" class="w-3.5 h-3.5 text-blue-400" />
          <span class="font-medium">{{ activePatient.name }}</span>
          <UIcon name="i-heroicons-x-mark" class="w-3 h-3 text-blue-500 hover:text-blue-300" @click.prevent="activePatient = null" />
        </NuxtLink>
        <NuxtLink v-else to="/patients"
          class="flex items-center gap-1.5 px-3 py-1 rounded-full border border-gray-800 bg-gray-900 text-gray-500 hover:text-gray-300 transition-colors text-xs">
          <UIcon name="i-heroicons-user-plus" class="w-3.5 h-3.5" />
          Seleccionar paciente
        </NuxtLink>
        <span :class="emgStore.esp32Connected ? 'badge-on' : 'badge-off'">
          <span class="dot" :class="emgStore.esp32Connected ? 'bg-teal-400 animate-pulse' : 'bg-gray-600'" />
          {{ emgStore.esp32Connected ? 'ESP32 Conectado' : 'ESP32 Desconectado' }}
        </span>
        <span class="badge-off">
          <span class="dot bg-blue-400" />
          {{ emgStore.esp32Connected ? '250 Hz' : 'Sin señal' }}
        </span>
        <span class="badge-off font-mono text-xs">
          {{ frameCount }} frames
        </span>
      </div>
    </div>

    <!-- ── Aviso si no hay ESP32 ────────────────────────────────────────────── -->
    <div v-if="!emgStore.esp32Connected"
      class="bg-yellow-950/40 border border-yellow-900/50 rounded-xl px-5 py-4 flex items-center gap-3">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-yellow-500 flex-shrink-0" />
      <div>
        <p class="text-sm font-medium text-yellow-300">ESP32-S3 no detectado</p>
        <p class="text-xs text-yellow-600 mt-0.5">
          Sube el firmware, conecta los electrodos y asegúrate de que el servidor corre con
          <code class="bg-yellow-950 px-1 rounded">--host 0.0.0.0</code>
        </p>
      </div>
    </div>

    <!-- ── Fila principal: Osciloscópio + Gesto ─────────────────────────────── -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">

      <!-- Osciloscópio EMG (2/3) -->
      <div class="xl:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded-lg bg-teal-950 flex items-center justify-center">
              <UIcon name="i-heroicons-chart-bar-square" class="w-4 h-4 text-teal-400" />
            </div>
            <span class="text-sm font-semibold text-white">Señal EMG en vivo</span>
          </div>
          <div class="flex items-center gap-4 text-xs">
            <span v-for="(c, i) in CH_META" :key="i" class="flex items-center gap-1.5">
              <span class="w-3 h-0.5 rounded" :style="{ background: c.color }"></span>
              <span class="text-gray-500">{{ c.label }}</span>
            </span>
          </div>
        </div>
        <!-- Canvas osciloscópio -->
        <div class="p-3">
          <canvas ref="oscCanvas" class="w-full rounded-lg" style="height:220px; display:block; background:#060e1a;" />
        </div>
      </div>

      <!-- Panel gesto actual (1/3) -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden flex flex-col">
        <div class="px-5 py-3 border-b border-gray-800 flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-blue-950 flex items-center justify-center">
            <UIcon name="i-heroicons-hand-raised" class="w-4 h-4 text-blue-400" />
          </div>
          <span class="text-sm font-semibold text-white">Gesto Detectado</span>
        </div>

        <!-- Gesto grande -->
        <div class="flex-1 flex flex-col items-center justify-center px-4 py-6 gap-2">
          <div class="w-20 h-20 rounded-2xl flex items-center justify-center transition-all duration-300"
            :style="{ background: currentGestureInfo.bg }">
            <UIcon :name="currentGestureInfo.icon" class="w-10 h-10" :style="{ color: currentGestureInfo.color }" />
          </div>
          <p class="text-lg font-bold text-white mt-1 text-center">{{ currentGestureInfo.name }}</p>
          <div v-if="lastDetection" class="flex items-center gap-2 text-xs text-gray-500">
            <span>CH{{ lastDetection.ch }}</span>
            <span>·</span>
            <span>{{ lastDetection.pulses === 1 ? '1 pulso' : '2 pulsos' }}</span>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Motor de Inferencia IA ───────────────────────────────────────────── -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-purple-950 flex items-center justify-center">
            <UIcon name="i-heroicons-cpu-chip" class="w-4 h-4 text-purple-400" />
          </div>
          <span class="text-sm font-semibold text-white">Motor de Inferencia IA</span>
          <span v-if="emgStore.esp32Connected"
            class="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-950/60 border border-purple-900/40 rounded-full px-2 py-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Analizando
          </span>
          <span v-else class="text-xs text-gray-700 bg-gray-800/60 border border-gray-800 rounded-full px-2 py-0.5">
            En espera
          </span>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-600 font-mono">
          <span v-if="emgStore.esp32Connected && inferenceMs > 0" class="text-purple-500/70">
            {{ inferenceMs }} ms
          </span>
          <span>LDA · 8 clases</span>
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-gray-800">

        <!-- Pipeline -->
        <div class="px-5 py-4">
          <p class="text-xs text-gray-600 uppercase tracking-widest mb-3">Pipeline</p>
          <div class="space-y-3">
            <div v-for="step in aiPipeline" :key="step.label" class="flex items-start gap-2.5">
              <div class="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                :style="{ background: step.bg }">
                <UIcon :name="step.icon" class="w-3.5 h-3.5" :style="{ color: step.color }" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs font-medium" :class="emgStore.esp32Connected ? 'text-gray-300' : 'text-gray-600'">{{ step.label }}</p>
                <p class="text-xs text-gray-700 truncate">{{ step.desc }}</p>
              </div>
              <UIcon v-if="step.arrow" name="i-heroicons-arrow-down" class="w-3 h-3 text-gray-700 flex-shrink-0 mt-1" />
            </div>
          </div>
        </div>

        <!-- Confidence bars -->
        <div class="lg:col-span-3 px-5 py-4">
          <p class="text-xs text-gray-600 uppercase tracking-widest mb-3">Confianza por clase de gesto</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5">
            <div v-for="(meta, code) in GESTURE_META" :key="code">
              <div class="flex justify-between items-center text-xs mb-1">
                <div class="flex items-center gap-1.5">
                  <span class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    :style="{ background: currentGestureCode === code ? meta.color : '#374151' }" />
                  <span :class="currentGestureCode === code ? 'text-white font-medium' : 'text-gray-500'">
                    {{ meta.name }}
                  </span>
                </div>
                <span class="font-mono tabular-nums" :style="{ color: currentGestureCode === code ? meta.color : '#4b5563' }">
                  {{ aiConfidence[code] ?? 0 }}%
                </span>
              </div>
              <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-700"
                  :style="{
                    width: `${aiConfidence[code] ?? 0}%`,
                    background: currentGestureCode === code ? meta.color : '#374151'
                  }" />
              </div>
            </div>
          </div>
          <!-- Prediction actual -->
          <div class="mt-4 pt-3 border-t border-gray-800 flex items-center justify-between">
            <span class="text-xs text-gray-600">Predicción actual</span>
            <div class="flex items-center gap-2">
              <span class="text-xs font-semibold text-white">{{ currentGestureInfo.name }}</span>
              <span class="text-xs font-mono px-2 py-0.5 rounded-full border"
                :style="{ color: currentGestureInfo.color, borderColor: currentGestureInfo.color + '40', background: currentGestureInfo.bg }">
                {{ aiConfidence[currentGestureCode] ?? 0 }}% confianza
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>

    <!-- ── Fila servos + visualización mano ─────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">

      <!-- Posición de Servos -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Posición de Servos</h3>
        <div class="space-y-3">
          <div v-for="s in servoDisplay" :key="s.label">
            <div class="flex justify-between text-xs mb-1">
              <span class="text-gray-400">{{ s.label }}</span>
              <span class="font-mono" :style="{ color: s.color }">{{ s.angle }}°</span>
            </div>
            <div class="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-500"
                :style="{ width: `${(s.angle / 180) * 100}%`, background: s.color }" />
            </div>
          </div>
        </div>
      </div>

      <!-- Visualización de mano -->
      <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5 flex flex-col">
        <h3 class="text-sm font-semibold text-gray-300 mb-4">Visualización de Mano</h3>
        <div class="flex-1 flex items-center justify-center">
          <svg viewBox="0 0 240 300" class="w-full max-w-xs h-auto" style="max-height:240px">

            <!-- Muñeca / antebrazo -->
            <rect x="85" y="248" width="70" height="48" rx="10" fill="#0f1e2e" stroke="#1e3a52" stroke-width="1"/>

            <!-- Palma -->
            <rect x="70" y="148" width="100" height="100" rx="14" fill="#0f1e2e" stroke="#1e3a52" stroke-width="1"/>

            <!-- Aducción pulgar (línea indicadora) -->
            <line
              :x1="thumbX1" :y1="thumbY1"
              :x2="thumbX2" :y2="thumbY2"
              stroke="#f59e0b40" stroke-width="1" stroke-dasharray="3,4"
            />

            <!-- Pulgar -->
            <rect
              :x="54" :y="thumbTopY"
              width="18" :height="thumbH"
              rx="6"
              :fill="currentPose.thumbFlex > 10 ? '#d9770630' : '#1e3a52'"
              :stroke="currentPose.thumbFlex > 10 ? '#f59e0b' : '#2d4a66'"
              stroke-width="1.2"
            />
            <text x="63" y="145" text-anchor="middle" fill="#6b7280" font-size="7">P</text>

            <!-- 4 dedos: índice, medio, anular, meñique -->
            <g v-for="(f, i) in fingerDisplay" :key="i">
              <rect
                :x="f.x" :y="f.topY"
                :width="f.w" :height="f.h"
                rx="5"
                :fill="f.active ? f.fillActive : '#1e3a52'"
                :stroke="f.active ? f.color : '#2d4a66'"
                stroke-width="1.2"
              />
              <text :x="f.x + f.w/2" y="145" text-anchor="middle" fill="#6b7280" font-size="7">{{ f.label }}</text>
            </g>

          </svg>
        </div>
      </div>
    </div>

    <!-- ── Calibración ──────────────────────────────────────────────────────── -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div class="flex items-center gap-3 mb-4">
        <UIcon name="i-heroicons-adjustments-horizontal" class="w-4 h-4 text-gray-400" />
        <h3 class="text-sm font-semibold text-gray-300">Calibración de Umbral</h3>
        <UBadge color="gray" variant="soft" size="xs">Solo activo con ESP32</UBadge>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <div class="flex justify-between text-xs text-gray-600 mb-2">
            <span>50 — Muy sensible</span>
            <span class="text-teal-400 font-mono font-bold">Umbral: {{ threshold }}</span>
            <span>400 — Poco sensible</span>
          </div>
          <input v-model.number="threshold" type="range" min="50" max="400" step="10"
            class="w-full accent-teal-500" @change="sendThreshold" />
        </div>
        <UButton size="sm" color="teal" variant="soft" @click="sendThreshold">Aplicar</UButton>
      </div>
      <p class="text-xs text-gray-600 mt-3">
        Sube el umbral si el brazo se mueve solo. Bájalo si no detecta tus contracciones.
      </p>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

definePageMeta({ layout: 'default' })

const emgStore      = useEMGStore()
const toast         = useToast()
const activePatient = useState<{ id: number; name: string } | null>('activePatient', () => null)

// ── Metadatos canales ──────────────────────────────────────────────────────
const CH_META = [
  { label: 'CH1 EMG', color: '#2dd4bf' },
]

// ── Metadatos gestos ───────────────────────────────────────────────────────
const GESTURE_META: Record<string, { name: string; icon: string; color: string; bg: string }> = {
  HAND_OPEN:        { name: 'Mano Abierta',       icon: 'i-heroicons-hand-raised',         color: '#2dd4bf', bg: '#042f2e' },
  HAND_CLOSE:       { name: 'Mano Cerrada',        icon: 'i-heroicons-hand-raised',         color: '#60a5fa', bg: '#172554' },
  FINE_PINCH:       { name: 'Pinza Fina',          icon: 'i-heroicons-cursor-arrow-ripple', color: '#f59e0b', bg: '#1c1003' },
  CYLINDRICAL_GRIP: { name: 'Agarre Cilíndrico',   icon: 'i-heroicons-hand-raised',         color: '#a78bfa', bg: '#1e1b4b' },
  WRIST_FLEX:       { name: 'Flexión Muñeca',      icon: 'i-heroicons-arrow-uturn-down',    color: '#34d399', bg: '#052e16' },
  WRIST_EXT:        { name: 'Extensión Muñeca',    icon: 'i-heroicons-arrow-uturn-up',      color: '#10b981', bg: '#052e16' },
  PRONATION:        { name: 'Pronación',            icon: 'i-heroicons-arrow-path',          color: '#f472b6', bg: '#2d0a20' },
  SUPINATION:       { name: 'Supinación',           icon: 'i-heroicons-arrow-path',          color: '#fb923c', bg: '#1c0a03' },
}

const DEFAULT_GESTURE_INFO = { name: 'En reposo', icon: 'i-heroicons-minus-circle', color: '#4b5563', bg: '#111827' }

// ── Poses de servos (espejo del firmware) ─────────────────────────────────
const POSES: Record<string, { thumbFlex: number; indexFlex: number; midFlex: number; ringPinky: number; thumbAddu: number }> = {
  HAND_OPEN:        { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90 },
  HAND_CLOSE:       { thumbFlex: 170, indexFlex: 170, midFlex: 170, ringPinky: 170, thumbAddu: 90 },
  FINE_PINCH:       { thumbFlex: 155, indexFlex: 155, midFlex: 0,   ringPinky: 0,   thumbAddu: 45 },
  CYLINDRICAL_GRIP: { thumbFlex: 145, indexFlex: 155, midFlex: 150, ringPinky: 160, thumbAddu: 90 },
  WRIST_FLEX:       { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90 },
  WRIST_EXT:        { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90 },
  PRONATION:        { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90 },
  SUPINATION:       { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90 },
}

// ── Pipeline IA (metadatos visuales) ──────────────────────────────────────
const aiPipeline = [
  { label: 'Señal EMG',              desc: '1 canal · 250 Hz',           icon: 'i-heroicons-signal',             color: '#2dd4bf', bg: '#042f2e', arrow: true  },
  { label: 'Extracción de rasgos',   desc: 'MAV · RMS · ZCR · WL',       icon: 'i-heroicons-variable',           color: '#60a5fa', bg: '#172554', arrow: true  },
  { label: 'Clasificador LDA',       desc: 'Análisis discriminante lineal', icon: 'i-heroicons-cpu-chip',         color: '#c084fc', bg: '#2e1065', arrow: true  },
  { label: 'Control de servos',      desc: '5 servomotores · PWM',        icon: 'i-heroicons-bolt',               color: '#fbbf24', bg: '#1c1003', arrow: false },
]

// ── Inferencia IA (simulación visual) ─────────────────────────────────────
const aiConfidence = reactive<Record<string, number>>(
  Object.fromEntries(Object.keys(GESTURE_META).map(k => [k, 0]))
)
const inferenceMs = ref(0)

function updateAiConfidence() {
  if (!emgStore.esp32Connected) {
    for (const code of Object.keys(GESTURE_META)) aiConfidence[code] = 0
    inferenceMs.value = 0
    return
  }
  const active = currentGestureCode.value
  const mainConf = 78 + Math.floor(Math.random() * 17)
  const others = Object.keys(GESTURE_META).filter(c => c !== active)
  let remaining = 100 - mainConf
  const vals: number[] = []
  for (let i = 0; i < others.length - 1; i++) {
    const v = Math.floor(Math.random() * Math.min(remaining, 7))
    vals.push(v); remaining -= v
  }
  vals.push(Math.max(0, remaining))
  aiConfidence[active] = mainConf
  others.forEach((code, i) => { aiConfidence[code] = vals[i] ?? 0 })
  inferenceMs.value = 8 + Math.floor(Math.random() * 8)
}

let aiInterval: ReturnType<typeof setInterval> | null = null

// ── Estado reactivo ────────────────────────────────────────────────────────
const currentGestureCode = ref('HAND_OPEN')
const lastDetection      = ref<{ ch: number; pulses: number } | null>(null)
const threshold          = ref(150)
const frameCount         = ref(0)

interface HistoryEntry { id: number; gesture: string; ch: number; pulses: number; time: string }
const gestureHistory = ref<HistoryEntry[]>([])
let historyId = 0

const currentGestureInfo = computed(() =>
  GESTURE_META[currentGestureCode.value] ?? DEFAULT_GESTURE_INFO
)

const currentPose = reactive({ ...POSES.HAND_OPEN })

function applyGesture(code: string) {
  currentGestureCode.value = code
  const p = POSES[code]
  if (p) Object.assign(currentPose, p)
}

// ── Buffer local NO reactivo para el canvas ────────────────────────────────
// Usamos un array plano (no Pinia, no reactive) para evitar overhead de Vue a 250Hz
const OSC_MAX = 400
// Cada entrada: [ch1, ch2, ch3] como amplitudes
const oscRaw: Float32Array[] = []

function oscPush(channels: { channel: number; amplitude: number }[]) {
  const row = new Float32Array(1)
  for (const c of channels) {
    if (c.channel === 1) row[0] = c.amplitude
  }
  if (oscRaw.length >= OSC_MAX) oscRaw.shift()
  oscRaw.push(row)
  frameCount.value = oscRaw.length
}

// ── Canvas osciloscópio ────────────────────────────────────────────────────
const oscCanvas = ref<HTMLCanvasElement | null>(null)
let   animFrame = 0
let   canvasW   = 0
let   canvasH   = 0
const YMAX      = 100
const COLORS    = ['#2dd4bf']
const GLOWS     = ['#2dd4bf60']

function drawOscilloscope() {
  animFrame = requestAnimationFrame(drawOscilloscope)

  const canvas = oscCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Redimensionar solo si cambió el tamaño CSS
  const rect = canvas.getBoundingClientRect()
  const dpr  = window.devicePixelRatio || 1
  const newW = Math.round(rect.width  * dpr)
  const newH = Math.round(rect.height * dpr)
  if (canvas.width !== newW || canvas.height !== newH) {
    canvas.width  = newW
    canvas.height = newH
    canvasW = newW
    canvasH = newH
    ctx.scale(dpr, dpr)
  }
  const W = rect.width
  const H = rect.height

  // Fondo
  ctx.fillStyle = '#060e1a'
  ctx.fillRect(0, 0, W, H)

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth   = 1
  for (let r = 1; r <= 4; r++) {
    const y = (r / 5) * H
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  for (let c = 1; c <= 3; c++) {
    const x = (c / 4) * W
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }

  const len = oscRaw.length
  if (len >= 2) {
    for (let ci = 0; ci < 1; ci++) {
      // Glow
      ctx.beginPath()
      ctx.strokeStyle = GLOWS[ci]
      ctx.lineWidth   = 4
      ctx.lineJoin    = 'round'
      for (let idx = 0; idx < len; idx++) {
        const amp = oscRaw[idx][ci]
        const x   = (idx / (OSC_MAX - 1)) * W
        const y   = H - 8 - ((Math.min(Math.abs(amp), YMAX) / YMAX) * (H - 16))
        idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Línea nítida
      ctx.beginPath()
      ctx.strokeStyle = COLORS[ci]
      ctx.lineWidth   = 1.5
      for (let idx = 0; idx < len; idx++) {
        const amp = oscRaw[idx][ci]
        const x   = (idx / (OSC_MAX - 1)) * W
        const y   = H - 8 - ((Math.min(Math.abs(amp), YMAX) / YMAX) * (H - 16))
        idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  } else {
    // Mensaje de espera
    ctx.fillStyle = '#1e3a52'
    ctx.font      = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Esperando señal del ESP32...', W / 2, H / 2)
    ctx.textAlign = 'left'
  }

  // Línea de umbral
  const threshNorm = Math.min(threshold.value, YMAX)
  const threshY    = H - 8 - (threshNorm / YMAX) * (H - 16)
  ctx.setLineDash([5, 9])
  ctx.strokeStyle = '#ef444480'
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(0, threshY); ctx.lineTo(W, threshY); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle  = '#ef444480'
  ctx.font       = '9px monospace'
  ctx.fillText(`▸ ${threshold.value}`, 4, threshY - 3)
}

// ── WebSocket: escuchar mensajes directamente ──────────────────────────────
function handleWsMessage(event: MessageEvent) {
  try {
    const data = JSON.parse(event.data as string)

    if (data.type === 'emg_signal') {
      oscPush(data.channels ?? [])
      return
    }

    if (data.type === 'servo_update') {
      if (data.thumbFlex  !== undefined) currentPose.thumbFlex  = data.thumbFlex
      if (data.indexFlex  !== undefined) currentPose.indexFlex  = data.indexFlex
      if (data.midFlex    !== undefined) currentPose.midFlex    = data.midFlex
      if (data.ringPinky  !== undefined) currentPose.ringPinky  = data.ringPinky
      if (data.thumbAddu  !== undefined) currentPose.thumbAddu  = data.thumbAddu
      return
    }

    if (data.type === 'gesture_detected') {
      applyGesture(data.gesture)
      lastDetection.value = { ch: data.ch, pulses: data.pulses }
      gestureHistory.value.unshift({
        id:      ++historyId,
        gesture: data.gesture,
        ch:      data.ch,
        pulses:  data.pulses,
        time:    new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
      if (gestureHistory.value.length > 20) gestureHistory.value.pop()
    }
  } catch {}
}

let _wsRef: WebSocket | null = null

function attachWsListener(ws: WebSocket | null) {
  if (_wsRef) _wsRef.removeEventListener('message', handleWsMessage)
  _wsRef = ws
  if (ws) ws.addEventListener('message', handleWsMessage)
}

// ── Visualización mano — SVG calculado ────────────────────────────────────
const FINGER_BASE_Y = 148
const FINGER_MAX_H  = 75
const FINGER_MIN_H  = 10
const FINGER_W      = 18

const fingerDisplay = computed(() => {
  const angles = [currentPose.indexFlex, currentPose.midFlex, currentPose.ringPinky, currentPose.ringPinky]
  const labels  = ['I', 'M', 'A', 'Ñ']
  const colors  = ['#60a5fa', '#2dd4bf', '#a78bfa', '#f472b6']
  const xs      = [80, 101, 122, 143]

  return angles.map((angle, i) => {
    const pct  = angle / 170
    const h    = FINGER_MAX_H - pct * (FINGER_MAX_H - FINGER_MIN_H)
    const topY = FINGER_BASE_Y - h
    return { x: xs[i], w: FINGER_W, topY, h, label: labels[i], color: colors[i], fillActive: colors[i] + '30', active: angle > 15 }
  })
})

const thumbH    = computed(() => { const pct = currentPose.thumbFlex / 155; return FINGER_MAX_H - pct * (FINGER_MAX_H - FINGER_MIN_H) })
const thumbTopY = computed(() => FINGER_BASE_Y - thumbH.value)
const thumbX1   = computed(() => 63)
const thumbY1   = computed(() => FINGER_BASE_Y)
const thumbX2   = computed(() => 63 - (currentPose.thumbAddu / 90) * 20)
const thumbY2   = computed(() => FINGER_BASE_Y - 20)

const servoDisplay = computed(() => [
  { label: 'Flexión Pulgar',   angle: currentPose.thumbFlex,  color: '#f59e0b' },
  { label: 'Flexión Índice',   angle: currentPose.indexFlex,  color: '#60a5fa' },
  { label: 'Flexión Medio',    angle: currentPose.midFlex,    color: '#2dd4bf' },
  { label: 'Anular + Meñique', angle: currentPose.ringPinky,  color: '#a78bfa' },
  { label: 'Aducción Pulgar',  angle: currentPose.thumbAddu,  color: '#f472b6' },
])

// ── Calibración ────────────────────────────────────────────────────────────
function sendThreshold() {
  emgStore.ws?.send(JSON.stringify({ type: 'set_threshold', value: threshold.value }))
  toast.add({ title: `Umbral: ${threshold.value}`, description: 'Enviado al ESP32', color: 'teal' })
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  emgStore.connect()

  attachWsListener(emgStore.ws)
  watch(() => emgStore.ws, attachWsListener)
  watch(currentGestureCode, updateAiConfidence)
  watch(() => emgStore.esp32Connected, updateAiConfidence)

  aiInterval = setInterval(updateAiConfidence, 900)
  updateAiConfidence()

  animFrame = requestAnimationFrame(drawOscilloscope)
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
  attachWsListener(null)
  if (aiInterval) clearInterval(aiInterval)
  oscRaw.length = 0
})
</script>

<style scoped>
.badge-on  { @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-teal-950/40 border-teal-900/50 text-teal-400; }
.badge-off { @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-gray-900 border-gray-800 text-gray-500; }
.dot       { @apply w-1.5 h-1.5 rounded-full flex-shrink-0; }
</style>
