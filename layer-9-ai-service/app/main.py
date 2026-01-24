from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
from app.core.engine import FeatureVector, PredictionResult
from app.engines.heuristic import HeuristicEngine
from app.engines.openai_engine import OpenAIEngine
from app.engines.claude_engine import ClaudeEngine
from app.engines.ollama_engine import OllamaEngine

# Configure Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Nifty 50 AI Inference Engine", version="1.2.0")
AI_PROVIDER = os.getenv("AI_PROVIDER", "heuristic").lower()
engine = None

if AI_PROVIDER == "pytorch":
    logger.info("🧠 Loading PyTorch Engine...")
    engine = PyTorchEngine()
elif AI_PROVIDER == "openai":
    logger.info("🧠 Loading OpenAI Engine...")
    engine = OpenAIEngine()
elif AI_PROVIDER == "claude":
    logger.info("🧠 Loading Claude Engine...")
    engine = ClaudeEngine()
elif AI_PROVIDER == "ollama":
    logger.info("🧠 Loading Ollama Engine (Local)...")
    engine = OllamaEngine()
else:
    logger.info("🧠 Loading Heuristic Engine (Default)...")
    engine = HeuristicEngine()

# --- Schemas ---
class PredictionRequest(BaseModel):
    symbol: str
    features: List[FeatureVector]

class PredictionResponse(BaseModel):
    symbol: str
    prediction: float
    confidence: float
    model_version: str

class MarketAnalysisRequest(BaseModel):
    summaries: List[dict]

class MarketAnalysisResponse(BaseModel):
    sentiment: str
    summary: str
    confidence: float

@app.get("/health")
def health_check():
    return {"status": "active", "provider": AI_PROVIDER}

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    try:
        result = engine.predict(request.symbol, request.features)
        
        return {
            "symbol": request.symbol,
            "prediction": result.prediction,
            "confidence": result.confidence,
            "model_version": result.model_version
        }
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Inference failed")

@app.post("/analyze_market", response_model=MarketAnalysisResponse)
def analyze_market(request: MarketAnalysisRequest):
    try:
        # Check if engine supports analyze_market
        if not hasattr(engine, 'analyze_market'):
            # Fallback for heuristic or other engines
            return {
                "sentiment": "NEUTRAL",
                "summary": "AI Engine does not support market analysis.",
                "confidence": 0.0
            }
            
        result = engine.analyze_market(request.summaries)
        return result
    except Exception as e:
        logger.error(f"Market Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Inference failed")
