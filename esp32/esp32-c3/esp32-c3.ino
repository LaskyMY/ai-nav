// ESP32-C3 BLE — Passive Buzzer PWM tone control on GPIO7
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SVC_UUID "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CH_LED "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CH_FREQ "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define CH_VOL "beb5483e-36e1-4688-b7f5-ea07361b26ab"
#define CH_PLAY "beb5483e-36e1-4688-b7f5-ea07361b26ac"
#define CH_STOP "beb5483e-36e1-4688-b7f5-ea07361b26ad"
#define CH_KEYS "beb5483e-36e1-4688-b7f5-ea07361b26ae"

#define PIN_R 4
#define PIN_G 5
#define PIN_B 6
#define PIN_BZ 7
#define PIN_LED 8

BLECharacteristic *pKeyChar;
bool devConn = false;
uint8_t lastKeys = 0xFF;
int curFreq = 1000, curDuty = 30;
bool bzOn = false;

class SvrCB: public BLEServerCallbacks {
  void onConnect(BLEServer* p) { devConn = true; }
  void onDisconnect(BLEServer* p) { devConn = false; p->startAdvertising(); }
};

class LEDCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if(v.length()>=3){analogWrite(PIN_R,(uint8_t)v[0]);analogWrite(PIN_G,(uint8_t)v[1]);analogWrite(PIN_B,(uint8_t)v[2]);}
  }
};

void toneSet(int f, int d) {
  if(f<=0){ledcWriteTone(0,0);bzOn=false;return;}
  ledcWriteTone(0,f);ledcWrite(0,d);bzOn=true;curFreq=f;curDuty=d;
}

class FreqCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();if(v.length()<2)return;
    curFreq=(uint8_t)v[0]|((uint8_t)v[1]<<8);
    if(bzOn)toneSet(curFreq,curDuty);
  }
};

class VolCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();if(v.length()<1)return;
    curDuty=(uint8_t)v[0];
    if(bzOn)toneSet(curFreq,curDuty);
  }
};

class PlayCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();if(v.length()<3)return;
    int f=(uint8_t)v[0]|((uint8_t)v[1]<<8);
    int d=(uint8_t)v[2]*100;
    toneSet(f,curDuty);delay(d);toneSet(0,0);
  }
};

class StopCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) { toneSet(0,0); }
};

void setup() {
  Serial.begin(115200);
  pinMode(PIN_R,OUTPUT);pinMode(PIN_G,OUTPUT);pinMode(PIN_B,OUTPUT);
  analogWrite(PIN_R,0);analogWrite(PIN_G,0);analogWrite(PIN_B,0);
  pinMode(PIN_LED,OUTPUT);digitalWrite(PIN_LED,HIGH);
  pinMode(0,INPUT_PULLUP);pinMode(1,INPUT_PULLUP);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);

  ledcAttach(PIN_BZ, 2000, 8);ledcWriteTone(0,0);

  BLEDevice::init("AI-NAV-C3");
  BLEServer *s=BLEDevice::createServer();s->setCallbacks(new SvrCB());
  BLEService *svc=s->createService(SVC_UUID);
  svc->createCharacteristic(CH_LED,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new LEDCB());
  svc->createCharacteristic(CH_FREQ,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new FreqCB());
  svc->createCharacteristic(CH_VOL,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new VolCB());
  svc->createCharacteristic(CH_PLAY,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new PlayCB());
  svc->createCharacteristic(CH_STOP,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new StopCB());
  pKeyChar=svc->createCharacteristic(CH_KEYS,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  svc->start();s->getAdvertising()->start();
}

void loop() {
  uint8_t k=0;
  if(digitalRead(0)==LOW)k|=1;if(digitalRead(1)==LOW)k|=2;
  if(digitalRead(2)==LOW)k|=4;if(digitalRead(3)==LOW)k|=8;
  if(k!=lastKeys&&devConn){pKeyChar->setValue(&k,1);pKeyChar->notify();lastKeys=k;}
  delay(30);
}
