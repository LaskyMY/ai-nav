// ESP32-C3 + SSD1306 OLED Dashboard — U8g2
// OLED: 0.96" 128x64 I2C, SDA=GPIO5 SCL=GPIO6
// Library: U8g2 by oliver (Arduino Library Manager)
#include <WiFi.h>
#include <Preferences.h>
#include <U8g2lib.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, U8X8_PIN_NONE, 6, 5);

#define SVC      "12345678-1234-1234-1234-123456789abc"
#define CH_WIFI  "12345678-1234-1234-1234-123456789003"
#define CH_INFO  "12345678-1234-1234-1234-123456789004"
#define CH_WDATA "12345678-1234-1234-1234-123456789006"
#define CH_OLED  "12345678-1234-1234-1234-123456789007"

WiFiServer http(80);
Preferences prefs;
bool wifiOK = false;
String myIP = "";
BLECharacteristic *pInfoChar = nullptr;
BLECharacteristic *pWifiDataChar = nullptr;
unsigned long startMs = 0;
int screenMode = 0;
String dispMsg = "";
unsigned long animStart = 0;

// ── Helper: draw text with top-left origin ──
void drawText(int x, int y, const char* str) {
  // U8g2 drawStr uses baseline Y. Add font ascent to get top-aligned
  u8g2.drawStr(x + 2, y + 10, str);
}

// ── Header bar ──
void drawHeader() {
  char buf[20];
  unsigned long up = (millis() - startMs) / 1000;
  snprintf(buf, 20, "%02lu:%02lu:%02lu", up / 3600, (up % 3600) / 60, up % 60);

  // Left: status icons
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(2, 10, "W");  // WiFi icon placeholder
  u8g2.drawStr(16, 10, "B"); // BT icon placeholder

  // Right: time
  u8g2.drawStr(90, 10, buf);

  // Separator
  u8g2.drawHLine(0, 12, 128);
}

// ── Screen 0: System Info ──
void drawSysInfo() {
  drawHeader();
  u8g2.setFont(u8g2_font_6x10_tf);

  // WiFi row
  u8g2.drawStr(2, 24, "WiFi:");
  u8g2.drawStr(36, 24, wifiOK ? (wifiOK ? myIP.c_str() : "OK") : "OFF");

  // IP row
  if (wifiOK) {
    u8g2.drawStr(2, 36, "IP:");
    u8g2.drawStr(24, 36, myIP.c_str());
  } else {
    u8g2.drawStr(2, 36, "Scan WiFi via BLE");
  }

  // Memory
  char mbuf[20];
  snprintf(mbuf, 20, "Free: %lu KB", ESP.getFreeHeap() / 1024);
  u8g2.drawStr(2, 48, mbuf);

  // RSSI bar
  if (wifiOK) {
    u8g2.drawStr(2, 60, "Sig:");
    int rssi = WiFi.RSSI();
    int bars = constrain((rssi + 90) / 8, 0, 10);
    for (int i = 0; i < bars; i++) {
      u8g2.drawBox(36 + i * 7, 50, 5, 10);
    }
    for (int i = bars; i < 10; i++) {
      u8g2.drawFrame(36 + i * 7, 50, 5, 10);
    }
    char rbuf[10];
    snprintf(rbuf, 10, "%d", rssi);
    u8g2.drawStr(110, 60, rbuf);
  } else {
    u8g2.drawStr(2, 60, "Ready");
  }
}

// ── Screen 1: Message ──
void drawMessage() {
  drawHeader();
  u8g2.setFont(u8g2_font_6x10_tf);

  if (dispMsg.length() == 0) {
    int tw = u8g2.getStrWidth("No message");
    u8g2.drawStr((128 - tw) / 2, 40, "No message");
    return;
  }

  // Filter non-ASCII
  String clean;
  for (int i = 0; i < dispMsg.length(); i++) {
    uint8_t c = (uint8_t)dispMsg[i];
    if (c == '\n' || (c >= 32 && c < 128)) clean += (char)c;
  }

  // Print with line wrap
  int y = 24;
  int start = 0;
  int col = 0;
  for (int i = 0; i <= clean.length(); i++) {
    char c = (i < clean.length()) ? clean[i] : '\n';
    if (c == '\n' || col >= 21) {
      if (i > start) {
        u8g2.drawStr(2, y, clean.substring(start, i).c_str());
        y += 12;
      }
      start = i + (c == '\n' ? 1 : 0);
      col = 0;
      if (y > 60) break;
    } else {
      col++;
    }
  }
}

// ── Screen 2: WiFi Detail ──
void drawWiFiDetail() {
  drawHeader();
  u8g2.setFont(u8g2_font_6x10_tf);

  if (!wifiOK) {
    u8g2.drawStr(2, 30, "WiFi: Not Connected");
    u8g2.drawStr(2, 44, "Use web page to scan");
    u8g2.drawStr(2, 56, "and connect via BLE");
    return;
  }

  u8g2.drawStr(2, 24, ("SSID: " + WiFi.SSID()).c_str());
  u8g2.drawStr(2, 38, ("IP:   " + myIP).c_str());
  char rbuf[20];
  snprintf(rbuf, 20, "RSSI: %d dBm", WiFi.RSSI());
  u8g2.drawStr(2, 52, rbuf);
}

// ── Screen 3: Animation ──
void drawAnimation() {
  drawHeader();

  int t = (millis() - animStart) / 30;
  u8g2.setFont(u8g2_font_10x20_tf);

  // 3 bouncing dots centered
  for (int i = 0; i < 3; i++) {
    int dx = 44 + i * 22;
    int dy = 30 + (int)(sin((t + i * 4) * 0.25) * 10);
    u8g2.drawDisc(dx, dy, 4);
  }

  u8g2.setFont(u8g2_font_6x10_tf);
  int dots = (t / 8) % 4;
  String msg = "Loading";
  for (int i = 0; i < dots; i++) msg += ".";
  int tw = u8g2.getStrWidth(msg.c_str());
  u8g2.drawStr((128 - tw) / 2, 60, msg.c_str());
}

// ── Main render ──
void renderDisplay() {
  u8g2.clearBuffer();
  switch (screenMode) {
    case 0: drawSysInfo(); break;
    case 1: drawMessage(); break;
    case 2: drawWiFiDetail(); break;
    case 3: drawAnimation(); break;
  }
  u8g2.sendBuffer();
}

// ── System Info ──
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
  pWifiDataChar->setValue("SCANNING"); pWifiDataChar->notify();
  int n = WiFi.scanNetworks(false, true);
  String json = "[";
  for (int i = 0; i < n && i < 20; i++) {
    if (i > 0) json += ",";
    json += "{\"s\":\"" + WiFi.SSID(i) + "\",\"r\":" + String(WiFi.RSSI(i)) + ",\"o\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? 1 : 0) + "}";
  }
  json += "]";
  WiFi.scanDelete();
  pWifiDataChar->setValue(json.c_str()); pWifiDataChar->notify();
}

// ── WiFi Connect ──
void doWiFiConnect(String ssid, String pass) {
  if (!pWifiDataChar) return;
  prefs.begin("ainav", false);
  prefs.putString("ssid", ssid); prefs.putString("pass", pass);
  prefs.end();

  pWifiDataChar->setValue("CONNECTING"); pWifiDataChar->notify();
  WiFi.begin(ssid.c_str(), pass.c_str());
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 30) { delay(500); t++; }

  if (WiFi.status() == WL_CONNECTED) {
    wifiOK = true; myIP = WiFi.localIP().toString(); http.begin();
    pWifiDataChar->setValue(("OK:" + myIP).c_str()); pWifiDataChar->notify();
    screenMode = 0;
  } else {
    WiFi.disconnect(true);
    pWifiDataChar->setValue("FAIL"); pWifiDataChar->notify();
  }
  infoUpdate();
}

// ── HTTP ──
void handleHTTP(WiFiClient &c, String &req) {
  String hdr = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: application/json; charset=utf-8\r\n\r\n";
  if (req.indexOf("/api/status") >= 0) {
    c.print(hdr + "{\"wifi\":" + String(wifiOK?"true":"false") + ",\"ip\":\"" + myIP + "\",\"uptime\":" + String((millis()-startMs)/1000) + "}");
  } else if (req.indexOf("/api/oled") >= 0) {
    int ti = req.indexOf("t=");
    if (ti >= 0) {
      String txt = req.substring(ti + 2);
      int ei = txt.indexOf('&'); if (ei < 0) ei = txt.indexOf(' '); if (ei < 0) ei = txt.length();
      dispMsg = txt.substring(0, ei);
      screenMode = 1;
    }
    c.print(hdr + "{\"status\":\"ok\"}");
  } else {
    c.print(hdr + "{\"name\":\"AI-NAV-OLED\"}");
  }
}

// ── BLE Callbacks ──
class WiFiCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v == "SCAN") { doWiFiScan(); return; }
    if (v.startsWith("W:") && v.indexOf("|") > 2) {
      String body = v.substring(2);
      int sep = body.indexOf("|");
      doWiFiConnect(body.substring(0, sep), body.substring(sep + 1));
      return;
    }
  }
};

class OLEDCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v.length() == 0) return;
    if (v == "SYS") { screenMode = 0; return; }
    if (v == "MSG") { screenMode = 1; return; }
    if (v == "WIFI") { screenMode = 2; return; }
    if (v == "ANIM") { screenMode = 3; animStart = millis(); return; }
    if (v.startsWith("T:") && v.length() > 2) { dispMsg = v.substring(2); screenMode = 1; return; }
    dispMsg = v; screenMode = 1;
  }
};

class InfoCB : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *p) { infoUpdate(); }
};

// ── Setup ──
void setup() {
  Serial.begin(115200); startMs = millis();
  u8g2.begin();
  u8g2.setContrast(200);

  // Boot screen
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_10x20_tf);
  int tw = u8g2.getStrWidth("AI NAV");
  u8g2.drawStr((128 - tw) / 2, 35, "AI NAV");
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(35, 55, "Booting...");
  u8g2.sendBuffer();
  delay(1500);

  // WiFi
  prefs.begin("ainav", false);
  String ssid = prefs.getString("ssid", ""), pass = prefs.getString("pass", "");
  prefs.end();
  if (ssid.length() > 0) {
    WiFi.begin(ssid.c_str(), pass.c_str());
    int t = 0; while (WiFi.status() != WL_CONNECTED && t < 40) { delay(250); t++; }
    if (WiFi.status() == WL_CONNECTED) { wifiOK = true; myIP = WiFi.localIP().toString(); http.begin(); }
    else { WiFi.disconnect(true); }
  }

  // BLE
  BLEDevice::init("AI-NAV-OLED");
  BLEServer *bs = BLEDevice::createServer();
  BLEService *svc = bs->createService(SVC);
  svc->createCharacteristic(CH_WIFI, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new WiFiCB());
  svc->createCharacteristic(CH_OLED, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new OLEDCB());
  pInfoChar = svc->createCharacteristic(CH_INFO, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pInfoChar->setCallbacks(new InfoCB());
  pWifiDataChar = svc->createCharacteristic(CH_WDATA, BLECharacteristic::PROPERTY_NOTIFY);
  svc->start();
  bs->getAdvertising()->addServiceUUID(SVC);
  bs->getAdvertising()->setScanResponse(true);
  bs->getAdvertising()->start();
  infoUpdate();
  Serial.println("Ready");
}

unsigned long lastRender = 0;
void loop() {
  if (wifiOK) {
    WiFiClient c = http.available();
    if (c) { String req = c.readStringUntil('\n'); if (req.length() > 0) handleHTTP(c, req); c.stop(); }
  }
  unsigned long interval = (screenMode == 3) ? 33 : 500;
  if (millis() - lastRender > interval) { lastRender = millis(); renderDisplay(); }
  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 30000) { lastInfo = millis(); infoUpdate(); }
  delay(5);
}
