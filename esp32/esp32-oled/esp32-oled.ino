// 诊断固件: 测试I2C是否干扰BLE
// SDA=GPIO5 SCL=GPIO6
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

// ⚡ 关键: 延迟I2C初始化
bool i2cStarted = false;

void initI2C_late() {
  if (i2cStarted) return;
  Wire.begin(5, 6);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0,0);
  display.println("OLED OK");
  display.display();
  i2cStarted = true;
  Serial.println("I2C started late");
}

void infoUpdate() {
  if (!pInfoChar) return;
  char buf[128];
  snprintf(buf, 128, "WiFi:%s IP:%s Up:%lus RSSI:%d Free:%lu",
    wifiOK ? "OK" : "NO", wifiOK ? myIP.c_str() : "-",
    (unsigned long)((millis() - startMs) / 1000),
    wifiOK ? WiFi.RSSI() : 0, ESP.getFreeHeap());
  pInfoChar->setValue(buf); pInfoChar->notify();
}

void doWiFiScan() {
  if (!pWifiDataChar) return;
  pWifiDataChar->setValue("SCANNING"); pWifiDataChar->notify();
  int n = WiFi.scanNetworks(false, true);
  String json = "[";
  for (int i = 0; i < n && i < 20; i++) {
    if (i > 0) json += ",";
    json += "{\"s\":\"" + WiFi.SSID(i) + "\",\"r\":" + String(WiFi.RSSI(i)) + ",\"o\":" + String(WiFi.encryptionType(i) != WIFI_AUTH_OPEN ? 1 : 0) + "}";
  }
  json += "]"; WiFi.scanDelete();
  pWifiDataChar->setValue(json.c_str()); pWifiDataChar->notify();
}

void doWiFiConnect(String ssid, String pass) {
  if (!pWifiDataChar) return;
  prefs.begin("ainav", false); prefs.putString("ssid", ssid); prefs.putString("pass", pass); prefs.end();
  pWifiDataChar->setValue("CONNECTING"); pWifiDataChar->notify();
  WiFi.begin(ssid.c_str(), pass.c_str());
  int t = 0; while (WiFi.status() != WL_CONNECTED && t < 30) { delay(500); t++; }
  if (WiFi.status() == WL_CONNECTED) { wifiOK = true; myIP = WiFi.localIP().toString(); http.begin(); pWifiDataChar->setValue(("OK:" + myIP).c_str()); pWifiDataChar->notify(); }
  else { WiFi.disconnect(true); pWifiDataChar->setValue("FAIL"); pWifiDataChar->notify(); }
  infoUpdate();
}

class WiFiCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    Serial.println("BLE WiFiCB: " + v);
    if (v == "SCAN") { doWiFiScan(); return; }
    if (v.startsWith("W:") && v.indexOf("|") > 2) { String body = v.substring(2); int sep = body.indexOf("|"); doWiFiConnect(body.substring(0, sep), body.substring(sep + 1)); return; }
    if (v == "I2C") { initI2C_late(); return; }  // ⚡ 手动触发I2C
  }
};

class OLEDCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    Serial.println("BLE OLEDCB: " + v);
    if (!i2cStarted) { initI2C_late(); delay(100); }
    if (v.length() == 0) return;
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 0);
    for (int i = 0; i < v.length() && i < 200; i++) { char c = v[i]; if ((uint8_t)c >= 32 && (uint8_t)c < 128) display.print(c); }
    display.display();
    Serial.println("Display updated");
  }
};

class InfoCB : public BLECharacteristicCallbacks { void onRead(BLECharacteristic *p) { infoUpdate(); } };

void setup() {
  Serial.begin(115200); startMs = millis();

  // ⚡ 不在这里初始化I2C！等BLE连接后手动触发
  Serial.println("I2C deferred. Send 'I2C' via BLE to init OLED");

  // WiFi
  prefs.begin("ainav", false);
  String ssid = prefs.getString("ssid", ""), pass = prefs.getString("pass", "");
  prefs.end();
  if (ssid.length() > 0) { WiFi.begin(ssid.c_str(), pass.c_str()); int t = 0; while (WiFi.status() != WL_CONNECTED && t < 40) { delay(250); t++; } if (WiFi.status() == WL_CONNECTED) { wifiOK = true; myIP = WiFi.localIP().toString(); http.begin(); } else { WiFi.disconnect(true); } }

  // BLE
  BLEDevice::init("AI-NAV-OLED");
  BLEServer *bs = BLEDevice::createServer();
  BLEService *svc = bs->createService(SVC);
  svc->createCharacteristic(CH_WIFI, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new WiFiCB());
  svc->createCharacteristic(CH_OLED, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new OLEDCB());
  pInfoChar = svc->createCharacteristic(CH_INFO, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY); pInfoChar->setCallbacks(new InfoCB());
  pWifiDataChar = svc->createCharacteristic(CH_WDATA, BLECharacteristic::PROPERTY_NOTIFY);
  svc->start(); bs->getAdvertising()->addServiceUUID(SVC); bs->getAdvertising()->setScanResponse(true); bs->getAdvertising()->start();
  infoUpdate();
  Serial.println("BLE Ready (no I2C yet)");
}

void loop() {
  if (wifiOK) { WiFiClient c = http.available(); if (c) { String req = c.readStringUntil('\n'); if (req.length() > 0) handleHTTP(c, req); c.stop(); } }
  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 30000) { lastInfo = millis(); infoUpdate(); }
  delay(5);
}

void handleHTTP(WiFiClient &c, String &req) {
  String hdr = "HTTP/1.1 200 OK\r\nAccess-Control-Allow-Origin: *\r\nContent-Type: application/json; charset=utf-8\r\n\r\n";
  c.print(hdr + "{\"name\":\"AI-NAV-OLED\"}");
}
