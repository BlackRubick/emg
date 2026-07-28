#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* WIFI_SSID = "wifi";
const char* WIFI_PASS = "contra";
const char* WS_HOST   = "192.168.1.XXX";
const int   WS_PORT   = 3000;
const char* WS_PATH   = "/_ws";

// ── EMG ───────────────────────────────────────────────────────────────────
#define PIN_EMG1       1
#define ADC_MID        2048
#define ALPHA          0.08f
float THRESHOLD      = 150.0f;
float THRESHOLD_FALL = 80.0f;
#define MIN_PULSE_MS   50
#define MAX_PULSE_MS   600
#define DOUBLE_WIN_MS  500
#define SEND_MS        4

struct Channel {
  uint8_t       pin;
  float         env;
  bool          active;
  unsigned long pulseStart;
  unsigned long lastFall;
  bool          waitDouble;
};

Channel ch = { PIN_EMG1, 0, false, 0, 0, false };

// ── Servos (5 pines — sin muñeca) ─────────────────────────────────────────
#define PIN_THUMB_FLEX  4
#define PIN_INDEX_FLEX  5
#define PIN_MID_FLEX    6
#define PIN_RING_PINKY  7
#define PIN_THUMB_ADDU  15

Servo sThumbFlex, sIndexFlex, sMidFlex, sRingPinky, sThumbAddu;

struct Pose {
  int thumbFlex  = 0;
  int indexFlex  = 0;
  int midFlex    = 0;
  int ringPinky  = 0;
  int thumbAddu  = 90;
} pose;

// ── WebSocket ──────────────────────────────────────────────────────────────
WebSocketsClient ws;
bool wsConnected = false;

#define MANUAL_LOCK_MS 3000
unsigned long manualUntil = 0;

// ── Declaraciones anticipadas ──────────────────────────────────────────────
void applyPose();
void setGesture(const char* code);
void processChannel(unsigned long now);
void onPulse(int count);
void notifyGesture(const char* code, int pulses);
void onWsEvent(WStype_t type, uint8_t* payload, size_t length);

// ─────────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  sThumbFlex.attach(PIN_THUMB_FLEX,  500, 2400);
  sIndexFlex.attach(PIN_INDEX_FLEX,  500, 2400);
  sMidFlex.attach(PIN_MID_FLEX,      500, 2400);
  sRingPinky.attach(PIN_RING_PINKY,  500, 2400);
  sThumbAddu.attach(PIN_THUMB_ADDU,  500, 2400);
  applyPose();

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Conectando WiFi");
  uint8_t tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries++ < 20) {
    delay(500);
    Serial.print('.');
  }
  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("\nWiFi OK: %s\n", WiFi.localIP().toString().c_str());
    ws.begin(WS_HOST, WS_PORT, WS_PATH);
    ws.onEvent(onWsEvent);
    ws.setReconnectInterval(3000);
  } else {
    Serial.println("\nWiFi falló — modo standalone");
  }
}

void loop() {
  ws.loop();
  unsigned long now = millis();

  // Leer y filtrar envolvente EMG
  int raw = analogRead(ch.pin);
  float s = (float)abs(raw - ADC_MID);
  ch.env += ALPHA * (s - ch.env);
  processChannel(now);

  // Enviar señal al osciloscópio de la web (~250 Hz)
  static unsigned long lastSend = 0;
  if (wsConnected && now - lastSend >= SEND_MS) {
    lastSend = now;
    char buf[96];
    snprintf(buf, sizeof(buf),
      "{\"type\":\"ecg_data\",\"t\":%lu,\"ch\":[%.1f]}", now, ch.env);
    ws.sendTXT(buf);
  }

  delay(4);
}

// ── Detección de pulsos simples / dobles ──────────────────────────────────
void processChannel(unsigned long now) {
  if (!ch.active && ch.env >= THRESHOLD) {
    ch.active     = true;
    ch.pulseStart = now;
  }

  if (ch.active && ch.env < THRESHOLD_FALL) {
    ch.active = false;
    unsigned long dur = now - ch.pulseStart;

    if (dur >= MIN_PULSE_MS && dur <= MAX_PULSE_MS) {
      if (ch.waitDouble && (now - ch.lastFall) < DOUBLE_WIN_MS) {
        ch.waitDouble = false;
        onPulse(2);
      } else {
        ch.waitDouble = true;
      }
      ch.lastFall = now;
    }
  }

  if (ch.waitDouble && (now - ch.lastFall) >= DOUBLE_WIN_MS) {
    ch.waitDouble = false;
    onPulse(1);
  }
}

// ── Acción al detectar pulso ──────────────────────────────────────────────
void onPulse(int count) {
  if (millis() < manualUntil) return;
  Serial.printf("[EMG] CH1 x%d\n", count);
  const char* code = (count == 1) ? "HAND_CLOSE" : "FINE_PINCH";
  setGesture(code);
  notifyGesture(code, count);
}

void notifyGesture(const char* code, int pulses) {
  if (!wsConnected) return;
  char buf[128];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"gesture_detected\",\"gesture\":\"%s\",\"ch\":1,\"pulses\":%d}",
    code, pulses);
  ws.sendTXT(buf);
}

// ── Tabla de poses (sin muñeca) ───────────────────────────────────────────
void setGesture(const char* code) {
  if      (strcmp(code, "HAND_OPEN")        == 0) pose = {0,   0,   0,   0,   90};
  else if (strcmp(code, "HAND_CLOSE")       == 0) pose = {170, 170, 170, 170, 90};
  else if (strcmp(code, "FINE_PINCH")       == 0) pose = {155, 155, 0,   0,   45};
  else if (strcmp(code, "CYLINDRICAL_GRIP") == 0) pose = {145, 155, 150, 160, 90};
  // Los gestos de muñeca solo abren la mano (no hay servo de muñeca en este hardware)
  else if (strcmp(code, "WRIST_FLEX")       == 0) pose = {0,   0,   0,   0,   90};
  else if (strcmp(code, "WRIST_EXT")        == 0) pose = {0,   0,   0,   0,   90};
  else if (strcmp(code, "PRONATION")        == 0) pose = {0,   0,   0,   0,   90};
  else if (strcmp(code, "SUPINATION")       == 0) pose = {0,   0,   0,   0,   90};
  else return;
  applyPose();
  Serial.printf("[GESTO] %s\n", code);
}

void applyPose() {
  sThumbFlex.write(pose.thumbFlex);
  sIndexFlex.write(pose.indexFlex);
  sMidFlex.write(pose.midFlex);
  sRingPinky.write(pose.ringPinky);
  sThumbAddu.write(pose.thumbAddu);
}

// ── Eventos WebSocket ─────────────────────────────────────────────────────
void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      wsConnected = true;
      ws.sendTXT("{\"type\":\"device_connect\",\"device\":\"esp32-s3\",\"channels\":1}");
      Serial.println("[WS] Conectado al servidor");
      break;

    case WStype_DISCONNECTED:
      wsConnected = false;
      Serial.println("[WS] Desconectado");
      break;

    case WStype_TEXT: {
      JsonDocument doc;
      if (deserializeJson(doc, payload, length)) break;
      const char* t = doc["type"];
      if (!t) break;

      // Comando manual desde la web → mueve la mano y bloquea EMG 3 s
      if (strcmp(t, "command") == 0) {
        const char* g = doc["gesture"];
        if (g) { setGesture(g); manualUntil = millis() + MANUAL_LOCK_MS; }

      // Stop → mano abierta
      } else if (strcmp(t, "stop") == 0) {
        setGesture("HAND_OPEN");
        manualUntil = millis() + MANUAL_LOCK_MS;

      // Calibración de umbral en caliente desde la web
      } else if (strcmp(t, "set_threshold") == 0) {
        if (doc["value"].is<float>()) {
          THRESHOLD      = doc["value"].as<float>();
          THRESHOLD_FALL = THRESHOLD * 0.55f;
          Serial.printf("[CAL] Threshold = %.1f\n", THRESHOLD);
        }
      }
      break;
    }

    default: break;
  }
}
