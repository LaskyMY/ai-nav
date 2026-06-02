// ESP32-C3 — WiFi+BLE, Breathing LED, Buzzer modes
#include <WiFi.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SVC  "12345678-1234-1234-1234-123456789abc"
#define CH_LED  "12345678-1234-1234-1234-123456789001"
#define CH_BUZZ "12345678-1234-1234-1234-123456789002"
#define CH_WIFI "12345678-1234-1234-1234-123456789003"
#define CH_INFO "12345678-1234-1234-1234-123456789004"

#define PIN_R 4
#define PIN_G 5
#define PIN_B 6
#define PIN_BZ 7
#define PIN_LED 8

WiFiServer http(80);
Preferences prefs;
bool wifiOK = false;
String myIP = "";
BLECharacteristic *pInfoChar;
unsigned long startMs = 0;

// ==== Helpers ====
void setLED(int r, int g, int b) { analogWrite(PIN_R,r); analogWrite(PIN_G,g); analogWrite(PIN_B,b); }
void buzz(int m) {
  if(m==1) digitalWrite(PIN_BZ,HIGH);
  else if(m==2) digitalWrite(PIN_BZ,LOW);
  else if(m==3) { digitalWrite(PIN_BZ,HIGH); delay(300); digitalWrite(PIN_BZ,LOW); }
  else if(m==4) { for(int i=0;i<3;i++){digitalWrite(PIN_LED,!digitalRead(PIN_LED));delay(150);} digitalWrite(PIN_LED,HIGH); }
}
void infoUpdate() {
  if(!pInfoChar) return;
  char buf[64];
  snprintf(buf,64,"WiFi:%s IP:%s Up:%lu", wifiOK?"OK":"NO", wifiOK?myIP.c_str():"-", (unsigned long)((millis()-startMs)/1000));
  pInfoChar->setValue(buf); pInfoChar->notify();
}

// ==== WiFi ====
void tryWiFi(String s, String p) {
  WiFi.begin(s.c_str(),p.c_str());
  int t=0; while(WiFi.status()!=WL_CONNECTED&&t<30){delay(500);t++;}
  if(WiFi.status()==WL_CONNECTED) {
    wifiOK=true; myIP=WiFi.localIP().toString(); http.begin();
    prefs.begin("ainav",false); prefs.putString("ssid",s); prefs.putString("pass",p); prefs.end();
    infoUpdate();
  } else { WiFi.disconnect(true); }
}

// ==== BLE Callbacks ====
class LEDCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v=p->getValue();
    if(v.length()==3) setLED((uint8_t)v[0],(uint8_t)v[1],(uint8_t)v[2]);
    else if(v.length()==1 && v[0]==5) { // Breathing mode
      for(int b=0;b<=255;b+=5){setLED(0,b/2,b);delay(20);}
      for(int b=255;b>=0;b-=5){setLED(0,b/2,b);delay(20);}
      setLED(0,0,0);
    }
  }
};
class BuzzCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) { buzz(p->getValue()[0]); }
};
class WiFiCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) {
    String v=p->getValue(); int sep=v.indexOf('|');
    if(sep>0) tryWiFi(v.substring(0,sep),v.substring(sep+1));
  }
};
class InfoCB: public BLECharacteristicCallbacks {
  void onRead(BLECharacteristic *p) { infoUpdate(); }
};

void setup() {
  Serial.begin(115200); startMs=millis();
  pinMode(PIN_R,OUTPUT);pinMode(PIN_G,OUTPUT);pinMode(PIN_B,OUTPUT);setLED(0,0,0);
  pinMode(PIN_BZ,OUTPUT);digitalWrite(PIN_BZ,LOW);
  pinMode(PIN_LED,OUTPUT);digitalWrite(PIN_LED,HIGH);
  pinMode(0,INPUT_PULLUP);pinMode(1,INPUT_PULLUP);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);

  // Try saved WiFi
  prefs.begin("ainav",false);
  String s=prefs.getString("ssid",""),p=prefs.getString("pass","");
  prefs.end();
  if(s.length()>0) tryWiFi(s,p);

  // BLE
  BLEDevice::init("AI-NAV-C3");
  BLEServer *bs=BLEDevice::createServer();
  BLEService *svc=bs->createService(SVC);
  svc->createCharacteristic(CH_LED,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new LEDCB());
  svc->createCharacteristic(CH_BUZZ,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new BuzzCB());
  svc->createCharacteristic(CH_WIFI,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new WiFiCB());
  pInfoChar=svc->createCharacteristic(CH_INFO,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  svc->start();bs->getAdvertising()->start();
  infoUpdate();
  Serial.println("BLE+WiFi Ready");
}

void loop() {
  if(wifiOK){WiFiClient c=http.available();if(c){String r=c.readStringUntil('\n');c.println("HTTP/1.1 200\r\nAccess-Control-Allow-Origin: *\r\n\r\nOK");
    if(r.indexOf("/api/led?")>=0){int ri=0,gi=0,bi=0;auto pa=[&](const char*k,int&v){int i=r.indexOf(k);if(i>=0){i+=strlen(k)+1;v=r.substring(i).toInt();}};pa("r",ri);pa("g",gi);pa("b",bi);setLED(ri,gi,bi);}
    else if(r.indexOf("/api/buzzer?")>=0){int cmd=0;auto pa=[&](const char*k,int&v){int i=r.indexOf(k);if(i>=0){i+=strlen(k)+1;v=r.substring(i).toInt();}};pa("cmd",cmd);buzz(cmd);}
    c.stop();}}
  delay(5);
}
