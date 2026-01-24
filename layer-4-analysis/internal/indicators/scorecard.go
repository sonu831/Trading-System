package indicators

import (
	"fmt"
	"time"

	"github.com/sdcoffey/big"
	"github.com/sdcoffey/techan"
	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/db"
)

// ScorecardResult represents the technical analysis scorecard
type ScorecardResult struct {
	Symbol         string  `json:"symbol"`
	Timestamp      string  `json:"timestamp"`
	RSI            float64 `json:"rsi"`
	MACD           float64 `json:"macd"`
	MACDHistogram  float64 `json:"macd_histogram"`
	EMA50          float64 `json:"ema50"`
	EMA200         float64 `json:"ema200"`
	TrendScore     int     `json:"trend_score"`    // -5 to +5
	Recommendation string  `json:"recommendation"` // BUY, SELL, HOLD
}

// GenerateScorecard calculates the scorecard for a given set of candles
func GenerateScorecard(symbol string, dbCandles []db.Candle) (*ScorecardResult, error) {
	if len(dbCandles) < 200 {
		return nil, fmt.Errorf("insufficient data: need at least 200 candles, got %d", len(dbCandles))
	}

	// 1. Convert DB Candles to Techan TimeSeries
	series := techan.NewTimeSeries()
	for _, c := range dbCandles {
		period := techan.NewTimePeriod(c.Time, time.Minute)
		candle := techan.NewCandle(period)
		candle.OpenPrice = big.NewDecimal(c.Open)
		candle.MaxPrice = big.NewDecimal(c.High)
		candle.MinPrice = big.NewDecimal(c.Low)
		candle.ClosePrice = big.NewDecimal(c.Close)
		candle.Volume = big.NewDecimal(float64(c.Volume))
		series.AddCandle(candle)
	}

	// 2. Indicators
	closePrices := techan.NewClosePriceIndicator(series)

	// RSI (14)
	rsiIndicator := techan.NewRelativeStrengthIndexIndicator(closePrices, 14)
	currentRSI := rsiIndicator.Calculate(series.LastIndex()).Float()

	// MACD (12, 26, 9)
	macdIndicator := techan.NewMACDIndicator(closePrices, 12, 26)
	macdSignal := techan.NewEMAIndicator(macdIndicator, 9)
	macdHistIndicator := techan.NewDifferenceIndicator(macdIndicator, macdSignal)

	currentMACD := macdIndicator.Calculate(series.LastIndex()).Float()
	currentHist := macdHistIndicator.Calculate(series.LastIndex()).Float()

	// EMA (50, 200)
	ema50Indicator := techan.NewEMAIndicator(closePrices, 50)
	ema200Indicator := techan.NewEMAIndicator(closePrices, 200)

	currentEMA50 := ema50Indicator.Calculate(series.LastIndex()).Float()
	currentEMA200 := ema200Indicator.Calculate(series.LastIndex()).Float()
	currentPrice := closePrices.Calculate(series.LastIndex()).Float()

	// 3. Scoring Logic
	score := 0

	// RSI Logic
	if currentRSI < 30 {
		score += 2 // Oversold (Bullish)
	} else if currentRSI > 70 {
		score -= 2 // Overbought (Bearish)
	} else if currentRSI > 50 {
		score += 1 // Mild Bullish
	} else {
		score -= 1 // Mild Bearish
	}

	// MACD Logic
	if currentHist > 0 {
		score += 1
	} else {
		score -= 1
	}

	// Trend Logic (EMA)
	if currentPrice > currentEMA200 {
		score += 2 // Long term Uptrend
	} else {
		score -= 2 // Long term Downtrend
	}

	if currentEMA50 > currentEMA200 {
		score += 1 // Golden Cross territory
	} else {
		score -= 1 // Death Cross territory
	}

	// Recommendation
	rec := "HOLD"
	if score >= 3 {
		rec = "STRONG BUY"
	} else if score >= 1 {
		rec = "BUY"
	} else if score <= -3 {
		rec = "STRONG SELL"
	} else if score <= -1 {
		rec = "SELL"
	}

	return &ScorecardResult{
		Symbol:         symbol,
		Timestamp:      series.LastCandle().Period.End.Format(time.RFC3339),
		RSI:            currentRSI,
		MACD:           currentMACD,
		MACDHistogram:  currentHist,
		EMA50:          currentEMA50,
		EMA200:         currentEMA200,
		TrendScore:     score,
		Recommendation: rec,
	}, nil
}
