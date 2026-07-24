<template>
  <div class="space-y-4">

    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">EMG Control · ESP32-S3</h2>
        <p class="text-sm text-gray-500 mt-0.5">Señal en tiempo real · Detección de pulsos · Control de 6 servos</p>
      </div>
      <div class="flex items-center gap-2">
        <span :class="emgStore.esp32Connected ? 'badge-on' : 'badge-off'">
          <span class="dot" :class="emgStore.esp32Connected ? 'bg-teal-400 animate-pulse' : 'bg-gray-600'" />
          {{ emgStore.esp32Connected ? 'ESP32 Conectado' : 'ESP32 Desconectado' }}
        </span>
        <span class="badge-off">
          <span class="dot bg-blue-400" />
          {{ emgStore.esp32Connected ? '250 Hz' : 'Sin señal' }}
        </span>
        <span class="badge-off font-mono text-xs">
          Latencia: {{ emgStore.latency }}ms
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
            <span class="text-gray-700 font-mono">{{ emgStore.buffer.length }} frames</span>
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

        <!-- Historial de gestos -->
        <div class="border-t border-gray-800 px-4 py-3 space-y-1 max-h-44 overflow-y-auto">
          <p class="text-xs text-gray-600 font-semibold uppercase tracking-wider mb-2">Historial</p>
          <div v-if="!gestureHistory.length" class="text-xs text-gray-700 text-center py-2">
            Sin detecciones aún
          </div>
          <div v-for="g in gestureHistory" :key="g.id"
            class="flex items-center gap-2 text-xs py-1">
            <span class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ background: GESTURE_META[g.gesture]?.color ?? '#6b7280' }"></span>
            <span class="text-gray-300 flex-1 truncate">{{ GESTURE_META[g.gesture]?.name ?? g.gesture }}</span>
            <span class="text-gray-600 font-mono flex-shrink-0">{{ g.time }}</span>
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
            <!-- Indicador rotación muñeca -->
            <g :transform="`rotate(${wristRotDeg}, 120, 252)`">
              <line x1="120" y1="252" x2="120" y2="240" stroke="#14b8a6" stroke-width="2" stroke-linecap="round"/>
              <circle cx="120" cy="252" r="3" fill="#14b8a6"/>
            </g>
            <text x="120" y="270" text-anchor="middle" fill="#374151" font-size="7">MUÑECA {{ currentPose.wristRot }}°</text>

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

const emgStore = useEMGStore()
const toast    = useToast()

// ── Metadatos canales ──────────────────────────────────────────────────────
const CH_META = [
  { label: 'CH1 Flexor',   color: '#2dd4bf' },
  { label: 'CH2 Extensor', color: '#60a5fa' },
  { label: 'CH3 Bíceps',   color: '#a78bfa' },
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
const POSES: Record<string, { thumbFlex: number; indexFlex: number; midFlex: number; ringPinky: number; thumbAddu: number; wristRot: number }> = {
  HAND_OPEN:        { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90,  wristRot: 90  },
  HAND_CLOSE:       { thumbFlex: 170, indexFlex: 170, midFlex: 170, ringPinky: 170, thumbAddu: 90,  wristRot: 90  },
  FINE_PINCH:       { thumbFlex: 155, indexFlex: 155, midFlex: 0,   ringPinky: 0,   thumbAddu: 45,  wristRot: 90  },
  CYLINDRICAL_GRIP: { thumbFlex: 145, indexFlex: 155, midFlex: 150, ringPinky: 160, thumbAddu: 90,  wristRot: 90  },
  WRIST_FLEX:       { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90,  wristRot: 45  },
  WRIST_EXT:        { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90,  wristRot: 135 },
  PRONATION:        { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90,  wristRot: 0   },
  SUPINATION:       { thumbFlex: 0,   indexFlex: 0,   midFlex: 0,   ringPinky: 0,   thumbAddu: 90,  wristRot: 180 },
}

// ── Estado reactivo ────────────────────────────────────────────────────────
const currentGestureCode = ref('HAND_OPEN')
const lastDetection      = ref<{ ch: number; pulses: number } | null>(null)
const threshold          = ref(150)

interface HistoryEntry { id: number; gesture: string; ch: number; pulses: number; time: string }
const gestureHistory = ref<HistoryEntry[]>([])
let historyId = 0

const currentGestureInfo = computed(() =>
  GESTURE_META[currentGestureCode.value] ?? DEFAULT_GESTURE_INFO
)

// Pose actual — se actualiza con cada gesto
const currentPose = reactive({ ...POSES.HAND_OPEN })

function applyGesture(code: string) {
  currentGestureCode.value = code
  const p = POSES[code]
  if (p) Object.assign(currentPose, p)
}

// ── Canvas osciloscópio ────────────────────────────────────────────────────
const oscCanvas = ref<HTMLCanvasElement | null>(null)
let   animFrame = 0
const N_SAMPLES = 400   // ~1.6s a 250Hz
const YMAX      = 100   // amplitud máxima esperada (µV proxy)

const COLORS  = ['#2dd4bf', '#60a5fa', '#a78bfa']
const GLOWS   = ['#2dd4bf60', '#60a5fa60', '#a78bfa60']

function drawOscilloscope() {
  const canvas = oscCanvas.value
  if (!canvas) return
  const ctx    = canvas.getContext('2d')
  if (!ctx)    return

  // Ajuste resolución (HiDPI)
  const rect = canvas.getBoundingClientRect()
  if (canvas.width !== rect.width || canvas.height !== rect.height) {
    canvas.width  = rect.width
    canvas.height = rect.height
  }
  const W = canvas.width
  const H = canvas.height

  // Fondo
  ctx.fillStyle = '#060e1a'
  ctx.fillRect(0, 0, W, H)

  // Grid horizontal (5 líneas)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth   = 1
  for (let r = 1; r <= 4; r++) {
    const y = (r / 5) * H
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }
  // Grid vertical (cada 0.5s aprox)
  for (let c = 1; c <= 3; c++) {
    const x = (c / 4) * W
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke()
  }

  // Señal: 3 canales
  const frames = emgStore.buffer.slice(-N_SAMPLES)
  const len    = frames.length
  if (len >= 2) {
    for (let ci = 0; ci < 3; ci++) {
      // Brillo / glow
      ctx.beginPath()
      ctx.strokeStyle = GLOWS[ci]
      ctx.lineWidth   = 4
      ctx.lineJoin    = 'round'
      for (let idx = 0; idx < len; idx++) {
        const amp  = (frames[idx] as any).channels?.find((c: any) => c.channel === ci + 1)?.amplitude ?? 0
        const x    = (idx / (N_SAMPLES - 1)) * W
        const y    = H - 8 - ((Math.min(Math.abs(amp), YMAX) / YMAX) * (H - 16))
        idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()

      // Línea nítida
      ctx.beginPath()
      ctx.strokeStyle = COLORS[ci]
      ctx.lineWidth   = 1.5
      for (let idx = 0; idx < len; idx++) {
        const amp = (frames[idx] as any).channels?.find((c: any) => c.channel === ci + 1)?.amplitude ?? 0
        const x   = (idx / (N_SAMPLES - 1)) * W
        const y   = H - 8 - ((Math.min(Math.abs(amp), YMAX) / YMAX) * (H - 16))
        idx === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
    }
  }

  // Línea de umbral
  const threshNorm = Math.min(threshold.value, YMAX)
  const threshY    = H - 8 - (threshNorm / YMAX) * (H - 16)
  ctx.setLineDash([5, 9])
  ctx.strokeStyle = '#ef444480'
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(0, threshY); ctx.lineTo(W, threshY); ctx.stroke()
  ctx.setLineDash([])

  // Etiqueta umbral
  ctx.fillStyle  = '#ef444480'
  ctx.font       = '9px monospace'
  ctx.fillText(`▸ ${threshold.value}`, 4, threshY - 3)

  animFrame = requestAnimationFrame(drawOscilloscope)
}

// ── Visualización mano — SVG calculado ────────────────────────────────────
const FINGER_BASE_Y   = 148   // top de la palma
const FINGER_MAX_H    = 75    // altura cuando flex=0 (extendido)
const FINGER_MIN_H    = 10    // altura cuando flex=170 (cerrado)
const FINGER_W        = 18

// Cuatro dedos: índice, medio, anular, meñique
const fingerDisplay = computed(() => {
  const angles = [currentPose.indexFlex, currentPose.midFlex, currentPose.ringPinky, currentPose.ringPinky]
  const labels  = ['I', 'M', 'A', 'Ñ']
  const colors  = ['#60a5fa', '#2dd4bf', '#a78bfa', '#f472b6']
  const xs      = [80, 101, 122, 143]

  return angles.map((angle, i) => {
    const pct  = angle / 170
    const h    = FINGER_MAX_H - pct * (FINGER_MAX_H - FINGER_MIN_H)
    const topY = FINGER_BASE_Y - h
    return {
      x:          xs[i],
      w:          FINGER_W,
      topY,
      h,
      label:      labels[i],
      color:      colors[i],
      fillActive: colors[i] + '30',
      active:     angle > 15,
    }
  })
})

// Pulgar
const thumbH    = computed(() => {
  const pct = currentPose.thumbFlex / 155
  return FINGER_MAX_H - pct * (FINGER_MAX_H - FINGER_MIN_H)
})
const thumbTopY = computed(() => FINGER_BASE_Y - thumbH.value)

// Guía de aducción
const thumbX1 = computed(() => 63)
const thumbY1 = computed(() => FINGER_BASE_Y)
const thumbX2 = computed(() => 63 - (currentPose.thumbAddu / 90) * 20)
const thumbY2 = computed(() => FINGER_BASE_Y - 20)

// Rotación muñeca (mapear 0-180 → -90 a +90 grados de rotación visual)
const wristRotDeg = computed(() => (currentPose.wristRot - 90) * 0.8)

// Barras de servo
const servoDisplay = computed(() => [
  { label: 'Flexión Pulgar',     angle: currentPose.thumbFlex,  color: '#f59e0b' },
  { label: 'Flexión Índice',     angle: currentPose.indexFlex,  color: '#60a5fa' },
  { label: 'Flexión Medio',      angle: currentPose.midFlex,    color: '#2dd4bf' },
  { label: 'Anular + Meñique',   angle: currentPose.ringPinky,  color: '#a78bfa' },
  { label: 'Aducción Pulgar',    angle: currentPose.thumbAddu,  color: '#f472b6' },
  { label: 'Rotación Muñeca',    angle: currentPose.wristRot,   color: '#34d399' },
])

// ── Calibración ────────────────────────────────────────────────────────────
function sendThreshold() {
  emgStore.ws?.send(JSON.stringify({ type: 'set_threshold', value: threshold.value }))
  toast.add({ title: `Umbral: ${threshold.value}`, description: 'Enviado al ESP32', color: 'teal' })
}

// ── Escuchar mensajes del store (gesture_detected) ─────────────────────────
// El store ya procesa emg_signal. Para gesture_detected necesitamos escuchar el WS directamente.
function handleWsMessage(event: MessageEvent) {
  try {
    const data = JSON.parse(event.data)
    if (data.type === 'gesture_detected') {
      applyGesture(data.gesture)
      lastDetection.value = { ch: data.ch, pulses: data.pulses }
      gestureHistory.value.unshift({
        id:     ++historyId,
        gesture: data.gesture,
        ch:     data.ch,
        pulses:  data.pulses,
        time:    new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      })
      if (gestureHistory.value.length > 20) gestureHistory.value.pop()
    }
  } catch {}
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(() => {
  emgStore.connect()
  // Escuchar mensajes WS directamente para gesture_detected
  watch(() => emgStore.ws, (ws) => {
    if (ws) ws.addEventListener('message', handleWsMessage)
  }, { immediate: true })

  animFrame = requestAnimationFrame(drawOscilloscope)
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
  emgStore.ws?.removeEventListener('message', handleWsMessage)
  emgStore.disconnect()
})
</script>

<style scoped>
.badge-on  { @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-teal-950/40 border-teal-900/50 text-teal-400; }
.badge-off { @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-gray-900 border-gray-800 text-gray-500; }
.dot       { @apply w-1.5 h-1.5 rounded-full flex-shrink-0; }
</style>
