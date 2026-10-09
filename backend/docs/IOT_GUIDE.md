# IoT hardware integration guide
1. Register the device: `curl -b jar -H 'origin: http://localhost:3000' -X POST localhost:3000/api/admin/devices -H 'content-type: application/json' -d '{"name":"Greenhouse ESP32"}'`
   Copy the returned token immediately. Only its hash is stored.
2. The device sends readings over HTTPS (at most one request per second):
   `POST /api/devices/telemetry` with `Authorization: Bearer <token>` and `{"readings":[{"metric":"temperature","value":27.4}]}`
   Allowed metrics: temperature, humidity, air_quality, distance, motion, energy_w, battery.
3. Check health: `GET /api/admin/devices` (online = reported in the last 2 minutes).

ESP32 sketch outline (Arduino core):
```cpp
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
const char* TOKEN = "PASTE_DEVICE_TOKEN";
const char* ROOT_CA = "-----BEGIN CERTIFICATE-----...";   // root CA of your server; do not use setInsecure() in production
void send(float t) {
  WiFiClientSecure c; c.setCACert(ROOT_CA);
  HTTPClient http; http.begin(c, "https://YOUR_DOMAIN/api/devices/telemetry");
  http.addHeader("Content-Type", "application/json");
  http.addHeader("Authorization", String("Bearer ") + TOKEN);
  http.POST("{\"readings\":[{\"metric\":\"temperature\",\"value\":" + String(t) + "}]}");
  http.end();
}
```
USB-connected Arduino boards cannot talk to the website directly. They need a gateway (an ESP32 or a small
computer that forwards readings to this API). MQTT: run a broker with per-device credentials and ACLs and add a small
bridge that forwards messages to this endpoint. That bridge is not included yet.
