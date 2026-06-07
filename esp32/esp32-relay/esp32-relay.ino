// ESP32-C3 继电器控制器 — 基于已验证C3 BLE栈
#include <WiFi.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define PIN_RELAY 10
#define SVC      "12345678-1234-1234-1234-123456789abc"
#define CH_RELAY "12345678-1234-1234-1234-123456789010"
#define CH_WIFI  "12345678-1234-1234-1234-123456789003"
#define CH_INFO  "12345678-1234-1234-1234-123456789004"
#define CH_WDATA "12345678-1234-1234-1234-123456789006"

WiFiServer http(80);
Preferences prefs;
bool wifiOK = false;
String myIP = "";
BLECharacteristic *pInfoChar = nullptr;
BLECharacteristic *pWifiDataChar = nullptr;
unsigned long startMs = 0;
bool relayOn = false;
unsigned long relayTimerEnd = 0;

void setRelay(bool on) { relayOn = on; digitalWrite(PIN_RELAY, on ? HIGH : LOW); }

void infoUpdate() {
  if (!pInfoChar) return;
  char buf[128];
  snprintf(buf, 128, "Relay:%s WiFi:%s IP:%s Up:%lus RSSI:%d Free:%lu",
    relayOn ? "ON" : "OFF", wifiOK ? "OK" : "NO", wifiOK ? myIP.c_str() : "-",
    (unsigned long)((millis() - startMs) / 1000), wifiOK ? WiFi.RSSI() : 0, ESP.getFreeHeap());
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
  if (WiFi.status() == WL_CONNECTED) { wifiOK = true; myIP = WiFi.localIP().toString(); http.begin(); pWifiDataChar->setValue(("OK:" + myIP).c_str()); }
  else { WiFi.disconnect(true); pWifiDataChar->setValue("FAIL"); }
  pWifiDataChar->notify(); infoUpdate();
}

class RelayCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v == "ON")       { setRelay(true); }
    else if (v == "OFF") { setRelay(false); }
    else if (v == "TOGGLE") { setRelay(!relayOn); }
    else if (v.startsWith("T:")) { int secs = v.substring(2).toInt(); if (secs > 0) { setRelay(true); relayTimerEnd = millis() + secs * 1000UL; } }
    infoUpdate();
  }
};

class WiFiCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v == "SCAN") { doWiFiScan(); }
    else if (v.startsWith("W:") && v.indexOf("|") > 2) { String body = v.substring(2); int sep = body.indexOf("|"); doWiFiConnect(body.substring(0, sep), body.substring(sep + 1)); }
  }
};

class InfoCB : public BLECharacteristicCallbacks { void onRead(BLECharacteristic *p) { infoUpdate(); } };

void setup() {
  Serial.begin(115200); startMs = millis();
  pinMode(PIN_RELAY, OUTPUT); digitalWrite(PIN_RELAY, LOW);
  prefs.begin("ainav", false); String ssid = prefs.getString("ssid", ""), pass = prefs.getString("pass", ""); prefs.end();
  if (ssid.length() > 0) { WiFi.begin(ssid.c_str(), pass.c_str()); int t = 0; while (WiFi.status() != WL_CONNECTED && t < 40) { delay(250); t++; } if (WiFi.status() == WL_CONNECTED) { wifiOK = true; myIP = WiFi.localIP().toString(); http.begin(); } else { WiFi.disconnect(true); } }
  BLEDevice::init("AI-NAV-RELAY");
  BLEServer *bs = BLEDevice::createServer(); BLEService *svc = bs->createService(SVC);
  svc->createCharacteristic(CH_RELAY, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new RelayCB());
  svc->createCharacteristic(CH_WIFI, BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new WiFiCB());
  pInfoChar = svc->createCharacteristic(CH_INFO, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY); pInfoChar->setCallbacks(new InfoCB());
  pWifiDataChar = svc->createCharacteristic(CH_WDATA, BLECharacteristic::PROPERTY_NOTIFY);
  svc->start(); bs->getAdvertising()->addServiceUUID(SVC); bs->getAdvertising()->setScanResponse(true); bs->getAdvertising()->start();
  infoUpdate(); Serial.println("AI-NAV-RELAY Ready");
}

void loop() {
  if (relayOn && relayTimerEnd > 0 && millis() > relayTimerEnd) { setRelay(false); infoUpdate(); }
  if (wifiOK) { WiFiClient c = http.available(); if (c) { c.stop(); } }
  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 3000) { lastInfo = millis(); infoUpdate(); }
  delay(5);
}
