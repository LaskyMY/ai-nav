// ESP32-C3 WiFi+BLE — light HTTP API, BLE fallback
#include <WiFi.h>
#include <Preferences.h>
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

WiFiServer http(80);
Preferences prefs;
bool useWiFi = false;
bool bleConnected = false;
BLECharacteristic *pKeyChar;
uint8_t lastKeys = 0xFF;

void buzz(int m, int p1, int p2) {
  switch(m) {
    case 0: ledcWrite(PIN_BZ,0); digitalWrite(PIN_BZ,LOW); break;
    case 1: ledcWrite(PIN_BZ,0); digitalWrite(PIN_BZ,HIGH); break;
    case 2: digitalWrite(PIN_BZ,LOW); break;
    case 3: ledcAttach(PIN_BZ,p1*10,8); ledcWriteTone(PIN_BZ,p1*10); ledcWrite(PIN_BZ,p2); break;
    case 4: if(p2==0){digitalWrite(PIN_BZ,HIGH);delay(p1*50);digitalWrite(PIN_BZ,LOW);}else{ledcAttach(PIN_BZ,2000,8);ledcWriteTone(PIN_BZ,2000);ledcWrite(PIN_BZ,30);delay(p1*50);ledcWrite(PIN_BZ,0);} break;
    case 5: ledcAttach(PIN_BZ,2000,8); for(int f=200;f<=2000;f+=100){ledcWriteTone(PIN_BZ,f);ledcWrite(PIN_BZ,20);delay(80);} ledcWrite(PIN_BZ,0); break;
    case 6: for(int i=0;i<p1;i++){digitalWrite(PIN_LED,!digitalRead(PIN_LED));delay(200);} digitalWrite(PIN_LED,HIGH); break;
  }
}

void handleHTTP(WiFiClient &c) {
  String req = c.readStringUntil('\n');
  c.println("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\nOK");
  // Parse: GET /api/led?r=255&g=0&b=0 or GET /api/buzzer?cmd=1
  if(req.indexOf("/api/led")>=0) { int r=0,g=0,b=0; parseParam(req,"r",r); parseParam(req,"g",g); parseParam(req,"b",b); analogWrite(PIN_R,r); analogWrite(PIN_G,g); analogWrite(PIN_B,b); }
  else if(req.indexOf("/api/buzzer")>=0) { int cmd=0; parseParam(req,"cmd",cmd); buzz(cmd,5,0); }
  else if(req.indexOf("/api/wifi")>=0) { String s="",p=""; parseParamS(req,"ssid",s); parseParamS(req,"pass",p); if(s.length()>0){prefs.begin("ainav",false);prefs.putString("ssid",s);prefs.putString("pass",p);prefs.end();ESP.restart();} }
}
void parseParam(String &r, const char* k, int &v) { int i=r.indexOf(k); if(i>=0){i+=strlen(k)+1; v=r.substring(i).toInt();} }
void parseParamS(String &r, const char* k, String &v) { int i=r.indexOf(k); if(i>=0){i+=strlen(k)+1; int e=r.indexOf('&',i); if(e<0)e=r.indexOf(' ',i); v=r.substring(i,e>0?e:r.length()); v.replace("%20"," ");} }

class SvrCB: public BLEServerCallbacks {
  void onConnect(BLEServer* p) { bleConnected = true; }
  void onDisconnect(BLEServer* p) { bleConnected = false; p->startAdvertising(); }
};
class LEDCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) { String v=p->getValue(); if(v.length()>=3){analogWrite(PIN_R,(uint8_t)v[0]);analogWrite(PIN_G,(uint8_t)v[1]);analogWrite(PIN_B,(uint8_t)v[2]);} }
};
class CmdCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p) { String v=p->getValue(); if(v.length()>=1) buzz((uint8_t)v[0], v.length()>1?(uint8_t)v[1]:0, v.length()>2?(uint8_t)v[2]:0); }
};

void setup() {
  Serial.begin(115200);
  pinMode(PIN_R,OUTPUT);pinMode(PIN_G,OUTPUT);pinMode(PIN_B,OUTPUT);analogWrite(PIN_R,0);analogWrite(PIN_G,0);analogWrite(PIN_B,0);
  pinMode(PIN_BZ,OUTPUT);digitalWrite(PIN_BZ,LOW);
  pinMode(PIN_LED,OUTPUT);digitalWrite(PIN_LED,HIGH);
  pinMode(0,INPUT_PULLUP);pinMode(1,INPUT_PULLUP);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);
  ledcAttach(PIN_BZ,2000,8);
  // WiFi
  prefs.begin("ainav",false); String s=prefs.getString("ssid",""),p=prefs.getString("pass",""); prefs.end();
  if(s.length()>0){ WiFi.begin(s.c_str(),p.c_str()); int t=0; while(WiFi.status()!=WL_CONNECTED&&t<30){delay(500);t++;}
    if(WiFi.status()==WL_CONNECTED){useWiFi=true;http.begin();Serial.print("WiFi:");Serial.println(WiFi.localIP());digitalWrite(PIN_LED,LOW);delay(200);digitalWrite(PIN_LED,HIGH);}
    else{WiFi.disconnect(true);Serial.println("WiFi fail");}
  }
  // BLE
  BLEDevice::init("AI-NAV-C3"); BLEServer *bs=BLEDevice::createServer();bs->setCallbacks(new SvrCB());
  BLEService *svc=bs->createService(SVC);
  svc->createCharacteristic(CH_LED,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new LEDCB());
  svc->createCharacteristic(CH_CMD,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new CmdCB());
  pKeyChar=svc->createCharacteristic(CH_KEYS,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  svc->start();
  if(!useWiFi){bs->getAdvertising()->start();Serial.println("BLE mode");}
  else{Serial.println("WiFi+BLE mode");}
}

void loop() {
  if(useWiFi){WiFiClient c=http.available();if(c){handleHTTP(c);c.stop();}}
  uint8_t k=0;if(digitalRead(0)==LOW)k|=1;if(digitalRead(1)==LOW)k|=2;if(digitalRead(2)==LOW)k|=4;if(digitalRead(3)==LOW)k|=8;
  if(k!=lastKeys&&bleConnected){pKeyChar->setValue(&k,1);pKeyChar->notify();lastKeys=k;}
  delay(5);
}
