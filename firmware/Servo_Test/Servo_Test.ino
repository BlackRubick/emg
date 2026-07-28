#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

const char* WIFI_SSID = "wifi";
const char* WIFI_PASS = "contra";
const char* WS_HOST   = "192.168.1.XXX";
const int   WS_PORT   = 3000;
const char* WS_PATH   = "/_ws";

Servo servo1, servo2, servo3, servo4, servo5;
Servo* servos[5] = {&servo1, &servo2, &servo3, &servo4, &servo5};

const int pines[5] = {4, 5, 6, 7, 15};
const char* nombres[5] = {"Servo1", "Servo2", "Servo3", "Servo4", "Servo5"};

// Posiciones actuales — mapeo directo a los campos de currentPose en la web
// índice:  0=thumbFlex  1=indexFlex  2=midFlex  3=ringPinky  4=thumbAddu
int posActual[5] = {0, 0, 0, 0, 90};
int servoActual  = 0;  // índice del servo que se está probando ahora

WebSocketsClient ws;
bool wsConnected = false;

void sendServoUpdate() {
  if (!wsConnected) return;
  char buf[200];
  snprintf(buf, sizeof(buf),
    "{\"type\":\"servo_update\","
    "\"thumbFlex\":%d,\"indexFlex\":%d,"
    "\"midFlex\":%d,\"ringPinky\":%d,\"thumbAddu\":%d}",
    posActual[0], posActual[1], posActual[2], posActual[3], posActual[4]);
  ws.sendTXT(buf);
}

void onWsEvent(WStype_t type, uint8_t* payload, size_t length) {
  if (type == WStype_CONNECTED) {
    wsConnected = true;
    ws.sendTXT("{\"type\":\"device_connect\",\"device\":\"esp32-s3\",\"channels\":1}");
    Serial.println("[WS] Conectado al servidor");
  } else if (type == WStype_DISCONNECTED) {
    wsConnected = false;
    Serial.println("[WS] Desconectado");
  }
}

// WebSocket + stream de señal — corre en Core 0 para no interferir con delay()
void wsTask(void* param) {
  unsigned long lastSend = 0;
  while (true) {
    ws.loop();
    unsigned long now = millis();
    // Envía el ángulo del servo activo como señal al osciloscópio (~250 Hz)
    // Server divide env/10 y YMAX=100 → multiplicamos x5 para ocupar 0-90% del canvas
    if (wsConnected && now - lastSend >= 4) {
      lastSend = now;
      int amp = posActual[servoActual] * 5;
      char buf[80];
      snprintf(buf, sizeof(buf), "{\"type\":\"ecg_data\",\"t\":%lu,\"ch\":[%d]}", now, amp);
      ws.sendTXT(buf);
    }
    delay(2);
  }
}

void setup() {
  Serial.begin(115200);
  delay(500);
  Serial.println("Iniciando prueba AISLADA de servos...");

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
    xTaskCreatePinnedToCore(wsTask, "wsTask", 4096, NULL, 1, NULL, 0);
  } else {
    Serial.println("\nWiFi falló — modo standalone");
  }
}

void loop() {
  for (int i = 0; i < 5; i++) {
    servoActual = i;
    Serial.print(">>> Probando SOLO ");
    Serial.print(nombres[i]);
    Serial.print(" (GPIO ");
    Serial.print(pines[i]);
    Serial.println(")");

    // Conecta únicamente el servo actual
    servos[i]->setPeriodHertz(50);
    servos[i]->attach(pines[i], 500, 2400);

    servos[i]->write(0);
    posActual[i] = 0; sendServoUpdate();
    Serial.println("  -> 0°");
    delay(1000);

    servos[i]->write(90);
    posActual[i] = 90; sendServoUpdate();
    Serial.println("  -> 90°");
    delay(1000);

    servos[i]->write(180);
    posActual[i] = 180; sendServoUpdate();
    Serial.println("  -> 180°");
    delay(1000);

    servos[i]->write(0);
    posActual[i] = 0; sendServoUpdate();
    delay(1000);

    // Desconecta antes de pasar al siguiente
    servos[i]->detach();
    Serial.println("---");
    delay(500);
  }

  Serial.println("Ciclo completo.\n");
  delay(2000);
}
