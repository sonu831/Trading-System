from app.core.engine import BaseEngine, PredictionResult, FeatureVector
from typing import List
import os
import requests
import json

class OllamaEngine(BaseEngine):
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_URL", "http://host.docker.internal:11434")
        self.model = os.getenv("OLLAMA_MODEL", "llama3")

    def predict(self, symbol: str, features: List[FeatureVector]) -> PredictionResult:
        last = features[-1]
        prompt = f"""
        Analyze this stock '{symbol}' based on technical indicators:
        - Price: {last.close}
        - RSI (14): {last.rsi}
        - MACD: {last.macd}
        - EMA50: {last.ema50}
        - EMA200: {last.ema200}
        
        Task: Predict probability of UPWARD trend (0.0 to 1.0).
        Output strictly JSON: {{"prediction": float, "confidence": float, "reasoning": "short explanation"}}
        """
        
        try:
            resp = requests.post(
                f"{self.base_url}/api/generate", 
                json={
                    "model": self.model, 
                    "prompt": prompt, 
                    "stream": False,
                    "format": "json"
                },
                timeout=45
            )
            data = resp.json()
            if 'response' not in data:
                print(f"Ollama unexpected response: {data}")
                raise KeyError("Missing 'response' field in Ollama output")

            # Parse 'response' field which contains the JSON string
            result_json = json.loads(data['response'])
            
            return PredictionResult(
                prediction=result_json.get("prediction", 0.5),
                confidence=result_json.get("confidence", 0.0),
                model_version=f"ollama-{self.model}",
                reasoning=result_json.get("reasoning", "AI analysis completed."),
                prompt_tokens=data.get("prompt_eval_count", 0),
                completion_tokens=data.get("eval_count", 0)
            )
        except Exception as e:
            print(f"Ollama Error: {e}")
            return PredictionResult(
                prediction=0.5,
                confidence=0.0,
                model_version=f"error-{self.model}",
                reasoning=f"Error connecting to AI: {str(e)}"
            )

    def analyze_market(self, summaries: List[dict]) -> dict:
        """
        Analyze overall market sentiment based on top gainers/losers and breadth.
        """
        # Convert summaries to compact string
        market_data_str = json.dumps(summaries[:20]) # Limit to top 20 to save tokens if needed, or send all if small
        
        prompt = f"""
        Analyze the Nifty 50 market based on these stock summaries:
        {market_data_str}
        
        Task:
        1. Determine overall Market Sentiment (BULLISH, BEARISH, or NEUTRAL).
        2. Provide a 2-sentence summary of the market condition.
        
        Output strictly JSON: {{"sentiment": "BULLISH|BEARISH|NEUTRAL", "summary": "Text summary here", "confidence": float}}
        """
        
        try:
            resp = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "format": "json"
                },
                timeout=45
            )
            data = resp.json()
            if 'response' not in data:
                print(f"Ollama unexpected response: {data}")
                raise KeyError("Missing 'response' field in Ollama output")

            result_json = json.loads(data['response'])
             # Add usage stats to result
            result_json['usage'] = {
                'prompt_tokens': data.get("prompt_eval_count", 0),
                'completion_tokens': data.get("eval_count", 0)
            }
            return result_json
        except Exception as e:
            print(f"Ollama Market Analysis Error: {e}")
            return {"sentiment": "NEUTRAL", "summary": "AI Analysis Unavailable", "confidence": 0.0}
