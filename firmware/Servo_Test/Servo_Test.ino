#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* WIFI_SSID = "marketing-informatica";
const char* WIFI_PASS = "Informark2026@";
const char* WS_HOST   = "192.168.0.17";
const int   WS_PORT   = 3000;
const char* WS_PATH   = "/_ws";

// ── ADC ────────────────────────────────────────────────────────────────────
#define ADC_MID        2048

// ── Filtro paso-banda (HPF 20 Hz → rectificación → LPF envolvente 5 Hz)
// dt = 4 ms, fc_high = 20 Hz → alpha_h = RC/(RC+dt), RC = 1/(2π·20) = 0.007958
#define HPF_ALPHA      0.6655f
// fc_env = 5 Hz → alpha_e = dt/(RC+dt), RC = 1/(2π·5) = 0.03183
#define ENV_ALPHA      0.112f

// ── Calibración MVC ──────────────────────────────────────────────────────
#define MVC_CAL_MS     5000
#define MVC_FALLBACK   150.0f

// ── Control proporcional ─────────────────────────────────────────────────
#define DEAD_ZONE_PCT  0.15f      // zona muerta = 15% del umbral
#define SLEW_MAX       8          // max cambio de ángulo por ciclo (4 ms) → ≤ 2000°/s

// ── Temporización ────────────────────────────────────────────────────────
#define SEND_MS        4          // 250 Hz osciloscópio
#define SERVO_SEND_MS  20         // 50 Hz servo_update al browser
#define MIN_PULSE_MS   50
#define MAX_PULSE_MS   600
#define DOUBLE_WIN_MS  500

// ── Pines EMG (3 canales) ────────────────────────────────────────────────
#define PIN_EMG1   1   // CH1 → pulgar + índice
#define PIN_EMG2   2   // CH2 → dedo medio
#define PIN_EMG3   9   // CH3 → anular + meñique

struct Channel {
  uint8_t       pin;
  float         hpf_x;      // HPF: entrada anterior
  float         hpf_y;      // HPF: salida anterior
  float         env;         // envolvente post-rectificación
  int           angle;       // ángulo actual del servo (con slew rate)
  bool          active;
  unsigned long pulseStart;
  unsigned long lastFall;
  bool          waitDouble;
};

Channel ch[3] = {
  { PIN_EMG1, 0, 0, 0, 0, false, 0, 0, false },
  { PIN_EMG2, 0, 0, 0, 0, false, 0, 0, false },
  { PIN_EMG3, 0, 0, 0, 0, false, 0, 0, false },
};

float chThreshold[3] = { MVC_FALLBACK, MVC_FALLBACK, MVC_FALLBACK };
float mvcMax[3]      = { 0, 0, 0 };

bool          calibrating = true;
unsigned long calStart    = 0;

// ── Servos ────────────────────────────────────────────────────────────────
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
void processChannel(int i, unsigned long now);
void onPulse(int i, int count);
void notifyGesture(const char* code, int chNum, int pulses);
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

  calStart = millis();
  Serial.println("[CAL] Calibración MVC — aprieta los músculos al máximo durante 5 s...");

  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Conectando WiFi");
  uint8_t tries = 0;
  while (WiFi.status() != WL_CONNECTED && tries++ < 20) {
    delay(500); Serial.print('.');
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

  // ── 1. Lectura + filtro paso-banda por canal ──────────────────────────
  for (int i = 0; i < 3; i++) {
    int raw = analogRead(ch[i].pin);
    float x = (float)(raw - ADC_MID);

    // HPF 20 Hz: elimina DC y drift lento
    float hpf = HPF_ALPHA * (ch[i].hpf_y + x - ch[i].hpf_x);
    ch[i].hpf_x = x;
    ch[i].hpf_y = hpf;

    // Rectificación onda completa + LPF 5 Hz para envolvente
    float rect = fabsf(hpf);
    ch[i].env += ENV_ALPHA * (rect - ch[i].env);
  }

  // ── 2. Calibración MVC (5 segundos al arrancar) ───────────────────────
  if (calibrating) {
    unsigned long elapsed = now - calStart;
    if (elapsed < MVC_CAL_MS) {
      for (int i = 0; i < 3; i++) {
        if (ch[i].env > mvcMax[i]) mvcMax[i] = ch[i].env;
      }
      static unsigned long lastCalNotify = 0;
      if (wsConnected && now - lastCalNotify >= 500) {
        lastCalNotify = now;
        int secsLeft = (int)((MVC_CAL_MS - elapsed) / 1000) + 1;
        char buf[128];
        snprintf(buf, sizeof(buf),
          "{\"type\":\"cal_status\",\"secsLeft\":%d,\"mvc\":[%.1f,%.1f,%.1f]}",
          secsLeft, mvcMax[0], mvcMax[1], mvcMax[2]);
        ws.sendTXT(buf);
      }
    } else {
      calibrating = false;
      for (int i = 0; i < 3; i++) {
        if (mvcMax[i] < 30.0f) mvcMax[i] = MVC_FALLBACK;
        chThreshold[i] = mvcMax[i] * 0.40f;
      }
      Serial.printf("[CAL] Completa! MVC=[%.1f,%.1f,%.1f] THR=[%.1f,%.1f,%.1f]\n",
        mvcMax[0], mvcMax[1], mvcMax[2],
        chThreshold[0], chThreshold[1], chThreshold[2]);
      if (wsConnected) {
        char buf[192];
        snprintf(buf, sizeof(buf),
          "{\"type\":\"cal_complete\",\"mvc\":[%.1f,%.1f,%.1f],\"thr\":[%.1f,%.1f,%.1f]}",
          mvcMax[0], mvcMax[1], mvcMax[2],
          chThreshold[0], chThreshold[1], chThreshold[2]);
        ws.sendTXT(buf);
      }
    }
  }

  // ── 3. Control proporcional: dead zone + slew rate ────────────────────
  if (millis() >= manualUntil) {
    for (int i = 0; i < 3; i++) {
      float env      = ch[i].env;
      float thr      = chThreshold[i];
      float deadZone = thr * DEAD_ZONE_PCT;

      int target;
      if (env <= deadZone) {
        target = 0;
      } else {
        float ratio = (env - deadZone) / (thr - deadZone);
        if (ratio > 1.0f) ratio = 1.0f;
        target = (int)(ratio * 170.0f);
      }

      int delta = target - ch[i].angle;
      if (delta >  SLEW_MAX) delta =  SLEW_MAX;
      if (delta < -SLEW_MAX) delta = -SLEW_MAX;
      ch[i].angle += delta;
    }

    // CH1 → pulgar + índice | CH2 → medio | CH3 → anular + meñique
    pose.thumbFlex  = ch[0].angle;
    pose.indexFlex  = ch[0].angle;
    pose.midFlex    = ch[1].angle;
    pose.ringPinky  = ch[2].angle;
    // Aducción del pulgar: aumenta al pellizcar (CH1)
    pose.thumbAddu  = 90 - (int)(ch[0].angle / 170.0f * 45.0f);
    applyPose();
  }

  // ── 4. Detección de pulsos (para panel de gesto en browser) ──────────
  if (!calibrating) {
    for (int i = 0; i < 3; i++) processChannel(i, now);
  }

  // ── 5. servo_update al browser a 50 Hz ───────────────────────────────
  static unsigned long lastServoSend = 0;
  if (wsConnected && now - lastServoSend >= SERVO_SEND_MS) {
    lastServoSend = now;
    char buf[192];
    snprintf(buf, sizeof(buf),
      "{\"type\":\"servo_update\",\"thumbFlex\":%d,\"indexFlex\":%d,\"midFlex\":%d,\"ringPinky\":%d,\"thumbAddu\":%d}",
      pose.thumbFlex, pose.indexFlex, pose.midFlex, pose.ringPinky, pose.thumbAddu);
    ws.sendTXT(buf);
  }

  // ── 6. ecg_data al osciloscópio a 250 Hz ─────────────────────────────
  static unsigned long lastSend = 0;
  if (wsConnected && now - lastSend >= SEND_MS) {
    lastSend = now;
    char buf[128];
    snprintf(buf, sizeof(buf),
      "{\"type\":\"ecg_data\",\"t\":%lu,\"ch\":[%.1f,%.1f,%.1f]}",
      now, ch[0].env, ch[1].env, ch[2].env);
    ws.sendTXT(buf);
  }

  delay(4);
}

// ── Detección de pulsos ────────────────────────────────────────────────────
void processChannel(int i, unsigned long now) {
  float thr  = chThreshold[i];
  float fall = thr * 0.55f;

  if (!ch[i].active && ch[i].env >= thr) {
    ch[i].active     = true;
    ch[i].pulseStart = now;
  }

  if (ch[i].active && ch[i].env < fall) {
    ch[i].active = false;
    unsigned long dur = now - ch[i].pulseStart;

    if (dur >= MIN_PULSE_MS && dur <= MAX_PULSE_MS) {
      if (ch[i].waitDouble && (now - ch[i].lastFall) < DOUBLE_WIN_MS) {
        ch[i].waitDouble = false;
        onPulse(i, 2);
      } else {
        ch[i].waitDouble = true;
      }
      ch[i].lastFall = now;
    }
  }

  if (ch[i].waitDouble && (now - ch[i].lastFall) >= DOUBLE_WIN_MS) {
    ch[i].waitDouble = false;
    onPulse(i, 1);
  }
}

void onPulse(int i, int count) {
  if (millis() < manualUntil) return;
  Serial.printf("[EMG] CH%d x%d\n", i + 1, count);

  const char* code = nullptr;
  if      (i == 0) code = (count == 1) ? "HAND_CLOSE"       : "FINE_PINCH";
  else if (i == 1) code = (count == 1) ? "HAND_OPEN"        : "CYLINDRICAL_GRIP";
  else if (i == 2) code = (count == 1) ? "PRONATION"        : "SUPINATION";

  if (code) notifyGesture(code, i + 1, count);
}

void notifyGesture(const char* code, int chNum, int pulses) {
  if (!wsConnected) return;
  char buf[128];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"gesture_detected\",\"gesture\":\"%s\",\"ch\":%d,\"pulses\":%d}",
    code, chNum, pulses);
  ws.sendTXT(buf);
}

// ── Poses fijas (solo para comandos manuales desde la web) ───────────────
void setGesture(const char* code) {
  if      (strcmp(code, "HAND_OPEN")        == 0) pose = {0,   0,   0,   0,   90};
  else if (strcmp(code, "HAND_CLOSE")       == 0) pose = {170, 170, 170, 170, 90};
  else if (strcmp(code, "FINE_PINCH")       == 0) pose = {155, 155, 0,   0,   45};
  else if (strcmp(code, "CYLINDRICAL_GRIP") == 0) pose = {145, 155, 150, 160, 90};
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
      ws.sendTXT("{\"type\":\"device_connect\",\"device\":\"esp32-s3\",\"channels\":3}");
      Serial.println("[WS] Conectado al servidor");
      // Si ya calibramos, informar estado al nuevo browser
      if (!calibrating) {
        char buf[192];
        snprintf(buf, sizeof(buf),
          "{\"type\":\"cal_complete\",\"mvc\":[%.1f,%.1f,%.1f],\"thr\":[%.1f,%.1f,%.1f]}",
          mvcMax[0], mvcMax[1], mvcMax[2],
          chThreshold[0], chThreshold[1], chThreshold[2]);
        ws.sendTXT(buf);
      }
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

      if (strcmp(t, "command") == 0) {
        const char* g = doc["gesture"];
        if (g) { setGesture(g); manualUntil = millis() + MANUAL_LOCK_MS; }

      } else if (strcmp(t, "stop") == 0) {
        setGesture("HAND_OPEN");
        manualUntil = millis() + MANUAL_LOCK_MS;

      } else if (strcmp(t, "set_threshold") == 0) {
        if (doc["value"].is<float>()) {
          float val = doc["value"].as<float>();
          for (int i = 0; i < 3; i++) chThreshold[i] = val;
          Serial.printf("[CAL] Threshold manual = %.1f\n", val);
        }

      } else if (strcmp(t, "recalibrate") == 0) {
        for (int i = 0; i < 3; i++) { mvcMax[i] = 0; ch[i].angle = 0; }
        calibrating = true;
        calStart    = millis();
        Serial.println("[CAL] Re-calibración iniciada");
      }
      break;
    }

    default: break;
  }
}
