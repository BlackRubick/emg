import { defineStore } from 'pinia'

// crypto.randomUUID() solo funciona en HTTPS o localhost — fallback para HTTP/IP
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16)
  })
}

export interface EMGSample {
  channel: number
  amplitude: number
  frequency: number
}

export interface EMGFrame {
  timestamp: number
  channels: EMGSample[]
}

interface GestureResult {
  gesture: { name: string; code: string }
  confidence: number
}

const MOCK_GESTURES = [
  { name: 'Mano Abierta',        code: 'HAND_OPEN' },
  { name: 'Mano Cerrada',        code: 'HAND_CLOSE' },
  { name: 'Pinza Fina',          code: 'FINE_PINCH' },
  { name: 'Agarre Cilindrico',   code: 'CYLINDRICAL_GRIP' },
  { name: 'Flexion de Muneca',   code: 'WRIST_FLEX' },
  { name: 'Extension de Muneca', code: 'WRIST_EXT' },
  { name: 'Pronacion',           code: 'PRONATION' },
  { name: 'Supinacion',          code: 'SUPINATION' },
]

// Amplitude profile per gesture: peak amplitude per channel (0-80 µV)
const GESTURE_PROFILE: Record<string, number[]> = {
  HAND_OPEN:        [75, 60, 50, 65, 30, 20, 15, 10],
  HAND_CLOSE:       [30, 70, 65, 55, 20, 15, 10, 10],
  FINE_PINCH:       [40, 80, 30, 20, 15, 10, 10, 10],
  CYLINDRICAL_GRIP: [50, 75, 60, 70, 25, 20, 15, 15],
  WRIST_FLEX:       [70, 30, 20, 20, 15, 10, 10, 10],
  WRIST_EXT:        [20, 25, 75, 65, 15, 10, 10, 10],
  PRONATION:        [30, 30, 40, 40, 20, 20, 70, 20],
  SUPINATION:       [25, 25, 35, 35, 15, 15, 20, 75],
}

const CH_FREQ = [55, 80, 65, 90, 45, 70, 60, 85]

// ── Module-level private state (not in Pinia – timers are not serializable) ──
let _frameTimer:   ReturnType<typeof setInterval> | null = null
let _gestureTimer: ReturnType<typeof setTimeout>  | null = null
let _gestureIdx  = 0
let _envelopes   = [0, 0, 0, 0, 0, 0, 0, 0]

export const useEMGStore = defineStore('emg', {
  state: () => ({
    isConnected: false,
    isStreaming:  false,
    sessionId:    null as string | null,
    buffer:       [] as EMGFrame[],
    maxBufferSize: 500,
    lastFrame:    null as EMGFrame | null,
    currentGesture: null as GestureResult | null,
    ws:           null as WebSocket | null,
    latency:      0,
    esp32Connected: false,
    dataSource:   'mock' as 'mock' | 'esp32',
  }),

  getters: {
    channelHistory: (state) => (channelNum: number) =>
      state.buffer.slice(-100).map(f => ({
        t: f.timestamp,
        v: f.channels.find(c => c.channel === channelNum)?.amplitude ?? 0,
      })),
  },

  actions: {
    connect() {
      if (this.ws?.readyState === WebSocket.OPEN) return
      // Usar el host actual para que funcione tanto en localhost como por IP
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      const wsUrl = `${protocol}//${window.location.host}`
      this.ws = new WebSocket(`${wsUrl}/_ws`)
      this.ws.onopen  = () => { this.isConnected = true; this.sessionId = uuid() }
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'emg_signal') {
          if (data.source === 'esp32') this.dataSource = 'esp32'
          this.lastFrame = data
          this.buffer.push(data)
          if (this.buffer.length > this.maxBufferSize) this.buffer.shift()
        } else if (data.type === 'pong') {
          this.latency = Date.now() - data.timestamp
        } else if (data.type === 'esp32_status') {
          this.esp32Connected = data.connected
          if (!data.connected) this.dataSource = 'mock'
        }
      }
      this.ws.onclose = () => {
        this.isConnected = false
        // No matar isStreaming si el mock está corriendo
        if (_frameTimer === null) this.isStreaming = false
      }
      this.ws.onerror = () => { this.isConnected = false }
    },

    disconnect() {
      this.ws?.close(); this.ws = null
      this.isConnected = false; this.isStreaming = false
    },

    startStreaming() { this.isStreaming = true; this.buffer = [] },
    stopStreaming()  { this.isStreaming = false },

    ping() {
      if (this.ws?.readyState === WebSocket.OPEN)
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }))
    },

    setCurrentGesture(gesture: GestureResult) { this.currentGesture = gesture },

    // ── Local mock simulation ──────────────────────────────────────────────
    startMockSimulation() {
      this._clearMockTimers()

      _gestureIdx = 0
      _envelopes  = [0, 0, 0, 0, 0, 0, 0, 0]

      this.isConnected    = true
      this.isStreaming     = true
      this.sessionId      = uuid()
      this.buffer         = []
      this.currentGesture = { gesture: MOCK_GESTURES[0], confidence: 0.94 }

      // EMG frame every 50 ms
      _frameTimer = setInterval(() => {
        const t       = Date.now() / 1000
        const code    = this.currentGesture?.gesture.code ?? 'HAND_OPEN'
        const profile = GESTURE_PROFILE[code] ?? GESTURE_PROFILE.HAND_OPEN

        // Smooth envelope per channel
        _envelopes = _envelopes.map((env, i) => {
          const target = 0.4 + 0.6 * (profile[i] / 80) + (Math.random() - 0.5) * 0.2
          return env + (target - env) * 0.12
        })

        const frame: EMGFrame = {
          timestamp: Date.now(),
          channels: Array.from({ length: 8 }, (_, i) => {
            const f   = CH_FREQ[i]
            const env = _envelopes[i]
            const sig = (
              Math.sin(2 * Math.PI * f * t) * 0.5 +
              Math.sin(2 * Math.PI * f * 2 * t) * 0.25 +
              Math.sin(2 * Math.PI * f * 0.5 * t) * 0.25
            )
            return {
              channel:   i + 1,
              amplitude: parseFloat((sig * profile[i] * env + (Math.random() - 0.5) * 6).toFixed(2)),
              frequency: f,
            }
          }),
        }

        this.lastFrame = frame
        this.buffer.push(frame)
        if (this.buffer.length > this.maxBufferSize) this.buffer.shift()
        this.latency = Math.round(8 + Math.random() * 10)
      }, 50)

      // Cycle gesture every 3-6 s
      const scheduleGesture = () => {
        _gestureTimer = setTimeout(() => {
          _gestureIdx = (_gestureIdx + 1) % MOCK_GESTURES.length
          this.currentGesture = {
            gesture:    MOCK_GESTURES[_gestureIdx],
            confidence: parseFloat((0.85 + Math.random() * 0.14).toFixed(3)),
          }
          scheduleGesture()
        }, 3000 + Math.random() * 3000)
      }
      scheduleGesture()
    },

    stopMockSimulation() {
      this._clearMockTimers()
      this.isConnected    = false
      this.isStreaming     = false
      this.lastFrame      = null
      this.currentGesture = null
    },

    _clearMockTimers() {
      if (_frameTimer)   { clearInterval(_frameTimer);   _frameTimer   = null }
      if (_gestureTimer) { clearTimeout(_gestureTimer);  _gestureTimer = null }
    },
  },
})
