// Package indicators provides feature vector generation for AI
package indicators

import (
	"math"

	"github.com/utkarsh-pandey/nifty50-trading-system/layer-4-analysis/internal/db"
)

// FeatureVector holds all indicator values for AI consumption
type FeatureVector struct {
	Interval    string           `json:"interval"`
	LatestPrice float64          `json:"latestPrice"`
	LatestTime  string           `json:"latestTime"`
	PriceChange float64          `json:"priceChange"`
	Indicators  IndicatorSet     `json:"indicators"`
	Trend       TrendInfo        `json:"trend"`
}

// IndicatorSet contains all calculated indicators
type IndicatorSet struct {
	RSI         float64         `json:"rsi"`
	RSIState    string          `json:"rsiState"`
	MACD        MACDResult      `json:"macd"`
	EMA         EMASet          `json:"ema"`
	BB          BollingerResult `json:"bb"`
	ATR         float64         `json:"atr"`
	Stochastic  StochasticResult `json:"stochastic"`
	VolumeRatio float64         `json:"volumeRatio"`
}

// EMASet holds multiple EMA values
type EMASet struct {
	EMA20  float64 `json:"ema20"`
	EMA50  float64 `json:"ema50"`
	EMA200 float64 `json:"ema200"`
}

// StochasticResult holds Stochastic oscillator values
type StochasticResult struct {
	K float64 `json:"k"`
	D float64 `json:"d"`
}

// TrendInfo provides trend direction and strength
type TrendInfo struct {
	Direction string  `json:"direction"`
	Strength  float64 `json:"strength"`
}

// GenerateFeatureVector creates a comprehensive feature vector from candles
func GenerateFeatureVector(interval string, candles []db.Candle) FeatureVector {
	if len(candles) < 14 {
		return FeatureVector{
			Interval: interval,
			Trend:    TrendInfo{Direction: "UNKNOWN", Strength: 0},
		}
	}

	closes := make([]float64, len(candles))
	highs := make([]float64, len(candles))
	lows := make([]float64, len(candles))
	volumes := make([]float64, len(candles))

	for i, c := range candles {
		closes[i] = c.Close
		highs[i] = c.High
		lows[i] = c.Low
		volumes[i] = float64(c.Volume)
	}

	latest := len(candles) - 1
	latestClose := closes[latest]
	firstClose := closes[0]

	// Calculate all indicators
	rsi := RSI(closes, 14)
	macd := MACD(closes, 12, 26, 9)
	bb := BollingerBands(closes, 20, 2.0)
	atr := ATR(highs, lows, closes, 14)
	stoch := Stochastic(highs, lows, closes, 14, 3)

	// Volume analysis
	volumeSMA := volumeAverage(volumes, 20)
	volumeRatio := 0.0
	if volumeSMA > 0 {
		volumeRatio = volumes[latest] / volumeSMA
	}

	// Trend info
	priceChange := ((latestClose - firstClose) / firstClose) * 100
	direction := "UP"
	if priceChange < 0 {
		direction = "DOWN"
	}

	return FeatureVector{
		Interval:    interval,
		LatestPrice: latestClose,
		LatestTime:  candles[latest].Time.Format("2006-01-02T15:04:05Z"),
		PriceChange: math.Round(priceChange*100) / 100,
		Indicators: IndicatorSet{
			RSI:      math.Round(rsi*100) / 100,
			RSIState: getRSIState(rsi),
			MACD:     macd,
			EMA: EMASet{
				EMA20:  math.Round(EMA(closes, 20)*100) / 100,
				EMA50:  math.Round(EMA(closes, 50)*100) / 100,
				EMA200: math.Round(EMA(closes, 200)*100) / 100,
			},
			BB:          bb,
			ATR:         math.Round(atr*100) / 100,
			Stochastic:  stoch,
			VolumeRatio: math.Round(volumeRatio*100) / 100,
		},
		Trend: TrendInfo{
			Direction: direction,
			Strength:  math.Round(math.Abs(priceChange)*100) / 100,
		},
	}
}

// getRSIState returns the RSI state description
func getRSIState(rsi float64) string {
	switch {
	case rsi > 70:
		return "Overbought"
	case rsi < 30:
		return "Oversold"
	case rsi > 60:
		return "Bullish"
	case rsi < 40:
		return "Bearish"
	default:
		return "Neutral"
	}
}

// Stochastic calculates Stochastic oscillator
func Stochastic(highs, lows, closes []float64, period, signalPeriod int) StochasticResult {
	if len(closes) < period {
		return StochasticResult{K: 50, D: 50}
	}

	kValues := make([]float64, 0)

	for i := period - 1; i < len(closes); i++ {
		high := maxSlice(highs[i-period+1 : i+1])
		low := minSlice(lows[i-period+1 : i+1])

		if high == low {
			kValues = append(kValues, 50)
		} else {
			k := ((closes[i] - low) / (high - low)) * 100
			kValues = append(kValues, k)
		}
	}

	latestK := kValues[len(kValues)-1]
	latestD := SMA(kValues, signalPeriod)

	return StochasticResult{
		K: math.Round(latestK*100) / 100,
		D: math.Round(latestD*100) / 100,
	}
}

// Helper functions
func volumeAverage(volumes []float64, period int) float64 {
	if len(volumes) < period {
		period = len(volumes)
	}
	sum := 0.0
	for i := len(volumes) - period; i < len(volumes); i++ {
		sum += volumes[i]
	}
	return sum / float64(period)
}

func maxSlice(data []float64) float64 {
	max := data[0]
	for _, v := range data {
		if v > max {
			max = v
		}
	}
	return max
}

func minSlice(data []float64) float64 {
	min := data[0]
	for _, v := range data {
		if v < min {
			min = v
		}
	}
	return min
}
