from app.core.engine import BaseEngine, PredictionResult, FeatureVector
from typing import Dict, Optional
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

    def chat(self, symbol: str, prompt: str, context: Dict, history: Optional[list] = None) -> Dict:
        """
        Interactive chat about a stock using Ollama with technical context.
        """
        # Build context summary from L4 features
        ctx_lines = [f"Stock: {symbol}"]
        features = context.get("features", {})
        for tf, data in features.items():
            if isinstance(data, dict) and "indicators" in data:
                ind = data["indicators"]
                price = data.get("latestPrice", "N/A")
                ctx_lines.append(f"\n--- {tf} Timeframe ---")
                ctx_lines.append(f"Price: {price}")
                if "rsi" in ind:
                    ctx_lines.append(f"RSI(14): {ind['rsi']}")
                if "macd" in ind:
                    m = ind["macd"]
                    ctx_lines.append(f"MACD: {m.get('macd', 'N/A')}, Signal: {m.get('signal', 'N/A')}, Hist: {m.get('histogram', 'N/A')}")
                if "ema" in ind:
                    e = ind["ema"]
                    ctx_lines.append(f"EMA20: {e.get('ema20', 'N/A')}, EMA50: {e.get('ema50', 'N/A')}")
                if "supertrend" in ind:
                    st = ind["supertrend"]
                    ctx_lines.append(f"Supertrend: direction={'UP' if st.get('direction') == 1 else 'DOWN'}, value={st.get('value', 'N/A')}")
                if "bb" in ind:
                    bb = ind["bb"]
                    ctx_lines.append(f"Bollinger: Upper={bb.get('upper', 'N/A')}, Mid={bb.get('middle', 'N/A')}, Lower={bb.get('lower', 'N/A')}")
                if "adx" in ind:
                    ctx_lines.append(f"ADX: {ind['adx']}")
                # Verdict if available
                verdict = data.get("verdict", {})
                if verdict:
                    ctx_lines.append(f"Verdict: {verdict.get('verdict', 'N/A')} (Score: {verdict.get('score', 'N/A')}/{verdict.get('maxScore', 'N/A')})")

        context_str = "\n".join(ctx_lines)

        # Build conversation
        system_prompt = f"""You are an expert Indian stock market technical analyst. 
Analyze {symbol} using the following real-time technical indicator data:

{context_str}

Rules:
- Be specific with numbers, price levels, and indicator values
- Reference the actual indicator values provided above
- Keep answers concise (2-4 paragraphs max)
- If asked about entry/exit, provide specific price levels
- Use professional but accessible language"""

        # Include history for multi-turn
        full_prompt = system_prompt + "\n\n"
        if history:
            for msg in history[-6:]:  # Last 6 messages for context window
                role = msg.get("role", "user")
                content = msg.get("content", "")
                full_prompt += f"{role.upper()}: {content}\n"
        full_prompt += f"USER: {prompt}\nASSISTANT:"

        try:
            resp = requests.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": full_prompt,
                    "stream": False,
                },
                timeout=120
            )
            data = resp.json()
            if "response" not in data:
                raise KeyError("Missing 'response' field in Ollama output")

            return {
                "response": data["response"].strip(),
                "model": f"ollama-{self.model}",
                "usage": {
                    "prompt_tokens": data.get("prompt_eval_count", 0),
                    "completion_tokens": data.get("eval_count", 0),
                },
                "context_summary": f"{len(features)} timeframes analyzed",
            }
        except Exception as e:
            print(f"Ollama Chat Error: {e}")
            return {
                "response": f"I'm unable to analyze {symbol} right now. Error: {str(e)}",
                "model": f"error-{self.model}",
                "usage": {},
                "context_summary": "error",
            }

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
