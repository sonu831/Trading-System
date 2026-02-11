package indicators

import (
	"fmt"
	"math"

	"github.com/sonu831/Trading-System/layer-4-analysis/internal/db"
)

// ── Result Types ────────────────────────────────────────────────────────────

// FullAnalysisResult is the chart-ready response for /analyze/full/{symbol}
type FullAnalysisResult struct {
	Symbol     string           `json:"symbol"`
	Interval   string           `json:"interval"`
	Candles    []CandleJSON     `json:"candles"`
	Indicators FullIndicatorSet `json:"indicators"`
	Patterns   []PatternMatch   `json:"patterns"`
	Verdict    VerdictResult    `json:"verdict"`
	Summary    AnalysisSummary  `json:"summary"`
}

// CandleJSON is the JSON-serializable candle
type CandleJSON struct {
	Time   string  `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume int64   `json:"volume"`
}

// FullIndicatorSet contains all padded arrays matching candle length
type FullIndicatorSet struct {
	RSI              []*float64              `json:"rsi"`
	MACD             MACDArrays              `json:"macd"`
	EMA              EMAArrays               `json:"ema"`
	BB               BollingerArrays         `json:"bb"`
	ATR              []*float64              `json:"atr"`
	ADX              ADXArrays               `json:"adx"`
	Stochastic       StochasticArrays        `json:"stochastic"`
	OBV              []*float64              `json:"obv"`
	Supertrend       SupertrendArrays        `json:"supertrend"`
	Volume           VolumeArrays            `json:"volume"`
	SupportResistance SupportResistanceResult `json:"supportResistance"`
}

// VerdictResult is the 7-factor scoring result
type VerdictResult struct {
	Signal     string            `json:"signal"`
	Confidence int               `json:"confidence"`
	Score      int               `json:"score"`
	MaxScore   int               `json:"maxScore"`
	Factors    map[string]Factor `json:"factors"`
}

// Factor describes one scoring factor
type Factor struct {
	Value        interface{} `json:"value,omitempty"`
	Contribution int         `json:"contribution"`
	Reason       string      `json:"reason"`
}

// AnalysisSummary holds quick-look values
type AnalysisSummary struct {
	LatestRSI   *float64    `json:"latestRSI"`
	TrendState  string      `json:"trendState"`
	SignalBadge SignalBadge `json:"signalBadge"`
}

// SignalBadge is a UI-ready signal label
type SignalBadge struct {
	Signal string `json:"signal"`
	Color  string `json:"color"`
}

// ── Main Generator ──────────────────────────────────────────────────────────

// GenerateFullAnalysis computes all indicators as arrays and returns chart-ready data.
func GenerateFullAnalysis(symbol, interval string, candles []db.Candle) *FullAnalysisResult {
	n := len(candles)
	if n < 14 {
		return nil
	}

	// Extract OHLCV arrays
	closes := make([]float64, n)
	highs := make([]float64, n)
	lows := make([]float64, n)
	volumes := make([]int64, n)
	volumesF64 := make([]float64, n)
	candlesJSON := make([]CandleJSON, n)

	for i, c := range candles {
		closes[i] = c.Close
		highs[i] = c.High
		lows[i] = c.Low
		volumes[i] = c.Volume
		volumesF64[i] = float64(c.Volume)
		candlesJSON[i] = CandleJSON{
			Time:   c.Time.Format("2006-01-02T15:04:05Z"),
			Open:   c.Open,
			High:   c.High,
			Low:    c.Low,
			Close:  c.Close,
			Volume: c.Volume,
		}
	}

	// Compute all indicator arrays
	rsiArr := RSIArray(closes, 14)
	macdArr := MACDArray(closes, 12, 26, 9)
	ema20 := EMAArray(closes, 20)
	ema50 := EMAArray(closes, 50)
	ema200 := EMAArray(closes, 200)
	bbArr := BollingerBandsArray(closes, 20, 2.0)
	atrArr := ATRArray(highs, lows, closes, 14)
	adxArr := ADXArray(highs, lows, closes, 14)
	stochArr := StochasticArray(highs, lows, closes, 14, 3)
	stArr := SupertrendArray(highs, lows, closes, 10, 3.0)
	obvArr := OBVArray(closes, volumes)
	volSMA := SMAArray(volumesF64, 20)
	sr := CalculateSupportResistance(highs, lows, closes, 50)

	// Detect candlestick patterns
	patterns := DetectCandlePatterns(candles)

	// Build indicator set
	indicatorSet := FullIndicatorSet{
		RSI:  rsiArr,
		MACD: macdArr,
		EMA:  EMAArrays{EMA20: ema20, EMA50: ema50, EMA200: ema200},
		BB:   bbArr,
		ATR:  atrArr,
		ADX:  adxArr,
		Stochastic:    stochArr,
		OBV:           obvArr,
		Supertrend:    stArr,
		Volume:        VolumeArrays{Values: volumes, SMA20: volSMA},
		SupportResistance: sr,
	}

	// Compute verdict using latest values
	verdict := computeVerdict(n, rsiArr, macdArr, ema20, ema50, ema200,
		closes, stArr, bbArr, adxArr, stochArr)

	// Build summary
	summary := buildSummary(rsiArr, macdArr)

	return &FullAnalysisResult{
		Symbol:     symbol,
		Interval:   interval,
		Candles:    candlesJSON,
		Indicators: indicatorSet,
		Patterns:   patterns,
		Verdict:    verdict,
		Summary:    summary,
	}
}

// ── 7-Factor Verdict ────────────────────────────────────────────────────────
// Direct translation of AnalysisService.js:484-629

func computeVerdict(n int, rsiArr []*float64, macdArr MACDArrays,
	ema20, ema50, ema200 []*float64, closes []float64,
	stArr SupertrendArrays, bbArr BollingerArrays,
	adxArr ADXArrays, stochArr StochasticArrays) VerdictResult {

	last := n - 1
	score := 0
	factors := make(map[string]Factor)

	// Factor 1: RSI (±2)
	if rsiArr[last] != nil {
		rsi := *rsiArr[last]
		switch {
		case rsi < 30:
			score += 2
			factors["rsi"] = Factor{Value: round2(rsi), Contribution: 2, Reason: "Oversold"}
		case rsi < 40:
			score += 1
			factors["rsi"] = Factor{Value: round2(rsi), Contribution: 1, Reason: "Near Oversold"}
		case rsi > 70:
			score -= 2
			factors["rsi"] = Factor{Value: round2(rsi), Contribution: -2, Reason: "Overbought"}
		case rsi > 60:
			score -= 1
			factors["rsi"] = Factor{Value: round2(rsi), Contribution: -1, Reason: "Near Overbought"}
		default:
			factors["rsi"] = Factor{Value: round2(rsi), Contribution: 0, Reason: "Neutral"}
		}
	}

	// Factor 2: MACD Histogram (±2)
	if macdArr.Histogram[last] != nil {
		hist := *macdArr.Histogram[last]
		switch {
		case hist > 0.5:
			score += 2
			factors["macd"] = Factor{Value: round2(hist), Contribution: 2, Reason: "Strong Bullish"}
		case hist > 0:
			score += 1
			factors["macd"] = Factor{Value: round2(hist), Contribution: 1, Reason: "Bullish"}
		case hist < -0.5:
			score -= 2
			factors["macd"] = Factor{Value: round2(hist), Contribution: -2, Reason: "Strong Bearish"}
		case hist < 0:
			score -= 1
			factors["macd"] = Factor{Value: round2(hist), Contribution: -1, Reason: "Bearish"}
		default:
			factors["macd"] = Factor{Value: round2(hist), Contribution: 0, Reason: "Neutral"}
		}
	}

	// Factor 3: EMA Alignment (±2)
	if ema20[last] != nil && ema50[last] != nil && ema200[last] != nil {
		e20 := *ema20[last]
		e50 := *ema50[last]
		e200 := *ema200[last]
		close := closes[last]
		above20 := close > e20
		above50 := close > e50
		above200 := close > e200
		aligned := e20 > e50 && e50 > e200

		switch {
		case above20 && above50 && above200 && aligned:
			score += 2
			factors["ema"] = Factor{Contribution: 2, Reason: "Perfect Bullish Alignment"}
		case above20 && above50:
			score += 1
			factors["ema"] = Factor{Contribution: 1, Reason: "Above Short EMAs"}
		case !above20 && !above50 && !above200:
			score -= 2
			factors["ema"] = Factor{Contribution: -2, Reason: "Below All EMAs"}
		case !above20 && !above50:
			score -= 1
			factors["ema"] = Factor{Contribution: -1, Reason: "Below Short EMAs"}
		default:
			factors["ema"] = Factor{Contribution: 0, Reason: "Mixed"}
		}
	} else if ema20[last] != nil && ema50[last] != nil {
		// Fallback when EMA200 not available (insufficient data)
		e20 := *ema20[last]
		e50 := *ema50[last]
		close := closes[last]
		if close > e20 && close > e50 {
			score += 1
			factors["ema"] = Factor{Contribution: 1, Reason: "Above Short EMAs"}
		} else if close < e20 && close < e50 {
			score -= 1
			factors["ema"] = Factor{Contribution: -1, Reason: "Below Short EMAs"}
		} else {
			factors["ema"] = Factor{Contribution: 0, Reason: "Mixed"}
		}
	}

	// Factor 4: Supertrend (±2)
	if stArr.Direction[last] != nil {
		dir := *stArr.Direction[last]
		if dir == 1 {
			score += 2
			factors["supertrend"] = Factor{Value: "Bullish", Contribution: 2, Reason: "Uptrend"}
		} else {
			score -= 2
			factors["supertrend"] = Factor{Value: "Bearish", Contribution: -2, Reason: "Downtrend"}
		}
	}

	// Factor 5: Bollinger Position (±2)
	if bbArr.Upper[last] != nil && bbArr.Lower[last] != nil {
		upper := *bbArr.Upper[last]
		lower := *bbArr.Lower[last]
		close := closes[last]
		width := upper - lower
		position := 0.5
		if width > 0 {
			position = (close - lower) / width
		}

		pctStr := formatPct(position)
		switch {
		case position < 0.2:
			score += 2
			factors["bb"] = Factor{Value: pctStr, Contribution: 2, Reason: "Near Lower Band"}
		case position < 0.35:
			score += 1
			factors["bb"] = Factor{Value: pctStr, Contribution: 1, Reason: "Lower Half"}
		case position > 0.8:
			score -= 2
			factors["bb"] = Factor{Value: pctStr, Contribution: -2, Reason: "Near Upper Band"}
		case position > 0.65:
			score -= 1
			factors["bb"] = Factor{Value: pctStr, Contribution: -1, Reason: "Upper Half"}
		default:
			factors["bb"] = Factor{Value: pctStr, Contribution: 0, Reason: "Middle"}
		}
	}

	// Factor 6: ADX Trend Strength (±2)
	if adxArr.ADX[last] != nil {
		adx := *adxArr.ADX[last]
		switch {
		case adx > 25 && score > 0:
			score += 2
			factors["adx"] = Factor{Value: round2(adx), Contribution: 2, Reason: "Strong Uptrend"}
		case adx > 25 && score < 0:
			score -= 2
			factors["adx"] = Factor{Value: round2(adx), Contribution: -2, Reason: "Strong Downtrend"}
		case adx < 20:
			factors["adx"] = Factor{Value: round2(adx), Contribution: 0, Reason: "Ranging Market"}
		default:
			factors["adx"] = Factor{Value: round2(adx), Contribution: 0, Reason: "Moderate Trend"}
		}
	}

	// Factor 7: Stochastic (±2)
	if stochArr.K[last] != nil && stochArr.D[last] != nil {
		k := *stochArr.K[last]
		d := *stochArr.D[last]
		switch {
		case k < 20 && k > d:
			score += 2
			factors["stochastic"] = Factor{Value: map[string]float64{"k": round2(k), "d": round2(d)}, Contribution: 2, Reason: "Oversold + Bullish Cross"}
		case k < 30:
			score += 1
			factors["stochastic"] = Factor{Value: map[string]float64{"k": round2(k), "d": round2(d)}, Contribution: 1, Reason: "Oversold"}
		case k > 80 && k < d:
			score -= 2
			factors["stochastic"] = Factor{Value: map[string]float64{"k": round2(k), "d": round2(d)}, Contribution: -2, Reason: "Overbought + Bearish Cross"}
		case k > 70:
			score -= 1
			factors["stochastic"] = Factor{Value: map[string]float64{"k": round2(k), "d": round2(d)}, Contribution: -1, Reason: "Overbought"}
		default:
			factors["stochastic"] = Factor{Value: map[string]float64{"k": round2(k), "d": round2(d)}, Contribution: 0, Reason: "Neutral"}
		}
	}

	maxScore := 14
	confidence := math.Min(100, math.Abs(float64(score))/float64(maxScore)*100)

	var signal string
	switch {
	case score >= 6:
		signal = "Strong Buy"
	case score >= 3:
		signal = "Buy"
	case score <= -6:
		signal = "Strong Sell"
	case score <= -3:
		signal = "Sell"
	default:
		signal = "Neutral"
	}

	return VerdictResult{
		Signal:     signal,
		Confidence: int(math.Round(confidence)),
		Score:      score,
		MaxScore:   maxScore,
		Factors:    factors,
	}
}

// ── Summary Builder ─────────────────────────────────────────────────────────

func buildSummary(rsiArr []*float64, macdArr MACDArrays) AnalysisSummary {
	n := len(rsiArr)
	var latestRSI *float64
	trendState := "Unknown"

	// Find latest non-nil RSI
	for i := n - 1; i >= 0; i-- {
		if rsiArr[i] != nil {
			latestRSI = ptrFloat(round2(*rsiArr[i]))
			rsi := *rsiArr[i]
			switch {
			case rsi > 70:
				trendState = "Overbought"
			case rsi > 60:
				trendState = "Bullish"
			case rsi < 30:
				trendState = "Oversold"
			case rsi < 40:
				trendState = "Bearish"
			default:
				trendState = "Neutral"
			}
			break
		}
	}

	badge := getSignalBadge(latestRSI, macdArr)

	return AnalysisSummary{
		LatestRSI:   latestRSI,
		TrendState:  trendState,
		SignalBadge: badge,
	}
}

func getSignalBadge(latestRSI *float64, macdArr MACDArrays) SignalBadge {
	score := 0

	if latestRSI != nil {
		rsi := *latestRSI
		switch {
		case rsi > 70:
			score -= 2
		case rsi > 60:
			score += 1
		case rsi < 30:
			score += 2
		case rsi < 40:
			score -= 1
		}
	}

	n := len(macdArr.Histogram)
	if n >= 2 {
		latest := macdArr.Histogram[n-1]
		prev := macdArr.Histogram[n-2]
		if latest != nil && prev != nil {
			if *latest > *prev && *latest > 0 {
				score++
			}
			if *latest < *prev && *latest < 0 {
				score--
			}
		}
	}

	switch {
	case score >= 2:
		return SignalBadge{Signal: "Strong Buy", Color: "success"}
	case score >= 1:
		return SignalBadge{Signal: "Buy", Color: "success"}
	case score <= -2:
		return SignalBadge{Signal: "Strong Sell", Color: "error"}
	case score <= -1:
		return SignalBadge{Signal: "Sell", Color: "error"}
	default:
		return SignalBadge{Signal: "Neutral", Color: "warning"}
	}
}

// GetOverviewSignalBadge computes a signal badge from scalar RSI and MACD values.
// Used by the /analyze/overview endpoint.
func GetOverviewSignalBadge(rsi float64, macd MACDResult) SignalBadge {
	score := 0

	if rsi > 70 {
		score -= 2
	} else if rsi > 60 {
		score += 1
	} else if rsi < 30 {
		score += 2
	} else if rsi < 40 {
		score -= 1
	}

	if macd.Histogram > 0 {
		score++
	} else if macd.Histogram < 0 {
		score--
	}

	switch {
	case score >= 2:
		return SignalBadge{Signal: "Strong Buy", Color: "success"}
	case score >= 1:
		return SignalBadge{Signal: "Buy", Color: "success"}
	case score <= -2:
		return SignalBadge{Signal: "Strong Sell", Color: "error"}
	case score <= -1:
		return SignalBadge{Signal: "Sell", Color: "error"}
	default:
		return SignalBadge{Signal: "Neutral", Color: "warning"}
	}
}

// ── Helpers ─────────────────────────────────────────────────────────────────

func round2(v float64) float64 {
	return math.Round(v*100) / 100
}

func formatPct(v float64) string {
	pct := int(v * 100)
	return fmt.Sprintf("%d%%", pct)
}
