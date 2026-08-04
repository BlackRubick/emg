<template>
  <div class="space-y-4">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-xl font-bold text-white">EMG Control · ESP32-S3</h2>
        <p class="text-sm text-gray-500 mt-0.5">Señal en tiempo real · 3 canales · Control proporcional · 5 servos</p>
      </div>
      <div class="flex items-center gap-2">
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
        <!-- Calibración badge -->
        <span v-if="calibrating" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-amber-950/40 border-amber-900/50 text-amber-400">
          <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse flex-shrink-0" />
          Calibrando {{ calSecsLeft }}s
        </span>
        <span v-else-if="calComplete" class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-teal-950/40 border-teal-900/50 text-teal-400">
          <UIcon name="i-heroicons-check-badge" class="w-3.5 h-3.5" />
          MVC calibrado
        </span>
        <span :class="emgStore.esp32Connected ? 'badge-on' : 'badge-off'">
          <span class="dot" :class="emgStore.esp32Connected ? 'bg-teal-400 animate-pulse' : 'bg-gray-600'" />
          {{ emgStore.esp32Connected ? 'ESP32 Conectado' : 'ESP32 Desconectado' }}
        </span>
        <span class="badge-off">
          <span class="dot bg-blue-400" />
          {{ emgStore.esp32Connected ? '250 Hz' : 'Sin señal' }}
        </span>
        <span class="badge-off font-mono text-xs">{{ frameCount }} frames</span>
      </div>
    </div>

    <!-- ── Banner de calibración MVC ─────────────────────────────────────── -->
    <div v-if="calibrating"
      class="bg-amber-950/40 border border-amber-900/50 rounded-xl px-5 py-4 flex items-center gap-4">
      <div class="w-10 h-10 rounded-xl bg-amber-900/50 flex items-center justify-center flex-shrink-0">
        <UIcon name="i-heroicons-bolt" class="w-5 h-5 text-amber-400 animate-pulse" />
      </div>
      <div class="flex-1">
        <p class="text-sm font-semibold text-amber-300">Calibración MVC en progreso — {{ calSecsLeft }}s restantes</p>
        <p class="text-xs text-amber-600 mt-0.5">
          Aprieta <strong class="text-amber-400">todos los músculos al máximo</strong> para registrar tu contracción máxima voluntaria. Los servos no responderán hasta terminar.
        </p>
      </div>
      <div class="flex gap-4 text-xs text-right">
        <div v-for="(v, i) in calMVC" :key="i">
          <p class="text-amber-600 mb-0.5">CH{{ i + 1 }}</p>
          <p class="font-mono text-amber-300 font-bold">{{ v.toFixed(0) }}</p>
        </div>
      </div>
    </div>

    <!-- ── Aviso si no hay ESP32 ──────────────────────────────────────────── -->
    <div v-if="!emgStore.esp32Connected"
      class="bg-yellow-950/40 border border-yellow-900/50 rounded-xl px-5 py-4 flex items-center gap-3">
      <UIcon name="i-heroicons-exclamation-triangle" class="w-5 h-5 text-yellow-500 flex-shrink-0" />
      <div>
        <p class="text-sm font-medium text-yellow-300">ESP32-S3 no detectado</p>
        <p class="text-xs text-yellow-600 mt-0.5">
          Sube el firmware, conecta los 3 electrodos y asegúrate de que el servidor corre con
          <code class="bg-yellow-950 px-1 rounded">--host 0.0.0.0</code>
        </p>
      </div>
    </div>

    <!-- ── Fila principal: Osciloscópio + Gesto ──────────────────────────── -->
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
          <!-- Actividad en tiempo real por canal -->
          <div class="w-full mt-2 space-y-1.5">
            <div v-for="(meta, i) in CH_META" :key="i">
              <div class="flex justify-between text-xs mb-0.5">
                <span class="text-gray-600">{{ meta.label }}</span>
                <span class="font-mono" :style="{ color: meta.color }">{{ channelActivity[i] }}%</span>
              </div>
              <div class="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-100"
                  :style="{ width: channelActivity[i] + '%', background: meta.color }" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Motor de Inferencia IA ──────────────────────────────────────────── -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden">
      <div class="flex items-center justify-between px-5 py-3 border-b border-gray-800">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg bg-purple-950 flex items-center justify-center">
            <UIcon name="i-heroicons-cpu-chip" class="w-4 h-4 text-purple-400" />
          </div>
          <span class="text-sm font-semibold text-white">Motor de Inferencia IA</span>
          <span v-if="emgStore.esp32Connected && !calibrating"
            class="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-950/60 border border-purple-900/40 rounded-full px-2 py-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Clasificando en tiempo real
          </span>
          <span v-else-if="calibrating" class="text-xs text-amber-400/70 bg-amber-950/30 border border-amber-900/30 rounded-full px-2 py-0.5">
            Esperando calibración
          </span>
          <span v-else class="text-xs text-gray-700 bg-gray-800/60 border border-gray-800 rounded-full px-2 py-0.5">
            En espera
          </span>
        </div>
        <div class="flex items-center gap-3 text-xs text-gray-600 font-mono">
          <span v-if="emgStore.esp32Connected && inferenceMs > 0" class="text-purple-500/70">
            {{ inferenceMs }} ms
          </span>
          <span>Centroide-MAV · 3 canales · 8 clases</span>
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
                <div class="h-full rounded-full transition-all duration-500"
                  :style="{
                    width: `${aiConfidence[code] ?? 0}%`,
                    background: currentGestureCode === code ? meta.color : '#374151'
                  }" />
              </div>
            </div>
          </div>
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

    <!-- ── Fila servos + visualización mano ──────────────────────────────── -->
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
              <div class="h-full rounded-full transition-all duration-100"
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
            <rect x="85" y="248" width="70" height="48" rx="10" fill="#0f1e2e" stroke="#1e3a52" stroke-width="1"/>
            <rect x="70" y="148" width="100" height="100" rx="14" fill="#0f1e2e" stroke="#1e3a52" stroke-width="1"/>
            <line :x1="thumbX1" :y1="thumbY1" :x2="thumbX2" :y2="thumbY2"
              stroke="#f59e0b40" stroke-width="1" stroke-dasharray="3,4" />
            <rect :x="54" :y="thumbTopY" width="18" :height="thumbH" rx="6"
              :fill="currentPose.thumbFlex > 10 ? '#d9770630' : '#1e3a52'"
              :stroke="currentPose.thumbFlex > 10 ? '#f59e0b' : '#2d4a66'"
              stroke-width="1.2" />
            <text x="63" y="145" text-anchor="middle" fill="#6b7280" font-size="7">P</text>
            <g v-for="(f, i) in fingerDisplay" :key="i">
              <rect :x="f.x" :y="f.topY" :width="f.w" :height="f.h" rx="5"
                :fill="f.active ? f.fillActive : '#1e3a52'"
                :stroke="f.active ? f.color : '#2d4a66'"
                stroke-width="1.2" />
              <text :x="f.x + f.w/2" y="145" text-anchor="middle" fill="#6b7280" font-size="7">{{ f.label }}</text>
            </g>
          </svg>
        </div>
      </div>
    </div>

    <!-- ── Grabación de sesión ──────────────────────────────────────────── -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div class="flex items-center justify-between mb-3">
        <div class="flex items-center gap-3">
          <div class="w-7 h-7 rounded-lg flex items-center justify-center"
            :class="isRecording ? 'bg-red-950' : 'bg-gray-800'">
            <UIcon name="i-heroicons-circle-stack" class="w-4 h-4"
              :class="isRecording ? 'text-red-400' : 'text-gray-500'" />
          </div>
          <h3 class="text-sm font-semibold text-gray-300">Grabación de Sesión EMG</h3>
          <span v-if="isRecording" class="flex items-center gap-1.5 text-xs text-red-400 bg-red-950/40 border border-red-900/40 rounded-full px-2 py-0.5">
            <span class="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            {{ recordElapsedStr }} · {{ recordCount.toLocaleString() }} muestras
          </span>
        </div>
        <div class="flex items-center gap-2">
          <UButton v-if="!isRecording" size="sm" color="red" variant="soft"
            :disabled="!emgStore.esp32Connected || calibrating"
            @click="startRecording">
            <UIcon name="i-heroicons-record-circle" class="w-3.5 h-3.5 mr-1" />
            Iniciar grabación
          </UButton>
          <template v-else>
            <UButton size="sm" color="gray" variant="soft" @click="cancelRecording">
              Cancelar
            </UButton>
            <UButton size="sm" color="teal" variant="solid" @click="stopAndSave" :loading="isSaving">
              <UIcon name="i-heroicons-check-circle" class="w-3.5 h-3.5 mr-1" />
              Guardar sesión
            </UButton>
          </template>
        </div>
      </div>
      <p v-if="lastSavedSession" class="text-xs text-gray-600">
        Última sesión guardada: <span class="text-teal-500">{{ lastSavedSession.samples.toLocaleString() }} muestras</span>
        · {{ lastSavedSession.duration }}s
        · sessionId <code class="bg-gray-800 px-1 rounded">{{ lastSavedSession.sessionId?.slice(0, 8) }}…</code>
      </p>
      <p v-else class="text-xs text-gray-600">
        Graba la señal EMG bruta en la base de datos para análisis posterior o entrenamiento del modelo IA.
      </p>
    </div>

    <!-- ── Calibración ─────────────────────────────────────────────────────── -->
    <div class="bg-gray-900 border border-gray-800 rounded-2xl p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-3">
          <UIcon name="i-heroicons-adjustments-horizontal" class="w-4 h-4 text-gray-400" />
          <h3 class="text-sm font-semibold text-gray-300">Calibración</h3>
          <UBadge color="gray" variant="soft" size="xs">Solo activo con ESP32</UBadge>
        </div>
        <UButton size="xs" color="amber" variant="soft"
          :disabled="!emgStore.esp32Connected"
          @click="sendRecalibrate">
          <UIcon name="i-heroicons-arrow-path" class="w-3 h-3 mr-1" />
          Re-calibrar MVC
        </UButton>
      </div>
      <div class="flex items-center gap-4">
        <div class="flex-1">
          <div class="flex justify-between text-xs text-gray-600 mb-2">
            <span>50 — Muy sensible</span>
            <span class="text-teal-400 font-mono font-bold">Umbral manual: {{ threshold }}</span>
            <span>400 — Poco sensible</span>
          </div>
          <input v-model.number="threshold" type="range" min="50" max="400" step="10"
            class="w-full accent-teal-500" @change="sendThreshold" />
        </div>
        <UButton size="sm" color="teal" variant="soft" @click="sendThreshold">Aplicar</UButton>
      </div>
      <p class="text-xs text-gray-600 mt-3">
        Sube el umbral si el brazo se mueve solo. Bájalo si no detecta tus contracciones.
        Con MVC calibrado, el umbral se ajusta automáticamente.
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
  { label: 'CH1 · Pulgar+Índice', color: '#2dd4bf' },
  { label: 'CH2 · Medio',         color: '#a78bfa' },
  { label: 'CH3 · Anular+Meñique', color: '#f59e0b' },
]
const COLORS = ['#2dd4bf', '#a78bfa', '#f59e0b']
const GLOWS  = ['#2dd4bf50', '#a78bfa50', '#f59e0b50']

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

// ── Centroides para clasificación por centroide-MAV ───────────────────────
// Valores normalizados [CH1, CH2, CH3] respecto al MVC (0=reposo, 1=contracción máxima)
const GESTURE_CENTROIDS: Record<string, number[]> = {
  HAND_OPEN:        [0.05, 0.05, 0.05],
  HAND_CLOSE:       [0.85, 0.75, 0.70],
  FINE_PINCH:       [0.92, 0.10, 0.08],
  CYLINDRICAL_GRIP: [0.72, 0.82, 0.88],
  WRIST_FLEX:       [0.55, 0.22, 0.28],
  WRIST_EXT:        [0.20, 0.58, 0.25],
  PRONATION:        [0.28, 0.28, 0.72],
  SUPINATION:       [0.22, 0.22, 0.45],
}

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

// ── Pipeline IA ────────────────────────────────────────────────────────────
const aiPipeline = [
  { label: 'Señal EMG',             desc: '3 canales · 250 Hz',         icon: 'i-heroicons-signal',     color: '#2dd4bf', bg: '#042f2e', arrow: true  },
  { label: 'Filtro paso-banda',     desc: 'HPF 20Hz → rect. → LPF 5Hz', icon: 'i-heroicons-funnel',     color: '#60a5fa', bg: '#172554', arrow: true  },
  { label: 'Extracción MAV',        desc: 'Ventana 1s · 3 canales',     icon: 'i-heroicons-variable',   color: '#c084fc', bg: '#2e1065', arrow: true  },
  { label: 'Centroide-MAV',         desc: '8 clases · distancia L2',    icon: 'i-heroicons-cpu-chip',   color: '#fbbf24', bg: '#1c1003', arrow: false },
]

// ── Estado IA ──────────────────────────────────────────────────────────────
const aiConfidence = reactive<Record<string, number>>(
  Object.fromEntries(Object.keys(GESTURE_META).map(k => [k, 0]))
)
const inferenceMs = ref(0)

// ── Calibración MVC ────────────────────────────────────────────────────────
const calibrating    = ref(false)
const calSecsLeft    = ref(5)
const calMVC         = ref([0, 0, 0])
const calComplete    = ref(false)
const calThresholds  = ref([15, 15, 15])    // amplitudes = raw_thr / 10

// ── Estado reactivo principal ──────────────────────────────────────────────
const currentGestureCode = ref('HAND_OPEN')
const lastDetection      = ref<{ ch: number; pulses: number } | null>(null)
const threshold          = ref(150)
const frameCount         = ref(0)
const channelActivity    = ref([0, 0, 0])   // % de actividad por canal (0-100)

const gestureHistory = ref<{ id: number; gesture: string; ch: number; pulses: number; time: string }[]>([])
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

// ── Buffer osciloscópio (no reactivo — Float32Array × 3 canales) ──────────
const OSC_MAX = 400
const oscRaw: Float32Array[] = []

function oscPush(channels: { channel: number; amplitude: number }[]) {
  const row = new Float32Array(3)
  for (const c of channels) {
    if (c.channel >= 1 && c.channel <= 3) row[c.channel - 1] = c.amplitude
  }
  if (oscRaw.length >= OSC_MAX) oscRaw.shift()
  oscRaw.push(row)
  frameCount.value = oscRaw.length

  // Actualizar actividad por canal (MAV últimas 25 muestras = 100ms)
  const WIN = Math.min(oscRaw.length, 25)
  const start = oscRaw.length - WIN
  const sums = [0, 0, 0]
  for (let i = start; i < oscRaw.length; i++) {
    sums[0] += oscRaw[i][0]
    sums[1] += oscRaw[i][1]
    sums[2] += oscRaw[i][2]
  }
  for (let i = 0; i < 3; i++) {
    const mav = sums[i] / WIN
    const pct = Math.min(Math.round((mav / Math.max(calThresholds.value[i], 0.5)) * 100), 100)
    channelActivity.value[i] = pct
  }
}

// ── Clasificación IA real (centroide-MAV) ─────────────────────────────────
function computeWindowMAV(): number[] {
  const WIN = Math.min(oscRaw.length, 250)   // última 1 s
  if (WIN < 10) return [0, 0, 0]
  const start = oscRaw.length - WIN
  const sums = [0, 0, 0]
  for (let i = start; i < oscRaw.length; i++) {
    sums[0] += oscRaw[i][0]
    sums[1] += oscRaw[i][1]
    sums[2] += oscRaw[i][2]
  }
  return sums.map(s => s / WIN)
}

function runClassification() {
  if (!emgStore.esp32Connected || calibrating.value) {
    for (const code of Object.keys(GESTURE_META)) aiConfidence[code] = 0
    inferenceMs.value = 0
    return
  }

  const t0   = performance.now()
  const mavs = computeWindowMAV()
  const thr  = calThresholds.value

  // Normalizar por umbral de amplitud (0=reposo, 1=MVC)
  const norm = [
    Math.min(mavs[0] / Math.max(thr[0], 0.5), 1.0),
    Math.min(mavs[1] / Math.max(thr[1], 0.5), 1.0),
    Math.min(mavs[2] / Math.max(thr[2], 0.5), 1.0),
  ]

  // Distancia euclidiana a cada centroide
  const codes  = Object.keys(GESTURE_CENTROIDS)
  const dists  = codes.map(code => {
    const c = GESTURE_CENTROIDS[code]
    return Math.sqrt((norm[0]-c[0])**2 + (norm[1]-c[1])**2 + (norm[2]-c[2])**2)
  })

  // Softmax sobre distancias negativas (temperature = 5 para mayor contraste)
  const negScaled = dists.map(d => -d * 5)
  const maxN      = Math.max(...negScaled)
  const exps      = negScaled.map(d => Math.exp(d - maxN))
  const sumE      = exps.reduce((a, b) => a + b, 0)

  codes.forEach((code, i) => {
    aiConfidence[code] = Math.round((exps[i] / sumE) * 100)
  })

  // Actualizar gesto actual con la predicción de mayor confianza
  const bestIdx  = dists.indexOf(Math.min(...dists))
  const bestCode = codes[bestIdx]
  if ((aiConfidence[bestCode] ?? 0) > 25) {
    currentGestureCode.value = bestCode
  }

  inferenceMs.value = Math.round(performance.now() - t0) || 1
}

let classifyInterval: ReturnType<typeof setInterval> | null = null

// ── Canvas osciloscópio ────────────────────────────────────────────────────
const oscCanvas = ref<HTMLCanvasElement | null>(null)
let   animFrame = 0
let   canvasW   = 0
let   canvasH   = 0
const YMAX      = 100

function drawOscilloscope() {
  animFrame = requestAnimationFrame(drawOscilloscope)

  const canvas = oscCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const rect = canvas.getBoundingClientRect()
  const dpr  = window.devicePixelRatio || 1
  const newW = Math.round(rect.width  * dpr)
  const newH = Math.round(rect.height * dpr)
  if (canvas.width !== newW || canvas.height !== newH) {
    canvas.width  = newW
    canvas.height = newH
    canvasW = newW; canvasH = newH
    ctx.scale(dpr, dpr)
  }
  const W = rect.width
  const H = rect.height

  ctx.fillStyle = '#060e1a'
  ctx.fillRect(0, 0, W, H)

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
    for (let ci = 0; ci < 3; ci++) {
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
    ctx.fillStyle = '#1e3a52'
    ctx.font      = '12px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('Esperando señal del ESP32...', W / 2, H / 2)
    ctx.textAlign = 'left'
  }

  // Línea de umbral calibrada
  const thrNorm = Math.min(calThresholds.value[0], YMAX)
  const thrY    = H - 8 - (thrNorm / YMAX) * (H - 16)
  ctx.setLineDash([5, 9])
  ctx.strokeStyle = '#ef444480'
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(0, thrY); ctx.lineTo(W, thrY); ctx.stroke()
  ctx.setLineDash([])
  ctx.fillStyle = '#ef444480'
  ctx.font      = '9px monospace'
  ctx.fillText(`▸ CH1 thr ${(calThresholds.value[0]).toFixed(1)}`, 4, thrY - 3)
}

// ── Grabación de sesión ────────────────────────────────────────────────────
const isRecording   = ref(false)
const isSaving      = ref(false)
const recordCount   = ref(0)                    // contador reactivo para el template
const recordElapsed = ref(0)
let   _recordBuf:   { t: number; ch: number[] }[] = []   // buffer plano (no reactivo)
let   recordTimer:  ReturnType<typeof setInterval> | null = null
let   dbChannelIds: number[] = []

interface SavedSession { samples: number; duration: string; sessionId: string | null }
const lastSavedSession = ref<SavedSession | null>(null)

const recordElapsedStr = computed(() => {
  const s = recordElapsed.value
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
})

function startRecording() {
  isRecording.value  = true
  _recordBuf         = []
  recordCount.value  = 0
  recordElapsed.value = 0
  recordTimer = setInterval(() => { recordElapsed.value++ }, 1000)
}

function cancelRecording() {
  isRecording.value = false
  _recordBuf        = []
  recordCount.value = 0
  if (recordTimer) { clearInterval(recordTimer); recordTimer = null }
}

async function stopAndSave() {
  isRecording.value = false
  if (recordTimer) { clearInterval(recordTimer); recordTimer = null }

  const samples = _recordBuf.splice(0)   // vaciar y tomar todo
  recordCount.value = 0

  if (samples.length < 10) {
    toast.add({ title: 'Sesión muy corta', description: 'Graba al menos unos segundos de señal', color: 'amber' })
    return
  }

  if (dbChannelIds.length === 0) {
    toast.add({ title: 'Sin canales configurados', description: 'Configura un sensor y canal en el sistema primero', color: 'amber' })
    return
  }

  isSaving.value = true
  try {
    const channelId = dbChannelIds[0]
    const sessionId = emgStore.sessionId
    const MAX_BATCH = 2000

    const batch = samples.slice(0, MAX_BATCH).map(s => ({
      channelId,
      amplitude:  s.ch[0] ?? 0,
      frequency:  250,
      sampleRate: 250,
      sessionId,
      rawData:    { ch: s.ch, t: s.t },
    }))

    await $fetch('/api/signals', { method: 'POST', body: batch })

    const saved = batch.length
    const dur   = recordElapsed.value.toString()
    lastSavedSession.value = { samples: saved, duration: dur, sessionId }
    toast.add({
      title: 'Sesión guardada',
      description: `${saved.toLocaleString()} muestras · ${dur}s · canal ${channelId}`,
      color: 'teal',
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    toast.add({ title: 'Error al guardar', description: msg, color: 'red' })
  } finally {
    isSaving.value = false
  }
}

// ── Calibración ────────────────────────────────────────────────────────────
function sendThreshold() {
  emgStore.ws?.send(JSON.stringify({ type: 'set_threshold', value: threshold.value }))
  toast.add({ title: `Umbral: ${threshold.value}`, description: 'Enviado al ESP32', color: 'teal' })
}

function sendRecalibrate() {
  emgStore.ws?.send(JSON.stringify({ type: 'recalibrate' }))
  calibrating.value = true
  calComplete.value  = false
  calMVC.value       = [0, 0, 0]
  toast.add({ title: 'Re-calibración iniciada', description: 'Aprieta al máximo los músculos durante 5 s', color: 'amber' })
}

// ── Visualización mano — SVG ───────────────────────────────────────────────
const FINGER_BASE_Y = 148
const FINGER_MAX_H  = 75
const FINGER_MIN_H  = 10
const FINGER_W      = 18

const fingerDisplay = computed(() => {
  const angles = [currentPose.indexFlex, currentPose.midFlex, currentPose.ringPinky, currentPose.ringPinky]
  const labels  = ['I', 'M', 'A', 'Ñ']
  const colors  = ['#60a5fa', '#a78bfa', '#f59e0b', '#f59e0b']
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
  { label: 'Flexión Pulgar   (CH1)', angle: currentPose.thumbFlex,  color: '#2dd4bf' },
  { label: 'Flexión Índice   (CH1)', angle: currentPose.indexFlex,  color: '#2dd4bf' },
  { label: 'Flexión Medio    (CH2)', angle: currentPose.midFlex,    color: '#a78bfa' },
  { label: 'Anular+Meñique   (CH3)', angle: currentPose.ringPinky,  color: '#f59e0b' },
  { label: 'Aducción Pulgar  (CH1)', angle: currentPose.thumbAddu,  color: '#f472b6' },
])

// ── WebSocket: escuchar mensajes ───────────────────────────────────────────
function handleWsMessage(event: MessageEvent) {
  try {
    const data = JSON.parse(event.data as string)

    if (data.type === 'emg_signal') {
      oscPush(data.channels ?? [])
      // Agregar al buffer de grabación si está activo (buffer plano, sin overhead reactivo)
      if (isRecording.value && _recordBuf.length < 15000) {
        _recordBuf.push({
          t:  data.timestamp ?? Date.now(),
          ch: (data.channels ?? []).map((c: { amplitude: number }) => c.amplitude),
        })
        // Actualizar contador reactivo para el display a menor frecuencia
        if (_recordBuf.length % 25 === 0) recordCount.value = _recordBuf.length
      }
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
      return
    }

    if (data.type === 'cal_status') {
      calibrating.value = true
      calSecsLeft.value  = data.secsLeft ?? calSecsLeft.value
      calMVC.value       = data.mvc ?? [0, 0, 0]
      return
    }

    if (data.type === 'cal_complete') {
      calibrating.value = false
      calComplete.value  = true
      const rawThr: number[] = data.thr ?? [150, 150, 150]
      // El browser recibe amplitudes = raw_env / 10
      calThresholds.value = rawThr.map(t => t / 10)
      calMVC.value = data.mvc ?? [0, 0, 0]
      toast.add({
        title: 'Calibración MVC completa',
        description: `Umbrales: CH1=${rawThr[0]?.toFixed(0)} CH2=${rawThr[1]?.toFixed(0)} CH3=${rawThr[2]?.toFixed(0)}`,
        color: 'teal',
      })
      return
    }

  } catch {}
}

let _wsRef: WebSocket | null = null

function attachWsListener(ws: WebSocket | null) {
  if (_wsRef) _wsRef.removeEventListener('message', handleWsMessage)
  _wsRef = ws
  if (ws) ws.addEventListener('message', handleWsMessage)
}

// ── Lifecycle ──────────────────────────────────────────────────────────────
onMounted(async () => {
  emgStore.connect()
  attachWsListener(emgStore.ws)
  watch(() => emgStore.ws, attachWsListener)
  watch(() => emgStore.esp32Connected, (connected) => {
    if (!connected) {
      for (const code of Object.keys(GESTURE_META)) aiConfidence[code] = 0
      calibrating.value = false
      channelActivity.value = [0, 0, 0]
    }
  })

  classifyInterval = setInterval(runClassification, 500)
  animFrame = requestAnimationFrame(drawOscilloscope)

  // Precargar channelIds para grabación de sesión
  try {
    const res = await $fetch<{ data: { id: number }[] }>('/api/channels', { query: { limit: 3 } })
    dbChannelIds = (res.data ?? []).map(c => c.id)
  } catch {}
})

onUnmounted(() => {
  cancelAnimationFrame(animFrame)
  attachWsListener(null)
  if (classifyInterval) clearInterval(classifyInterval)
  if (recordTimer) clearInterval(recordTimer)
  oscRaw.length = 0
})
</script>

<style scoped>
.badge-on  { @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-teal-950/40 border-teal-900/50 text-teal-400; }
.badge-off { @apply flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-gray-900 border-gray-800 text-gray-500; }
.dot       { @apply w-1.5 h-1.5 rounded-full flex-shrink-0; }
</style>
