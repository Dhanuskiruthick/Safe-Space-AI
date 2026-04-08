from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math
import logging

# Setup basic logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SafeSpace AI API")

# Setup CORS to allow physical device connecting over local network
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mock Data for Dark Spots - Add a few default coords
# e.g., representing high risk areas
DARK_SPOTS = [
    {"lat": 23.07, "lng": 76.85},
    # Add more as needed for the demo
]

class LocationData(BaseModel):
    lat: float
    lng: float

class SOSData(BaseModel):
    user_id: int
    type: str

def haversine_distance(lat1, lon1, lat2, lon2):
    """
    Calculate the great circle distance in meters between two points 
    on the earth (specified in decimal degrees)
    """
    R = 6371000  # radius of Earth in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = math.sin(delta_phi/2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * \
        math.sin(delta_lambda/2.0)**2
        
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    distance = R * c
    return distance

@app.post("/api/location/ping")
async def ping_location(data: LocationData):
    min_dist = float("inf")
    
    # Calculate distance to nearest dark spot
    for spot in DARK_SPOTS:
        dist = haversine_distance(data.lat, data.lng, spot["lat"], spot["lng"])
        if dist < min_dist:
            min_dist = dist

    # Determine Risk
    risk_level = "LOW_RISK"
    if min_dist < 200: # 200 meters trigger
        risk_level = "HIGH_RISK"
    elif min_dist < 500:
        risk_level = "MEDIUM_RISK"

    return {
        "risk_level": risk_level,
        "distance_to_danger": f"{int(min_dist)}m" if min_dist != float("inf") else "Unknown"
    }

@app.post("/api/sos/trigger")
async def trigger_sos(data: SOSData):
    logger.info(f"🚨 SOS TRIGGERED! Type: {data.type} for User ID: {data.user_id}")
    logger.info(f"📲 Mock SMS sent to emergency contacts.")
    return {
        "status": "SOS_ACTIVE",
        "mock_sms_sent": True
    }

@app.get("/api/nearby-mesh")
async def get_nearby_mesh(lat: float, lng: float):
    # Mock return, in a real scenario this queries a database
    import random
    active_guardians = random.randint(3, 15)
    return {
        "active_guardians_nearby": active_guardians
    }

if __name__ == "__main__":
    import uvicorn
    # Bind to 0.0.0.0 to allow physical device connections over the network
    uvicorn.run(app, host="0.0.0.0", port=8000)
