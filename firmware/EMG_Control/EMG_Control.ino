

#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* WIFI_SSID = "wifi";
const char* WIFI_PASS = "contra";
const char* WS_HOST   = "192.168.1.XXX";   
const int   WS_PORT   = 3000;
const char* WS_PATH   = "/_ws";

#define PIN_EMG1  1
#define PIN_EMG2  2
#define PIN_EMG3  9

#define PIN_THUMB_FLEX  4
#define PIN_INDEX_FLEX  5
#define PIN_MID_FLEX    6
#define PIN_RING_PINKY  7
#define PIN_THUMB_ADDU  15
#define PIN_WRIST_ROT   16

#define ADC_MID        2048     
#define ALPHA          0.08f    
float THRESHOLD      = 150.0f; 
float THRESHOLD_FALL = 80.0f;  
#define MIN_PULSE_MS   50       
#define MAX_PULSE_MS   600      
#define DOUBLE_WIN_MS  500      
#define SEND_MS        4        

Servo sThumbFlex, sIndexFlex, sMidFlex, sRingPinky, sThumbAddu, sWristRot;

struct Pose {
  int thumbFlex  = 0;
  int indexFlex  = 0;
  int midFlex    = 0;
  int ringPinky  = 0;
  int thumbAddu  = 90;
  int wristRot   = 90;
} pose;

struct Channel {
  uint8_t       pin;
  float         env;
  bool          active;
  unsigned long pulseStart;
  unsigned long lastFall;
  bool          waitDouble;
};

Channel ch[3] = {
  {PIN_EMG1, 0, false, 0, 0, false},
  {PIN_EMG2, 0, false, 0, 0, false},
  {PIN_EMG3, 0, false, 0, 0, false},
};

WebSocketsClient ws;
bool wsConnected = false;

#define MANUAL_LOCK_MS 3000
unsigned long manualUntil = 0;

bool wristPronated = false;
bool wristFlexed   = false;

void applyPose();
void setGesture(const char* code);
void processChannel(int i, unsigned long now);
void onPulse(int i, int count);
void onWsEvent(WStype_t type, uint8_t* payload, size_t length);


void setup() {
  Serial.begin(115200);
  analogReadResolution(12);

  sThumbFlex.attach(PIN_THUMB_FLEX,  500, 2400);
  sIndexFlex.attach(PIN_INDEX_FLEX,  500, 2400);
  sMidFlex.attach(PIN_MID_FLEX,      500, 2400);
  sRingPinky.attach(PIN_RING_PINKY,  500, 2400);
  sThumbAddu.attach(PIN_THUMB_ADDU,  500, 2400);
  sWristRot.attach(PIN_WRIST_ROT,    500, 2400);
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

  for (int i = 0; i < 3; i++) {
    int raw = analogRead(ch[i].pin);
    float s = (float)abs(raw - ADC_MID);
    ch[i].env += ALPHA * (s - ch[i].env);
    processChannel(i, now);
  }

  static unsigned long lastSend = 0;
  if (wsConnected && now - lastSend >= SEND_MS) {
    lastSend = now;
    char buf[160];
    snprintf(buf, sizeof(buf),
      "{\"type\":\"ecg_data\",\"t\":%lu,\"ch\":[%.1f,%.1f,%.1f]}",
      now, ch[0].env, ch[1].env, ch[2].env);
    ws.sendTXT(buf);
  }

  delay(4);
}

void processChannel(int i, unsigned long now) {
  Channel& c = ch[i];

  if (!c.active && c.env >= THRESHOLD) {
    c.active     = true;
    c.pulseStart = now;
  }

  if (c.active && c.env < THRESHOLD_FALL) {
    c.active = false;
    unsigned long dur = now - c.pulseStart;

    if (dur >= MIN_PULSE_MS && dur <= MAX_PULSE_MS) {
      if (c.waitDouble && (now - c.lastFall) < DOUBLE_WIN_MS) {
        // Llegó segundo pulso → DOBLE
        c.waitDouble = false;
        onPulse(i, 2);
      } else {
        c.waitDouble = true;
      }
      c.lastFall = now;
    }
  }

  if (c.waitDouble && (now - c.lastFall) >= DOUBLE_WIN_MS) {
    c.waitDouble = false;
    onPulse(i, 1);
  }
}

void notifyGesture(const char* code, int ch, int pulses) {
  if (!wsConnected) return;
  char buf[128];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"gesture_detected\",\"gesture\":\"%s\",\"ch\":%d,\"pulses\":%d}",
    code, ch, pulses);
  ws.sendTXT(buf);
}

void onPulse(int i, int count) {
  if (millis() < manualUntil) return;

  Serial.printf("[EMG] CH%d  x%d\n", i + 1, count);

  const char* code = nullptr;
  switch (i) {
    case 0:
      code = (count == 1) ? "HAND_CLOSE" : "FINE_PINCH";
      break;
    case 1:
      code = (count == 1) ? "HAND_OPEN" : "CYLINDRICAL_GRIP";
      break;
    case 2:
      if (count == 1) {
        wristPronated = !wristPronated;
        code = wristPronated ? "PRONATION" : "SUPINATION";
      } else {
        wristFlexed = !wristFlexed;
        code = wristFlexed ? "WRIST_FLEX" : "WRIST_EXT";
      }
      break;
  }
  if (code) {
    setGesture(code);
    notifyGesture(code, i + 1, count);
  }
}

void setGesture(const char* code) {
  if      (strcmp(code, "HAND_OPEN")        == 0) pose = {0,   0,   0,   0,   90,  90};
  else if (strcmp(code, "HAND_CLOSE")       == 0) pose = {170, 170, 170, 170, 90,  90};
  else if (strcmp(code, "FINE_PINCH")       == 0) pose = {155, 155, 0,   0,   45,  90};
  else if (strcmp(code, "CYLINDRICAL_GRIP") == 0) pose = {145, 155, 150, 160, 90,  90};
  else if (strcmp(code, "WRIST_FLEX")       == 0) pose = {0,   0,   0,   0,   90,  45};
  else if (strcmp(code, "WRIST_EXT")        == 0) pose = {0,   0,   0,   0,   90,  135};
  else if (strcmp(code, "PRONATION")        == 0) pose = {0,   0,   0,   0,   90,  0};
  else if (strcmp(code, "SUPINATION")       == 0) pose = {0,   0,   0,   0,   90,  180};
  applyPose();
  Serial.printf("[GESTO] %s\n", code);
}

void applyPose() {
  sThumbFlex.write(pose.thumbFlex);
  sIndexFlex.write(pose.indexFlex);
  sMidFlex.write(pose.midFlex);
  sRingPinky.write(pose.ringPinky);
  sThumbAddu.write(pose.thumbAddu);
  sWristRot.write(pose.wristRot);
}

void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      wsConnected = true;
      ws.sendTXT("{\"type\":\"device_connect\",\"device\":\"esp32-s3\",\"channels\":3}");
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

      if (strcmp(t, "command") == 0) {
        const char* g = doc["gesture"];
        if (g) { setGesture(g); manualUntil = millis() + MANUAL_LOCK_MS; }

      } else if (strcmp(t, "stop") == 0) {
        setGesture("HAND_OPEN");
        manualUntil = millis() + MANUAL_LOCK_MS;

      } else if (strcmp(t, "set_threshold") == 0) {
        // La app puede ajustar el umbral en caliente para calibrar
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
