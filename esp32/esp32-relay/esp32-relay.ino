// ESP32-C3 专业继电器控制器
// 功能: BLE控制 + WiFi配网(NTP校时) + 定时调度(时间/星期) + 状态上报
// 继电器: GPIO10 高电平触发
#include <WiFi.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>
#include <time.h>

#define PIN_RELAY 10

#define SVC       "12345678-1234-1234-1234-123456789abc"
#define CH_RELAY  "12345678-1234-1234-1234-123456789010"
#define CH_INFO   "12345678-1234-1234-1234-123456789004"
#define CH_WIFI   "12345678-1234-1234-1234-123456789003"
#define CH_WDATA  "12345678-1234-1234-1234-123456789006"

Preferences prefs;
WiFiServer http(80);
bool wifiOK = false;
String myIP = "";
BLECharacteristic *pInfoChar = nullptr;
BLECharacteristic *pWifiDataChar = nullptr;
unsigned long startMs = 0;

// ── Relay State ──
bool relayOn = false;
unsigned long scheduleEndMs = 0;       // 定时关闭时刻 (millis), 0=无
int scheduleDays[7] = {0};             // 星期几启用 (0=周日..6=周六)
int scheduleHour = -1, scheduleMin = -1; // 定时开启的时分, -1=未设置
int scheduleDurSec = 0;                // 定时开启后持续秒数

// ── NTP Time ──
const char* ntpServer = "pool.ntp.org";
unsigned long lastNtpMs = 0;
struct tm timeinfo;

bool getTime(struct tm &ti) {
  if (!wifiOK) return false;
  // Refresh NTP every hour
  if (millis() - lastNtpMs > 3600000) {
    configTime(8*3600, 0, ntpServer, "time.nist.gov");
    lastNtpMs = millis();
  }
  return getLocalTime(&ti, 100);
}

// ── Relay Control ──
void setRelay(bool on) {
  relayOn = on;
  digitalWrite(PIN_RELAY, on ? HIGH : LOW);
  if (!on) { scheduleEndMs = 0; infoUpdate(); }
}

// ── System Info ──
void infoUpdate() {
  if (!pInfoChar) return;
  char buf[200];
  unsigned long remainSec = 0;
  if (relayOn && scheduleEndMs > 0 && scheduleEndMs > millis()) {
    remainSec = (scheduleEndMs - millis()) / 1000;
  }

  String sched = "none";
  if (scheduleHour >= 0) {
    sched = String(scheduleHour) + ":" + (scheduleMin < 10 ? "0" : "") + String(scheduleMin) + ":" + String(scheduleDurSec);
  }

  snprintf(buf, 200, "Relay:%s Remain:%lus Up:%lus WiFi:%s IP:%s Sched:%s",
    relayOn ? "ON" : "OFF",
    remainSec,
    (unsigned long)((millis() - startMs) / 1000),
    wifiOK ? "OK" : "NO",
    wifiOK ? myIP.c_str() : "-",
    sched.c_str());
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
    json += "{\"s\":\"" + WiFi.SSID(i) + "\",\"r\":" + String(WiFi.RSSI(i)) + "}";
  }
  json += "]";
  WiFi.scanDelete();
  pWifiDataChar->setValue(json.c_str()); pWifiDataChar->notify();
}

// ── WiFi Connect ──
void doWiFiConnect(String ssid, String pass) {
  if (!pWifiDataChar) return;
  pWifiDataChar->setValue("CONNECTING"); pWifiDataChar->notify();

  WiFi.begin(ssid.c_str(), pass.c_str());
  int t = 0;
  while (WiFi.status() != WL_CONNECTED && t < 40) { delay(500); t++; }

  if (WiFi.status() == WL_CONNECTED) {
    wifiOK = true;
    myIP = WiFi.localIP().toString();
    http.begin();
    // Save credentials
    prefs.begin("relay", false);
    prefs.putString("ssid", ssid);
    prefs.putString("pass", pass);
    prefs.end();
    // Sync time
    configTime(8*3600, 0, ntpServer);
    lastNtpMs = millis();
    pWifiDataChar->setValue(("OK:" + myIP).c_str());
  } else {
    WiFi.disconnect(true);
    pWifiDataChar->setValue("FAIL");
  }
  pWifiDataChar->notify();
  infoUpdate();
}

// ── BLE Callbacks ──
class RelayCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v.length() == 0) return;

    if (v == "ON")       { setRelay(true); }
    else if (v == "OFF") { setRelay(false); }
    else if (v == "TOGGLE") { setRelay(!relayOn); }
    else if (v.startsWith("T:")) {
      // 秒数倒计时: T:30
      int secs = v.substring(2).toInt();
      if (secs > 0) {
        setRelay(true);
        scheduleEndMs = millis() + secs * 1000UL;
      }
    }
    else if (v.startsWith("SCHED:")) {
      // 调度: SCHED:8,30,60,1,2,3,4,5
      // 每天8:30开启60秒, 周一到周五
      // SCHED:0 取消调度
      if (v == "SCHED:0") {
        scheduleHour = -1; scheduleMin = -1; scheduleDurSec = 0;
        for (int i = 0; i < 7; i++) scheduleDays[i] = 0;
        Serial.println("Schedule cleared");
      } else {
        // Parse: H,M,DUR,D1,D2,...
        String params = v.substring(6);
        int comma1 = params.indexOf(',');
        int comma2 = params.indexOf(',', comma1 + 1);
        if (comma1 > 0 && comma2 > 0) {
          scheduleHour = params.substring(0, comma1).toInt();
          scheduleMin  = params.substring(comma1 + 1, comma2).toInt();
          String rest = params.substring(comma2 + 1);
          int comma3 = rest.indexOf(',');
          if (comma3 > 0) {
            scheduleDurSec = rest.substring(0, comma3).toInt();
            String days = rest.substring(comma3 + 1);
            for (int i = 0; i < 7; i++) scheduleDays[i] = 0;
            int idx = 0;
            while (idx < days.length()) {
              int c = days.indexOf(',', idx);
              if (c < 0) c = days.length();
              int d = days.substring(idx, c).toInt();
              if (d >= 0 && d <= 6) scheduleDays[d] = 1;
              idx = c + 1;
            }
          }
        }
        Serial.printf("Schedule: %02d:%02d for %ds\n", scheduleHour, scheduleMin, scheduleDurSec);
      }
    }
    infoUpdate();
  }
};

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

class InfoCB : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *p) { infoUpdate(); }
};

// ── Check Schedule ──
void checkSchedule() {
  if (scheduleHour < 0 || !wifiOK) return;

  struct tm ti;
  if (!getTime(ti)) return;

  // Check if today is enabled
  if (!scheduleDays[ti.tm_wday]) return;

  // Check if it's time to trigger (within this minute)
  if (ti.tm_hour == scheduleHour && ti.tm_min == scheduleMin && ti.tm_sec < 5) {
    if (!relayOn) {
      setRelay(true);
      if (scheduleDurSec > 0) {
        scheduleEndMs = millis() + scheduleDurSec * 1000UL;
      }
      Serial.println("Schedule triggered!");
      infoUpdate();
    }
  }
}

// ── Setup ──
void setup() {
  Serial.begin(115200);
  startMs = millis();

  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, LOW);

  // Try saved WiFi
  prefs.begin("relay", false);
  String ssid = prefs.getString("ssid", "");
  String pass = prefs.getString("pass", "");
  prefs.end();

  if (ssid.length() > 0) {
    WiFi.begin(ssid.c_str(), pass.c_str());
    int t = 0;
    while (WiFi.status() != WL_CONNECTED && t < 20) { delay(500); t++; }
    if (WiFi.status() == WL_CONNECTED) {
      wifiOK = true;
      myIP = WiFi.localIP().toString();
      http.begin();
      configTime(8*3600, 0, ntpServer);
      lastNtpMs = millis();
    } else {
      WiFi.disconnect(true);
    }
  }

  // BLE
  BLEDevice::init("AI-NAV-RELAY");
  BLEServer *bs = BLEDevice::createServer();
  BLEService *svc = bs->createService(SVC);

  svc->createCharacteristic(CH_RELAY, BLECharacteristic::PROPERTY_WRITE)
     ->setCallbacks(new RelayCB());
  svc->createCharacteristic(CH_WIFI, BLECharacteristic::PROPERTY_WRITE)
     ->setCallbacks(new WiFiCB());

  pInfoChar = svc->createCharacteristic(CH_INFO,
     BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pInfoChar->setCallbacks(new InfoCB());

  pWifiDataChar = svc->createCharacteristic(CH_WDATA,
     BLECharacteristic::PROPERTY_NOTIFY);

  svc->start();
  bs->getAdvertising()->addServiceUUID(SVC);
  bs->getAdvertising()->setScanResponse(true);
  bs->getAdvertising()->start();

  infoUpdate();
  Serial.println("AI-NAV-RELAY Ready");
}

// ── Loop ──
void loop() {
  // Timer expiry
  if (relayOn && scheduleEndMs > 0 && millis() > scheduleEndMs) {
    setRelay(false);
    Serial.println("Timer expired - Relay OFF");
  }

  // Schedule check
  checkSchedule();

  // HTTP
  if (wifiOK) {
    WiFiClient c = http.available();
    if (c) { c.stop(); }
  }

  // Periodic status update
  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 3000) {
    lastInfo = millis();
    infoUpdate();
  }

  delay(50);
}
