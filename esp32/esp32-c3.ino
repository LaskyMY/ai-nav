// ESP32-C3 Super Mini — BLE Peripheral for AI Nav Dashboard
// Hardware:
//   RGB LED: GPIO 4(R), 5(G), 6(B) — common cathode via 220Ω resistors
//   4-key keypad: GPIO 0,1,2,3 — INPUT_PULLUP (LOW when pressed)
//   Relay: GPIO 7 — HIGH=ON
//   Buzzer: via Relay to 12V (GPIO 7 controls relay)
// Web Bluetooth API connects to SERVICE_UUID, writes to characteristics

#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEServer.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHAR_LED_UUID       "beb5483e-36e1-4688-b7f5-ea07361b26a8"  // WRITE: 3 bytes R,G,B
#define CHAR_RELAY_UUID     "beb5483e-36e1-4688-b7f5-ea07361b26a9"  // WRITE: 1 byte 0/1
#define CHAR_BUZZER_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26aa"  // WRITE: 1 byte 0/1
#define CHAR_KEYPAD_UUID    "beb5483e-36e1-4688-b7f5-ea07361b26ab"  // READ/NOTIFY: 1 byte bitmask

// Pins
#define PIN_R 4
#define PIN_G 5
#define PIN_B 6
#define PIN_RELAY 7
#define PIN_K1 0
#define PIN_K2 1
#define PIN_K3 2
#define PIN_K4 3

BLECharacteristic *pKeypadChar;
bool deviceConnected = false;
uint8_t lastKeys = 0xFF;

class ServerCallbacks: public BLEServerCallbacks {
  void onConnect(BLEServer* pServer) { deviceConnected = true; Serial.println("BLE Connected"); }
  void onDisconnect(BLEServer* pServer) { deviceConnected = false; Serial.println("BLE Disconnected"); pServer->startAdvertising(); }
};

class LEDCallback: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    std::string val = pChar->getValue();
    if (val.length() >= 3) {
      analogWrite(PIN_R, 255 - (uint8_t)val[0]);
      analogWrite(PIN_G, 255 - (uint8_t)val[1]);
      analogWrite(PIN_B, 255 - (uint8_t)val[2]);
      Serial.printf("LED: R=%d G=%d B=%d\n", val[0], val[1], val[2]);
    }
  }
};

class RelayCallback: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    std::string val = pChar->getValue();
    if (val.length() >= 1) {
      digitalWrite(PIN_RELAY, val[0] ? HIGH : LOW);
      Serial.printf("Relay: %s\n", val[0] ? "ON" : "OFF");
    }
  }
};

class BuzzerCallback: public BLECharacteristicCallbacks {
  void onWrite(BLECharacteristic *pChar) {
    std::string val = pChar->getValue();
    if (val.length() >= 1 && val[0]) {
      // Pulse buzzer via relay for beep
      digitalWrite(PIN_RELAY, HIGH);
      delay(200);
      digitalWrite(PIN_RELAY, LOW);
      Serial.println("Buzzer: BEEP");
    }
  }
};

void setup() {
  Serial.begin(115200);

  // RGB LED
  pinMode(PIN_R, OUTPUT); pinMode(PIN_G, OUTPUT); pinMode(PIN_B, OUTPUT);
  analogWrite(PIN_R, 255); analogWrite(PIN_G, 255); analogWrite(PIN_B, 255);  // OFF (common cathode, 255 = off with inversion)

  // Relay
  pinMode(PIN_RELAY, OUTPUT);
  digitalWrite(PIN_RELAY, LOW);

  // Keypad — INPUT_PULLUP, LOW when pressed
  pinMode(PIN_K1, INPUT_PULLUP); pinMode(PIN_K2, INPUT_PULLUP);
  pinMode(PIN_K3, INPUT_PULLUP); pinMode(PIN_K4, INPUT_PULLUP);

  // BLE
  BLEDevice::init("AI-NAV-C3");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new ServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  BLECharacteristic *pLedChar = pService->createCharacteristic(CHAR_LED_UUID, BLECharacteristic::PROPERTY_WRITE);
  pLedChar->setCallbacks(new LEDCallback());

  BLECharacteristic *pRelayChar = pService->createCharacteristic(CHAR_RELAY_UUID, BLECharacteristic::PROPERTY_WRITE);
  pRelayChar->setCallbacks(new RelayCallback());

  BLECharacteristic *pBuzzerChar = pService->createCharacteristic(CHAR_BUZZER_UUID, BLECharacteristic::PROPERTY_WRITE);
  pBuzzerChar->setCallbacks(new BuzzerCallback());

  pKeypadChar = pService->createCharacteristic(CHAR_KEYPAD_UUID, BLECharacteristic::PROPERTY_READ | BLECharacteristic::PROPERTY_NOTIFY);

  pService->start();
  pServer->getAdvertising()->start();
  Serial.println("AI Nav C3 BLE Ready — Waiting for connection...");
}

void loop() {
  // Read keypad
  uint8_t keys = 0;
  if (digitalRead(PIN_K1) == LOW) keys |= 0x01;
  if (digitalRead(PIN_K2) == LOW) keys |= 0x02;
  if (digitalRead(PIN_K3) == LOW) keys |= 0x04;
  if (digitalRead(PIN_K4) == LOW) keys |= 0x08;

  // Notify if changed
  if (keys != lastKeys && deviceConnected) {
    pKeypadChar->setValue(&keys, 1);
    pKeypadChar->notify();
    if (keys) Serial.printf("Keys: 0x%02X\n", keys);
    lastKeys = keys;
  }

  delay(50);
}
