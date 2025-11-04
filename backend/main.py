from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import cv2
import numpy as np
import tensorflow as tf
from PIL import Image
import io
import os
import json
from datetime import datetime
from pathlib import Path
import logging

# Initialize FastAPI app
app = FastAPI(title="PANGIL Backe" \
"nd", version="1.0.0")

# Configure CORS for Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.getenv("FRONTEND_URL", "https://pangil.vercel.app")
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Local storage for detections
STORAGE_DIR = Path(os.getenv("STORAGE_DIR", "/home/pi/PANGIL/detections"))
STORAGE_DIR.mkdir(parents=True, exist_ok=True)

# Load TensorFlow model
MODEL_PATH = os.getenv("MODEL_PATH", "/home/pi/PANGIL/model.h5")
try:
    model = tf.keras.models.load_model(MODEL_PATH)
    logger.info(f"Model loaded successfully from {MODEL_PATH}")
except Exception as e:
    logger.error(f"Failed to load model from {MODEL_PATH}: {e}")
    model = None

# Disease mapping
DISEASE_MAPPING = {
    0: {"name": "Aphthous Ulcer", "confidence_threshold": 0.7},
    1: {"name": "Dental Caries", "confidence_threshold": 0.75},
    2: {"name": "Gingivitis", "confidence_threshold": 0.65},
    3: {"name": "Oral Candidiasis", "confidence_threshold": 0.68},
    4: {"name": "Mucosal Tags", "confidence_threshold": 0.72},
    5: {"name": "Xerostomia", "confidence_threshold": 0.70},
}

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "environment": os.getenv("ENVIRONMENT", "development"),
        "storage_path": str(STORAGE_DIR)
    }

@app.post("/detect")
async def detect_lesion(file: UploadFile = File(...), user_id: str = None):
    """
    Detect oral lesions in uploaded image
    Returns: disease label, confidence, bounding boxes, recommendations
    """
    try:
        # Read image
        contents = await file.read()
        image = Image.open(io.BytesIO(contents))
        image_array = np.array(image)
        
        # Preprocess image
        processed_image = preprocess_image(image_array)
        
        # Run inference
        if model is None:
            raise HTTPException(status_code=500, detail="Model not loaded")
        
        predictions = model.predict(np.expand_dims(processed_image, axis=0))
        
        # Process predictions
        disease_idx = np.argmax(predictions[0])
        confidence = float(predictions[0][disease_idx])
        disease_name = DISEASE_MAPPING[disease_idx]["name"]
        
        # Detect bounding boxes
        bounding_boxes = detect_bounding_boxes(image_array, disease_idx)
        
        # Generate recommendations
        recommendations = get_recommendations(disease_name, confidence)
        
        # Prepare response
        detection_result = {
            "disease": disease_name,
            "confidence": confidence,
            "disease_id": int(disease_idx),
            "bounding_boxes": bounding_boxes,
            "recommendations": recommendations,
            "timestamp": datetime.utcnow().isoformat(),
            "image_filename": file.filename
        }
        
        if user_id:
            detection_result["user_id"] = user_id
            save_detection_locally(user_id, detection_result)
        
        return JSONResponse(content=detection_result)
    
    except Exception as e:
        logger.error(f"Detection error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/history/{user_id}")
async def get_detection_history(user_id: str, limit: int = 50):
    """Get detection history for a user"""
    try:
        history_file = STORAGE_DIR / f"{user_id}_history.json"
        
        if not history_file.exists():
            return {"detections": [], "count": 0}
        
        with open(history_file, 'r') as f:
            detections = json.load(f)
        
        # Return limited results
        return {"detections": detections[-limit:], "count": len(detections)}
    
    except Exception as e:
        logger.error(f"History retrieval error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/detection/{user_id}/{detection_index}")
async def delete_detection(user_id: str, detection_index: int):
    """Delete a detection record"""
    try:
        history_file = STORAGE_DIR / f"{user_id}_history.json"
        
        if not history_file.exists():
            raise HTTPException(status_code=404, detail="Detection not found")
        
        with open(history_file, 'r') as f:
            detections = json.load(f)
        
        if 0 <= detection_index < len(detections):
            detections.pop(detection_index)
            with open(history_file, 'w') as f:
                json.dump(detections, f, indent=2)
            return {"message": "Detection deleted successfully"}
        else:
            raise HTTPException(status_code=404, detail="Detection not found")
    
    except Exception as e:
        logger.error(f"Deletion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

def save_detection_locally(user_id: str, detection: dict):
    """Save detection to local JSON file"""
    history_file = STORAGE_DIR / f"{user_id}_history.json"
    
    detections = []
    if history_file.exists():
        with open(history_file, 'r') as f:
            detections = json.load(f)
    
    detections.append(detection)
    
    with open(history_file, 'w') as f:
        json.dump(detections, f, indent=2)

def preprocess_image(image: np.ndarray, target_size: tuple = (224, 224)) -> np.ndarray:
    """Preprocess image for model inference"""
    # Resize
    image = cv2.resize(image, target_size)
    
    # Normalize
    image = image.astype("float32") / 255.0
    
    return image

def detect_bounding_boxes(image: np.ndarray, disease_idx: int) -> list:
    """Detect bounding boxes for affected regions"""
    h, w = image.shape[:2]
    
    # Example bounding boxes (replace with actual detection)
    bounding_boxes = [
        {
            "x": int(w * 0.2),
            "y": int(h * 0.2),
            "width": int(w * 0.6),
            "height": int(h * 0.6),
            "confidence": 0.85,
            "disease_id": disease_idx
        }
    ]
    
    return bounding_boxes

def get_recommendations(disease_name: str, confidence: float) -> dict:
    """Generate medical recommendations based on disease"""
    recommendations_db = {
        "Aphthous Ulcer": {
            "urgent_actions": ["Avoid spicy foods", "Use topical anesthetics"],
            "monitoring": ["Track ulcer size", "Monitor for secondary infection"],
            "lifestyle": ["Maintain oral hygiene", "Reduce stress"]
        },
        "Dental Caries": {
            "urgent_actions": ["Schedule dental appointment", "Avoid sugary foods"],
            "monitoring": ["Check for pain", "Monitor cavity progression"],
            "lifestyle": ["Brush twice daily", "Floss regularly"]
        },
        "Gingivitis": {
            "urgent_actions": ["Improve oral hygiene", "Use antimicrobial mouthwash"],
            "monitoring": ["Check for bleeding", "Monitor inflammation"],
            "lifestyle": ["Brush gently", "Floss daily"]
        },
        "Oral Candidiasis": {
            "urgent_actions": ["Consult healthcare provider", "Avoid irritants"],
            "monitoring": ["Track white patches", "Monitor symptoms"],
            "lifestyle": ["Maintain oral hygiene", "Avoid tobacco"]
        },
        "Mucosal Tags": {
            "urgent_actions": ["Monitor for changes", "Consult specialist if needed"],
            "monitoring": ["Track size and appearance"],
            "lifestyle": ["Maintain oral hygiene"]
        },
        "Xerostomia": {
            "urgent_actions": ["Stay hydrated", "Use saliva substitutes"],
            "monitoring": ["Monitor dry mouth severity"],
            "lifestyle": ["Drink water frequently", "Avoid dry foods"]
        }
    }
    
    return recommendations_db.get(disease_name, {
        "urgent_actions": ["Consult healthcare provider"],
        "monitoring": ["Monitor symptoms"],
        "lifestyle": ["Maintain oral hygiene"]
    })

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
