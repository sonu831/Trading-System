from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
from app.core.engine import FeatureVector, PredictionResult
from app.core.layer4_client import layer4_client
from app.engines.heuristic import HeuristicEngine
from app.engines.openai_engine import OpenAIEngine
from app.engines.claude_engine import ClaudeEngine
from app.engines.ollama_engine import OllamaEngine
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Counter, Histogram
import time
import json
import torch  # For MPS check

# Fix missing import if PyTorch is used
try:
    from app.engines.pytorch_engine import PyTorchEngine
except ImportError:
    pass # Might not be installed in all envs


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
    logger.info("🧠 Loading Heuristic Engine (Default)...")
    engine = HeuristicEngine()

# --- Hardware Acceleration Check (M4-Max) ---
if torch.backends.mps.is_available():
    logger.info(f"🚀 Apple Silicon MPS (Metal) Acceleration: ENABLED")
    logger.info(f"   Device: {torch.device('mps')}")
elif torch.cuda.is_available():
    logger.info(f"🚀 NVIDIA CUDA Acceleration: ENABLED")
else:
    logger.warning("⚠️  Running on CPU. Performance may be limited.")

# --- Metrics ---
TOKEN_USAGE = Counter(
    "ai_token_usage_total", 
    "Total tokens used by AI models", 
    ["type", "model", "context"]
)

REQUEST_DURATION = Histogram(
    "ai_request_duration_seconds",
    "Time spent accessing AI providers",
    ["model", "endpoint"]
)


# --- Schemas ---
class PredictionRequest(BaseModel):
    symbol: str
    features: List[FeatureVector]

class PredictionResponse(BaseModel):
    symbol: str
    prediction: float
    confidence: float
    reasoning: str = ""
    model_version: str
    prompt_tokens: int
    completion_tokens: int

class MarketAnalysisRequest(BaseModel):
    summaries: List[dict]

class MarketAnalysisResponse(BaseModel):
    sentiment: str
    summary: str
    confidence: float
    usage: dict

class ChatRequest(BaseModel):
    symbol: str
    prompt: str
    history: Optional[List[dict]] = None

class ChatResponse(BaseModel):
    response: str
    model: str
    usage: dict
    context_summary: str

@app.get("/health")
def health_check():
    return {"status": "active", "provider": AI_PROVIDER}

@app.post("/predict", response_model=PredictionResponse)
def predict(request: PredictionRequest):
    start_time = time.time()
    try:
        result = engine.predict(request.symbol, request.features)
        duration = time.time() - start_time
        
        # Record metrics
        model_name = result.model_version
        TOKEN_USAGE.labels(type="input", model=model_name, context="predict").inc(result.prompt_tokens)
        TOKEN_USAGE.labels(type="output", model=model_name, context="predict").inc(result.completion_tokens)
        REQUEST_DURATION.labels(model=model_name, endpoint="predict").observe(duration)

        # Structured Log
        log_payload = {
            "event": "ai_inference",
            "type": "prediction",
            "symbol": request.symbol,
            "model": model_name,
            "input_tokens": result.prompt_tokens,
            "output_tokens": result.completion_tokens,
            "duration_s": round(duration, 3),
            "prediction": result.prediction,
            "confidence": result.confidence
        }
        logger.info(json.dumps(log_payload))

        return {
            "symbol": request.symbol,
            "prediction": result.prediction,
            "confidence": result.confidence,
            "reasoning": result.reasoning,
            "model_version": result.model_version,
            "prompt_tokens": result.prompt_tokens,
            "completion_tokens": result.completion_tokens
        }
    except Exception as e:
        logger.error(f"Prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Inference failed")

@app.post("/analyze_market", response_model=MarketAnalysisResponse)
def analyze_market(request: MarketAnalysisRequest):
    start_time = time.time()
    try:
        # Check if engine supports analyze_market
        if not hasattr(engine, 'analyze_market'):
            # Fallback for heuristic or other engines
            return {
                "sentiment": "NEUTRAL",
                "summary": "AI Engine does not support market analysis.",
                "confidence": 0.0,
                "usage": {}
            }
            
        result = engine.analyze_market(request.summaries)
        duration = time.time() - start_time
        
        # Metrics & Logging
        usage = result.get('usage', {})
        p_tokens = usage.get('prompt_tokens', 0)
        c_tokens = usage.get('completion_tokens', 0)
        model_name = f"ollama-{os.getenv('OLLAMA_MODEL', 'ukn')}"

        TOKEN_USAGE.labels(type="input", model=model_name, context="market_analysis").inc(p_tokens)
        TOKEN_USAGE.labels(type="output", model=model_name, context="market_analysis").inc(c_tokens)
        REQUEST_DURATION.labels(model=model_name, endpoint="analyze_market").observe(duration)

        log_payload = {
            "event": "ai_inference",
            "type": "market_analysis",
            "model": model_name,
            "input_tokens": p_tokens,
            "output_tokens": c_tokens,
            "duration_s": round(duration, 3),
            "sentiment": result.get('sentiment')
        }
        logger.info(json.dumps(log_payload))

        return result
    except Exception as e:
        logger.error(f"Market Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail="Inference failed")

# Instrument FastAPI for Prometheus
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    start_time = time.time()
    try:
        # Check if engine supports chat
        if not hasattr(engine, 'chat'):
            return {
                "response": "Chat is not supported by the current AI engine. Switch to Ollama.",
                "model": AI_PROVIDER,
                "usage": {},
                "context_summary": "unsupported"
            }

        # Fetch stock context from Layer 4
        context = {}
        try:
            context = await layer4_client.get_features(
                request.symbol,
                timeframes="5m,15m,1h,4h,1d"
            )
        except Exception as ctx_err:
            logger.warning(f"Could not fetch L4 context for {request.symbol}: {ctx_err}")
            context = {"features": {}}

        result = engine.chat(
            symbol=request.symbol,
            prompt=request.prompt,
            context=context,
            history=request.history
        )

        duration = time.time() - start_time
        model_name = result.get("model", f"ollama-{os.getenv('OLLAMA_MODEL', 'ukn')}")

        # Metrics
        usage = result.get("usage", {})
        TOKEN_USAGE.labels(type="input", model=model_name, context="chat").inc(usage.get("prompt_tokens", 0))
        TOKEN_USAGE.labels(type="output", model=model_name, context="chat").inc(usage.get("completion_tokens", 0))
        REQUEST_DURATION.labels(model=model_name, endpoint="chat").observe(duration)

        # Log
        log_payload = {
            "event": "ai_inference",
            "type": "chat",
            "symbol": request.symbol,
            "model": model_name,
            "input_tokens": usage.get("prompt_tokens", 0),
            "output_tokens": usage.get("completion_tokens", 0),
            "duration_s": round(duration, 3),
            "prompt_length": len(request.prompt)
        }
        logger.info(json.dumps(log_payload))

        return result
    except Exception as e:
        logger.error(f"Chat failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")

