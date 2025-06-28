#!/bin/bash

# Weather Station VPS Deployment Script
# Run this script directly on your VPS

echo "🚀 Setting up Weather Station on VPS..."

# Create project directory
mkdir -p /root/weather_station
cd /root/weather_station

# Install Docker if not present
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# Install Docker Compose if not present
if ! command -v docker-compose &> /dev/null; then
    echo "📦 Installing Docker Compose..."
    curl -L "https://github.com/docker/compose/releases/download/v2.21.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

# Create package.json
cat > package.json << 'EOF'
{
  "name": "weather-station-server",
  "version": "1.0.0",
  "description": "Weather Station IoT Server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "sqlite3": "^5.1.6",
    "cors": "^2.8.5"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
EOF

# Create server.js
cat > server.js << 'EOF'
const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 6065;
const DB_PATH = process.env.DB_PATH || './data/weather_data.db';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
    initDatabase();
  }
});

function initDatabase() {
  db.run(`CREATE TABLE IF NOT EXISTS weather_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    temperature REAL,
    humidity REAL,
    rainfall REAL,
    pressure REAL,
    light_level TEXT,
    device_id TEXT
  )`, (err) => {
    if (err) {
      console.error('❌ Error creating table:', err.message);
    } else {
      console.log('✅ Database table ready');
    }
  });
}

// API Routes
app.post('/api/data', (req, res) => {
  const { temperature, humidity, rainfall, pressure, light_level, device_id } = req.body;
  
  if (temperature === undefined || humidity === undefined) {
    return res.status(400).json({ error: 'Missing required data' });
  }

  const stmt = db.prepare(`INSERT INTO weather_data 
    (temperature, humidity, rainfall, pressure, light_level, device_id) 
    VALUES (?, ?, ?, ?, ?, ?)`);
  
  stmt.run([temperature, humidity, rainfall || 0, pressure || 0, light_level || 'Unknown', device_id || 'default'], 
    function(err) {
      if (err) {
        console.error('❌ Database insert error:', err.message);
        res.status(500).json({ error: 'Database error' });
      } else {
        console.log(`📊 New data: T:${temperature}°C H:${humidity}% R:${rainfall}% P:${pressure}Pa L:${light_level}`);
        res.json({ success: true, id: this.lastID });
      }
    });
  stmt.finalize();
});

app.get('/api/latest', (req, res) => {
  db.get(`SELECT * FROM weather_data ORDER BY timestamp DESC LIMIT 1`, (err, row) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json(row || {});
    }
  });
});

app.get('/api/data', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  db.all(`SELECT * FROM weather_data ORDER BY timestamp DESC LIMIT ?`, [limit], (err, rows) => {
    if (err) {
      res.status(500).json({ error: 'Database error' });
    } else {
      res.json(rows);
    }
  });
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Weather Station Server running on port ${PORT}`);
  console.log(`🌐 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API: http://localhost:${PORT}/api/`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server...');
  db.close();
  process.exit(0);
});
EOF

# Create Dockerfile
cat > Dockerfile << 'EOF'
FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache wget

COPY package*.json ./
RUN npm install --production

COPY . .

RUN mkdir -p /app/data
RUN chown -R node:node /app
USER node

EXPOSE 6065

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:6065/health || exit 1

CMD ["node", "server.js"]
EOF

# Create docker-compose.yml
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  weather-app:
    build: .
    container_name: weather-app
    restart: unless-stopped
    ports:
      - "6065:6065"
    volumes:
      - weather_data:/app/data
    environment:
      - NODE_ENV=production
      - PORT=6065
      - DB_PATH=/app/data/weather_data.db
    networks:
      - weather-network

  nginx:
    image: nginx:alpine
    container_name: weather-nginx
    restart: unless-stopped
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - weather-app
    networks:
      - weather-network

volumes:
  weather_data:

networks:
  weather-network:
    driver: bridge
EOF

# Create nginx.conf
cat > nginx.conf << 'EOF'
events {
    worker_connections 1024;
}

http {
    upstream weather_app {
        server weather-app:6065;
    }

    server {
        listen 80;
        server_name _;

        location / {
            proxy_pass http://weather_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /api/ {
            proxy_pass http://weather_app;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        location /health {
            proxy_pass http://weather_app/health;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
}
EOF

# Create public directory and files
mkdir -p public

cat > public/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Weather Station Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: Arial, sans-serif; background: #f0f0f0; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; }
        .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .card { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .card h3 { color: #333; margin-bottom: 10px; }
        .value { font-size: 2em; font-weight: bold; color: #007bff; }
        .unit { font-size: 0.8em; color: #666; }
        .status { padding: 10px; border-radius: 5px; margin-bottom: 20px; text-align: center; }
        .status.online { background: #d4edda; color: #155724; }
        .status.offline { background: #f8d7da; color: #721c24; }
        #chart { background: white; border-radius: 10px; padding: 20px; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🌤️ Weather Station Dashboard</h1>
            <div id="status" class="status offline">🔴 Offline</div>
        </div>
        
        <div class="cards">
            <div class="card">
                <h3>🌡️ Temperature</h3>
                <div class="value" id="temperature">--</div>
                <div class="unit">°C</div>
            </div>
            <div class="card">
                <h3>💧 Humidity</h3>
                <div class="value" id="humidity">--</div>
                <div class="unit">%</div>
            </div>
            <div class="card">
                <h3>🌧️ Rainfall</h3>
                <div class="value" id="rainfall">--</div>
                <div class="unit">%</div>
            </div>
            <div class="card">
                <h3>📊 Pressure</h3>
                <div class="value" id="pressure">--</div>
                <div class="unit">Pa</div>
            </div>
            <div class="card">
                <h3>☀️ Light Level</h3>
                <div class="value" id="light">--</div>
                <div class="unit"></div>
            </div>
            <div class="card">
                <h3>📅 Last Update</h3>
                <div class="value" id="lastUpdate" style="font-size: 1em;">--</div>
                <div class="unit"></div>
            </div>
        </div>
    </div>

    <script>
        async function fetchLatestData() {
            try {
                const response = await fetch('/api/latest');
                const data = await response.json();
                
                if (data.id) {
                    document.getElementById('temperature').textContent = data.temperature?.toFixed(1) || '--';
                    document.getElementById('humidity').textContent = data.humidity?.toFixed(1) || '--';
                    document.getElementById('rainfall').textContent = data.rainfall?.toFixed(1) || '--';
                    document.getElementById('pressure').textContent = data.pressure?.toFixed(0) || '--';
                    document.getElementById('light').textContent = data.light_level || '--';
                    
                    if (data.timestamp) {
                        const date = new Date(data.timestamp);
                        document.getElementById('lastUpdate').textContent = date.toLocaleString();
                    }
                    
                    document.getElementById('status').textContent = '🟢 Online';
                    document.getElementById('status').className = 'status online';
                } else {
                    document.getElementById('status').textContent = '🔴 No Data';
                    document.getElementById('status').className = 'status offline';
                }
            } catch (error) {
                console.error('Error fetching data:', error);
                document.getElementById('status').textContent = '🔴 Connection Error';
                document.getElementById('status').className = 'status offline';
            }
        }

        // Fetch data every 10 seconds
        fetchLatestData();
        setInterval(fetchLatestData, 10000);
    </script>
</body>
</html>
EOF

# Stop any existing containers
echo "🛑 Stopping existing containers..."
docker-compose down --remove-orphans 2>/dev/null || true

# Clean up Docker system
echo "🧹 Cleaning up..."
docker system prune -f

# Build and start services
echo "🔨 Building and starting services..."
docker-compose up --build -d

# Wait for services to start
echo "⏳ Waiting for services to start..."
sleep 30

# Check status
echo "📊 Container Status:"
docker-compose ps

# Test endpoints
echo "🧪 Testing endpoints..."
echo -n "App Health: "
curl -s http://localhost:6065/health >/dev/null && echo "✅ OK" || echo "❌ FAILED"

echo -n "Nginx Health: "
curl -s http://localhost:80/health >/dev/null && echo "✅ OK" || echo "❌ FAILED"

echo -n "Dashboard: "
curl -s http://localhost:80/ >/dev/null && echo "✅ OK" || echo "❌ FAILED"

# Show final status
echo ""
echo "🎉 Deployment Complete!"
echo "🌐 Dashboard: http://37.114.41.124"
echo "🔌 API: http://37.114.41.124/api/"
echo "🏥 Health: http://37.114.41.124/health"
echo ""
echo "📋 Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Restart: docker-compose restart"
echo "  - Stop: docker-compose down"
echo "  - Update: docker-compose up --build -d"
