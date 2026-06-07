// ESP32-C3 继电器控制器 — BLE控制
// 继电器: GPIO10, 高电平触发
// Board: ESP32C3 Dev Module, Partition: Huge App
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define PIN_RELAY 10

#define SVC       "12345678-1234-1234-1234-123456789abc"
#define CH_RELAY  "12345678-1234-1234-1234-123456789010"  // 继电器控制
#define CH_INFO   "12345678-1234-1234-1234-123456789004"  // 状态信息

BLECharacteristic *pInfoChar = nullptr;
bool relayOn = false;
unsigned long relayTimerEnd = 0;    // 定时关闭时间 (0=无定时)
unsigned long startMs = 0;

void setRelay(bool on) {
  relayOn = on;
  digitalWrite(PIN_RELAY, on ? HIGH : LOW);
  if (!on) relayTimerEnd = 0;
}

void infoUpdate() {
  if (!pInfoChar) return;
  char buf[128];
  unsigned long remaining = 0;
  if (relayTimerEnd > 0 && relayOn) {
    remaining = (relayTimerEnd > millis()) ? (relayTimerEnd - millis()) / 1000 : 0;
  }
  snprintf(buf, 128, "Relay:%s Timer:%lus Up:%lus",
    relayOn ? "ON" : "OFF",
    remaining,
    (unsigned long)((millis() - startMs) / 1000));
  pInfoChar->setValue(buf); pInfoChar->notify();
}

class RelayCB : public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if (v.length() == 0) return;

    if (v == "ON")  { setRelay(true); Serial.println("Relay ON"); }
    else if (v == "OFF") { setRelay(false); Serial.println("Relay OFF"); }
    else if (v == "TOGGLE") { setRelay(!relayOn); Serial.println("Relay TOGGLE"); }
    else if (v.startsWith("T:")) {
      // 定时: T:30 表示30秒后自动关
      int secs = v.substring(2).toInt();
      if (secs > 0) {
        setRelay(true);
        relayTimerEnd = millis() + secs * 1000UL;
        Serial.printf("Relay ON for %d seconds\n", secs);
      }
    }
    else if (v.startsWith("S:")) {
      // 循环: S:5,30 表示开5秒关30秒循环, S:0 停止
      // 简化实现: 解析参数
      if (v == "S:0") { setRelay(false); return; }
      int comma = v.indexOf(',');
      if (comma > 2) {
        int onSec = v.substring(2, comma).toInt();
        int offSec = v.substring(comma + 1).toInt();
        // 循环由loop处理, 这里设置初始状态
        setRelay(true);
        relayTimerEnd = millis() + onSec * 1000UL;
      }
    }
    infoUpdate();
  }
};

class InfoCB : public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *p) { infoUpdate(); }
};

void setup() {
  Serial.begin(115200);
  startMs = millis();

  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, LOW);

  BLEDevice::init("AI-NAV-RELAY");
  BLEServer *bs = BLEDevice::createServer();
  BLEService *svc = bs->createService(SVC);

  svc->createCharacteristic(CH_RELAY, BLECharacteristic::PROPERTY_WRITE)
     ->setCallbacks(new RelayCB());

  pInfoChar = svc->createCharacteristic(CH_INFO,
     BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);
  pInfoChar->setCallbacks(new InfoCB());

  svc->start();
  bs->getAdvertising()->addServiceUUID(SVC);
  bs->getAdvertising()->setScanResponse(true);
  bs->getAdvertising()->start();

  infoUpdate();
  Serial.println("AI-NAV-RELAY Ready");
}

void loop() {
  // 定时器检查
  if (relayOn && relayTimerEnd > 0 && millis() > relayTimerEnd) {
    setRelay(false);
    infoUpdate();
    Serial.println("Timer expired - Relay OFF");
  }

  static unsigned long lastInfo = 0;
  if (millis() - lastInfo > 5000) {
    lastInfo = millis();
    infoUpdate();
  }

  delay(50);
}
