// Configuration
const BACKEND_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:8000' 
    : `http://${window.location.hostname}:8000`; 

let map, userMarker;
let watchId = null;
let pollInterval = null;
let isProactiveMode = false;
let currentLat = 23.06, currentLng = 76.84; 
let isTracking = false;
let isPowerSaver = false;

// Hardware & System State
let lastAcceleration = { x: null, y: null, z: null };
let impactTimerInt;
const IMPACT_THRESHOLD = 18;
let guardiansList = [];

// Mock Data
let currentPathLayer = null;
const originalBadRoute = [[23.060, 76.840], [23.065, 76.845], [23.070, 76.850]];
const safeAlternativeRoute = [[23.060, 76.840], [23.062, 76.835], [23.068, 76.842], [23.070, 76.850]];

const offlineCache = {
    saveData: (key, data) => localStorage.setItem(key, JSON.stringify(data)),
    getData: (key) => JSON.parse(localStorage.getItem(key))
};

const views = {
    dashboard: document.getElementById('dashboard-view'),
    testing: document.getElementById('testing-phase-view')
};

const mapWrapper = document.getElementById('map-wrapper');
const toggleMapBtn = document.getElementById('toggle-map-btn');
const startWalkBtn = document.getElementById('start-walk');
const routeModal = document.getElementById('route-modal');
const impactModal = document.getElementById('impact-modal');
const guardianModal = document.getElementById('guardian-modal');
const reportModal = document.getElementById('report-modal');

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    setupEventListeners();
    fetchNearbyMesh();
    offlineCache.saveData("darkSpots", [{lat: 23.07, lng: 76.85}]);
    initBatteryManager(); // Check hardware battery natively
});

function initMap() {
    map = L.map('map', {zoomControl: false, attributionControl: false}).setView([currentLat, currentLng], 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {}).addTo(map);
    
    // Draw known historical danger zones
    const spots = offlineCache.getData("darkSpots");
    if(spots) {
        spots.forEach(spot => {
            L.circle([spot.lat, spot.lng], {
                color: '#E50914', fillColor: '#E50914', fillOpacity: 0.2, weight: 2, radius: 200 
            }).addTo(map);
        });
    }

    // DRAW POIs (Police and Hospitals nearby)
    const policeIcon = L.divIcon({ className: 'custom-poi-marker', html: '<div style="color:blue;">🚓</div>', iconSize: [24,24] });
    const hospitalIcon = L.divIcon({ className: 'custom-poi-marker', html: '<div style="color:red;">🏥</div>', iconSize: [24,24] });

    L.marker([23.061, 76.838], {icon: policeIcon}).addTo(map).bindPopup("City Police Station");
    L.marker([23.056, 76.846], {icon: hospitalIcon}).addTo(map).bindPopup("General Hospital");
    
    updateUserPosition(currentLat, currentLng);
}

function setupEventListeners() {
    toggleMapBtn.addEventListener('click', toggleMapSize);
    document.getElementById('go-to-testing-btn').addEventListener('click', () => switchView('testing'));
    document.getElementById('close-testing-btn').addEventListener('click', () => switchView('dashboard'));
    startWalkBtn.addEventListener('click', toggleTracking);
    
    // Guardian Flow
    document.getElementById('add-guardian-btn').addEventListener('click', () => guardianModal.classList.remove('hidden'));
    document.getElementById('save-guardian-btn').addEventListener('click', saveGuardian);
    
    // Report Flow
    document.getElementById('report-btn').addEventListener('click', () => reportModal.classList.remove('hidden'));
    document.getElementById('submit-report-btn').addEventListener('click', submitReport);

    // SOS & Alerts
    document.getElementById('sos-btn').addEventListener('click', triggerSOS);
    
    document.getElementById('accept-route-btn').addEventListener('click', acceptSafeRoute);
    document.getElementById('reject-route-btn').addEventListener('click', () => routeModal.classList.add('hidden'));

    document.getElementById('impact-safe-btn').addEventListener('click', cancelImpactSOS);
    document.getElementById('impact-sos-btn').addEventListener('click', () => { cancelImpactSOS(); triggerSOS(); });
    
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        document.body.addEventListener('click', () => {
            DeviceMotionEvent.requestPermission().then(response => {
                if (response == 'granted') window.addEventListener('devicemotion', handleMotion);
            }).catch(console.error);
        }, { once: true });
    } else {
        window.addEventListener('devicemotion', handleMotion);
    }
}

function switchView(viewName) {
    Object.values(views).forEach(v => v.classList.remove('active'));
    views[viewName].classList.add('active');
}

function toggleMapSize() {
    const isFullscreen = mapWrapper.classList.contains('fullscreen-mode');
    if (isFullscreen) {
        mapWrapper.classList.remove('fullscreen-mode'); mapWrapper.classList.add('minimap-mode'); toggleMapBtn.innerHTML = '⛶';
    } else {
        mapWrapper.classList.remove('minimap-mode'); mapWrapper.classList.add('fullscreen-mode'); toggleMapBtn.innerHTML = '✕';
    }
    setTimeout(() => { map.invalidateSize(); if(currentLat) map.panTo([currentLat, currentLng]); }, 400);
}

// ----------------------------------------------------
// BATTERY API & POWER SAVING LOGIC
// ----------------------------------------------------

function initBatteryManager() {
    try {
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                battery.addEventListener('levelchange', () => assessBattery(battery));
                battery.addEventListener('chargingchange', () => assessBattery(battery));
                assessBattery(battery);
            });
        }
    } catch(e) {
        console.warn("Battery API unavailable in this browser.");
    }
}

function assessBattery(battery) {
    // If battery drops to exactly 20% or lower and we aren't plugged in
    if (battery.level <= 0.20 && !battery.charging) {
        if (!isPowerSaver) enablePowerSaverMode();
    } else {
        if (isPowerSaver) disablePowerSaverMode();
    }
}

function enablePowerSaverMode() {
    isPowerSaver = true;
    document.body.classList.add('power-saver-mode');
    document.getElementById('power-mode-text').innerText = "POWER SAVER";
    document.getElementById('power-mode-text').className = "color-warning";
    
    // Reboot tracking logic to use power-saver interval vs watchPosition
    if (isTracking) {
        stopTrackingCore(); 
        startTrackingCore();
    }
}

function disablePowerSaverMode() {
    isPowerSaver = false;
    document.body.classList.remove('power-saver-mode');
    document.getElementById('power-mode-text').innerText = "Performance";
    document.getElementById('power-mode-text').className = "color-safe";
    
    if (isTracking) {
        stopTrackingCore(); 
        startTrackingCore();
    }
}

// ----------------------------------------------------
// DYNAMIC AGGRESSIVE LOCATION TRACKING
// ----------------------------------------------------

function toggleTracking() {
    if(!isTracking) {
        isTracking = true;
        startWalkBtn.innerText = "System Active • Tap to Stop";
        startWalkBtn.classList.add('active-tracking');
        startTrackingCore();
    } else {
        stopTracking();
    }
}

function startTrackingCore() {
    if (!navigator.geolocation) return;

    if (isPowerSaver) {
        // [Power Saver] - Grab manual polling frame exactly every 15s to bypass continuous GPS lock drain
        pollInterval = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                processNewPosition, 
                console.error, 
                { enableHighAccuracy: false, maximumAge: 10000, timeout: 5000 }
            );
        }, 15000); 
        // trigger one explicitly to skip 15s lag internally
        navigator.geolocation.getCurrentPosition(processNewPosition);
    } else {
        // [Performance] - Constant smooth streaming GPS lock
        watchId = navigator.geolocation.watchPosition(
            processNewPosition,
            console.error,
            { enableHighAccuracy: true, maximumAge: 0 } 
        );
    }
}

function processNewPosition(position) {
    currentLat = position.coords.latitude; 
    currentLng = position.coords.longitude;
    updateUserPosition(currentLat, currentLng);
    pingRadarEngine(currentLat, currentLng);
}

function stopTrackingCore() {
    if(watchId) { navigator.geolocation.clearWatch(watchId); watchId = null; }
    if(pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function stopTracking() {
    isTracking = false;
    startWalkBtn.innerText = "Engage Safety Escort";
    startWalkBtn.classList.remove('active-tracking');
    stopTrackingCore();
    disableProactiveMode();
    if(currentPathLayer) map.removeLayer(currentPathLayer);
}

function updateUserPosition(lat, lng) {
    if (!userMarker) {
        const Icon = L.divIcon({
            className: 'custom-user-marker',
            html: '<div style="background-color: #FFF; width: 18px; height: 18px; border-radius: 50%; border: 3px solid #007AFF;"></div>',
            iconSize: [18, 18], iconAnchor: [9, 9]
        });
        userMarker = L.marker([lat, lng], {icon: Icon}).addTo(map);
        map.setView([lat, lng], 15);
    } else {
        userMarker.setLatLng([lat, lng]);
        map.panTo([lat, lng]);
    }
}

// ----------------------------------------------------
// FORMS: GUARDIANS & REPORTING logic
// ----------------------------------------------------

function saveGuardian() {
    const name = document.getElementById('guardian-name').value;
    const phone = document.getElementById('guardian-phone').value;
    if(name && phone) {
        guardiansList.push({name, phone});
        alert(`Guardian '${name}' successfully registered.`);
        guardianModal.classList.add('hidden');
    }
}

function submitReport() {
    L.circle([currentLat, currentLng], {
        color: '#f39c12', fillColor: '#f39c12', fillOpacity: 0.4, weight: 2, radius: 100 
    }).addTo(map);

    alert("Incident successfully broadcasted.");
    reportModal.classList.add('hidden');
    if(!mapWrapper.classList.contains('fullscreen-mode')) toggleMapSize();
}

// ----------------------------------------------------
// HARDWARE / ACCELEROMETER INTEGRATION
// ----------------------------------------------------

function handleMotion(event) {
    if (isPowerSaver) return; // Prevent draining sensors!

    let acc = event.accelerationIncludingGravity || event.acceleration;
    if (!acc.x) return; 

    let currentMagnitude = Math.sqrt(acc.x*acc.x + acc.y*acc.y + acc.z*acc.z);
    if (lastAcceleration.x !== null) {
        let delta = Math.abs(currentMagnitude - 9.8);
        if (delta > IMPACT_THRESHOLD) triggerImpactEvent();
        
        if (delta > 3) {
            document.getElementById('motion-state').innerText = "Running";
            document.getElementById('motion-state').className = "stat-value color-warning";
        } else {
            document.getElementById('motion-state').innerText = "Stable";
            document.getElementById('motion-state').className = "stat-value";
        }
    }
    lastAcceleration.x = acc.x;
}

function triggerImpactEvent() {
    if (!impactModal.classList.contains('hidden')) return; 
    impactModal.classList.remove('hidden');
    if (navigator.vibrate) navigator.vibrate([500, 200, 500, 200, 500]);
    let countdown = 10;
    const timerElem = document.getElementById('impact-timer');
    timerElem.innerText = countdown;
    impactTimerInt = setInterval(() => {
        countdown--; timerElem.innerText = countdown;
        if (countdown <= 0) {
            clearInterval(impactTimerInt); cancelImpactSOS(); triggerSOS();
        }
    }, 1000);
}

function cancelImpactSOS() {
    impactModal.classList.add('hidden'); clearInterval(impactTimerInt);
}

// ----------------------------------------------------
// PROACTIVE ROUTING AND API
// ----------------------------------------------------

function activateMockRoute(routeCoords, color) {
    if(currentPathLayer) map.removeLayer(currentPathLayer);
    currentPathLayer = L.polyline(routeCoords, { color: color, weight: 6, opacity: 0.8, lineCap: 'round', dashArray: '10, 10' }).addTo(map);
    if(mapWrapper.classList.contains('fullscreen-mode')) {
        map.fitBounds(currentPathLayer.getBounds(), {padding: [50, 50]});
    }
}

function acceptSafeRoute() {
    routeModal.classList.add('hidden');
    if(!mapWrapper.classList.contains('fullscreen-mode')) toggleMapSize();
    activateMockRoute(safeAlternativeRoute, '#2ecc71');
}

async function pingRadarEngine(lat, lng) {}
async function fetchNearbyMesh() { document.getElementById('guardian-count-grid').innerText = "14"; }

function triggerSOS() {
    document.body.style.backgroundColor = "white"; 
    setTimeout(() => { document.body.style.backgroundColor = ""; }, 100);
    
    if(guardiansList.length > 0) {
        let contactsStr = guardiansList.map(g => `${g.name} (${g.phone})`).join(', ');
        alert(`🚨 SOS TRIGGERED! Transmitting live video & location to: ${contactsStr}`);
    } else {
        alert("🚨 SOS TRIGGERED! Activating Cameras and Notifying Mesh Nodes...");
    }
}

// ----------------------------------------------------
// UI STATE TRANSITIONS & SIMULATIONS
// ----------------------------------------------------

function enableProactiveMode() {
    isProactiveMode = true; document.body.classList.add('proactive-mode');
    document.getElementById('risk-text').innerText = "DANGER ZONE ALGORITHM MATCH";
    document.getElementById('threat-level').innerText = "HIGH"; document.getElementById('threat-level').className = "stat-value color-danger";
    document.getElementById('status-desc').innerText = "Crime metrics indicate extreme risk.";
    document.getElementById('status-indicator').className = 'danger';
    document.querySelector('.normal-tools').style.display = 'none'; document.querySelector('.proactive-tools').style.display = 'block';
}

function disableProactiveMode() {
    isProactiveMode = false; document.body.classList.remove('proactive-mode');
    document.getElementById('risk-text').innerText = "System Active";
    document.getElementById('threat-level').innerText = "Low"; document.getElementById('threat-level').className = "stat-value color-safe";
    document.getElementById('status-desc').innerText = "Area secure. Proactive monitoring engaged.";
    document.getElementById('status-indicator').className = 'safe';
    document.querySelector('.normal-tools').style.display = 'block'; document.querySelector('.proactive-tools').style.display = 'none';
}

function simulateHighRisk() { switchView('dashboard'); enableProactiveMode(); updateUserPosition(23.07, 76.85); }
function simulateNormalRisk() { switchView('dashboard'); disableProactiveMode(); if(currentPathLayer) map.removeLayer(currentPathLayer); updateUserPosition(23.06, 76.84); }
function simulateReroutePopup() { switchView('dashboard'); activateMockRoute(originalBadRoute, '#E50914'); routeModal.classList.remove('hidden'); }
function simulateImpactEvent() { switchView('dashboard'); triggerImpactEvent(); }
function simulateRunning() { 
    switchView('dashboard'); 
    document.getElementById('motion-state').innerText = "Running"; document.getElementById('motion-state').className = "stat-value color-warning";
    setTimeout(() => { document.getElementById('motion-state').innerText = "Stable"; document.getElementById('motion-state').className = "stat-value"; }, 4000);
}
function simulatePowerSaver() { 
    switchView('dashboard'); 
    isPowerSaver ? disablePowerSaverMode() : enablePowerSaverMode(); 
}
