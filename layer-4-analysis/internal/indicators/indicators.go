// Package indicators provides technical indicator calculations
package indicators

import (
	"math"
)

// MACDResult holds MACD calculation results
type MACDResult struct {
	MACD      float64 `json:"macd"`
	Signal    float64 `json:"signal"`
	Histogram float64 `json:"histogram"`
}

// SupertrendResult holds Supertrend calculation results
type SupertrendResult struct {
	Value     float64 `json:"value"`
	Direction int     `json:"direction"` // 1 = bullish, -1 = bearish
}

// BollingerResult holds Bollinger Bands results
type BollingerResult struct {
	Upper  float64 `json:"upper"`
	Middle float64 `json:"middle"`
	Lower  float64 `json:"lower"`
}

// RSI calculates Relative Strength Index
func RSI(closes []float64, period int) float64 {
	if len(closes) < period+1 {
		return 50.0 // Neutral if not enough data
	}

	gains := 0.0
	losses := 0.0

	// Calculate initial average gain/loss
	for i := 1; i <= period; i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			gains += change
		} else {
			losses += -change
		}
	}

	avgGain := gains / float64(period)
	avgLoss := losses / float64(period)

	// Smooth the averages
	for i := period + 1; i < len(closes); i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			avgGain = (avgGain*float64(period-1) + change) / float64(period)
			avgLoss = (avgLoss * float64(period-1)) / float64(period)
		} else {
			avgGain = (avgGain * float64(period-1)) / float64(period)
			avgLoss = (avgLoss*float64(period-1) + (-change)) / float64(period)
		}
	}

	if avgLoss == 0 {
		return 100.0
	}

	rs := avgGain / avgLoss
	rsi := 100.0 - (100.0 / (1.0 + rs))

	return rsi
}

// EMA calculates Exponential Moving Average
func EMA(data []float64, period int) float64 {
	if len(data) < period {
		return 0
	}

	multiplier := 2.0 / float64(period+1)

	// Start with SMA for first EMA value
	sma := 0.0
	for i := 0; i < period; i++ {
		sma += data[i]
	}
	sma /= float64(period)

	ema := sma

	// Calculate EMA for remaining values
	for i := period; i < len(data); i++ {
		ema = (data[i]-ema)*multiplier + ema
	}

	return ema
}

// SMA calculates Simple Moving Average
func SMA(data []float64, period int) float64 {
	if len(data) < period {
		return 0
	}

	sum := 0.0
	for i := len(data) - period; i < len(data); i++ {
		sum += data[i]
	}

	return sum / float64(period)
}

// MACD calculates Moving Average Convergence Divergence
func MACD(closes []float64, fastPeriod, slowPeriod, signalPeriod int) MACDResult {
	if len(closes) < slowPeriod {
		return MACDResult{}
	}

	// Calculate MACD line
	macdValues := make([]float64, len(closes))
	
	for i := slowPeriod; i < len(closes); i++ {
		subset := closes[:i+1]
		fastEMA := EMA(subset, fastPeriod)
		slowEMA := EMA(subset, slowPeriod)
		macdValues[i] = fastEMA - slowEMA
	}

	// Calculate signal line (EMA of MACD)
	macdLine := macdValues[len(macdValues)-1]
	signalLine := EMA(macdValues[slowPeriod:], signalPeriod)
	histogram := macdLine - signalLine

	return MACDResult{
		MACD:      macdLine,
		Signal:    signalLine,
		Histogram: histogram,
	}
}

// ATR calculates Average True Range
func ATR(highs, lows, closes []float64, period int) float64 {
	if len(highs) < period+1 {
		return 0
	}

	trValues := make([]float64, len(highs)-1)

	for i := 1; i < len(highs); i++ {
		tr1 := highs[i] - lows[i]
		tr2 := math.Abs(highs[i] - closes[i-1])
		tr3 := math.Abs(lows[i] - closes[i-1])

		trValues[i-1] = math.Max(tr1, math.Max(tr2, tr3))
	}

	// Calculate ATR using Wilder's smoothing
	atr := 0.0
	for i := 0; i < period; i++ {
		atr += trValues[i]
	}
	atr /= float64(period)

	for i := period; i < len(trValues); i++ {
		atr = (atr*float64(period-1) + trValues[i]) / float64(period)
	}

	return atr
}

// VWAP calculates Volume Weighted Average Price
func VWAP(highs, lows, closes, volumes []float64) float64 {
	if len(highs) == 0 {
		return 0
	}

	totalVWAP := 0.0
	totalVolume := 0.0

	for i := 0; i < len(highs); i++ {
		typicalPrice := (highs[i] + lows[i] + closes[i]) / 3
		totalVWAP += typicalPrice * volumes[i]
		totalVolume += volumes[i]
	}

	if totalVolume == 0 {
		return closes[len(closes)-1]
	}

	return totalVWAP / totalVolume
}

// Supertrend calculates Supertrend indicator
func Supertrend(highs, lows, closes []float64, period int, multiplier float64) SupertrendResult {
	if len(highs) < period+1 {
		return SupertrendResult{Direction: 1}
	}

	atr := ATR(highs, lows, closes, period)
	
	lastClose := closes[len(closes)-1]
	lastHigh := highs[len(highs)-1]
	lastLow := lows[len(lows)-1]

	hl2 := (lastHigh + lastLow) / 2

	upperBand := hl2 + (multiplier * atr)
	lowerBand := hl2 - (multiplier * atr)

	// Simplified direction calculation
	direction := 1
	if lastClose < lowerBand {
		direction = -1
	}

	value := lowerBand
	if direction < 0 {
		value = upperBand
	}

	return SupertrendResult{
		Value:     value,
		Direction: direction,
	}
}

// BollingerBands calculates Bollinger Bands
func BollingerBands(closes []float64, period int, stdDev float64) BollingerResult {
	if len(closes) < period {
		return BollingerResult{}
	}

	// Calculate SMA (middle band)
	sma := SMA(closes, period)

	// Calculate standard deviation
	sum := 0.0
	for i := len(closes) - period; i < len(closes); i++ {
		diff := closes[i] - sma
		sum += diff * diff
	}
	std := math.Sqrt(sum / float64(period))

	return BollingerResult{
		Upper:  sma + (stdDev * std),
		Middle: sma,
		Lower:  sma - (stdDev * std),
	}
}

// StdDev calculates standard deviation
func StdDev(data []float64, period int) float64 {
	if len(data) < period {
		return 0
	}

	mean := SMA(data, period)

	sum := 0.0
	for i := len(data) - period; i < len(data); i++ {
		diff := data[i] - mean
		sum += diff * diff
	}

	return math.Sqrt(sum / float64(period))
}
