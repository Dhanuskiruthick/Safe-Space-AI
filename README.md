# 🛡️ SafeSpace AI

**SafeSpace AI** is a proactive, context-aware mobile safety application built to shift personal security from reactive emergency responses to intelligent, preventative protection. Designed natively as a Hackathon prototype, it leverages modern web APIs and advanced UI/UX principles to act as an invisible, intelligent safety escort in your pocket.

---

## 🌟 Key Features

### 1. Proactive Dynamic Routing
Instead of just telling you where you are, SafeSpace tells you where *not* to go. The application cross-references your trajectory with known "Dark Spots" (areas of historical crime or poor lighting). 
If danger is detected ahead, a **Netflix-styled interactive modal** seamlessly interrupts you to suggest an alternative, well-lit, highly trafficked route.

### 2. Autonomous Hardware Incident Detection
SafeSpace hooks directly into the browser's native `DeviceMotionEvent` API to read your device's accelerometer. 
By calculating real-time 3D vector magnitude, the application detects running or **Violent Impacts** (e.g., severe falls or collisions) and automatically triggers a 10-second `Auto-SOS` countdown, keeping you safe even if you are incapacitated.

### 3. Intelligent Battery Management 
Safety apps typically drain batteries through continuous GPS polling. We solved this using the `navigator.getBattery()` API.
When your device drops below 20%, SafeSpace enters an aggressive **Power Saver Mode**:
- Pure-black CSS disables OLED pixels.
- GPU-heavy glassmorphism and animations are abruptly stripped away.
- Geolocation polling intelligently throttles from a continuous aggressive stream to a measured 15-second background interval loop.

### 4. Crowdsourced Threat Reporting
A native reporting form allows users to instantly flag suspicious activity or poor lighting. Upon broadcast, a glowing orange radius is immediately appended to the live Mesh network map, warning nearby guardians and users of real-time threats.

### 5. Style HUD & Cinematic UI
The interface operates completely on a meticulously designed **Cinematic Dark Mode** with high visual contrast. The map acts as a persistent, circular style radar stuck efficiently to the bottom right of the screen for one-handed thumb use, but can be seamlessly expanded to full-screen heatmap rendering at the tap of a button.

---

## 🛠️ Tech Stack

**Frontend:**
- Pure Vanilla HTML5, JavaScript, and CSS3
- No heavy frameworks, purely relying on modern DOM Manipulation for blazing fast performance.
- **Mapping**: Leaflet.js (Map tiles inverted dynamically via CSS for dark-mode mapping without paid API keys).

**Backend:**
- **Python / FastAPI**
- Capable of exposing the Radar Engine (`/api/location/ping`) and Mesh network guardian logic.

---

## 🚀 How to Run Locally

Because the frontend is decoupled from the backend logic, running this is extremely simple. Open **two terminal windows**:

### 1. Start the Backend API
```bash
cd backend
pip install -r requirements.txt
python main.py
```
*(The backend server will spin up on `http://0.0.0.0:8000`)*

### 2. Start the Frontend Application
```bash
cd frontend
python -m http.server 3000
```
*(Alternatively, you can use `npx serve -l 3000` or `npx live-server`)*

### 3. Access the Application
Open your web browser and navigate to:
**`http://localhost:3000`**

*(Note: For the best experience, open Chrome DevTools (F12) and toggle the Device Toolbar to simulate an iPhone/Android screen shape to see the GTA Minimap and layout respond dynamically!)*

---

## 🧪 Developer Demo Mode

For Hackathon presentations, there is a dedicated **Dev Tools** button on the bottom of the main dashboard. This grants access to a hidden suite of Simulation options that let you forcefully present the app's capabilities without needing to physically run around outside:

- **Trigger Reroute Alert**: Simulates walking directly into a dark spot to demonstrate Proactive Routing logic mapping alternative safe havens.
- **Simulate Sudden Impact**: Visually triggers the massive hardware accelerometer impact UI to showcase the auto-countdown SOS modal.
- **Toggle Power Saver**: Overrides the Chrome hardware battery status so judges can watch the OLED optimization CSS shift happen right before their eyes.
