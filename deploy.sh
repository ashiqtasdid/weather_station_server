#!/bin/bash

# Weather Station Server - VPS Deployment Script
# VPS IP: 37.114.41.124

set -e

echo "🚀 Starting Weather Station Server deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo -e "${RED}❌ Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
fi

# Create necessary directories
echo -e "${YELLOW}📁 Creating directories...${NC}"
mkdir -p logs
mkdir -p ssl

# Create logs directory if it doesn't exist
sudo mkdir -p /var/log/weather-station

# Stop any running containers
echo -e "${YELLOW}🛑 Stopping existing containers...${NC}"
docker-compose down --remove-orphans || true

# Remove old images (optional - uncomment if you want to force rebuild)
# echo -e "${YELLOW}🗑️ Removing old images...${NC}"
# docker rmi weather_station_server_weather-iot || true

# Build and start services
echo -e "${YELLOW}🔨 Building and starting services...${NC}"
docker-compose up --build -d

# Wait for services to be healthy
echo -e "${YELLOW}⏳ Waiting for services to be healthy...${NC}"
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up (healthy)"; then
    echo -e "${GREEN}✅ Weather Station Server is running successfully!${NC}"
    echo -e "${GREEN}📊 Dashboard: http://37.114.41.124${NC}"
    echo -e "${GREEN}🔌 API endpoint: http://37.114.41.124/api/data${NC}"
    echo -e "${GREEN}🏥 Health check: http://37.114.41.124/health${NC}"
else
    echo -e "${RED}❌ Failed to start services. Checking logs...${NC}"
    docker-compose logs --tail=50
    exit 1
fi

# Show running containers
echo -e "${YELLOW}📋 Running containers:${NC}"
docker-compose ps

# Show logs
echo -e "${YELLOW}📝 Recent logs:${NC}"
docker-compose logs --tail=20

echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${YELLOW}💡 Useful commands:${NC}"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop services: docker-compose down"
echo "  - Restart services: docker-compose restart"
echo "  - Update and restart: docker-compose up --build -d"

# Display Arduino configuration
echo -e "${YELLOW}🔧 Arduino Configuration:${NC}"
echo "Update your Arduino code with:"
echo "const char* serverHost = \"37.114.41.124\";"
echo "const char* serverURL = \"http://37.114.41.124:6065/api/data\";"
