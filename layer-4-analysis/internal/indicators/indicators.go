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

// ──────────────────────────────────────────────
// ADX (Average Directional Index)
// ──────────────────────────────────────────────

type ADXResult struct {
	ADX float64
	PDI float64 // +DI
	NDI float64 // -DI
}

// ADX computes Wilder's ADX, +DI, and -DI
func ADX(highs, lows, closes []float64, period int) ADXResult {
	if len(highs) < period+1 || len(lows) < period+1 || len(closes) < period+1 {
		return ADXResult{ADX: 0, PDI: 0, NDI: 0}
	}

	n := len(highs)
	tr := make([]float64, n-1)
	pdm := make([]float64, n-1)
	ndm := make([]float64, n-1)

	for i := 1; i < n; i++ {
		high := highs[i]
		low := lows[i]
		prevClose := closes[i-1]

		tr[i-1] = max3(high-low, math.Abs(high-prevClose), math.Abs(low-prevClose))

		upMove := high - highs[i-1]
		downMove := lows[i-1] - low

		if upMove > downMove && upMove > 0 {
			pdm[i-1] = upMove
		} else {
			pdm[i-1] = 0
		}

		if downMove > upMove && downMove > 0 {
			ndm[i-1] = downMove
		} else {
			ndm[i-1] = 0
		}
	}

	// Wilder's smoothing for ATR, +DM, -DM
	atrSmooth := wilderSmooth(tr, period)
	pdiSmooth := wilderSmooth(pdm, period)
	ndiSmooth := wilderSmooth(ndm, period)

	m := len(atrSmooth)
	dx := make([]float64, m)
	for i := 0; i < m; i++ {
		if atrSmooth[i] == 0 {
			dx[i] = 0
		} else {
			pdi := (pdiSmooth[i] / atrSmooth[i]) * 100
			ndi := (ndiSmooth[i] / atrSmooth[i]) * 100
			dx[i] = (math.Abs(pdi-ndi) / (pdi + ndi)) * 100
		}
	}

	adxVal := 0.0
	pdiVal := 0.0
	ndiVal := 0.0
	if len(dx) > 0 {
		adxVal = avgLast(dx, period)
	}
	if m > 0 {
		pdiVal = (pdiSmooth[m-1] / atrSmooth[m-1]) * 100
		ndiVal = (ndiSmooth[m-1] / atrSmooth[m-1]) * 100
	}

	return ADXResult{ADX: adxVal, PDI: pdiVal, NDI: ndiVal}
}

func wilderSmooth(data []float64, period int) []float64 {
	result := make([]float64, 0, len(data))
	sum := 0.0
	for i := 0; i < len(data); i++ {
		if i < period {
			sum += data[i]
			if i == period-1 {
				result = append(result, sum/float64(period))
			}
		} else {
			prev := result[len(result)-1]
			val := prev + (data[i]-prev)/float64(period)
			result = append(result, val)
		}
	}
	return result
}

func max3(a, b, c float64) float64 {
	if a >= b && a >= c {
		return a
	}
	if b >= a && b >= c {
		return b
	}
	return c
}

func avgLast(data []float64, period int) float64 {
	if len(data) == 0 {
		return 0
	}
	count := period
	if count > len(data) {
		count = len(data)
	}
	sum := 0.0
	for i := len(data) - count; i < len(data); i++ {
		sum += data[i]
	}
	return sum / float64(count)
}

// ──────────────────────────────────────────────
// Ichimoku Cloud
// ──────────────────────────────────────────────

type IchimokuResult struct {
	Tenkan  float64 // Conversion line (9)
	Kijun   float64 // Base line (26)
	SenkouA float64 // Leading span A
	SenkouB float64 // Leading span B
	Chikou  float64 // Lagging span (close shifted -26)
}

func Ichimoku(highs, lows, closes []float64) IchimokuResult {
	if len(closes) < 52 {
		return IchimokuResult{}
	}

	tenkanPeriod := 9
	kijunPeriod := 26
	senkouBPeriod := 52

	tenkan := (maxN(highs, tenkanPeriod) + minN(lows, tenkanPeriod)) / 2
	kijun := (maxN(highs, kijunPeriod) + minN(lows, kijunPeriod)) / 2
	senkouA := (tenkan + kijun) / 2
	senkouB := (maxN(highs, senkouBPeriod) + minN(lows, senkouBPeriod)) / 2
	chikou := closes[len(closes)-26]

	return IchimokuResult{
		Tenkan: tenkan, Kijun: kijun,
		SenkouA: senkouA, SenkouB: senkouB,
		Chikou: chikou,
	}
}

func maxN(data []float64, n int) float64 {
	if len(data) < n {
		n = len(data)
	}
	maxVal := data[len(data)-n]
	for i := len(data) - n; i < len(data); i++ {
		if data[i] > maxVal {
			maxVal = data[i]
		}
	}
	return maxVal
}

func minN(data []float64, n int) float64 {
	if len(data) < n {
		n = len(data)
	}
	minVal := data[len(data)-n]
	for i := len(data) - n; i < len(data); i++ {
		if data[i] < minVal {
			minVal = data[i]
		}
	}
	return minVal
}
