// ESP32 OLED Dashboard — WiFi AP + HTTP直接控制
// 手机连WiFi: AI-Nav-OLED, 密码: 12345678
// 浏览器打开: http://192.168.4.1
// OLED: 0.96" SSD1306 I2C, SDA=GPIO5 SCL=GPIO6
#include <WiFi.h>
#include <WebServer.h>
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>

Adafruit_SSD1306 display(128, 64, &Wire, -1);
WebServer server(80);
Preferences prefs;

String dispMsg = "";
int screenMode = 0; // 0=info 1=msg
unsigned long startMs;

void drawInfo() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);

  display.setCursor(0, 0);
  display.println("AI-Nav OLED");
  display.print("IP: 192.168.4.1");

  display.setCursor(0, 24);
  display.print("WiFi AP: AI-Nav-OLED");

  display.setCursor(0, 36);
  unsigned long up = (millis() - startMs) / 1000;
  display.printf("Up: %02lu:%02lu:%02lu", up/3600, (up%3600)/60, up%60);

  display.setCursor(0, 48);
  display.printf("Free: %lu KB", ESP.getFreeHeap() / 1024);

  display.setCursor(0, 58);
  display.print("Pass: 12345678");
  display.display();
}

void drawMsg() {
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(0, 0);

  for (int i = 0; i < dispMsg.length() && i < 200; i++) {
    char c = dispMsg[i];
    if (c == '\n') {
      // skip to next line position
      int y = display.getCursorY() + 10;
      if (y < 64) display.setCursor(0, y);
    } else if ((uint8_t)c >= 32 && (uint8_t)c < 128) {
      display.print(c);
    }
  }
  display.display();
}

void setup() {
  Serial.begin(115200);
  startMs = millis();

  Wire.begin(5, 6);
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextSize(1);
  display.setTextColor(SSD1306_WHITE);
  display.setCursor(10, 25);
  display.println("Booting...");
  display.display();

  // WiFi AP mode
  WiFi.softAP("AI-Nav-OLED", "12345678");
  delay(100);
  Serial.println("AP: 192.168.4.1");

  // Web server
  server.on("/", []() {
    server.send(200, "text/html", R"rawliteral(
<!DOCTYPE html><html lang="zh"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>AI-Nav OLED</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a14;color:#fff;font-family:system-ui,sans-serif;padding:16px;max-width:500px;margin:0 auto}
h1{font-size:18px;color:#00e5ff;margin-bottom:4px}
.card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:14px;margin-bottom:10px}
.row{display:flex;align-items:center;gap:8px;margin:4px 0}
.lbl{color:rgba(255,255,255,.5);font-size:11px;width:40px}.val{color:#00e5ff;font-size:12px;font-weight:600}
.btn{display:block;width:100%;padding:10px;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#fff;font-size:12px;cursor:pointer;text-align:center;margin:4px 0}
.btn:active{background:rgba(0,229,255,.1)}
.btn.primary{background:rgba(0,229,255,.12);border-color:rgba(0,229,255,.2);color:#00e5ff}
.btn.green{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.2);color:#10b981}
.btn.warn{background:rgba(245,158,11,.1);border-color:rgba(245,158,11,.2);color:#fbbf24}
input[type=text]{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:8px;color:#fff;font-size:12px;width:100%}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:4px}
</style></head><body>
<h1>AI-Nav OLED</h1>
<div class="card">
  <div class="row"><span class="lbl">WiFi</span><span class="val">AI-Nav-OLED</span></div>
  <div class="row"><span class="lbl">密码</span><span class="val">12345678</span></div>
  <div class="row"><span class="lbl">IP</span><span class="val">192.168.4.1</span></div>
</div>
<div class="card">
  <div class="row"><span class="lbl">运行</span><span class="val" id="up">—</span></div>
  <div class="row"><span class="lbl">内存</span><span class="val" id="mem">—</span></div>
</div>
<div class="card">
  <div style="font-size:12px;font-weight:600;margin-bottom:6px">OLED 控制</div>
  <input type="text" id="msg" placeholder="输入文字发送到屏幕" onkeydown="if(event.key==='Enter')sendMsg()">
  <div style="display:flex;gap:4px;margin-top:6px">
    <button class="btn primary" onclick="sendMsg()" style="flex:1">发送文字</button>
    <button class="btn green" onclick="sendCmd('info')" style="flex:1">系统信息</button>
  </div>
  <div class="grid" style="margin-top:4px">
    <button class="btn" onclick="sendMsgStr('Hello World!')">Hello</button>
    <button class="btn" onclick="sendMsgStr('ESP32 OLED\\nDashboard')">两行文字</button>
    <button class="btn" onclick="sendMsgStr('WiFi: AI-Nav-OLED\\nIP: 192.168.4.1')">WiFi信息</button>
    <button class="btn" onclick="sendMsgStr('Free: ')">内存</button>
  </div>
</div>
<div class="card">
  <div style="font-size:12px;font-weight:600;margin-bottom:6px">WiFi 配网</div>
  <button class="btn warn" onclick="wifiScan()">扫描WiFi</button>
  <div id="wifiList"></div>
  <div id="pwdArea" style="display:none;margin-top:6px">
    <input type="text" id="ssid" placeholder="WiFi名称">
    <input type="password" id="pass" placeholder="WiFi密码" style="margin-top:4px">
    <button class="btn green" onclick="wifiConn()" style="margin-top:4px">连接</button>
  </div>
</div>
<script>
async function load(){try{var r=await fetch('/api/status'),d=await r.json();document.getElementById('up').textContent=d.up;document.getElementById('mem').textContent=d.mem+' KB'}catch(e){}}
async function sendMsg(){var t=document.getElementById('msg').value;if(!t)return;await fetch('/api/oled?t='+encodeURIComponent(t));document.getElementById('msg').value=''}
async function sendMsgStr(t){await fetch('/api/oled?t='+encodeURIComponent(t))}
async function sendCmd(c){await fetch('/api/oled?cmd='+c)}
async function wifiScan(){var r=await fetch('/api/wifi/scan'),d=await r.json();var h='';d.forEach(function(n,i){h+='<div style="padding:8px;margin:2px 0;border-radius:6px;background:rgba(255,255,255,.02);cursor:pointer" onclick="sel('+i+')">'+n.s+' ('+n.r+'dBm)</div>'});document.getElementById('wifiList').innerHTML=h}
var scanData=[];
function sel(i){scanData=[];fetch('/api/wifi/scan').then(r=>r.json()).then(d=>{scanData=d;document.getElementById('ssid').value=d[i].s;document.getElementById('pwdArea').style.display='block'})}
async function wifiConn(){var s=document.getElementById('ssid').value,p=document.getElementById('pass').value;await fetch('/api/wifi/conn?ssid='+encodeURIComponent(s)+'&pass='+encodeURIComponent(p));alert('已发送，ESP32将尝试连接')}
load();setInterval(load,3000);
</script></body></html>
)rawliteral");
  });

  server.on("/api/status", []() {
    unsigned long up = (millis() - startMs) / 1000;
    String json = "{\"up\":\"";
    char buf[20];
    snprintf(buf, 20, "%02lu:%02lu:%02lu", up/3600, (up%3600)/60, up%60);
    json += buf;
    json += "\",\"mem\":" + String(ESP.getFreeHeap()/1024) + "}";
    server.send(200, "application/json", json);
  });

  server.on("/api/oled", []() {
    if (server.hasArg("t")) {
      dispMsg = server.arg("t");
      screenMode = 1;
    }
    if (server.hasArg("cmd") && server.arg("cmd") == "info") screenMode = 0;
    server.send(200, "application/json", "{\"ok\":1}");
  });

  server.on("/api/wifi/scan", []() {
    int n = WiFi.scanNetworks();
    String json = "[";
    for (int i = 0; i < n && i < 20; i++) {
      if (i > 0) json += ",";
      json += "{\"s\":\"" + WiFi.SSID(i) + "\",\"r\":" + String(WiFi.RSSI(i)) + "}";
    }
    json += "]";
    WiFi.scanDelete();
    server.send(200, "application/json", json);
  });

  server.on("/api/wifi/conn", []() {
    String ssid = server.arg("ssid"), pass = server.arg("pass");
    prefs.begin("ainav", false);
    prefs.putString("ssid", ssid); prefs.putString("pass", pass);
    prefs.end();
    server.send(200, "application/json", "{\"ok\":1}");
    delay(500);
    WiFi.begin(ssid.c_str(), pass.c_str());
  });

  server.begin();
  drawInfo();
}

void loop() {
  server.handleClient();

  static unsigned long lastDraw = 0;
  if (millis() - lastDraw > 500) {
    lastDraw = millis();
    if (screenMode == 0) drawInfo();
    else drawMsg();
  }
  delay(10);
}
