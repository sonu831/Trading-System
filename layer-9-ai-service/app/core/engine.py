from abc import ABC, abstractmethod
from typing import List
from pydantic import BaseModel

class FeatureVector(BaseModel):
    rsi: float
    macd: float
    ema50: float
    ema200: float
    close: float
    volume: float

class PredictionResult(BaseModel):
    prediction: float
    confidence: float
    model_version: str
    reasoning: str = "Analysis based on technical indicators."

class BaseEngine(ABC):
    @abstractmethod
    def predict(self, symbol: str, features: List[FeatureVector]) -> PredictionResult:
        pass
