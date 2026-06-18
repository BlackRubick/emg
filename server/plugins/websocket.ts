export default defineNitroPlugin((nitroApp) => {
  // WebSocket peer management
  const peers = new Set<any>()

  nitroApp.router.add('/_ws', defineEventHandler({
    handler() {},
    websocket: {
      open(peer) {
        peers.add(peer)
        peer.send(JSON.stringify({ type: 'connected', message: 'EMG WebSocket connected', timestamp: Date.now() }))
      },
      message(peer, message) {
        const raw = message.text()
        try {
          const data = JSON.parse(raw)
          if (data.type === 'ping') {
            peer.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }))
          } else if (data.type === 'subscribe') {
            peer.send(JSON.stringify({ type: 'subscribed', channel: data.channel, timestamp: Date.now() }))
          }
        } catch {}
      },
      close(peer) {
        peers.delete(peer)
      },
      error(peer) {
        peers.delete(peer)
      },
    },
  }))

  // Broadcast helper attached to nitroApp
  ;(nitroApp as any).broadcastEMG = (data: unknown) => {
    const message = JSON.stringify(data)
    for (const peer of peers) {
      try { peer.send(message) } catch {}
    }
  }

  // Simulate real-time EMG signal broadcast every 50ms
  let sessionActive = false
  setInterval(() => {
    if (!sessionActive || peers.size === 0) return
    const signalData = {
      type: 'emg_signal',
      timestamp: Date.now(),
      channels: Array.from({ length: 8 }, (_, i) => ({
        channel: i + 1,
        amplitude: Math.sin(Date.now() * 0.001 + i * 0.5) * 50 + (Math.random() - 0.5) * 30,
        frequency: 50 + Math.random() * 150,
      })),
    }
    ;(nitroApp as any).broadcastEMG(signalData)
  }, 50)

  nitroApp.hooks.hook('request', (event) => {
    if (event.path === '/_ws/start') sessionActive = true
    if (event.path === '/_ws/stop') sessionActive = false
  })
})
