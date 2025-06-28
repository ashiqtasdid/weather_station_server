# Weather Station Server - Docker Deployment

This guide helps you deploy the Weather Station Server on your VPS with Docker.

## VPS Information
- **IP Address**: 37.114.41.124
- **Services**: 
  - Weather Station API & Dashboard
  - Nginx Reverse Proxy
  - SQLite Database

## 🚀 Quick Deployment

### 1. Prerequisites on VPS
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/download/v2.24.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
```

### 2. Deploy the Application
```bash
# Clone/upload your project to VPS
# cd /path/to/weather_station_server

# Make deployment script executable
chmod +x deploy.sh

# Run deployment
./deploy.sh
```

### 3. Access Your Application
- **Dashboard**: http://37.114.41.124
- **API**: http://37.114.41.124/api/data
- **Health Check**: http://37.114.41.124/health

## 🔧 Arduino Configuration

Update your Arduino code with the VPS IP:

```cpp
// Server configuration
const char* serverURL = "http://37.114.41.124:6065/api/data";
const char* serverHost = "37.114.41.124";
const int serverPort = 6065;
```

## 📊 Container Services

### Weather IoT Server
- **Port**: 6065
- **Container**: weather-iot-server
- **Health Check**: Every 30s
- **Restart Policy**: unless-stopped

### Nginx Reverse Proxy
- **Ports**: 80 (HTTP), 443 (HTTPS)
- **Container**: weather-nginx
- **Features**: Rate limiting, gzip, security headers

## 🛠️ Management Commands

```bash
# View real-time logs
docker-compose logs -f

# View specific service logs
docker-compose logs weather-iot
docker-compose logs nginx

# Stop all services
docker-compose down

# Restart services
docker-compose restart

# Update and restart
docker-compose up --build -d

# Check container status
docker-compose ps

# View system resources
docker stats

# Clean up unused containers and images
docker system prune -f
```

## 🔐 Security Features

1. **Rate Limiting**: 
   - API: 10 requests/second
   - Dashboard: 5 requests/second

2. **Security Headers**:
   - X-Frame-Options: DENY
   - X-Content-Type-Options: nosniff
   - X-XSS-Protection: enabled

3. **Non-root User**: App runs as nodejs user (UID 1001)

4. **CORS**: Configured for Arduino uploads

## 📁 File Structure

```
weather_station_server/
├── docker-compose.yml    # Main deployment config
├── Dockerfile           # Application container
├── nginx.conf          # Nginx configuration
├── deploy.sh           # Deployment script
├── server.js           # Node.js application
├── public/             # Frontend files
├── data/               # SQLite database (persistent)
└── logs/               # Application logs
```

## 🔄 Data Persistence

- **Database**: Stored in Docker volume `weather_data`
- **Logs**: Mounted to `./logs` directory
- **Backup**: Database located at `/var/lib/docker/volumes/weather_station_server_weather_data/_data/`

## 🌐 HTTPS Setup (Optional)

1. Get SSL certificate (Let's Encrypt recommended):
```bash
# Install certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com
```

2. Copy certificates to ssl folder:
```bash
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem ./ssl/cert.pem
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem ./ssl/key.pem
```

3. Uncomment HTTPS server block in nginx.conf

4. Restart services:
```bash
docker-compose restart nginx
```

## 🐛 Troubleshooting

### Container Won't Start
```bash
# Check logs
docker-compose logs weather-iot

# Check container status
docker-compose ps

# Restart specific service
docker-compose restart weather-iot
```

### Database Issues
```bash
# Check database permissions
docker-compose exec weather-iot ls -la /app/data/

# Reset database (CAUTION: This deletes all data)
docker-compose down
docker volume rm weather_station_server_weather_data
docker-compose up -d
```

### Network Issues
```bash
# Check if ports are open
sudo netstat -tulpn | grep :80
sudo netstat -tulpn | grep :6065

# Check firewall
sudo ufw status
sudo ufw allow 80
sudo ufw allow 443
```

### Arduino Connection Issues
1. Verify VPS IP: 37.114.41.124
2. Check if port 6065 is accessible
3. Ensure firewall allows incoming connections
4. Verify Arduino WiFi connection

## 📈 Monitoring

### View Metrics
```bash
# Container resource usage
docker stats

# System resources
htop

# Disk usage
df -h
du -sh /var/lib/docker/
```

### Logs
```bash
# Application logs
docker-compose logs -f weather-iot

# Nginx access logs
docker-compose logs nginx

# System logs
journalctl -u docker
```

## 🔄 Updates

To update the application:

1. Pull latest code
2. Run deployment script:
```bash
./deploy.sh
```

The script will:
- Build new images
- Update containers
- Preserve database data
- Apply configuration changes
