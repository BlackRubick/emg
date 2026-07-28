export default defineNitroPlugin((nitroApp) => {
  const browserPeers = new Set<any>()
  let esp32Peer: any = null

  nitroApp.router.add('/_ws', defineEventHandler({
    handler() {},
    websocket: {
      open(peer) {
        browserPeers.add(peer)
        peer.send(JSON.stringify({ type: 'connected', timestamp: Date.now() }))
        // Si el ESP32 ya estaba conectado cuando este browser llegó, avisarle inmediatamente
        if (esp32Peer !== null) {
          peer.send(JSON.stringify({ type: 'esp32_status', connected: true, timestamp: Date.now() }))
        }
      },

      message(peer, message) {
        const raw = message.text()
        try {
          const data = JSON.parse(raw)

          // ESP32 se identifica al conectarse
          if (data.type === 'device_connect') {
            browserPeers.delete(peer)
            esp32Peer = peer
            console.log('[WS] ESP32-S3 conectado — canales:', data.channels ?? 1)
            peer.send(JSON.stringify({ type: 'ack', message: 'ESP32 registrado' }))
            _broadcast({ type: 'esp32_status', connected: true, channels: data.channels ?? 1, timestamp: Date.now() })
            return
          }

          // Posiciones de servo desde prueba de test → reenviar a browsers
          if (data.type === 'servo_update' && peer === esp32Peer) {
            _broadcast({ type: 'servo_update', ...data, timestamp: Date.now() })
            return
          }

          // Gesto detectado en ESP32 → reenviar a browsers
          if (data.type === 'gesture_detected' && peer === esp32Peer) {
            _broadcast({ type: 'gesture_detected', gesture: data.gesture, ch: data.ch, pulses: data.pulses, timestamp: Date.now() })
            return
          }

          // Datos EMG del ESP32 → reenviar a browsers como emg_signal
          if (data.type === 'ecg_data' && peer === esp32Peer) {
            const chArr: number[] = Array.isArray(data.ch) ? data.ch : [data.env ?? 0]

            const signal = {
              type: 'emg_signal',
              timestamp: Date.now(),
              source: 'esp32',
              channels: chArr.map((env: number, i: number) => ({
                channel: i + 1,
                // Normalizar envolvente ADC (0-1000) → µV proxy (0-100)
                amplitude: parseFloat((env / 10).toFixed(2)),
                frequency: 250,
              })),
              raw: data.ch ?? data.v,
            }
            _broadcast(signal)
            return
          }

          // Ping desde browser
          if (data.type === 'ping') {
            peer.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
            return
          }

          // Browser pide estado actual del ESP32
          if (data.type === 'get_status') {
            peer.send(JSON.stringify({ type: 'esp32_status', connected: esp32Peer !== null, timestamp: Date.now() }))
            return
          }

          // Comando manual desde browser → ESP32
          if (data.type === 'command' && esp32Peer) {
            esp32Peer.send(JSON.stringify({ type: 'command', gesture: data.gesture }))
            return
          }

          // Stop desde browser → mano abierta
          if (data.type === 'stop' && esp32Peer) {
            esp32Peer.send(JSON.stringify({ type: 'stop' }))
            return
          }

          // Calibración de umbral desde browser → ESP32
          if (data.type === 'set_threshold' && esp32Peer) {
            esp32Peer.send(JSON.stringify({ type: 'set_threshold', value: data.value }))
            return
          }

        } catch {}
      },

      close(peer) {
        browserPeers.delete(peer)
        if (peer === esp32Peer) {
          esp32Peer = null
          console.log('[WS] ESP32-S3 desconectado')
          _broadcast({ type: 'esp32_status', connected: false, timestamp: Date.now() })
        }
      },

      error(peer) {
        browserPeers.delete(peer)
        if (peer === esp32Peer) {
          esp32Peer = null
          _broadcast({ type: 'esp32_status', connected: false, timestamp: Date.now() })
        }
      },
    },
  }))

  function _broadcast(data: unknown) {
    const msg = JSON.stringify(data)
    for (const peer of browserPeers) {
      try { peer.send(msg) } catch {}
    }
  }

  ;(nitroApp as any).sendToESP32 = (data: unknown) => {
    if (esp32Peer) {
      try { esp32Peer.send(JSON.stringify(data)) } catch {}
    }
  }
  ;(nitroApp as any).broadcastEMG      = _broadcast
  ;(nitroApp as any).isESP32Connected  = () => esp32Peer !== null
})
