<template>
  <div class="space-y-5">

    <!-- ── Header ─────────────────────────────────────────────────────────── -->
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-white tracking-tight">Dashboard Biomédico</h1>
        <p class="text-sm text-gray-500 mt-0.5">{{ today }} · Sistema sEMG</p>
      </div>

      <div class="flex items-center gap-3">
        <!-- Status pills -->
        <div class="hidden lg:flex items-center gap-2">
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-teal-950/40 border-teal-900/50 text-teal-400">
            <span class="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span>DB Online</span>
          </div>
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors"
            :class="emgStore.isConnected
              ? 'bg-teal-950/40 border-teal-900/50 text-teal-400'
              : 'bg-gray-900 border-gray-800 text-gray-500'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="emgStore.isConnected ? 'bg-teal-400 animate-pulse' : 'bg-gray-600'" />
            <span class="font-mono">{{ emgStore.isConnected ? `${emgStore.latency}ms` : 'WS Offline' }}</span>
          </div>
          <div
            class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border transition-colors"
            :class="emgStore.isStreaming
              ? 'bg-teal-950/40 border-teal-900/50 text-teal-400'
              : 'bg-gray-900 border-gray-800 text-gray-500'"
          >
            <span class="w-1.5 h-1.5 rounded-full" :class="emgStore.isStreaming ? 'bg-teal-400 animate-pulse' : 'bg-gray-600'" />
            <span>{{ emgStore.isStreaming ? 'EMG Activa' : 'EMG Inactiva' }}</span>
          </div>
          <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs border bg-teal-950/40 border-teal-900/50 text-teal-400">
            <span class="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
            <span>1 Modelo LDA</span>
          </div>
        </div>

        <!-- Session toggle -->
        <button
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 border"
          :class="emgStore.isStreaming
            ? 'bg-red-950/60 border-red-800/60 text-red-300 hover:bg-red-900/40'
            : 'bg-teal-950/60 border-teal-800/60 text-teal-300 hover:bg-teal-900/40'"
          @click="toggleMock"
        >
          <span class="w-2 h-2 rounded-full" :class="emgStore.isStreaming ? 'bg-red-400 animate-pulse' : 'bg-gray-500'" />
          {{ emgStore.isStreaming ? 'Detener simulacion' : 'Iniciar simulacion' }}
        </button>
      </div>
    </div>

    <!-- ── KPI Row 1 ─────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatsCard
        label="Senales EMG"
        :value="live.signals"
        icon="i-heroicons-chart-bar-square"
        color="teal"
        :trend="12"
        :sparkline="sparklines.signals"
      />
      <StatsCard
        label="Precision Avg"
        :value="live.accuracy"
        unit="%"
        icon="i-heroicons-check-badge"
        color="green"
        :trend="3"
        :sparkline="sparklines.accuracy"
      />
      <StatsCard
        label="Gestos Reconocidos"
        :value="live.gestures"
        icon="i-heroicons-hand-raised"
        color="blue"
        :trend="8"
        :sparkline="sparklines.gestures"
      />
      <StatsCard
        label="Modelos LDA"
        :value="live.models"
        icon="i-heroicons-cpu-chip"
        color="purple"
        :sparkline="sparklines.models"
      />
    </div>

    <!-- ── KPI Row 2 ─────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatsCard label="Sujetos"   :value="live.subjects" icon="i-heroicons-user-group"  color="orange" badge="activos" />
      <StatsCard label="Sensores"  :value="live.sensors"  icon="i-heroicons-signal"       color="teal"   badge="online"  />
      <StatsCard label="F1 Score"  :value="live.f1"       icon="i-heroicons-star"          color="pink"   unit="%"       />
      <StatsCard label="Usuarios"  :value="live.users"    icon="i-heroicons-users"         color="blue"   badge="activos"/>
    </div>

    <!-- ── EMG Monitor + Gesture ──────────────────────────────────────────── -->
    <div class="grid grid-cols-1 xl:grid-cols-3 gap-4">

      <!-- Signal monitor (2/3) -->
      <div class="xl:col-span-2 bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-teal-950/80 flex items-center justify-center">
              <UIcon name="i-heroicons-chart-bar-square" class="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <h3 class="text-sm font-semibold text-white">Monitor EMG en Tiempo Real</h3>
              <p class="text-xs text-gray-500">8 canales · 2000 Hz · NinaPro DB5</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <span class="font-mono text-xs text-gray-600">{{ emgStore.buffer.length }} frames</span>
            <span class="font-mono text-xs text-teal-400">{{ emgStore.latency }}ms</span>
            <div v-if="emgStore.isStreaming" class="flex items-center gap-1.5 bg-teal-950/60 border border-teal-900/60 rounded-lg px-2.5 py-1 text-xs text-teal-400">
              <span class="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
              LIVE
            </div>
          </div>
        </div>

        <div class="px-4 pb-4">
          <SignalMonitor :is-active="emgStore.isStreaming" />
        </div>
      </div>

      <!-- Gesture panel (1/3) -->
      <div class="bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden">
        <div class="flex items-center gap-3 px-5 py-3.5 border-b border-gray-800">
          <div class="w-8 h-8 rounded-lg bg-blue-950/80 flex items-center justify-center">
            <UIcon name="i-heroicons-hand-raised" class="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h3 class="text-sm font-semibold text-white">Gesto Actual</h3>
            <p class="text-xs text-gray-500">Clasificacion LDA en tiempo real</p>
          </div>
        </div>
        <div class="p-4">
          <GestureDisplay />
        </div>
      </div>
    </div>

    <!-- ── Charts Row ─────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-5 gap-4">

      <!-- Performance chart (3/5) -->
      <div class="lg:col-span-3 bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden">
        <div class="flex items-center justify-between px-5 py-3.5 border-b border-gray-800">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-purple-950/80 flex items-center justify-center">
              <UIcon name="i-heroicons-chart-bar" class="w-4 h-4 text-purple-400" />
            </div>
            <h3 class="text-sm font-semibold text-white">Rendimiento del Sistema</h3>
          </div>
          <div class="flex bg-gray-800/80 rounded-lg p-0.5 gap-0.5">
            <button
              v-for="tab in chartTabs" :key="tab.key"
              class="px-3 py-1 rounded-md text-xs font-medium transition-all"
              :class="activeTab === tab.key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'"
              @click="activeTab = tab.key"
            >{{ tab.label }}</button>
          </div>
        </div>
        <div class="p-4" style="height: 240px;">
          <MultiLineChart
            v-if="activeTab === 'accuracy'"
            :datasets="accuracyDatasets"
            :labels="accuracyLabels"
            :height="200" y-label="%" :y-min="70" :y-max="100"
          />
          <MultiLineChart
            v-else-if="activeTab === 'signals'"
            :datasets="signalBarDatasets"
            :labels="signalBarLabels"
            :height="200" type="bar"
          />
          <MultiLineChart
            v-else
            :datasets="modelCompareDatasets"
            :labels="modelCompareLabels"
            :height="200" y-label="%" :y-min="60" :y-max="100"
          />
        </div>
      </div>

      <!-- Gesture distribution (2/5) -->
      <div class="lg:col-span-2 bg-gray-900/80 border border-gray-800 rounded-2xl overflow-hidden">
        <div class="flex items-center gap-3 px-5 py-3.5 border-b border-gray-800">
          <div class="w-8 h-8 rounded-lg bg-orange-950/80 flex items-center justify-center">
            <UIcon name="i-heroicons-chart-pie" class="w-4 h-4 text-orange-400" />
          </div>
          <h3 class="text-sm font-semibold text-white">Distribucion de Gestos</h3>
        </div>
        <div class="p-4 space-y-2.5">
          <div v-for="(g, i) in gestureDistrib" :key="g.label">
            <div class="flex items-center justify-between text-xs mb-1.5">
              <div class="flex items-center gap-2">
                <div class="w-1.5 h-1.5 rounded-full flex-shrink-0" :style="{ background: distribColors[i] }" />
                <span class="text-gray-400 truncate max-w-[130px]">{{ g.label }}</span>
              </div>
              <span class="font-mono text-gray-500 tabular-nums">{{ g.count }}</span>
            </div>
            <div class="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-700"
                :style="{
                  width: `${(g.count / maxDistrib) * 100}%`,
                  background: `linear-gradient(90deg, ${distribColors[i]}88, ${distribColors[i]})`,
                  transitionDelay: `${i * 50}ms`,
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Bottom Row ─────────────────────────────────────────────────────── -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">

      <!-- Prosthesis status -->
      <div class="bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
        <div class="flex items-center gap-3 mb-4">
          <div class="w-8 h-8 rounded-lg bg-green-950/80 flex items-center justify-center">
            <UIcon name="i-heroicons-bolt" class="w-4 h-4 text-green-400" />
          </div>
          <h3 class="text-sm font-semibold text-white">Protesis Conectadas</h3>
        </div>
        <div class="space-y-3">
          <div
            v-for="p in prosthesisList" :key="p.name"
            class="flex items-center gap-3 p-3 rounded-xl border"
            :class="p.active ? 'bg-green-950/20 border-green-900/40' : 'bg-gray-800/40 border-gray-700/40'"
          >
            <div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              :class="p.active ? 'bg-green-900/50' : 'bg-gray-700/50'">
              <UIcon name="i-heroicons-bolt" class="w-4 h-4"
                :class="p.active ? 'text-green-400' : 'text-gray-500'" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-medium text-white truncate">{{ p.name }}</p>
              <div class="flex items-center gap-2 mt-0.5">
                <span class="w-1.5 h-1.5 rounded-full" :class="p.active ? 'bg-green-400 animate-pulse' : 'bg-gray-600'" />
                <span class="text-xs" :class="p.active ? 'text-green-400' : 'text-gray-500'">
                  {{ p.active ? 'Activa · ' + p.battery + '% bat.' : 'Desconectada' }}
                </span>
              </div>
            </div>
            <NuxtLink to="/prosthesis" class="text-xs text-teal-400 hover:text-teal-300 flex items-center gap-1 flex-shrink-0">
              Control <UIcon name="i-heroicons-arrow-right" class="w-3 h-3" />
            </NuxtLink>
          </div>
        </div>
      </div>

      <!-- Activity feed -->
      <div class="lg:col-span-2 bg-gray-900/80 border border-gray-800 rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center">
              <UIcon name="i-heroicons-clock" class="w-4 h-4 text-gray-400" />
            </div>
            <h3 class="text-sm font-semibold text-white">Actividad en Tiempo Real</h3>
          </div>
          <span class="text-xs text-gray-600">{{ activityFeed.length }} eventos</span>
        </div>

        <div class="space-y-0.5 max-h-64 overflow-y-auto">
          <TransitionGroup name="feed">
            <div
              v-for="entry in activityFeed"
              :key="entry.id"
              class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-800/50 transition-colors"
            >
              <div class="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" :class="entry.bg">
                <UIcon :name="entry.icon" class="w-3.5 h-3.5" :class="entry.color" />
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-xs text-gray-300 truncate">
                  <span class="font-medium text-white">{{ entry.user }}</span>
                  <span class="text-gray-500"> · {{ entry.text }}</span>
                </p>
              </div>
              <span class="text-xs text-gray-600 flex-shrink-0 tabular-nums font-mono">{{ entry.time }}</span>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useEMGStore } from '~/stores/emg'

definePageMeta({ layout: 'default' })

const emgStore = useEMGStore()

// ── Live reactive counters ─────────────────────────────────────────────────────
const live = reactive({
  signals:  200,
  accuracy: 94.5,
  gestures: 0,
  models:   1,
  subjects: 3,
  sensors:  2,
  f1:       94.0,
  users:    3,
})

const sparklines = reactive({
  signals:  [120, 145, 163, 178, 187, 195, 200],
  accuracy: [88, 89, 90, 91.5, 92, 93.8, 94.5],
  gestures: [0, 0, 0, 0, 0, 0, 0],
  models:   [0, 0, 1, 1, 1, 1, 1],
})

// ── Charts ─────────────────────────────────────────────────────────────────────
const chartTabs = [
  { key: 'accuracy', label: 'Precision' },
  { key: 'signals',  label: 'Senales' },
  { key: 'models',   label: 'Modelos' },
]
const activeTab = ref('accuracy')

const accuracyLabels   = ref(['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'])
const accuracyDatasets = ref([
  { label: 'Accuracy', data: [82, 85, 88, 90, 91, 94.5], color: '#14b8a6' },
  { label: 'F1 Score', data: [80, 83, 86, 88, 90, 93.8], color: '#8b5cf6' },
])

const signalBarLabels   = ref(['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'])
const signalBarDatasets = ref([
  { label: 'Senales/dia', data: [28, 34, 42, 51, 38, 29, 22], color: '#3b82f6' },
])

const modelCompareLabels   = ['LDA-1', 'LDA-2', 'LDA-3']
const modelCompareDatasets = [
  { label: 'Accuracy',  data: [94.5, 91.2, 88.0], color: '#14b8a6' },
  { label: 'Precision', data: [93.8, 90.5, 87.3], color: '#3b82f6' },
  { label: 'Recall',    data: [94.2, 91.0, 87.8], color: '#8b5cf6' },
  { label: 'F1',        data: [93.8, 90.2, 87.5], color: '#f59e0b' },
]

// ── Gesture distribution ───────────────────────────────────────────────────────
const gestureDistrib = reactive([
  { label: 'Mano Abierta',        count: 22 },
  { label: 'Mano Cerrada',        count: 20 },
  { label: 'Agarre Cilindrico',   count: 18 },
  { label: 'Pinza Fina',          count: 15 },
  { label: 'Flexion de Muneca',   count: 13 },
  { label: 'Extension de Muneca', count: 12 },
])
const distribColors = ['#14b8a6','#3b82f6','#8b5cf6','#f59e0b','#10b981','#ec4899']
const maxDistrib    = computed(() => Math.max(...gestureDistrib.map(g => g.count)))

// ── Prosthesis ─────────────────────────────────────────────────────────────────
const prosthesisList = reactive([
  { name: 'Vincent Hand v3', active: true,  battery: 87 },
  { name: 'i-Limb Quantum',  active: false, battery: 0  },
])

// ── Activity feed ──────────────────────────────────────────────────────────────
interface FeedEntry {
  id: number; user: string; text: string; time: string
  icon: string; bg: string; color: string
}
const activityFeed = ref<FeedEntry[]>([
  { id: 1, user: 'Sistema',      text: 'Migracion DB completada correctamente',     time: '08:12', icon: 'i-heroicons-circle-stack',             bg: 'bg-teal-950/60',   color: 'text-teal-400'   },
  { id: 2, user: 'Admin',        text: 'Inicio sesion desde 127.0.0.1',             time: '08:15', icon: 'i-heroicons-arrow-right-on-rectangle', bg: 'bg-green-950/60',  color: 'text-green-400'  },
  { id: 3, user: 'Investigador', text: 'Creo dataset NinaPro DB5 sujeto S1',        time: '08:18', icon: 'i-heroicons-plus-circle',              bg: 'bg-blue-950/60',   color: 'text-blue-400'   },
])
let feedId = 10

const FEED_TEMPLATES = [
  { user: 'Sistema',      text: (g: string) => `Gesto "${g}" clasificado`,                   icon: 'i-heroicons-hand-raised',             bg: 'bg-blue-950/60',   color: 'text-blue-400'   },
  { user: 'Sistema',      text: () => 'Senal adquirida · 8 canales · 50ms',                  icon: 'i-heroicons-chart-bar-square',         bg: 'bg-teal-950/60',   color: 'text-teal-400'   },
  { user: 'LDA-1',        text: () => 'Extraccion MAV/RMS completada · 8 canales',           icon: 'i-heroicons-cpu-chip',                 bg: 'bg-purple-950/60', color: 'text-purple-400' },
  { user: 'Vincent Hand', text: (g: string) => `Movimiento ejecutado · ${g}`,               icon: 'i-heroicons-bolt',                     bg: 'bg-green-950/60',  color: 'text-green-400'  },
  { user: 'Sistema',      text: () => 'Ventana deslizante procesada · 256 muestras',         icon: 'i-heroicons-variable',                 bg: 'bg-yellow-950/60', color: 'text-yellow-400' },
  { user: 'Modelo LDA-1', text: () => 'Accuracy validada · 94.5%',                          icon: 'i-heroicons-check-badge',              bg: 'bg-green-950/60',  color: 'text-green-400'  },
]

function pushFeedEntry(gestureName = 'Mano Abierta') {
  const tpl  = FEED_TEMPLATES[Math.floor(Math.random() * FEED_TEMPLATES.length)]
  const time = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  activityFeed.value.unshift({ id: ++feedId, user: tpl.user, text: tpl.text(gestureName), time, icon: tpl.icon, bg: tpl.bg, color: tpl.color })
  if (activityFeed.value.length > 20) activityFeed.value.pop()
}

// ── Mock update timers ─────────────────────────────────────────────────────────
const today = new Date().toLocaleDateString('es-MX', {
  weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
})

let statsTimer: ReturnType<typeof setInterval> | null = null
let feedHandle: ReturnType<typeof setTimeout>  | null = null

function startUpdates() {
  statsTimer = setInterval(() => {
    live.signals  += Math.floor(Math.random() * 3) + 1
    live.accuracy  = parseFloat((94.5 + (Math.random() - 0.5) * 0.6).toFixed(1))
    live.f1        = parseFloat((94.0 + (Math.random() - 0.5) * 0.5).toFixed(1))
    if (Math.random() < 0.08) prosthesisList[0].battery = Math.max(80, prosthesisList[0].battery - 1)

    sparklines.signals.push(live.signals)
    sparklines.signals.shift()
    sparklines.accuracy.push(live.accuracy)
    sparklines.accuracy.shift()

    signalBarDatasets.value[0].data[6] = Math.round(live.signals / 8)
  }, 800)

  const scheduleFeed = () => {
    feedHandle = setTimeout(() => {
      pushFeedEntry(emgStore.currentGesture?.gesture.name ?? 'Mano Abierta')
      scheduleFeed()
    }, 4000 + Math.random() * 4000)
  }
  scheduleFeed()
}

function stopUpdates() {
  if (statsTimer) { clearInterval(statsTimer); statsTimer = null }
  if (feedHandle) { clearTimeout(feedHandle);  feedHandle = null }
}

// When gesture changes: update distribution + counter + sparkline
watch(() => emgStore.currentGesture, (g) => {
  if (!g) return
  live.gestures++
  sparklines.gestures.push(live.gestures)
  sparklines.gestures.shift()
  const slot = gestureDistrib.find(d => d.label === g.gesture.name)
  if (slot) slot.count++
})

// ── Toggle ─────────────────────────────────────────────────────────────────────
function toggleMock() {
  if (emgStore.isStreaming) {
    emgStore.stopMockSimulation()
    stopUpdates()
  } else {
    emgStore.startMockSimulation()
    startUpdates()
  }
}

onMounted(() => {
  emgStore.startMockSimulation()
  startUpdates()
})

onUnmounted(() => {
  emgStore.stopMockSimulation()
  stopUpdates()
})
</script>

<style scoped>
.feed-enter-active { transition: all 0.3s ease; }
.feed-enter-from   { opacity: 0; transform: translateY(-6px); }
.feed-leave-active { transition: all 0.2s ease; position: absolute; }
.feed-leave-to     { opacity: 0; transform: translateX(16px); }
</style>
