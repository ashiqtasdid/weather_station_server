// Global variables
let tempChart, humidityChart;
let autoRefresh = true;
let refreshInterval;
let countdownInterval;
let lastData = null;
let refreshCounter = 30;

// Initialize the dashboard
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    loadDevices();
    updateDashboard();
    startAutoRefresh();
    updateLastUpdated();
});

// Initialize Chart.js charts
function initCharts() {
    const tempCtx = document.getElementById('temperatureChart').getContext('2d');
    const humidityCtx = document.getElementById('humidityChart').getContext('2d');
    
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
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
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
                fill: true
            }, {
                label: 'Rainfall (%)',
                data: [],
                borderColor: '#00d2d3',
                backgroundColor: 'rgba(0, 210, 211, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
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

// Load available devices
async function loadDevices() {
    try {
        const response = await fetch('/api/devices');
        const devices = await response.json();
        
        const selector = document.getElementById('deviceSelector');
        selector.innerHTML = '<option value="">All Devices</option>';
        
        devices.forEach(device => {
            const option = document.createElement('option');
            option.value = device.device_id;
            option.textContent = `${device.device_id} (${device.reading_count} readings)`;
            selector.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error loading devices:', error);
    }
}

// Update dashboard with latest data
async function updateDashboard() {
    try {
        const deviceId = document.getElementById('deviceSelector').value;
        const params = deviceId ? `?device_id=${deviceId}` : '';
        
        // Get latest data
        const latestResponse = await fetch(`/api/latest${params}`);
        const latest = await latestResponse.json();
        
        // Get historical data for charts
        const hours = document.getElementById('tempTimeRange')?.value || 24;
        const historyResponse = await fetch(`/api/history?hours=${hours}&limit=100${deviceId ? `&device_id=${deviceId}` : ''}`);
        const history = await historyResponse.json();
        
        // Update connection status
        updateConnectionStatus(latest);
        
        // Update current stats
        updateStats(latest);
        
        // Update charts
        updateChartsData(history);
        
        // Store for trend calculation
        if (latest.timestamp) {
            calculateTrends(latest);
            lastData = latest;
        }
        
    } catch (error) {
        console.error('Error updating dashboard:', error);
        updateConnectionStatus(null, error);
    }
}

// Update connection status
function updateConnectionStatus(latest, error = null) {
    const statusIndicator = document.getElementById('connectionStatus');
    const statusText = document.getElementById('connectionText');
    
    if (error) {
        statusIndicator.textContent = '🔴';
        statusText.textContent = 'Connection Error';
        statusText.className = 'error';
        return;
    }
    
    if (latest && latest.timestamp) {
        const lastUpdate = new Date(latest.timestamp);
        const now = new Date();
        const diffMinutes = (now - lastUpdate) / (1000 * 60);
        
        if (diffMinutes < 5) {
            statusIndicator.textContent = '🟢';
            statusText.textContent = 'Online';
            statusText.className = 'success';
        } else if (diffMinutes < 15) {
            statusIndicator.textContent = '🟡';
            statusText.textContent = 'Warning';
            statusText.className = 'warning';
        } else {
            statusIndicator.textContent = '🔴';
            statusText.textContent = 'Offline';
            statusText.className = 'error';
        }
    } else {
        statusIndicator.textContent = '⚪';
        statusText.textContent = 'No Data';
        statusText.className = '';
    }
}

// Update statistics display
function updateStats(latest) {
    if (!latest || !latest.timestamp) {
        // Show placeholder values
        document.getElementById('tempValue').textContent = '--';
        document.getElementById('humidityValue').textContent = '--';
        document.getElementById('rainfallValue').textContent = '--';
        document.getElementById('lightValue').textContent = '--';
        return;
    }
    
    // Update values
    document.getElementById('tempValue').textContent = latest.temperature.toFixed(1);
    document.getElementById('humidityValue').textContent = Math.round(latest.humidity);
    document.getElementById('rainfallValue').textContent = latest.rainfall;
    document.getElementById('lightValue').textContent = latest.light_level;
    
    // Update light icon based on level
    const lightIcon = document.getElementById('lightIcon');
    lightIcon.textContent = latest.light_level === 'High' ? '☀️' : '🌙';
}

// Calculate and display trends
function calculateTrends(current) {
    if (!lastData) return;
    
    const trends = {
        temperature: current.temperature - lastData.temperature,
        humidity: current.humidity - lastData.humidity,
        rainfall: current.rainfall - lastData.rainfall
    };
    
    updateTrendIndicator('tempTrend', trends.temperature);
    updateTrendIndicator('humidityTrend', trends.humidity);
    updateTrendIndicator('rainfallTrend', trends.rainfall);
}

// Update trend indicator
function updateTrendIndicator(elementId, change) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    if (Math.abs(change) < 0.1) {
        element.textContent = '➡️';
        element.title = 'Stable';
    } else if (change > 0) {
        element.textContent = '📈';
        element.title = `+${change.toFixed(1)}`;
    } else {
        element.textContent = '📉';
        element.title = `${change.toFixed(1)}`;
    }
}

// Update charts with historical data
function updateChartsData(history) {
    if (!history || history.length === 0) return;
    
    // Reverse to show oldest to newest
    const sortedHistory = history.reverse();
    
    const labels = sortedHistory.map(item => {
        const date = new Date(item.timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    });
    
    // Temperature chart
    tempChart.data.labels = labels;
    tempChart.data.datasets[0].data = sortedHistory.map(item => item.temperature);
    tempChart.update('none');
    
    // Humidity chart
    humidityChart.data.labels = labels;
    humidityChart.data.datasets[0].data = sortedHistory.map(item => item.humidity);
    humidityChart.data.datasets[1].data = sortedHistory.map(item => item.rainfall);
    humidityChart.update('none');
}

// Update charts when time range changes
function updateCharts() {
    updateDashboard();
}

// Auto-refresh functionality
function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    
    if (autoRefresh) {
        refreshInterval = setInterval(updateDashboard, 30000); // 30 seconds
        startCountdown();
    }
}

function startCountdown() {
    refreshCounter = 30;
    countdownInterval = setInterval(() => {
        refreshCounter--;
        document.getElementById('refreshCountdown').textContent = `${refreshCounter}s`;
        
        if (refreshCounter <= 0) {
            refreshCounter = 30;
        }
    }, 1000);
}

function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefresh) {
        btn.textContent = '⏸️ Pause';
        startAutoRefresh();
    } else {
        btn.textContent = '▶️ Resume';
        if (refreshInterval) clearInterval(refreshInterval);
        if (countdownInterval) clearInterval(countdownInterval);
        document.getElementById('refreshCountdown').textContent = 'Paused';
    }
}

// Export data functionality
async function exportData() {
    try {
        const hours = prompt('Export data for how many hours? (default: 24)', '24');
        if (!hours) return;
        
        const response = await fetch(`/api/history?hours=${hours}&limit=1000`);
        const data = await response.json();
        
        if (data.length === 0) {
            alert('No data available for export');
            return;
        }
        
        // Convert to CSV
        const headers = ['Timestamp', 'Temperature', 'Humidity', 'Rainfall', 'Light Level', 'Device ID'];
        const csvContent = [
            headers.join(','),
            ...data.map(row => [
                row.timestamp,
                row.temperature,
                row.humidity,
                row.rainfall,
                row.light_level,
                row.device_id
            ].join(','))
        ].join('\n');
        
        // Download file
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `weather_data_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        console.error('Export error:', error);
        alert('Error exporting data');
    }
}

// Show statistics modal
async function showStats() {
    try {
        const response = await fetch('/api/stats?hours=24');
        const stats = await response.json();
        
        const content = document.getElementById('statsContent');
        content.innerHTML = `
            <div class="stats-row">
                <div class="stats-item">
                    <div class="value">${stats.total_readings || 0}</div>
                    <div class="label">Total Readings</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.device_count || 0}</div>
                    <div class="label">Active Devices</div>
                </div>
            </div>
            
            <h4>Temperature Statistics</h4>
            <div class="stats-row">
                <div class="stats-item">
                    <div class="value">${stats.avg_temp ? stats.avg_temp.toFixed(1) : '--'}°C</div>
                    <div class="label">Average</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.min_temp ? stats.min_temp.toFixed(1) : '--'}°C</div>
                    <div class="label">Minimum</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.max_temp ? stats.max_temp.toFixed(1) : '--'}°C</div>
                    <div class="label">Maximum</div>
                </div>
            </div>
            
            <h4>Humidity Statistics</h4>
            <div class="stats-row">
                <div class="stats-item">
                    <div class="value">${stats.avg_humidity ? Math.round(stats.avg_humidity) : '--'}%</div>
                    <div class="label">Average</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.min_humidity ? Math.round(stats.min_humidity) : '--'}%</div>
                    <div class="label">Minimum</div>
                </div>
                <div class="stats-item">
                    <div class="value">${stats.max_humidity ? Math.round(stats.max_humidity) : '--'}%</div>
                    <div class="label">Maximum</div>
                </div>
            </div>
            
            <h4>Rainfall</h4>
            <div class="stats-row">
                <div class="stats-item">
                    <div class="value">${stats.avg_rainfall ? Math.round(stats.avg_rainfall) : '--'}%</div>
                    <div class="label">Average</div>
                </div>
            </div>
        `;
        
        document.getElementById('statsModal').style.display = 'flex';
        
    } catch (error) {
        console.error('Stats error:', error);
        alert('Error loading statistics');
    }
}

function closeStatsModal() {
    document.getElementById('statsModal').style.display = 'none';
}

// Data table functionality
function toggleDataTable() {
    const table = document.getElementById('dataTable');
    if (table.style.display === 'none') {
        loadDataTable();
        table.style.display = 'block';
    } else {
        table.style.display = 'none';
    }
}

async function loadDataTable() {
    try {
        const response = await fetch('/api/history?hours=24&limit=50');
        const data = await response.json();
        
        const tbody = document.getElementById('tableBody');
        tbody.innerHTML = data.map(row => `
            <tr>
                <td>${new Date(row.timestamp).toLocaleString()}</td>
                <td>${row.temperature.toFixed(1)}°C</td>
                <td>${Math.round(row.humidity)}%</td>
                <td>${row.rainfall}%</td>
                <td>${row.light_level}</td>
                <td>${row.device_id}</td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Table loading error:', error);
    }
}

// Update last updated timestamp
function updateLastUpdated() {
    setInterval(() => {
        const now = new Date();
        document.getElementById('lastUpdated').textContent = 
            `Last updated: ${now.toLocaleString()}`;
    }, 1000);
}

// Device selector change handler
document.getElementById('deviceSelector').addEventListener('change', updateDashboard);

// Close modal when clicking outside
document.getElementById('statsModal').addEventListener('click', (e) => {
    if (e.target.id === 'statsModal') {
        closeStatsModal();
    }
});