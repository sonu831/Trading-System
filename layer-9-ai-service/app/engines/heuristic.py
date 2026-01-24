from app.core.engine import BaseEngine, PredictionResult, FeatureVector
from typing import List

class HeuristicEngine(BaseEngine):
    def predict(self, symbol: str, features: List[FeatureVector]) -> PredictionResult:
        last_point = features[-1]
        
        # Simple heuristic "AI"
        prob = 0.5
        if last_point.rsi < 30:
            prob += 0.3
        elif last_point.rsi > 70:
            prob -= 0.3
            
        if last_point.close > last_point.ema200:
            prob += 0.1
            
        # Clamp
        prob = max(0.0, min(1.0, prob))
        
        return PredictionResult(
            prediction=prob,
            confidence=0.85,
            model_version="v1.0.0-heuristic",
            reasoning=f"RSI is {last_point.rsi:.2f}. Trend is {'Bullish' if prob > 0.5 else 'Bearish'}."
        )
