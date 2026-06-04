// ESP32-C3 + SSD1306 OLED — BLE配网 + BLE屏幕控制 + HTTP API
// 库依赖: Adafruit SSD1306, Adafruit GFX (Arduino库管理器安装)
// OLED: 0.96" 128x64 I2C, SDA=GPIO6, SCL=GPIO7
// Board: ESP32C3 Dev Module, Partition: Huge App (3MB No OTA)
#include <WiFi.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include <Adafruit_GFX.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// ── OLED ──
#define OLED_ADDR 0x3C
#define OLED_SDA  5
#define OLED_SCL  6
#define SCREEN_W  128
#define SCREEN_H  64
Adafruit_SSD1306 display(SCREEN_W, SCREEN_H, &Wire, -1);

// ── BLE UUIDs ──
#define SVC      "12345678-1234-1234-1234-123456789abc"
#define CH_WIFI  "12345678-1234-1234-1234-123456789003"
#define CH_INFO  "12345678-1234-1234-1234-123456789004"
#define CH_WDATA "12345678-1234-1234-1234-123456789006"
#define CH_OLED  "12345678-1234-1234-1234-123456789007"  // OLED control

WiFiServer http(80);
Preferences prefs;
bool wifiOK = false;
String myIP = "";
BLECharacteristic *pInfoChar = nullptr;
BLECharacteristic *pWifiDataChar = nullptr;
unsigned long startMs = 0;

// ── OLED Drawing ──
void oledClear() {
  display.clearDisplay();
  display.display();
}

void oledPrint(String text) {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  // Split text by \n, auto-wrap
  int y = 0;
  String line = "";
  for (int i = 0; i <= text.length(); i++) {
    char c = (i < text.length()) ? text[i] : '\n';
    if (c == '\n' || display.getCursorX() + 6 > SCREEN_W) {
      display.setCursor(0, y);
      display.print(line);
      y += 10;
      line = "";
      if (y >= SCREEN_H) break;
      if (c != '\n') line += c;
    } else {
      line += c;
    }
  }
  display.display();
}

void oledDrawIcon(String icon) {
  int cx = SCREEN_W / 2, cy = SCREEN_H / 2;

  if (icon == "wifi" || icon == "wifi_on") {
    // WiFi signal arcs
    display.fillCircle(cx, cy + 8, 4, SSD1306_WHITE);
    display.fillCircle(cx, cy + 8, 1, SSD1306_BLACK);
    for (int i = 0; i < 3; i++) {
      int r = 10 + i * 8;
      display.drawCircle(cx, cy + 8, r, SSD1306_WHITE);
      // Mask bottom half
      display.fillRect(cx - r - 2, cy + 8, r * 2 + 4, r + 2, SSD1306_BLACK);
    }
  }
  else if (icon == "bt" || icon == "bluetooth") {
    // Bluetooth rune
    int bx = cx - 3, by = cy - 12;
    display.drawLine(bx + 6, by, bx, by + 12, SSD1306_WHITE);
    display.drawLine(bx + 6, by + 24, bx, by + 12, SSD1306_WHITE);
    display.drawLine(bx + 6, by, bx + 6, by + 24, SSD1306_WHITE);
    display.drawLine(bx + 3, by + 6, bx + 3, by + 18, SSD1306_WHITE);
  }
  else if (icon == "ok" || icon == "check") {
    // Checkmark
    display.drawLine(cx - 12, cy, cx - 4, cy + 10, SSD1306_WHITE);
    display.drawLine(cx - 4, cy + 10, cx + 14, cy - 12, SSD1306_WHITE);
  }
  else if (icon == "x" || icon == "fail") {
    display.drawLine(cx - 10, cy - 10, cx + 10, cy + 10, SSD1306_WHITE);
    display.drawLine(cx + 10, cy - 10, cx - 10, cy + 10, SSD1306_WHITE);
  }
  else if (icon == "arrow_up") {
    display.fillTriangle(cx, cy - 14, cx - 10, cy + 6, cx + 10, cy + 6, SSD1306_WHITE);
  }
  else if (icon == "arrow_down") {
    display.fillTriangle(cx, cy + 14, cx - 10, cy - 6, cx + 10, cy - 6, SSD1306_WHITE);
  }
  else if (icon == "heart") {
    display.fillCircle(cx - 6, cy - 4, 6, SSD1306_WHITE);
    display.fillCircle(cx + 6, cy - 4, 6, SSD1306_WHITE);
    display.fillTriangle(cx - 12, cy - 2, cx + 12, cy - 2, cx, cy + 14, SSD1306_WHITE);
  }
  else if (icon == "star") {
    for (int i = 0; i < 5; i++) {
      float a = -PI/2 + i * 2*PI/5;
      float a2 = -PI/2 + (i + 2) * 2*PI/5;
      int x1 = cx + 16 * cos(a), y1 = cy + 16 * sin(a);
      int x2 = cx + 7 * cos(a2), y2 = cy + 7 * sin(a2);
      display.drawLine(x1, y1, x2, y2, SSD1306_WHITE);
    }
  }
  else if (icon == "sun") {
    display.fillCircle(cx, cy, 10, SSD1306_WHITE);
    for (int i = 0; i < 8; i++) {
      float a = i * PI/4;
      int x1 = cx + 14 * cos(a), y1 = cy + 14 * sin(a);
      int x2 = cx + 20 * cos(a), y2 = cy + 20 * sin(a);
      display.drawLine(x1, y1, x2, y2, SSD1306_WHITE);
    }
  }
  else if (icon == "moon") {
    display.fillCircle(cx + 4, cy, 12, SSD1306_WHITE);
    display.fillCircle(cx, cy - 4, 12, SSD1306_BLACK);
  }
  else if (icon == "bolt") {
    display.fillTriangle(cx - 4, cy - 16, cx + 4, cy - 2, cx - 6, cy - 2, SSD1306_WHITE);
    display.fillTriangle(cx + 4, cy - 2, cx - 4, cy + 16, cx + 8, cy + 16, SSD1306_WHITE);
  }
  else if (icon == "bell") {
    display.fillCircle(cx, cy - 6, 10, SSD1306_WHITE);
    display.fillRect(cx - 3, cy + 2, 6, 8, SSD1306_WHITE);
    display.fillCircle(cx, cy - 4, 6, SSD1306_BLACK);
    display.drawLine(cx, cy - 14, cx, cy - 18, SSD1306_WHITE);
    display.drawLine(cx - 2, cy - 16, cx + 2, cy - 16, SSD1306_WHITE);
  }
  else {
    // Unknown icon — show "?"
    display.setTextSize(2);
    display.setCursor(cx - 8, cy - 10);
    display.print("?");
  }
  display.display();
}

void oledSysInfo() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  display.print(wifiOK ? "WiFi: OK" : "WiFi: NO");
  display.setCursor(0, 12);
  display.print(wifiOK ? ("IP:" + myIP).c_str() : "IP: ---");
  display.setCursor(0, 24);
  char uptime[20];
  snprintf(uptime, 20, "Up: %lus", (unsigned long)((millis() - startMs) / 1000));
  display.print(uptime);
  display.setCursor(0, 36);
  display.print("RSSI: " + String(wifiOK ? WiFi.RSSI() : 0) + " dBm");
  display.setCursor(0, 48);
  display.print("Free: " + String(ESP.getFreeHeap() / 1024) + " KB");

  // Draw a small signal bar on the right
  if (wifiOK) {
    int rssi = WiFi.RSSI();
    int bars = (rssi > -50) ? 4 : (rssi > -60) ? 3 : (rssi > -70) ? 2 : (rssi > -80) ? 1 : 0;
    for (int i = 0; i < 4; i++) {
      int h = 4 + i * 4;
      if (i < bars) display.fillRect(118, 56 - h, 6, h, SSD1306_WHITE);
      else display.drawRect(118, 56 - h, 6, h, SSD1306_WHITE);
    }
  }

  display.display();
}

// ── System Info via BLE ──
void infoUpdate() {
  if (!pInfoChar) return;
  char buf[128];
  snprintf(buf, 128, "WiFi:%s IP:%s Up:%lus RSSI:%d Free:%lu",
    wifiOK ? "OK" : "NO", wifiOK ? myIP.c_str() : "-",
    (unsigned long)((millis() - startMs) / 1000),
    wifiOK ? WiFi.RSSI() : 0, ESP.getFreeHeap());
  pInfoChar->setValue(buf); pInfoChar->notify();
}

// ── WiFi Scan ──
void doWiFiScan() {
  if (!pWifiDataChar) return;
  pWifiDataChar->setValue("SCANNING");
  pWifiDataChar->notify();

  int n = WiFi.scanNetworks(false, true);
  String json = "[";
  for (int i = 0; i < n && i < 20; i++) {
    if (i > 0) json += ",";
    String ssid = WiFi.SSID(i);
    ssid.replace("\"", "\\\"");
    json += "{\"s\":\"" + ssid + "\",\"r\":" + String(WiFi.RSSI(i)) + ",\"o\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? 1 : 0) + "}";
  }
  json += "]";
  WiFi.scanDelete();

  pWifiDataChar->setValue(json.c_str());
  pWifiDataChar->notify();
}

// ── WiFi Connect ──
void doWiFiConnect(String ssid, String pass) {
  if (!pWifiDataChar) return;

  prefs.begin("ainav", false);
  prefs.putString("ssid", ssid);
  prefs.putString("pass", pass);
  prefs.end();

  pWifiDataChar->setValue("CONNECTING");
  pWifiDataChar->notify();

  WiFi.begin(ssid.c_str(), pass.c_str());
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 30) { delay(500); t++; }

  if (WiFi.status() == WL_CONNECTED) {
    wifiOK = true;
    myIP = WiFi.localIP().toString();
    http.begin();
    pWifiDataChar->setValue(("OK:" + myIP).c_str());
    pWifiDataChar->notify();
    oledSysInfo();
    Serial.println("WiFi OK: " + myIP);
  } else {
    WiFi.disconnect(true);
    pWifiDataChar->setValue("FAIL");
    pWifiDataChar->notify();
    oledPrint("WiFi Failed\nCheck password");
    Serial.println("WiFi failed");
  }
  infoUpdate();
}

// ── HTTP Handlers ──
void handleHTTP(WiFiClient &c, String &req) {
  String hdr = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: application/json; charset=utf-8\r\n\r\n";

  if (req.indexOf("/api/status") >= 0) {
    String json = "{\"wifi\":";
    json += wifiOK ? "true" : "false";
    json += ",\"ip\":\"" + myIP + "\"";
    json += ",\"uptime\":" + String((millis() - startMs) / 1000);
    json += ",\"rssi\":" + String(wifiOK ? WiFi.RSSI() : 0);
    json += ",\"freeHeap\":" + String(ESP.getFreeHeap()) + "}";
    c.print(hdr + json);
  }
  else if (req.indexOf("/api/oled") >= 0) {
    // /api/oled?t=Hello  or  /api/oled?i=wifi
    String txt = "";
    String icon = "";
    auto gp = [&](const char* k, String& v) {
      int i = req.indexOf(String(k) + "=");
      if (i >= 0) { i += strlen(k) + 1; int e = req.indexOf('&', i); if (e < 0) e = req.indexOf(' ', i); if (e < 0) e = req.length(); v = req.substring(i, e); }
    };
    gp("t", txt); gp("i", icon);
    if (txt.length() > 0) { txt.replace("%20", " "); oledPrint(txt); }
    else if (icon.length() > 0) oledDrawIcon(icon);
    c.print(hdr + "{\"status\":\"ok\"}");
  }
  else if (req.indexOf("/api/resetwifi") >= 0) {
    c.print(hdr + "{\"status\":\"resetting\"}");
    WiFi.disconnect(true);
    prefs.begin("ainav", false); prefs.clear(); prefs.end();
    delay(500); ESP.restart();
  }
  else {
    c.print(hdr + "{\"name\":\"AI-NAV-OLED\",\"endpoints\":[\"/api/status\",\"/api/oled?t=text\",\"/api/oled?i=icon\",\"/api/resetwifi\"]}");
  }
}

// ── BLE Callbacks ──
class WiFiCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v == "SCAN") {
      doWiFiScan();
    } else if (v.startsWith("W:") && v.indexOf("|") > 2) {
      String body = v.substring(2);
      int sep = body.indexOf("|");
      doWiFiConnect(body.substring(0, sep), body.substring(sep + 1));
    }
  }
};

class OLEDCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v.length() == 0) return;

    if (v == "C") { oledClear(); return; }
    if (v == "S") { oledSysInfo(); return; }

    // Check for icon command: "I:iconname"
    if (v.startsWith("I:") && v.length() > 2) {
      oledDrawIcon(v.substring(2));
      return;
    }

    // Check for text command: "T:text"
    if (v.startsWith("T:") && v.length() > 2) {
      oledPrint(v.substring(2));
      return;
    }

    // Default: treat as plain text
    oledPrint(v);
  }
};

class InfoCB : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *p) { infoUpdate(); }
};

// ── Setup ──
void setup() {
  Serial.begin(115200);
  startMs = millis();

  // OLED init
  Wire.begin(OLED_SDA, OLED_SCL);
  if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
    Serial.println("OLED init failed!");
  } else {
    display.clearDisplay();
    display.setTextSize(2);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(20, 20);
    display.print("AI NAV");
    display.display();
    delay(1000);
    oledSysInfo();
  }

  // Try saved WiFi
  prefs.begin("ainav", false);
  String savedSSID = prefs.getString("ssid", "");
  String savedPass = prefs.getString("pass", "");
  prefs.end();

  if (savedSSID.length() > 0) {
    WiFi.begin(savedSSID.c_str(), savedPass.c_str());
    int t = 0;
    while (WiFi.status() != WL_CONNECTED && t < 40) { delay(250); t++; }
    if (WiFi.status() == WL_CONNECTED) {
      wifiOK = true; myIP = WiFi.localIP().toString(); http.begin();
      oledSysInfo();
    } else {
      WiFi.disconnect(true);
    }
  }

  // BLE
  BLEDevice::init("AI-NAV-OLED");
  BLEServer *bs = BLEDevice::createServer();
  BLEService *svc = bs->createService(SVC);

  svc->createCharacteristic(CH_WIFI, BLECharacteristic::PROPERTY_WRITE)
     ->setCallbacks(new WiFiCB());
  svc->createCharacteristic(CH_OLED, BLECharacteristic::PROPERTY_WRITE)
     ->setCallbacks(new OLEDCB());

  pInfoChar = svc->createCharacteristic(CH_INFO,
     BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pInfoChar->setCallbacks(new InfoCB());

  pWifiDataChar = svc->createCharacteristic(CH_WDATA,
     BLECharacteristic::PROPERTY_NOTIFY);

  svc->start();
  BLEAdvertising *adv = bs->getAdvertising();
  adv->addServiceUUID(SVC);
  adv->setScanResponse(true);
  adv->start();

  infoUpdate();
  Serial.println("AI-NAV-OLED Ready");
  Serial.print("Free heap: "); Serial.println(ESP.getFreeHeap());
}

void loop() {
  if (wifiOK) {
    WiFiClient c = http.available();
    if (c) { String req = c.readStringUntil('\n'); if (req.length() > 0) handleHTTP(c, req); c.stop(); }
  }

  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 30000) { lastInfo = millis(); infoUpdate(); }

  delay(5);
}
