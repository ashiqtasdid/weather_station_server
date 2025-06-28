# Weather Station with WiFi Upload

This project combines an Arduino-based weather station with a Node.js web server for data collection and visualization.

## Arduino Setup

### Required Libraries
Install these libraries through the Arduino IDE Library Manager:

1. **LiquidCrystal_I2C** - for LCD display
2. **DHT sensor library** - for temperature/humidity sensor
3. **SFE_BMP180** - for pressure sensor
4. **ESP8266WiFi** - for WiFi connectivity (built-in for ESP8266)
5. **ESP8266HTTPClient** - for HTTP requests (built-in for ESP8266)
6. **ArduinoJson** - for JSON data formatting

### Hardware Connections
- **DHT11**: Pin D4
- **Rain Sensor**: Analog pin A0
- **LDR (Light Sensor)**: Pin D0
- **BMP180 Pressure Sensor**: I2C (SDA/SCL)
- **LCD Display**: I2C (address 0x27 or 0x3F)

### Configuration

1. **WiFi Credentials**: Update these lines in `arduino.cpp`:
   ```cpp
   const char* ssid = "YOUR_WIFI_SSID";
   const char* password = "YOUR_WIFI_PASSWORD";
   ```

2. **Server URL**: Update the server IP address:
   ```cpp
   const char* serverURL = "http://192.168.1.100:6065/api/data";
   ```
   Replace `192.168.1.100` with your server's actual IP address.

3. **Device ID**: Optionally change the device identifier:
   ```cpp
   const char* deviceID = "weather_station_01";
   ```

## Web Server Setup

### Installation
```bash
npm install
```

### Running the Server
```bash
npm start
```

The server will run on port 6065 by default.

### API Endpoints
- `POST /api/data` - Receive sensor data from Arduino
- `GET /api/latest` - Get latest sensor reading
- `GET /api/history` - Get historical data
- `GET /api/stats` - Get statistics
- `GET /` - Dashboard web interface

## Features

### Arduino Features
- Reads temperature, humidity, pressure, light level, and rain data
- Displays data on 16x2 LCD with WiFi status indicator
- Automatically uploads data to web server every 30 seconds
- Automatic WiFi reconnection if connection is lost
- Visual upload confirmation on LCD (↑ symbol)

### LCD Display Format
```
T:25.1C H:65% W:✓
P:1013 R:15% L:B
```
- T: Temperature in Celsius
- H: Humidity percentage
- W: WiFi status (✓ connected, ✗ disconnected)
- P: Pressure in hPa (or Pa if <99999)
- R: Rain percentage
- L: Light level (B=Bright, D=Dark)

### Web Server Features
- SQLite database for data storage
- RESTful API for data access
- Real-time dashboard
- Historical data visualization
- Device management
- Docker support

## Data Upload Format

The Arduino sends data in this JSON format:
```json
{
  "temperature": 25.1,
  "humidity": 65.0,
  "rainfall": 15,
  "light_level": "Bright",
  "device_id": "weather_station_01"
}
```

## Troubleshooting

### Arduino Issues
1. **WiFi Connection Failed**: 
   - Check SSID and password
   - Ensure ESP8266 is in range of WiFi router
   - Verify ESP8266 board is selected in Arduino IDE

2. **Upload Errors**:
   - Check server IP address and port
   - Ensure server is running
   - Verify network connectivity

3. **Sensor Readings**:
   - Check sensor connections
   - Verify sensor power supply
   - Check pin assignments

### Server Issues
1. **Port Already in Use**: Change PORT in environment or docker-compose.yml
2. **Database Errors**: Ensure write permissions in data directory
3. **Network Access**: Check firewall settings for port 6065

## Development

### Running with Docker
```bash
docker-compose up -d
```

### Environment Variables
- `PORT`: Server port (default: 6065)
- `NODE_ENV`: Environment (development/production)
- `DB_PATH`: Database file path

## Future Enhancements

- Add data encryption for transmission
- Implement OTA (Over-The-Air) updates for Arduino
- Add email/SMS alerts for extreme weather conditions
- Implement data caching for offline operation
- Add weather forecasting features
