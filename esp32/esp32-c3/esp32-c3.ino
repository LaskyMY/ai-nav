// ESP32-C3 BLE — Multi-mode buzzer test (active + passive)
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SVC "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CH_LED "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CH_CMD "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define CH_KEYS "beb5483e-36e1-4688-b7f5-ea07361b26ab"

#define PIN_R 4
#define PIN_G 5
#define PIN_B 6
#define PIN_BZ 7
#define PIN_LED 8

BLECharacteristic *pKeyChar;
bool devConn = false;
uint8_t lastKeys = 0xFF;

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

// CMD format: [mode, param1, param2]
// mode 0=stop, 1=digital ON, 2=digital OFF, 3=PWM tone(freq), 4=beep(durMs), 5=sweep, 6=LED test
class CmdCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v = p->getValue();
    if(v.length()<1)return;
    uint8_t mode = (uint8_t)v[0];
    int p1 = v.length()>1 ? (uint8_t)v[1] : 0;
    int p2 = v.length()>2 ? (uint8_t)v[2] : 0;

    switch(mode) {
      case 0: // Stop
        ledcWrite(PIN_BZ,0); digitalWrite(PIN_BZ, LOW);
        Serial.println("STOP"); break;
      case 1: // Digital ON (active buzzer)
        ledcWrite(PIN_BZ,0); digitalWrite(PIN_BZ, HIGH);
        Serial.println("DIGITAL ON"); break;
      case 2: // Digital OFF
        digitalWrite(PIN_BZ, LOW);
        Serial.println("DIGITAL OFF"); break;
      case 3: // PWM tone (passive buzzer) — p1=freq/10 Hz
        ledcAttach(PIN_BZ, 2000, 8);
        ledcAttach(PIN_BZ, p1*10, 8);
        ledcWriteTone(PIN_BZ, p1*10);
        ledcWrite(PIN_BZ, p2); // duty
        Serial.printf("PWM: %dHz duty=%d\n", p1*10, p2); break;
      case 4: // Beep: p1=duration*50ms, p2=0=digital,1=PWM
        if(p2==0){digitalWrite(PIN_BZ,HIGH);delay(p1*50);digitalWrite(PIN_BZ,LOW);}
        else{ledcAttach(PIN_BZ, 2000, 8);ledcAttach(PIN_BZ,2000,8);ledcWriteTone(PIN_BZ,2000);ledcWrite(PIN_BZ,30);delay(p1*50);ledcWrite(PIN_BZ,0);}
        Serial.printf("BEEP %dms\n", p1*50); break;
      case 5: // Sweep test (passive)
        ledcAttach(PIN_BZ, 2000, 8);ledcAttach(PIN_BZ,500,8);
        for(int f=200;f<=2000;f+=100){ledcWriteTone(PIN_BZ,f);ledcWrite(PIN_BZ,20);delay(80);}
        ledcWrite(PIN_BZ,0);Serial.println("SWEEP done"); break;
      case 6: // LED blink test
        for(int i=0;i<p1;i++){digitalWrite(PIN_LED,!digitalRead(PIN_LED));delay(200);}
        digitalWrite(PIN_LED,HIGH);Serial.println("LED test done"); break;
    }
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(PIN_R,OUTPUT);pinMode(PIN_G,OUTPUT);pinMode(PIN_B,OUTPUT);
  analogWrite(PIN_R,0);analogWrite(PIN_G,0);analogWrite(PIN_B,0);
  pinMode(PIN_BZ,OUTPUT);digitalWrite(PIN_BZ,LOW);
  pinMode(PIN_LED,OUTPUT);digitalWrite(PIN_LED,HIGH);
  pinMode(0,INPUT_PULLUP);pinMode(1,INPUT_PULLUP);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);
  // Setup LEDC for passive buzzer tests
  ledcAttach(PIN_BZ,2000,8);
  BLEDevice::init("AI-NAV-C3");
  BLEServer *s=BLEDevice::createServer();s->setCallbacks(new SvrCB());
  BLEService *svc=s->createService(SVC);
  svc->createCharacteristic(CH_LED,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new LEDCB());
  svc->createCharacteristic(CH_CMD,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new CmdCB());
  pKeyChar=svc->createCharacteristic(CH_KEYS,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  svc->start();s->getAdvertising()->start();
  Serial.println("OK");
}
void loop(){uint8_t k=0;if(digitalRead(0)==LOW)k|=1;if(digitalRead(1)==LOW)k|=2;if(digitalRead(2)==LOW)k|=4;if(digitalRead(3)==LOW)k|=8;if(k!=lastKeys&&devConn){pKeyChar->setValue(&k,1);pKeyChar->notify();lastKeys=k;}delay(30);}
