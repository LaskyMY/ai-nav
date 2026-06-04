// ESP32-C3 + SSD1306 OLED — 基于已验证的C3固件
// BLE配网 + BLE OLED控制 + HTTP API
// OLED: 0.96" SSD1306 I2C, SDA=GPIO5 SCL=GPIO6
// Board: ESP32C3 Dev Module, Partition: Huge App
#include <WiFi.h>
#include <Preferences.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);

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
String dispMsg = "";
int screenMode = 0;

// ── OLED ──
void oledInfo() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  if (wifiOK) {
    display.println("WiFi OK");
    display.println(myIP);
  } else {
    display.println("WiFi: OFF");
    display.println("Use BLE to config");
    display.println("Open esp32-oled.html");
  }
  unsigned long up = (millis() - startMs) / 1000;
  display.printf("Up: %02lu:%02lu:%02lu\n", up/3600, (up%3600)/60, up%60);
  display.printf("Free: %lu KB", ESP.getFreeHeap()/1024);
  display.display();
}

void oledMsg() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);
  for (int i = 0; i < dispMsg.length() && i < 300; i++) {
    char c = dispMsg[i];
    if (c == '\n') {
      int y = display.getCursorY() + 10;
      if (y < 64) display.setCursor(0, y);
    } else if ((uint8_t)c >= 32 && (uint8_t)c < 128) {
      display.print(c);
    }
  }
  display.display();
}

void oledUpdate() {
  if (screenMode == 0) oledInfo();
  else oledMsg();
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
    oledUpdate();
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
    String json = "{\"wifi\":";
    json += wifiOK ? "true" : "false";
    json += ",\"ip\":\"" + myIP + "\"";
    json += ",\"uptime\":" + String((millis() - startMs) / 1000);
    json += ",\"rssi\":" + String(wifiOK ? WiFi.RSSI() : 0);
    json += ",\"freeHeap\":" + String(ESP.getFreeHeap()) + "}";
    c.print(hdr + json);
  } else if (req.indexOf("/api/oled") >= 0) {
    int ti = req.indexOf("t=");
    if (ti >= 0) {
      String txt = req.substring(ti + 2);
      int ei = txt.indexOf('&'); if (ei < 0) ei = txt.indexOf(' '); if (ei < 0) ei = txt.length();
      dispMsg = txt.substring(0, ei);
      screenMode = 1;
      oledUpdate();
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
    if (v == "INFO") { screenMode = 0; oledUpdate(); return; }
    if (v.startsWith("T:") && v.length() > 2) { dispMsg = v.substring(2); screenMode = 1; oledUpdate(); return; }
    dispMsg = v; screenMode = 1; oledUpdate();
  }
};

class InfoCB : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *p) { infoUpdate(); }
};

// ── Setup ──
void setup() {
  Serial.begin(115200);
  startMs = millis();

  // OLED
  Wire.begin(5, 6);
  if (!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) {
    Serial.println("OLED FAIL");
  }
  display.clearDisplay();
  display.setTextSize(2);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(20, 20);
  display.print("AI NAV");
  display.display();
  delay(1000);

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
  oledUpdate();
  Serial.println("Ready");
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
