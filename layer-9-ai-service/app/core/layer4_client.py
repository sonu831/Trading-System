"""
Layer 4 HTTP Client for AI Service
Provides communication with the Analysis Engine (Go) for indicators and dynamic queries
"""
import os
import httpx
from typing import Dict, List, Optional, Any
import logging

logger = logging.getLogger(__name__)


class Layer4Client:
    """HTTP client for communicating with Layer 4 Analysis Engine (Go)"""
    
    def __init__(self):
        self.base_url = os.getenv("ANALYSIS_SERVICE_URL", "http://analysis:8081")
        self.timeout = 15.0
    
    async def get_features(
        self, 
        symbol: str, 
        timeframes: str = "5m,15m,1h,4h,1d"
    ) -> Dict[str, Any]:
        """
        Get multi-timeframe indicators for a symbol from Layer 4
        
        Args:
            symbol: Stock symbol (e.g., "RELIANCE")
            timeframes: Comma-separated timeframes
            
        Returns:
            Dict containing features per timeframe
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/analyze/features",
                    params={"symbol": symbol, "timeframes": timeframes}
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Layer 4 features error for {symbol}: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_scorecard(self, symbol: str) -> Dict[str, Any]:
        """
        Get full technical scorecard for a symbol
        
        Args:
            symbol: Stock symbol
            
        Returns:
            Dict containing scorecard with trend score
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(
                    f"{self.base_url}/analyze",
                    params={"symbol": symbol}
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Layer 4 scorecard error for {symbol}: {e}")
            return {"success": False, "error": str(e)}
    
    async def dynamic_query(
        self,
        symbol: str,
        interval: str = "15m",
        aggregation: str = "avg",
        field: str = "close",
        lookback: int = 100,
        group_by: str = ""
    ) -> Dict[str, Any]:
        """
        Execute dynamic aggregation query for custom analysis
        
        Args:
            symbol: Stock symbol
            interval: Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
            aggregation: Aggregation function (avg, sum, min, max, count, stddev)
            field: OHLCV field to aggregate
            lookback: Number of candles
            group_by: Optional grouping (hour, day, week)
            
        Returns:
            Aggregation result
        """
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.post(
                    f"{self.base_url}/query/dynamic",
                    json={
                        "symbol": symbol,
                        "interval": interval,
                        "aggregation": aggregation,
                        "field": field,
                        "lookback": lookback,
                        "groupBy": group_by
                    }
                )
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Layer 4 dynamic query error: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_symbols(self) -> List[str]:
        """Get list of all available symbols"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/symbols")
                response.raise_for_status()
                data = response.json()
                return data.get("symbols", [])
        except httpx.HTTPError as e:
            logger.error(f"Layer 4 symbols error: {e}")
            return []
    
    async def get_market_sentiment(self) -> Dict[str, Any]:
        """Get overall market sentiment"""
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(f"{self.base_url}/analyze/market")
                response.raise_for_status()
                return response.json()
        except httpx.HTTPError as e:
            logger.error(f"Layer 4 market sentiment error: {e}")
            return {"sentiment": "Unknown", "error": str(e)}
    
    def extract_feature_vector(self, features: Dict) -> List[float]:
        """
        Extract a flat feature vector from Layer 4 features for ML models
        
        Args:
            features: Features dict from get_features()
            
        Returns:
            Flat list of numeric features
        """
        vector = []
        
        for tf, data in features.get("features", {}).items():
            if "error" in data:
                continue
                
            indicators = data.get("indicators", {})
            
            # RSI
            vector.append(indicators.get("rsi", 50.0))
            
            # MACD
            macd = indicators.get("macd", {})
            vector.append(macd.get("macd", 0.0))
            vector.append(macd.get("signal", 0.0))
            vector.append(macd.get("histogram", 0.0))
            
            # EMA
            ema = indicators.get("ema", {})
            vector.append(ema.get("ema20", 0.0))
            vector.append(ema.get("ema50", 0.0))
            vector.append(ema.get("ema200", 0.0))
            
            # Bollinger Bands
            bb = indicators.get("bb", {})
            vector.append(bb.get("upper", 0.0))
            vector.append(bb.get("middle", 0.0))
            vector.append(bb.get("lower", 0.0))
            
            # ATR
            vector.append(indicators.get("atr", 0.0))
            
            # Stochastic
            stoch = indicators.get("stochastic", {})
            vector.append(stoch.get("k", 50.0))
            vector.append(stoch.get("d", 50.0))
            
            # Volume ratio
            vector.append(indicators.get("volumeRatio", 1.0))
            
            # Trend
            trend = data.get("trend", {})
            vector.append(1.0 if trend.get("direction") == "UP" else -1.0)
            vector.append(trend.get("strength", 0.0))
        
        return vector


# Singleton instance for use across the application
layer4_client = Layer4Client()
