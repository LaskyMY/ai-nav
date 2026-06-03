// ESP32-C3 — WiFiManager配网 + BLE控制 + HTTP API
// 库依赖: WiFiManager (tzapu), 通过Arduino库管理器安装
// Board: ESP32C3 Dev Module, Partition: Huge App (3MB No OTA)
#include <WiFi.h>
#include <WiFiManager.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// ── BLE UUIDs ──
#define SVC     "12345678-1234-1234-1234-123456789abc"
#define CH_LED  "12345678-1234-1234-1234-123456789001"
#define CH_BUZZ "12345678-1234-1234-1234-123456789002"
#define CH_INFO "12345678-1234-1234-1234-123456789004"
#define CH_KEY  "12345678-1234-1234-1234-123456789005"

// ── Pin Definitions ──
#define PIN_R   4
#define PIN_G   5
#define PIN_B   6
#define PIN_BZ  7
#define PIN_LED 8
#define PIN_K0  0
#define PIN_K1  1
#define PIN_K2  2
#define PIN_K3  3

WiFiServer http(80);
WiFiManager wm;
Preferences prefs;
bool wifiOK = false;
String myIP = "";
BLECharacteristic *pInfoChar = nullptr;
BLECharacteristic *pKeyChar = nullptr;
unsigned long startMs = 0;

// ── RGB LED ──
void setLED(int r, int g, int b) {
  analogWrite(PIN_R, r);
  analogWrite(PIN_G, g);
  analogWrite(PIN_B, b);
}

// ── Active Buzzer ──
void buzzActive(int mode) {
  if (mode == 1) digitalWrite(PIN_BZ, HIGH);          // ON
  else if (mode == 2) digitalWrite(PIN_BZ, LOW);       // OFF
  else if (mode == 3) {                                // Short beep
    digitalWrite(PIN_BZ, HIGH); delay(300);
    digitalWrite(PIN_BZ, LOW);
  }
  else if (mode == 4) {                                // LED flash test
    for (int i = 0; i < 3; i++) {
      digitalWrite(PIN_LED, !digitalRead(PIN_LED));
      delay(150);
    }
    digitalWrite(PIN_LED, HIGH);
  }
}

// ── Passive Buzzer ──
void buzzTone(int freq, int dur) {
  if (freq < 20 || freq > 20000) return;
  tone(PIN_BZ, freq, dur);
}

void buzzMelody() {
  int notes[] = {523, 587, 659, 698, 784, 880, 988, 1047};
  for (int i = 0; i < 8; i++) {
    tone(PIN_BZ, notes[i], 150);
    delay(180);
  }
  noTone(PIN_BZ);
}

// ── Keypad ──
int lastKey[4] = {-1, -1, -1, -1};
void readKeys() {
  int pins[4] = {PIN_K0, PIN_K1, PIN_K2, PIN_K3};
  for (int i = 0; i < 4; i++) {
    int v = digitalRead(pins[i]);
    int state = (v == LOW) ? 1 : 0;
    if (state != lastKey[i]) {
      lastKey[i] = state;
      if (pKeyChar) {
        char buf[8];
        snprintf(buf, 8, "%d:%d", i, state);
        pKeyChar->setValue(buf);
        pKeyChar->notify();
      }
    }
  }
}

// ── System Info ──
void infoUpdate() {
  if (!pInfoChar) return;
  char buf[96];
  snprintf(buf, 96, "WiFi:%s IP:%s Up:%lus RSSI:%d Free:%lu",
    wifiOK ? "OK" : "NO",
    wifiOK ? myIP.c_str() : "-",
    (unsigned long)((millis() - startMs) / 1000),
    wifiOK ? WiFi.RSSI() : 0,
    ESP.getFreeHeap());
  pInfoChar->setValue(buf);
  pInfoChar->notify();
}

// ── HTTP Handlers ──
void handleHTTP(WiFiClient &c, String &req) {
  String hdr = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: application/json; charset=utf-8\r\n\r\n";

  if (req.indexOf("/api/status") >= 0 || req.indexOf("/api/info") >= 0) {
    String json = "{\"wifi\":";
    json += wifiOK ? "true" : "false";
    json += ",\"ip\":\"" + myIP + "\"";
    json += ",\"uptime\":" + String((millis() - startMs) / 1000);
    json += ",\"rssi\":" + String(wifiOK ? WiFi.RSSI() : 0);
    json += ",\"freeHeap\":" + String(ESP.getFreeHeap()) + "}";
    c.print(hdr + json);
  }
  else if (req.indexOf("/api/led") >= 0) {
    int ri = 0, gi = 0, bi = 0;
    auto gp = [&](const char* k, int& v) {
      int i = req.indexOf(String(k) + "=");
      if (i >= 0) { i += strlen(k) + 1; v = req.substring(i).toInt(); }
    };
    gp("r", ri); gp("g", gi); gp("b", bi);
    ri = constrain(ri, 0, 255); gi = constrain(gi, 0, 255); bi = constrain(bi, 0, 255);
    setLED(ri, gi, bi);
    c.print(hdr + "{\"status\":\"ok\",\"r\":" + String(ri) + ",\"g\":" + String(gi) + ",\"b\":" + String(bi) + "}");
  }
  else if (req.indexOf("/api/buzzer") >= 0) {
    int cmd = 0, freq = 0, dur = 0;
    auto gp = [&](const char* k, int& v) {
      int i = req.indexOf(String(k) + "=");
      if (i >= 0) { i += strlen(k) + 1; v = req.substring(i).toInt(); }
    };
    gp("cmd", cmd);
    if (cmd >= 1 && cmd <= 4) {
      buzzActive(cmd);
      c.print(hdr + "{\"status\":\"ok\",\"cmd\":" + String(cmd) + ",\"type\":\"active\"}");
    } else if (cmd == 5) {
      gp("freq", freq); gp("dur", dur);
      if (freq > 0 && dur > 0) buzzTone(freq, dur);
      c.print(hdr + "{\"status\":\"ok\",\"cmd\":5,\"freq\":" + String(freq) + ",\"dur\":" + String(dur) + ",\"type\":\"passive\"}");
    } else if (cmd == 6) {
      buzzMelody();
      c.print(hdr + "{\"status\":\"ok\",\"cmd\":6,\"type\":\"melody\"}");
    } else {
      c.print(hdr + "{\"status\":\"error\",\"msg\":\"unknown cmd\"}");
    }
  }
  else if (req.indexOf("/api/breath") >= 0) {
    c.print(hdr + "{\"status\":\"breathing\"}");
    for (int b = 0; b <= 255; b += 5) { setLED(0, b/2, b); delay(20); }
    for (int b = 255; b >= 0; b -= 5) { setLED(0, b/2, b); delay(20); }
    setLED(0, 0, 0);
  }
  else if (req.indexOf("/api/reset") >= 0) {
    c.print(hdr + "{\"status\":\"resetting\"}");
    wm.resetSettings();
    delay(500);
    ESP.restart();
  }
  else {
    c.print(hdr + "{\"name\":\"AI-NAV-C3\",\"endpoints\":[\"/api/status\",\"/api/led?r=&g=&b=\",\"/api/buzzer?cmd=&freq=&dur=\",\"/api/breath\",\"/api/reset\"]}");
  }
}

// ── BLE Callbacks ──
class LEDCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v.length() == 3) {
      setLED((uint8_t)v[0], (uint8_t)v[1], (uint8_t)v[2]);
    } else if (v.length() == 1) {
      uint8_t cmd = (uint8_t)v[0];
      if (cmd == 5) {  // Breathing
        for (int b = 0; b <= 255; b += 5) { setLED(0, b/2, b); delay(20); }
        for (int b = 255; b >= 0; b -= 5) { setLED(0, b/2, b); delay(20); }
        setLED(0, 0, 0);
      } else if (cmd == 6) { setLED(0, 0, 0); } // Off
    }
  }
};

class BuzzCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v.length() == 0) return;
    uint8_t cmd = (uint8_t)v[0];
    if (cmd >= 1 && cmd <= 4) { buzzActive(cmd); }
    else if (cmd == 5 && v.length() >= 5) {
      int freq = (uint8_t)v[1] | ((uint8_t)v[2] << 8);
      int dur  = (uint8_t)v[3] | ((uint8_t)v[4] << 8);
      buzzTone(freq, dur);
    }
    else if (cmd == 6) { buzzMelody(); }
  }
};

class InfoCB : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *p) { infoUpdate(); }
};

// ── WiFiManager: 自定义配置页面 ──
void setupWiFiManager() {
  wm.setDebugOutput(false);
  wm.setCaptivePortalEnable(true);
  wm.setAPCallback([](WiFiManager *myWM) {
    Serial.println("AP Mode: AI-NAV-C3-Setup");
    Serial.println("IP: 192.168.4.1");
    // LED flash to indicate AP mode
    for (int i = 0; i < 5; i++) {
      digitalWrite(PIN_LED, LOW); delay(200);
      digitalWrite(PIN_LED, HIGH); delay(200);
    }
  });
  wm.setSaveConfigCallback([]() {
    Serial.println("WiFi saved — restarting...");
  });

  // Custom menu items (optional)
  std::vector<const char *> menu = {"wifi", "info", "sep", "restart"};
  wm.setMenu(menu);
}

// ── Setup ──
void setup() {
  Serial.begin(115200);
  startMs = millis();

  // GPIO
  pinMode(PIN_R, OUTPUT); pinMode(PIN_G, OUTPUT); pinMode(PIN_B, OUTPUT);
  setLED(0, 0, 0);
  pinMode(PIN_BZ, OUTPUT); digitalWrite(PIN_BZ, LOW);
  pinMode(PIN_LED, OUTPUT); digitalWrite(PIN_LED, HIGH);
  pinMode(PIN_K0, INPUT_PULLUP); pinMode(PIN_K1, INPUT_PULLUP);
  pinMode(PIN_K2, INPUT_PULLUP); pinMode(PIN_K3, INPUT_PULLUP);

  // ── WiFi via WiFiManager ──
  setupWiFiManager();

  // Try saved credentials first, if fail → AP mode
  wifiOK = wm.autoConnect("AI-NAV-C3-Setup");

  if (wifiOK) {
    myIP = WiFi.localIP().toString();
    http.begin();
    Serial.println("WiFi OK: " + myIP);
    digitalWrite(PIN_LED, LOW);  // LED ON = connected
  } else {
    Serial.println("WiFi failed — running offline");
    digitalWrite(PIN_LED, HIGH); // LED OFF = no WiFi
  }

  // ── BLE Setup ──
  BLEDevice::init("AI-NAV-C3");
  BLEServer *bs = BLEDevice::createServer();
  BLEService *svc = bs->createService(SVC);

  svc->createCharacteristic(CH_LED, BLECharacteristic::PROPERTY_WRITE)
     ->setCallbacks(new LEDCB());

  svc->createCharacteristic(CH_BUZZ, BLECharacteristic::PROPERTY_WRITE)
     ->setCallbacks(new BuzzCB());

  pInfoChar = svc->createCharacteristic(CH_INFO,
     BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pInfoChar->setCallbacks(new InfoCB());

  pKeyChar = svc->createCharacteristic(CH_KEY,
     BLECharacteristic::PROPERTY_NOTIFY);

  svc->start();

  BLEAdvertising *adv = bs->getAdvertising();
  adv->addServiceUUID(SVC);
  adv->setScanResponse(true);
  adv->start();

  infoUpdate();
  Serial.println("AI-NAV-C3 Ready");
  Serial.print("Free heap: "); Serial.println(ESP.getFreeHeap());
}

// ── Loop ──
void loop() {
  // WiFiManager portal (if in AP mode)
  wm.process();

  // HTTP server
  if (wifiOK) {
    WiFiClient c = http.available();
    if (c) {
      String req = c.readStringUntil('\n');
      if (req.length() > 0) handleHTTP(c, req);
      c.stop();
    }
  }

  // Keypad polling
  static unsigned long lastKey = 0;
  if (millis() - lastKey > 50) {
    lastKey = millis();
    readKeys();
  }

  // Periodic info update
  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 30000) {
    lastInfo = millis();
    infoUpdate();
  }

  delay(5);
}
