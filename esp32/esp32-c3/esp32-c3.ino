// ESP32-C3 BLE — Simple: only LED + Buzzer
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SVC_UUID "12345678-1234-1234-1234-123456789abc"
#define CH_LED   "12345678-1234-1234-1234-123456789001"
#define CH_BUZZ  "12345678-1234-1234-1234-123456789002"

#define PIN_R 4
#define PIN_G 5
#define PIN_B 6
#define PIN_BZ 7
#define PIN_LED 8

bool devConn = false;

class CB: public BLEServerCallbacks {
  void onConnect(BLEServer* p) { devConn = true; digitalWrite(PIN_LED, LOW); }
  void onDisconnect(BLEServer* p) { devConn = false; digitalWrite(PIN_LED, HIGH); p->startAdvertising(); }
};

class LEDCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if(v.length()>=3){analogWrite(PIN_R,(uint8_t)v[0]);analogWrite(PIN_G,(uint8_t)v[1]);analogWrite(PIN_B,(uint8_t)v[2]);}
  }
};

class BuzzCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    uint8_t v = p->getValue()[0];
    if(v==1) digitalWrite(PIN_BZ, HIGH);
    else if(v==2) digitalWrite(PIN_BZ, LOW);
    else if(v==3) { digitalWrite(PIN_BZ, HIGH); delay(300); digitalWrite(PIN_BZ, LOW); }
    else if(v==4) { digitalWrite(PIN_LED, !digitalRead(PIN_LED)); }
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(PIN_R,OUTPUT);pinMode(PIN_G,OUTPUT);pinMode(PIN_B,OUTPUT);analogWrite(PIN_R,0);analogWrite(PIN_G,0);analogWrite(PIN_B,0);
  pinMode(PIN_BZ,OUTPUT);digitalWrite(PIN_BZ,LOW);
  pinMode(PIN_LED,OUTPUT);digitalWrite(PIN_LED,HIGH);
  BLEDevice::init("AI-NAV-C3");
  BLEServer *s=BLEDevice::createServer();s->setCallbacks(new CB());
  BLEService *svc=s->createService(SVC_UUID);
  svc->createCharacteristic(CH_LED,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new LEDCB());
  svc->createCharacteristic(CH_BUZZ,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new BuzzCB());
  svc->start();s->getAdvertising()->start();
  Serial.println("BLE Ready");
}
void loop() { delay(100); }
