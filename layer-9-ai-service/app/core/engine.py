from abc import ABC, abstractmethod
from typing import List, Optional
from pydantic import BaseModel

class FeatureVector(BaseModel):
    rsi: float
    macd: float
    ema50: float
    ema200: float
    close: float
    volume: float

class PredictionResult(BaseModel):
    prediction: Optional[float] = None       # null = abstain / no prediction
    confidence: Optional[float] = None
    model_version: str = "unknown"
    status: str = "ok"                       # "ok" | "abstain" | "not_trained" | "error"
    reasoning: str = "Analysis based on technical indicators."
    prompt_tokens: int = 0
    completion_tokens: int = 0

class BaseEngine(ABC):
    @abstractmethod
    def predict(self, symbol: str, features: List[FeatureVector]) -> PredictionResult:
        pass
