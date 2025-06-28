#include <LiquidCrystal_I2C.h>
#include <DHT.h>
#include <SFE_BMP180.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>

LiquidCrystal_I2C lcd(0x27, 16, 2); // Use 0x27 or 0x3F according to your LCD

// WiFi credentials - CHANGE THESE!
const char* ssid = "Ashiq Tasdid";
const char* password = "*#*AshiqMonir328958*#*";

// Server configuration - CHANGE THE IP TO YOUR VPS IP
const char* serverURL = "http://37.114.41.124:6065/api/data"; // VPS IP address
const char* serverHost = "37.114.41.124"; // VPS IP address
const int serverPort = 6065;
const char* deviceID = "weather_station_01";

WiFiClient wifiClient;

// DHT setup
#define DHTPIN D4
#define DHTTYPE DHT11
DHT dht(DHTPIN, DHTTYPE);

// Rain sensor analog pin
#define RAIN_ANALOG_PIN A0

// LDR and Pressure sensor pins
#define LDR_PIN D0
SFE_BMP180 bmp;

// Timers
unsigned long lastDHT = 0, lastRain = 0, lastPressure = 0, lastLDR = 0, lastUpload = 0, lastHeartbeat = 0;
const unsigned long dhtInterval = 1000;
const unsigned long rainInterval = 500;
const unsigned long pressureInterval = 1000;
const unsigned long ldrInterval = 500;
const unsigned long uploadInterval = 20000; // Upload every 20 seconds
const unsigned long heartbeatInterval = 60000; // Heartbeat every 60 seconds

// Sensor variables (for display)
float g_temperature = 0, g_humidity = 0;
int g_rainPercent = 0;
double g_pressure = 101325; // Initialize with standard atmospheric pressure (Pa)
bool g_isBright = false;
bool wifiConnected = false;
bool isUploading = false;

void setup() {
  Serial.begin(9600);
  
  // Initialize BMP180 pressure sensor
  if (bmp.begin()) {
    Serial.println("BMP180 pressure sensor initialized successfully");
  } else {
    Serial.println("❌ Failed to initialize BMP180 pressure sensor!");
    Serial.println("Check I2C connections (SDA/SCL)");
  }
  
  lcd.init();
  lcd.backlight();
  pinMode(LDR_PIN, INPUT);
  dht.begin();

  lcd.setCursor(0, 0);
  lcd.print("Weather Monitor");
  lcd.setCursor(1, 1);
  lcd.print("Initializing...");
  delay(2000);
  
  // Initialize WiFi
  initWiFi();
  
  // Run connectivity test if WiFi connected
  if (wifiConnected) {
    testConnectivity();
  }
  
  lcd.clear();
}

void DHT11sensor() {
  float h = dht.readHumidity();
  float t = dht.readTemperature();

  if (isnan(h) || isnan(t)) {
    Serial.println("Failed to read from DHT sensor!");
    // Keep previous values if read fails
    return;
  }
  
  // Validate reasonable ranges
  if (t >= -40 && t <= 80 && h >= 0 && h <= 100) {
    g_temperature = t;
    g_humidity = h;
  } else {
    Serial.println("DHT sensor values out of range!");
    return;
  }

  Serial.print("Temperature: "); Serial.print(t, 1);
  Serial.print("C, Humidity: "); Serial.print(h, 1); Serial.println("%");
}

void rainSensor() {
  int analogValue = analogRead(RAIN_ANALOG_PIN);
  int percent = map(analogValue, 0, 1024, 0, 100);
  g_rainPercent = percent;
  Serial.print("Rain analog: "); Serial.print(analogValue);
  Serial.print(" ("); Serial.print(percent); Serial.println("%)");
}

void pressureSensor() {
  char status;
  double T = 0, P = 0; // Initialize variables
  
  // Start temperature measurement
  status = bmp.startTemperature();
  if (status == 0) {
    Serial.println("Error starting temperature measurement!");
    return;
  }
  
  delay(status); // Wait for measurement
  
  // Get temperature
  status = bmp.getTemperature(T);
  if (status == 0) {
    Serial.println("Error reading temperature from pressure sensor!");
    return;
  }
  
  // Start pressure measurement
  status = bmp.startPressure(3);
  if (status == 0) {
    Serial.println("Error starting pressure measurement!");
    return;
  }
  
  delay(status); // Wait for measurement
  
  // Get pressure
  status = bmp.getPressure(P, T);
  if (status == 0) {
    Serial.println("Error reading pressure!");
    return;
  }
  
  // Validate reasonable pressure range (300-1100 hPa = 30000-110000 Pa)
  if (P >= 30000 && P <= 110000) {
    g_pressure = P;
    Serial.print("Pressure: ");
    Serial.print(P, 0);
    Serial.print(" Pa (");
    Serial.print(P/100, 1); // Show in hPa as well
    Serial.println(" hPa)");
  } else {
    Serial.print("Pressure reading out of range: ");
    Serial.print(P, 0);
    Serial.println(" Pa - keeping previous value");
    // Don't update g_pressure, keep previous valid value
  }
}

void LDRsensor() {
  bool value = digitalRead(LDR_PIN);
  g_isBright = (value == 0); // 0 = bright, 1 = dark
  Serial.print("LDR: ");
  Serial.println(g_isBright ? "Bright" : "Dark");
}

void displayAll() {
  // First row: T:25.0C H:60% L:B
  lcd.setCursor(0, 0);
  lcd.print("T:");
  lcd.print(g_temperature, 1);
  lcd.print("C");

  lcd.setCursor(7, 0);
  lcd.print("H:");
  lcd.print((int)g_humidity);
  lcd.print("%");

  lcd.setCursor(13, 0);
  lcd.print("L:");
  lcd.print(g_isBright ? "B" : "D"); // B = Bright, D = Dark

  // Second row: P:101325 R:45%
  lcd.setCursor(0, 1);
  lcd.print("P:");
  if (g_pressure > 99999) lcd.print((int)g_pressure / 100); // Show hPa
  else lcd.print((int)g_pressure);
  lcd.print(" ");

  lcd.setCursor(9, 1);
  lcd.print("R:");
  if (g_rainPercent < 10) lcd.print(" "); // alignment
  lcd.print(g_rainPercent);
  lcd.print("% ");

  // Clear any leftover chars on display if shorter values printed
  lcd.setCursor(15, 1);
  lcd.print(" ");
}

void initWiFi() {
  lcd.setCursor(0, 1);
  lcd.print("Connecting WiFi");
  
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.println();
    Serial.println("WiFi connected!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
    
    lcd.setCursor(0, 1);
    lcd.print("WiFi: Connected ");
    delay(2000);
  } else {
    wifiConnected = false;
    Serial.println();
    Serial.println("WiFi connection failed!");
    
    lcd.setCursor(0, 1);
    lcd.print("WiFi: Failed    ");
    delay(2000);
  }
}

void uploadDataToServer() {
  if (!wifiConnected) {
    Serial.println("WiFi not connected, skipping upload");
    return;
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting reconnection...");
    initWiFi();
    return;
  }
  
  // Show uploading status
  isUploading = true;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Uploading...");
  delay(500);
  
  HTTPClient http;
  
  // Set timeout values
  http.setTimeout(10000); // 10 seconds timeout
  
  Serial.print("Attempting to connect to: ");
  Serial.println(serverURL);
  
  // Begin HTTP connection
  if (!http.begin(wifiClient, serverURL)) {
    Serial.println("❌ HTTP begin failed!");
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("HTTP Begin Error!");
    delay(1000);
    isUploading = false;
    lcd.clear();
    return;
  }
  
  http.addHeader("Content-Type", "application/json");
  
  // Create JSON payload
  StaticJsonDocument<200> doc;
  doc["temperature"] = g_temperature;
  doc["humidity"] = g_humidity;
  doc["rainfall"] = g_rainPercent;
  doc["pressure"] = g_pressure; // Add pressure data
  doc["light_level"] = g_isBright ? "Bright" : "Dark";
  doc["device_id"] = deviceID;
  
  String jsonString;
  serializeJson(doc, jsonString);
  
  Serial.print("Uploading data: ");
  Serial.println(jsonString);
  
  int httpResponseCode = http.POST(jsonString);
  
  if (httpResponseCode > 0) {
    String response = http.getString();
    Serial.print("HTTP Response Code: ");
    Serial.println(httpResponseCode);
    Serial.print("Response Body: ");
    Serial.println(response);
    
    if (httpResponseCode == 200) {
      Serial.println("✅ Data uploaded successfully!");
      
      // Show uploaded status
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Uploaded!");
      delay(1000);
    } else {
      Serial.println("❌ Server error");
      
      // Show error status with code
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Server Error:");
      lcd.setCursor(0, 1);
      lcd.print("Code: ");
      lcd.print(httpResponseCode);
      delay(2000);
    }
  } else {
    Serial.print("❌ HTTP Error Code: ");
    Serial.println(httpResponseCode);
    
    // Provide more specific error messages
    String errorMsg = "Unknown Error";
    switch(httpResponseCode) {
      case HTTPC_ERROR_CONNECTION_REFUSED:
        errorMsg = "Connection Refused";
        Serial.println("Connection refused - is server running?");
        break;
      case HTTPC_ERROR_SEND_HEADER_FAILED:
        errorMsg = "Send Header Failed";
        break;
      case HTTPC_ERROR_SEND_PAYLOAD_FAILED:
        errorMsg = "Send Payload Failed";
        break;
      case HTTPC_ERROR_NOT_CONNECTED:
        errorMsg = "Not Connected";
        break;
      case HTTPC_ERROR_CONNECTION_LOST:
        errorMsg = "Connection Lost";
        break;
      case HTTPC_ERROR_NO_STREAM:
        errorMsg = "No Stream";
        break;
      case HTTPC_ERROR_NO_HTTP_SERVER:
        errorMsg = "No HTTP Server";
        break;
      case HTTPC_ERROR_TOO_LESS_RAM:
        errorMsg = "Too Less RAM";
        break;
      case HTTPC_ERROR_ENCODING:
        errorMsg = "Encoding Error";
        break;
      case HTTPC_ERROR_STREAM_WRITE:
        errorMsg = "Stream Write Error";
        break;
      case HTTPC_ERROR_READ_TIMEOUT:
        errorMsg = "Read Timeout";
        break;
    }
    
    // Show error status
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Conn Error:");
    lcd.setCursor(0, 1);
    if (errorMsg.length() > 16) {
      lcd.print(errorMsg.substring(0, 16));
    } else {
      lcd.print(errorMsg);
    }
    delay(2000);
  }
  
  http.end();
  isUploading = false;
  lcd.clear();
}

void uploadDataToServerDirect() {
  if (!wifiConnected) {
    Serial.println("WiFi not connected, skipping upload");
    return;
  }
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi disconnected, attempting reconnection...");
    initWiFi();
    return;
  }
  
  // Show uploading status
  isUploading = true;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("Uploading...");
  delay(500);
  
  WiFiClient client;
  
  Serial.print("Connecting to server: ");
  Serial.print(serverHost);
  Serial.print(":");
  Serial.println(serverPort);
  
  if (client.connect(serverHost, serverPort)) {
    Serial.println("Connected to server!");
    
    // Create JSON payload
    StaticJsonDocument<200> doc;
    doc["temperature"] = g_temperature;
    doc["humidity"] = g_humidity;
    doc["rainfall"] = g_rainPercent;
    doc["pressure"] = g_pressure; // Add pressure data
    doc["light_level"] = g_isBright ? "Bright" : "Dark";
    doc["device_id"] = deviceID;
    
    String jsonString;
    serializeJson(doc, jsonString);
    
    // Create HTTP POST request
    String httpRequest = "POST /api/data HTTP/1.1\r\n";
    httpRequest += "Host: " + String(serverHost) + ":" + String(serverPort) + "\r\n";
    httpRequest += "Content-Type: application/json\r\n";
    httpRequest += "Content-Length: " + String(jsonString.length()) + "\r\n";
    httpRequest += "Connection: close\r\n\r\n";
    httpRequest += jsonString;
    
    Serial.println("Sending HTTP request:");
    Serial.println(httpRequest);
    
    // Send the request
    client.print(httpRequest);
    
    // Wait for response
    unsigned long timeout = millis();
    while (client.available() == 0) {
      if (millis() - timeout > 5000) {
        Serial.println("Timeout!");
        client.stop();
        lcd.clear();
        lcd.setCursor(0, 0);
        lcd.print("Timeout Error!");
        delay(1000);
        isUploading = false;
        lcd.clear();
        return;
      }
    }
    
    // Read response
    String response = "";
    while (client.available()) {
      response += client.readString();
    }
    
    Serial.println("Server response:");
    Serial.println(response);
    
    if (response.indexOf("200 OK") > 0 || response.indexOf("\"success\":true") > 0) {
      Serial.println("✅ Data uploaded successfully!");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Uploaded!");
      delay(1000);
    } else {
      Serial.println("❌ Server returned error");
      lcd.clear();
      lcd.setCursor(0, 0);
      lcd.print("Server Error!");
      delay(1000);
    }
    
    client.stop();
  } else {
    Serial.println("❌ Failed to connect to server");
    Serial.println("Possible causes:");
    Serial.println("- Server not running");
    Serial.println("- Firewall blocking connection");
    Serial.println("- Wrong IP address");
    Serial.println("- Network connectivity issue");
    
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Connection Failed");
    lcd.setCursor(0, 1);
    lcd.print("Check Server!");
    delay(2000);
  }
  
  isUploading = false;
  lcd.clear();
}

void testConnectivity() {
  Serial.println("\n=== Network Connectivity Test ===");
  
  // Test WiFi status
  Serial.print("WiFi Status: ");
  switch(WiFi.status()) {
    case WL_CONNECTED:
      Serial.println("Connected");
      break;
    case WL_NO_SSID_AVAIL:
      Serial.println("No SSID Available");
      break;
    case WL_CONNECT_FAILED:
      Serial.println("Connection Failed");
      break;
    case WL_WRONG_PASSWORD:
      Serial.println("Wrong Password");
      break;
    case WL_DISCONNECTED:
      Serial.println("Disconnected");
      break;
    default:
      Serial.println("Other");
      break;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Gateway: ");
    Serial.println(WiFi.gatewayIP());
    Serial.print("DNS: ");
    Serial.println(WiFi.dnsIP());
    Serial.print("Signal Strength (RSSI): ");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");
    
    // Test ping to gateway
    Serial.println("Testing connectivity to gateway...");
    WiFiClient testClient;
    if (testClient.connect(WiFi.gatewayIP(), 80)) {
      Serial.println("✅ Gateway reachable");
      testClient.stop();
    } else {
      Serial.println("❌ Gateway unreachable");
    }
    
    // Test ping to server
    Serial.println("Testing connectivity to server...");
    if (testClient.connect(serverHost, serverPort)) {
      Serial.println("✅ Server reachable");
      testClient.stop();
    } else {
      Serial.println("❌ Server unreachable - Check if server is running and firewall allows connections");
    }
  }
  
  Serial.println("=== End Test ===\n");
}

void sendHeartbeat() {
  if (!wifiConnected || WiFi.status() != WL_CONNECTED) {
    return;
  }
  
  Serial.println("Sending heartbeat...");
  
  HTTPClient http;
  http.setTimeout(5000);
  
  // Create health endpoint URL
  String healthURL = String("http://") + serverHost + ":" + serverPort + "/health";
  
  if (http.begin(wifiClient, healthURL)) {
    int httpResponseCode = http.GET();
    
    if (httpResponseCode == 200) {
      Serial.println("✅ Heartbeat successful - Server is alive");
    } else {
      Serial.print("❌ Heartbeat failed - HTTP Code: ");
      Serial.println(httpResponseCode);
    }
    
    http.end();
  }
}

void loop() {
  unsigned long now = millis();

  // Only run sensor readings and display when not uploading
  if (!isUploading) {
    if (now - lastDHT >= dhtInterval) {
      DHT11sensor();
      lastDHT = now;
    }
    if (now - lastRain >= rainInterval) {
      rainSensor();
      lastRain = now;
    }
    if (now - lastPressure >= pressureInterval) {
      pressureSensor();
      lastPressure = now;
    }
    if (now - lastLDR >= ldrInterval) {
      LDRsensor();
      lastLDR = now;
    }

    displayAll();
  }
  
  // Upload data to server periodically
  if (now - lastUpload >= uploadInterval) {
    uploadDataToServerDirect(); // Using direct connection method
    lastUpload = now;
  }
  
  // Send heartbeat to check server health
  if (now - lastHeartbeat >= heartbeatInterval) {
    sendHeartbeat();
    lastHeartbeat = now;
  }

  delay(10);
}