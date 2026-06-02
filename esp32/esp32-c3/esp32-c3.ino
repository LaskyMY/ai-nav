// ESP32-C3 — BLE配网 + WiFi连接 + HTTP API
#include <WiFi.h>
#include <Preferences.h>
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SVC  "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CH_LED   "beb5483e-36e1-4688-b7f5-ea07361b26a8"
#define CH_CMD   "beb5483e-36e1-4688-b7f5-ea07361b26aa"
#define CH_WIFI  "beb5483e-36e1-4688-b7f5-ea07361b26ac"  // WRITE: ssid|password
#define CH_IP    "beb5483e-36e1-4688-b7f5-ea07361b26ad"  // READ/NOTIFY: IP string

#define PIN_R 4
#define PIN_G 5
#define PIN_B 6
#define PIN_BZ 7
#define PIN_LED 8

WiFiServer http(80);
Preferences prefs;
bool wifiOK = false;
String myIP = "";
BLECharacteristic *pIPChar;

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

void connectWiFi(String s, String p) {
  Serial.printf("WiFi: %s\n", s.c_str());
  WiFi.begin(s.c_str(), p.c_str());
  int t=0; while(WiFi.status()!=WL_CONNECTED&&t<40){delay(500);t++;Serial.print(".");}
  if(WiFi.status()==WL_CONNECTED){
    wifiOK=true; myIP=WiFi.localIP().toString(); http.begin();
    prefs.begin("ainav",false); prefs.putString("ssid",s); prefs.putString("pass",p); prefs.end();
    Serial.print("\nWiFi OK: "); Serial.println(myIP);
    digitalWrite(PIN_LED,LOW);delay(200);digitalWrite(PIN_LED,HIGH);delay(200);digitalWrite(PIN_LED,LOW);delay(200);digitalWrite(PIN_LED,HIGH);
    // Notify IP via BLE
    if(pIPChar){pIPChar->setValue(myIP.c_str()); pIPChar->notify();}
  } else {
    WiFi.disconnect(true); Serial.println("WiFi fail");
  }
}

void handleHTTP(WiFiClient &c) {
  String req=c.readStringUntil('\n'); c.println("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\nOK");
  if(req.indexOf("/api/led")>=0){int r=0,g=0,b=0;parseP(req,"r",r);parseP(req,"g",g);parseP(req,"b",b);analogWrite(PIN_R,r);analogWrite(PIN_G,g);analogWrite(PIN_B,b);}
  else if(req.indexOf("/api/buzzer")>=0){int cmd=0;parseP(req,"cmd",cmd);buzz(cmd,5,0);}
  else if(req.indexOf("/api/ip")>=0){c.println("HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n\r\n"+myIP);}
}
void parseP(String &r,const char*k,int &v){int i=r.indexOf(k);if(i>=0){i+=strlen(k)+1;v=r.substring(i).toInt();}}

// BLE callbacks
class LEDCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p){String v=p->getValue();if(v.length()>=3){analogWrite(PIN_R,(uint8_t)v[0]);analogWrite(PIN_G,(uint8_t)v[1]);analogWrite(PIN_B,(uint8_t)v[2]);}}
};
class CmdCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p){String v=p->getValue();if(v.length()>=1)buzz((uint8_t)v[0],v.length()>1?(uint8_t)v[1]:0,v.length()>2?(uint8_t)v[2]:0);}
};
class WiFiCB: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *p){
    String v=p->getValue(); int sep=v.indexOf('|');
    if(sep>0){String s=v.substring(0,sep),pwd=v.substring(sep+1);connectWiFi(s,pwd);}
  }
};

void setup() {
  Serial.begin(115200);
  pinMode(PIN_R,OUTPUT);pinMode(PIN_G,OUTPUT);pinMode(PIN_B,OUTPUT);analogWrite(PIN_R,0);analogWrite(PIN_G,0);analogWrite(PIN_B,0);
  pinMode(PIN_BZ,OUTPUT);digitalWrite(PIN_BZ,LOW);
  pinMode(PIN_LED,OUTPUT);digitalWrite(PIN_LED,HIGH);
  pinMode(0,INPUT_PULLUP);pinMode(1,INPUT_PULLUP);pinMode(2,INPUT_PULLUP);pinMode(3,INPUT_PULLUP);
  ledcAttach(PIN_BZ,2000,8);

  // Try saved WiFi first
  prefs.begin("ainav",false); String s=prefs.getString("ssid",""),p=prefs.getString("pass",""); prefs.end();
  if(s.length()>0){connectWiFi(s,p);}

  // BLE always on (for config + control)
  BLEDevice::init("AI-NAV-C3");
  BLEServer *bs=BLEDevice::createServer();
  BLEService *svc=bs->createService(SVC);
  svc->createCharacteristic(CH_LED,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new LEDCB());
  svc->createCharacteristic(CH_CMD,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new CmdCB());
  svc->createCharacteristic(CH_WIFI,BLECharacteristic::PROPERTY_WRITE)->setCallbacks(new WiFiCB());
  pIPChar=svc->createCharacteristic(CH_IP,BLECharacteristic::PROPERTY_READ|BLECharacteristic::PROPERTY_NOTIFY);
  if(wifiOK)pIPChar->setValue(myIP.c_str());
  svc->start();bs->getAdvertising()->start();
  Serial.println(wifiOK?"WiFi+BLE ready":"BLE ready (no WiFi)");
}

void loop() {
  if(wifiOK){WiFiClient c=http.available();if(c){handleHTTP(c);c.stop();}}
  delay(5);
}
