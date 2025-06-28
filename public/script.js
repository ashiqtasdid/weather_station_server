// Arduino Weather Station Dashboard - Enhanced Dark Theme
let tempChart, humidityChart;
let autoRefresh = true;
let refreshInterval;
let countdownInterval;
let lastData = null;
let refreshCounter = 30;
let previousData = null;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    updateDashboard();
    startAutoRefresh();
    updateLastUpdated();
});

// Initialize Chart.js charts with dark theme
function initCharts() {
    const tempCtx = document.getElementById('temperatureChart').getContext('2d');
    const humidityCtx = document.getElementById('humidityChart').getContext('2d');
    
    Chart.defaults.color = '#a8b3c7';
    Chart.defaults.borderColor = 'rgba(255, 255, 255, 0.1)';
    Chart.defaults.backgroundColor = 'rgba(255, 255, 255, 0.05)';
    
    tempChart = new Chart(tempCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Temperature (°C)',
                data: [],
                borderColor: '#ff6b6b',
                backgroundColor: 'rgba(255, 107, 107, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#ff6b6b',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        color: '#a8b3c7'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 31, 37, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#a8b3c7',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a8b3c7'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a8b3c7',
                        maxTicksLimit: 10
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    
    humidityChart = new Chart(humidityCtx, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Humidity (%)',
                data: [],
                borderColor: '#54a0ff',
                backgroundColor: 'rgba(84, 160, 255, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#54a0ff',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }, {
                label: 'Rain Level (%)',
                data: [],
                borderColor: '#00d2d3',
                backgroundColor: 'rgba(0, 210, 211, 0.1)',
                tension: 0.4,
                fill: true,
                pointBackgroundColor: '#00d2d3',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20,
                        color: '#a8b3c7'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(26, 31, 37, 0.9)',
                    titleColor: '#ffffff',
                    bodyColor: '#a8b3c7',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a8b3c7'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        color: '#a8b3c7',
                        maxTicksLimit: 10
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
}

// Update dashboard with latest data
async function updateDashboard() {
    try {
        showLoadingState();
        
        // Fetch latest data
        const response = await fetch('/api/latest');
        const data = await response.json();
        
        if (data && data.temperature !== undefined) {
            updateMainStats(data);
            updateConnectionStatus(true, data);
            lastData = data;
            
            // Calculate trends if we have previous data
            if (previousData) {
                updateTrends(data, previousData);
            }
            previousData = data;
        } else {
            updateConnectionStatus(false);
        }
        
        // Update charts
        await updateCharts();
        
        hideLoadingState();
        
    } catch (error) {
        console.error('Error updating dashboard:', error);
        updateConnectionStatus(false);
        hideLoadingState();
    }
}

// Update main statistics cards
function updateMainStats(data) {
    // Temperature
    document.getElementById('tempValue').textContent = `${data.temperature.toFixed(1)}°C`;
    
    // Humidity
    document.getElementById('humidityValue').textContent = `${Math.round(data.humidity)}%`;
    
    // Pressure - use real data if available
    let pressure = data.pressure ? (data.pressure / 100).toFixed(1) : 1013; // Convert Pa to hPa
    document.getElementById('pressureValue').textContent = `${pressure} hPa`;
    
    // Rainfall
    document.getElementById('rainfallValue').textContent = `${data.rainfall}%`;
    const rainCondition = getRainCondition(data.rainfall);
    document.getElementById('rainCondition').textContent = rainCondition;
    
    // Light Level
    document.getElementById('lightValue').textContent = data.light_level;
    const lightIcon = document.getElementById('lightIcon');
    const lightStatus = document.getElementById('lightStatus');
    
    if (data.light_level === 'Bright') {
        lightIcon.textContent = '☀️';
        lightStatus.textContent = 'Daylight detected';
        lightStatus.style.color = '#feca57';
    } else {
        lightIcon.textContent = '🌙';
        lightStatus.textContent = 'Low light/Night';
        lightStatus.style.color = '#a8b3c7';
    }
    
    // Update light time
    const now = new Date();
    document.getElementById('lightTime').textContent = now.toLocaleTimeString();
    
    // Connection status
    document.getElementById('connectionValue').textContent = 'Online';
    document.getElementById('deviceName').textContent = data.device_id || 'weather_station_01';
}

// Update trends compared to previous reading
function updateTrends(current, previous) {
    updateTrendIndicator('tempTrend', current.temperature, previous.temperature, '°C');
    updateTrendIndicator('humidityTrend', current.humidity, previous.humidity, '%');
    updateTrendIndicator('rainfallTrend', current.rainfall, previous.rainfall, '%');
}

function updateTrendIndicator(elementId, current, previous, unit) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    const diff = current - previous;
    
    if (Math.abs(diff) < 0.1) {
        element.textContent = '→ Stable';
        element.className = 'trend stable';
    } else if (diff > 0) {
        element.textContent = `↗ +${diff.toFixed(1)}${unit}`;
        element.className = 'trend up';
    } else {
        element.textContent = `↘ ${diff.toFixed(1)}${unit}`;
        element.className = 'trend down';
    }
}

// Get rain condition description
function getRainCondition(percentage) {
    if (percentage <= 10) return 'Dry conditions';
    if (percentage <= 30) return 'Light moisture';
    if (percentage <= 60) return 'Moderate rain';
    if (percentage <= 80) return 'Heavy rain';
    return 'Very heavy rain';
}

// Update connection status
function updateConnectionStatus(isOnline, data = null) {
    const statusDot = document.getElementById('statusDot');
    const connectionValue = document.getElementById('connectionValue');
    const uptime = document.getElementById('uptime');
    const lastSeen = document.getElementById('lastSeen');
    
    if (isOnline) {
        statusDot.style.background = '#10b981';
        connectionValue.textContent = 'Online';
        connectionValue.style.color = '#10b981';
        
        if (data) {
            const timestamp = new Date(data.timestamp);
            lastSeen.textContent = formatTime(timestamp);
            
            // Calculate uptime (mock calculation)
            const now = new Date();
            const diffMs = now - timestamp;
            const diffMins = Math.floor(diffMs / 60000);
            uptime.textContent = diffMins < 60 ? `${diffMins}m` : `${Math.floor(diffMins/60)}h ${diffMins%60}m`;
        }
    } else {
        statusDot.style.background = '#ef4444';
        connectionValue.textContent = 'Offline';
        connectionValue.style.color = '#ef4444';
        uptime.textContent = '--';
        lastSeen.textContent = '--';
    }
}

// Update charts with historical data
async function updateCharts() {
    try {
        const tempHours = document.getElementById('tempTimeRange').value;
        const humidityHours = document.getElementById('humidityTimeRange').value;
        
        // Fetch historical data
        const tempResponse = await fetch(`/api/history?hours=${tempHours}&limit=100`);
        const tempData = await tempResponse.json();
        
        const humidityResponse = await fetch(`/api/history?hours=${humidityHours}&limit=100`);
        const humidityData = await humidityResponse.json();
        
        // Update temperature chart
        if (tempData && tempData.length > 0) {
            const tempLabels = tempData.map(d => formatChartTime(new Date(d.timestamp)));
            const tempValues = tempData.map(d => d.temperature);
            
            tempChart.data.labels = tempLabels.reverse();
            tempChart.data.datasets[0].data = tempValues.reverse();
            tempChart.update();
        }
        
        // Update humidity chart
        if (humidityData && humidityData.length > 0) {
            const humidityLabels = humidityData.map(d => formatChartTime(new Date(d.timestamp)));
            const humidityValues = humidityData.map(d => d.humidity);
            const rainfallValues = humidityData.map(d => d.rainfall);
            
            humidityChart.data.labels = humidityLabels.reverse();
            humidityChart.data.datasets[0].data = humidityValues.reverse();
            humidityChart.data.datasets[1].data = rainfallValues.reverse();
            humidityChart.update();
        }
        
        // Update ranges
        await updateStatRanges();
        
    } catch (error) {
        console.error('Error updating charts:', error);
    }
}

// Update stat ranges
async function updateStatRanges() {
    try {
        const response = await fetch('/api/stats?hours=24');
        const stats = await response.json();
        
        if (stats) {
            document.getElementById('tempRange').textContent = 
                `${stats.min_temp?.toFixed(1) || '--'} to ${stats.max_temp?.toFixed(1) || '--'}°C`;
            document.getElementById('humidityRange').textContent = 
                `${Math.round(stats.min_humidity) || '--'} to ${Math.round(stats.max_humidity) || '--'}%`;
            
            // Real pressure range from data
            document.getElementById('pressureRange').textContent = 
                `${stats.min_pressure ? (stats.min_pressure / 100).toFixed(1) : '--'} to ${stats.max_pressure ? (stats.max_pressure / 100).toFixed(1) : '--'} hPa`;
        }
    } catch (error) {
        console.error('Error updating stat ranges:', error);
    }
}

// Auto refresh functionality
function startAutoRefresh() {
    refreshInterval = setInterval(() => {
        if (autoRefresh) {
            updateDashboard();
        }
    }, 30000); // 30 seconds
    
    startCountdown();
}

function startCountdown() {
    refreshCounter = 30;
    updateCountdownDisplay();
    
    countdownInterval = setInterval(() => {
        refreshCounter--;
        updateCountdownDisplay();
        
        if (refreshCounter <= 0) {
            refreshCounter = 30;
        }
    }, 1000);
}

function updateCountdownDisplay() {
    document.getElementById('refreshCountdown').textContent = `${refreshCounter}s`;
    
    // Update progress bar
    const progressBar = document.getElementById('progressBar');
    if (progressBar) {
        const percentage = ((30 - refreshCounter) / 30) * 100;
        progressBar.style.width = `${percentage}%`;
    }
}

function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefresh) {
        btn.textContent = '⏸️ Pause Updates';
        startCountdown();
    } else {
        btn.textContent = '▶️ Resume Updates';
        clearInterval(countdownInterval);
        document.getElementById('refreshCountdown').textContent = 'Paused';
        const progressBar = document.getElementById('progressBar');
        if (progressBar) {
            progressBar.style.width = '0%';
        }
    }
}

// Show/hide functions
function showHistory() {
    const table = document.getElementById('dataTable');
    table.style.display = table.style.display === 'none' ? 'block' : 'none';
    
    if (table.style.display === 'block') {
        loadHistoryTable();
    }
}

function toggleDataTable() {
    document.getElementById('dataTable').style.display = 'none';
}

async function loadHistoryTable() {
    try {
        const response = await fetch('/api/history?hours=24&limit=50');
        const data = await response.json();
        
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = '';
        
        data.forEach(reading => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${formatTime(new Date(reading.timestamp))}</td>
                <td>${reading.temperature.toFixed(1)}°C</td>
                <td>${Math.round(reading.humidity)}%</td>
                <td>${reading.rainfall}%</td>
                <td>${reading.light_level}</td>
                <td>${reading.device_id}</td>
            `;
        });
    } catch (error) {
        console.error('Error loading history table:', error);
    }
}

async function showStats() {
    const modal = document.getElementById('statsModal');
    modal.classList.add('show');
    modal.style.display = 'flex';
    
    try {
        const response = await fetch('/api/stats?hours=24');
        const stats = await response.json();
        
        const content = document.getElementById('statsContent');
        content.innerHTML = `
            <div class="stats-row">
                <div class="stats-item">
                    <div class="value">${stats.avg_temp?.toFixed(1) || '--'}</div>
                    <div class="label">Avg Temperature (°C)</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.max_temp?.toFixed(1) || '--'}</div>
                    <div class="label">Max Temperature (°C)</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.min_temp?.toFixed(1) || '--'}</div>
                    <div class="label">Min Temperature (°C)</div>
                </div>
            </div>
            <div class="stats-row">
                <div class="stats-item">
                    <div class="value">${Math.round(stats.avg_humidity) || '--'}</div>
                    <div class="label">Avg Humidity (%)</div>
                </div>
                <div class="stats-item">
                    <div class="value">${Math.round(stats.max_humidity) || '--'}</div>
                    <div class="label">Max Humidity (%)</div>
                </div>
                <div class="stats-item">
                    <div class="value">${Math.round(stats.min_humidity) || '--'}</div>
                    <div class="label">Min Humidity (%)</div>
                </div>
            </div>
            <div class="stats-row">
                <div class="stats-item">
                    <div class="value">${Math.round(stats.avg_rainfall) || '--'}</div>
                    <div class="label">Avg Rain Level (%)</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.total_readings || '--'}</div>
                    <div class="label">Total Readings</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.device_count || '--'}</div>
                    <div class="label">Active Devices</div>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Error loading stats:', error);
        document.getElementById('statsContent').innerHTML = '<p>Error loading statistics</p>';
    }
}

function closeStatsModal() {
    const modal = document.getElementById('statsModal');
    modal.classList.remove('show');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

async function exportData() {
    try {
        const response = await fetch('/api/history?hours=168&limit=1000'); // Last week
        const data = await response.json();
        
        if (data && data.length > 0) {
            const csv = convertToCSV(data);
            downloadCSV(csv, 'weather_data.csv');
        } else {
            alert('No data available for export');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        alert('Error exporting data');
    }
}

function convertToCSV(data) {
    const headers = ['Timestamp', 'Temperature', 'Humidity', 'Rainfall', 'Light Level', 'Device ID'];
    const rows = data.map(row => [
        row.timestamp,
        row.temperature,
        row.humidity,
        row.rainfall,
        row.light_level,
        row.device_id
    ]);
    
    return [headers, ...rows].map(row => row.join(',')).join('\n');
}

function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('hidden', '');
    a.setAttribute('href', url);
    a.setAttribute('download', filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Utility functions
function formatTime(date) {
    return date.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatChartTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

function updateLastUpdated() {
    const now = new Date();
    const element = document.getElementById('lastUpdated');
    if (element) {
        element.textContent = `Last updated: ${now.toLocaleTimeString()}`;
    }
}

function showLoadingState() {
    // Add loading indicators if needed
}

function hideLoadingState() {
    updateLastUpdated();
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('statsModal');
    if (e.target === modal) {
        closeStatsModal();
    }
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeStatsModal();
        toggleDataTable();
    }
    if (e.key === ' ') {
        e.preventDefault();
        toggleAutoRefresh();
    }
});