const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3022;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'weather_data.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} - ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Initialize SQLite database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1);
  }
  console.log(`Connected to SQLite database at ${DB_PATH}`);
});

// Create tables if they don't exist
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS sensor_data (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    temperature REAL,
    humidity REAL,
    rainfall INTEGER,
    light_level TEXT,
    device_id TEXT DEFAULT 'weather_station_01',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Create index for better performance
  db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON sensor_data(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_device_id ON sensor_data(device_id)`);
  
  console.log('Database tables initialized');
});

// API endpoint to receive sensor data from ESP8266
app.post('/api/data', (req, res) => {
  const { temperature, humidity, rainfall, light_level, device_id } = req.body;
  
  // Validate data
  if (temperature === undefined || humidity === undefined || 
      rainfall === undefined || light_level === undefined) {
    return res.status(400).json({ 
      error: 'Missing required sensor data',
      required: ['temperature', 'humidity', 'rainfall', 'light_level']
    });
  }
  
  // Validate data types and ranges
  if (isNaN(temperature) || isNaN(humidity) || isNaN(rainfall)) {
    return res.status(400).json({ error: 'Invalid numeric data' });
  }
  
  // Insert data into database
  const stmt = db.prepare(`INSERT INTO sensor_data 
    (temperature, humidity, rainfall, light_level, device_id) 
    VALUES (?, ?, ?, ?, ?)`);
  
  stmt.run(temperature, humidity, rainfall, light_level, device_id || 'weather_station_01', function(err) {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    console.log(`📊 New data received from ${device_id || 'default'}: T:${temperature}°C H:${humidity}% R:${rainfall}% L:${light_level}`);
    res.json({ 
      success: true, 
      message: 'Data received successfully',
      id: this.lastID,
      timestamp: new Date().toISOString()
    });
  });
  
  stmt.finalize();
});

// API endpoint to get latest data
app.get('/api/latest', (req, res) => {
  const device_id = req.query.device_id;
  let query = 'SELECT * FROM sensor_data';
  let params = [];
  
  if (device_id) {
    query += ' WHERE device_id = ?';
    params.push(device_id);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT 1';
  
  db.get(query, params, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(row || { message: 'No data available' });
  });
});

// API endpoint to get historical data
app.get('/api/history', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 100, 1000); // Max 1000 records
  const hours = parseInt(req.query.hours) || 24;
  const device_id = req.query.device_id;
  
  let query = 'SELECT * FROM sensor_data WHERE timestamp >= datetime(\'now\', \'-' + hours + ' hours\')';
  let params = [];
  
  if (device_id) {
    query += ' AND device_id = ?';
    params.push(device_id);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  
  db.all(query, params, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// API endpoint for statistics
app.get('/api/stats', (req, res) => {
  const hours = parseInt(req.query.hours) || 24;
  const device_id = req.query.device_id;
  
  let query = `SELECT 
    AVG(temperature) as avg_temp,
    MIN(temperature) as min_temp,
    MAX(temperature) as max_temp,
    AVG(humidity) as avg_humidity,
    MIN(humidity) as min_humidity,
    MAX(humidity) as max_humidity,
    AVG(rainfall) as avg_rainfall,
    COUNT(*) as total_readings,
    COUNT(DISTINCT device_id) as device_count
    FROM sensor_data 
    WHERE timestamp >= datetime('now', '-${hours} hours')`;
  
  let params = [];
  if (device_id) {
    query += ' AND device_id = ?';
    params.push(device_id);
  }
  
  db.get(query, params, (err, row) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Round values to 2 decimal places
    if (row) {
      Object.keys(row).forEach(key => {
        if (typeof row[key] === 'number' && key !== 'total_readings' && key !== 'device_count') {
          row[key] = Math.round(row[key] * 100) / 100;
        }
      });
    }
    
    res.json(row);
  });
});

// API endpoint to get device list
app.get('/api/devices', (req, res) => {
  db.all(`SELECT 
    device_id,
    COUNT(*) as reading_count,
    MAX(timestamp) as last_seen,
    MIN(timestamp) as first_seen
    FROM sensor_data 
    GROUP BY device_id 
    ORDER BY last_seen DESC`, (err, rows) => {
    if (err) {
      console.error('Database error:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Serve the dashboard
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
  db.get('SELECT COUNT(*) as count FROM sensor_data', (err, row) => {
    if (err) {
      return res.status(500).json({ 
        status: 'ERROR', 
        database: 'disconnected',
        timestamp: new Date().toISOString() 
      });
    }
    
    res.json({ 
      status: 'OK',
      database: 'connected',
      total_records: row.count,
      uptime: process.uptime(),
      memory_usage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    });
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🌤️  Weather IoT Server running on port ${PORT}`);
  console.log(`📊 Dashboard: http://localhost:${PORT}`);
  console.log(`🔌 API endpoint: http://localhost:${PORT}/api/data`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`🐳 Environment: ${NODE_ENV}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed');
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n🔄 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ HTTP server closed');
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err.message);
      } else {
        console.log('✅ Database connection closed');
      }
      process.exit(0);
    });
  });
});