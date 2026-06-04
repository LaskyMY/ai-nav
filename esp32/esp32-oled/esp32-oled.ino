// ESP32-C3 + SSD1306 OLED Dashboard — U8g2 专业仪表盘
// 库: U8g2 (Arduino库管理器安装 "U8g2 by oliver")
// OLED: 0.96" 128x64 I2C, SDA=GPIO5 SCL=GPIO6
#include <WiFi.h>
#include <Preferences.h>
#include <Wire.h>
#include <U8g2lib.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

// ── OLED ──
U8G2_SSD1306_128X64_NONAME_F_HW_I2C u8g2(U8G2_R0, /*reset=*/U8X8_PIN_NONE, /*clock=*/6, /*data=*/5);

// ── BLE UUIDs ──
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

// Display state
int screenMode = 0;       // 0=system info, 1=message, 2=WiFi detail, 3=animation
String dispMsg = "";
unsigned long animStart = 0;
int animFrame = 0;

// ── Dashboard Rendering ──
void drawHeader() {
  u8g2.setFont(u8g2_font_6x10_tf);

  // WiFi icon + RSSI
  int cx = 4;
  if (wifiOK) {
    int rssi = WiFi.RSSI();
    u8g2.drawStr(cx, 9, wifiOK ? "W" : "w");
  } else {
    u8g2.drawStr(cx, 9, "w");
  }

  // BT icon
  u8g2.drawStr(20, 9, "B");

  // Time
  char tbuf[12];
  unsigned long up = (millis() - startMs) / 1000;
  int h = up / 3600, m = (up % 3600) / 60, s = up % 60;
  snprintf(tbuf, 12, "%02d:%02d:%02d", h, m, s);
  u8g2.setFont(u8g2_font_7x14_tf);
  int tw = u8g2.getStrWidth(tbuf);
  u8g2.drawStr(128 - tw - 2, 13, tbuf);

  // Separator line
  u8g2.drawHLine(0, 15, 128);
}

void drawSysInfo() {
  drawHeader();
  u8g2.setFont(u8g2_font_6x10_tf);

  // WiFi status
  u8g2.setCursor(0, 26);
  u8g2.print("WiFi: ");
  u8g2.print(wifiOK ? "OK  " + myIP : "---");

  // BT status
  u8g2.setCursor(0, 36);
  u8g2.print("BLE:  AI-NAV-OLED");

  // Memory
  u8g2.setCursor(0, 46);
  u8g2.print("Free: ");
  u8g2.print(ESP.getFreeHeap() / 1024);
  u8g2.print(" KB");

  // RSSI bar
  u8g2.setCursor(0, 56);
  if (wifiOK) {
    int rssi = WiFi.RSSI();
    u8g2.print("RSSI: ");
    u8g2.print(rssi);
    u8g2.print(" dBm");
    // Signal bar
    int bars = (rssi > -50) ? 5 : (rssi > -60) ? 4 : (rssi > -70) ? 3 : (rssi > -80) ? 2 : (rssi > -90) ? 1 : 0;
    int sx = 80;
    for (int i = 0; i < 5; i++) {
      int h = 3 + i * 3;
      if (i < bars) u8g2.drawBox(sx + i * 6, 50 - h, 4, h);
      else u8g2.drawFrame(sx + i * 6, 50 - h, 4, h);
    }
  } else {
    u8g2.print("No WiFi");
  }
}

void drawMessage() {
  drawHeader();
  u8g2.setFont(u8g2_font_6x10_tf);

  if (dispMsg.length() == 0) {
    u8g2.setCursor(10, 40);
    u8g2.print("Waiting for message...");
    return;
  }

  // Print message with basic wrapping
  int y = 24;
  int ci = 0;
  String line = "";
  while (ci < dispMsg.length() && y < 62) {
    char c = dispMsg[ci];
    if (c == '\n' || line.length() > 20) {
      u8g2.setCursor(0, y);
      // Only print ASCII chars
      for (int j = 0; j < line.length(); j++) {
        if ((uint8_t)line[j] < 128) u8g2.print(line[j]);
        else u8g2.print('?');
      }
      y += 12;
      line = "";
      if (c != '\n') line += c;
    } else {
      if ((uint8_t)c >= 32 && (uint8_t)c < 128) line += c;
    }
    ci++;
  }
  // Remaining
  if (line.length() > 0 && y < 62) {
    u8g2.setCursor(0, y);
    for (int j = 0; j < line.length(); j++) {
      if ((uint8_t)line[j] < 128) u8g2.print(line[j]);
    }
  }
}

void drawWiFiDetail() {
  drawHeader();
  u8g2.setFont(u8g2_font_6x10_tf);

  if (wifiOK) {
    u8g2.setCursor(0, 26); u8g2.print("SSID: " + WiFi.SSID());
    u8g2.setCursor(0, 36); u8g2.print("IP:   " + myIP);
    u8g2.setCursor(0, 46); u8g2.print("RSSI: " + String(WiFi.RSSI()) + " dBm");
    u8g2.setCursor(0, 56); u8g2.print("Host: AI-NAV-OLED");
  } else {
    u8g2.setCursor(0, 30); u8g2.print("WiFi Not Connected");
    u8g2.setCursor(0, 44); u8g2.print("Use BLE to configure");
    u8g2.setCursor(0, 54); u8g2.print("Open esp32-oled.html");
  }
}

void drawAnimation() {
  drawHeader();

  int elapsed = (millis() - animStart) / 50;
  int frame = elapsed % 16;

  u8g2.setFont(u8g2_font_10x20_tf);

  // Bouncing loading dots
  for (int i = 0; i < 3; i++) {
    int dotX = 30 + i * 25;
    int dotY = 30 + (sin((elapsed + i * 5) * 0.3) * 10);
    u8g2.drawDisc(dotX, dotY, 4);
  }

  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.setCursor(10, 56);
  u8g2.print(frame % 4 < 2 ? "Processing" : "Processing.");
  u8g2.print(frame % 4 < 1 ? "." : frame % 4 < 2 ? ".." : frame % 4 < 3 ? "..." : "");
}

// ── Main render loop ──
void renderDisplay() {
  u8g2.clearBuffer();
  switch (screenMode) {
    case 0: drawSysInfo(); break;
    case 1: drawMessage(); break;
    case 2: drawWiFiDetail(); break;
    case 3: drawAnimation(); break;
    default: drawSysInfo(); break;
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
    auto gp = [&](const char* k, String& v) {
      int i = req.indexOf(String(k)+"="); if(i>=0){i+=strlen(k)+1;int e=req.indexOf('&',i);if(e<0)e=req.indexOf(' ',i);if(e<0)e=req.length();v=req.substring(i,e);}
    };
    String txt, icon;
    gp("t", txt); gp("i", icon);
    if (txt.length() > 0) { dispMsg = txt; screenMode = 1; }
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
    if (v == "SYS") { screenMode = 0; return; }
    if (v == "MSG") { screenMode = 1; return; }
    if (v == "WIFI") { screenMode = 2; return; }
    if (v == "ANIM") { screenMode = 3; animStart = millis(); return; }
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
    // Default: treat as message
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
  u8g2.setContrast(128);

  // Boot screen
  u8g2.clearBuffer();
  u8g2.setFont(u8g2_font_10x20_tf);
  u8g2.drawStr(20, 30, "AI NAV");
  u8g2.setFont(u8g2_font_6x10_tf);
  u8g2.drawStr(25, 50, "Booting...");
  u8g2.sendBuffer();
  delay(1200);

  // Try saved WiFi
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

// ── Loop ──
unsigned long lastRender = 0;
void loop() {
  if (wifiOK) {
    WiFiClient c = http.available();
    if (c) { String req = c.readStringUntil('\n'); if (req.length() > 0) handleHTTP(c, req); c.stop(); }
  }

  // Render display at ~30fps (animation mode) or 2fps (other modes)
  unsigned long interval = (screenMode == 3) ? 33 : 500;
  if (millis() - lastRender > interval) {
    lastRender = millis();
    renderDisplay();
  }

  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 30000) { lastInfo = millis(); infoUpdate(); }

  delay(5);
}
