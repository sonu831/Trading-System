package indicators

import (
	"fmt"
	"math"

	"github.com/sonu831/Trading-System/layer-4-analysis/internal/db"
)

// IndicatorMeta describes one indicator's parameters, formula, and current interpretation.
type IndicatorMeta struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  map[string]interface{} `json:"parameters"`
	Formula     string                 `json:"formula"`
	Current     interface{}            `json:"current"`
	State       string                 `json:"state"`
	Zones       map[string]string      `json:"zones,omitempty"`
	Verdict     *VerdictContribution   `json:"verdictContribution,omitempty"`
}

// VerdictContribution describes how one factor contributed to the verdict.
type VerdictContribution struct {
	Score    int    `json:"score"`
	MaxScore int    `json:"maxScore"`
	Reason   string `json:"reason"`
}

// VerdictExplanation is a human-readable breakdown of the total verdict.
type VerdictExplanation struct {
	TotalScore  int    `json:"totalScore"`
	MaxPossible int    `json:"maxPossible"`
	Signal      string `json:"signal"`
	Confidence  int    `json:"confidence"`
	Breakdown   string `json:"breakdown"`
}

// MetadataResult is the response for /analyze/metadata.
type MetadataResult struct {
	Symbol     string                    `json:"symbol"`
	Interval   string                    `json:"interval"`
	Indicators map[string]IndicatorMeta  `json:"indicators"`
	Verdict    VerdictExplanation        `json:"verdictExplanation"`
}

// GenerateMetadata returns indicator metadata with current values and verdict contribution.
func GenerateMetadata(symbol, interval string, candles []db.Candle) *MetadataResult {
	n := len(candles)
	if n < 14 {
		return nil
	}

	closes := make([]float64, n)
	highs := make([]float64, n)
	lows := make([]float64, n)
	for i, c := range candles {
		closes[i] = c.Close
		highs[i] = c.High
		lows[i] = c.Low
	}

	last := n - 1

	// Compute indicators
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

	meta := make(map[string]IndicatorMeta)

	// ── RSI ──
	var rsiVal interface{}
	rsiState := "N/A"
	rsiVerdict := &VerdictContribution{MaxScore: 2}
	if rsiArr[last] != nil {
		r := *rsiArr[last]
		rsiVal = round2(r)
		switch {
		case r < 30:
			rsiState = "Oversold"
			rsiVerdict.Score = 2
			rsiVerdict.Reason = "Oversold — potential bounce/reversal"
		case r < 40:
			rsiState = "Near Oversold"
			rsiVerdict.Score = 1
			rsiVerdict.Reason = "Approaching oversold territory"
		case r > 70:
			rsiState = "Overbought"
			rsiVerdict.Score = -2
			rsiVerdict.Reason = "Overbought — potential pullback"
		case r > 60:
			rsiState = "Near Overbought"
			rsiVerdict.Score = -1
			rsiVerdict.Reason = "Approaching overbought territory"
		default:
			rsiState = "Neutral"
			rsiVerdict.Score = 0
			rsiVerdict.Reason = "Neutral — no extreme reading"
		}
	}
	meta["rsi"] = IndicatorMeta{
		Name:        "Relative Strength Index (RSI)",
		Description: "Momentum oscillator measuring the speed and magnitude of price changes over 14 periods. Values range 0-100.",
		Parameters:  map[string]interface{}{"period": 14},
		Formula:     "RSI = 100 - (100 / (1 + RS)), where RS = Average Gain / Average Loss over 14 periods",
		Current:     rsiVal,
		State:       rsiState,
		Zones: map[string]string{
			"overbought": ">70 — Price may be overextended. Consider taking profits or waiting for pullback.",
			"oversold":   "<30 — Price may be oversold. Watch for reversal or buying opportunity.",
			"neutral":    "30-70 — No extreme. Look for other confirmations.",
		},
		Verdict: rsiVerdict,
	}

	// ── MACD ──
	var macdHistVal interface{}
	macdState := "N/A"
	macdVerdict := &VerdictContribution{MaxScore: 2}
	if macdArr.Histogram[last] != nil {
		h := *macdArr.Histogram[last]
		macdHistVal = round2(h)
		switch {
		case h > 0.5:
			macdState = "Strong Bullish"
			macdVerdict.Score = 2
			macdVerdict.Reason = "Histogram strongly positive — bullish momentum accelerating"
		case h > 0:
			macdState = "Bullish"
			macdVerdict.Score = 1
			macdVerdict.Reason = "Histogram positive — bullish momentum"
		case h < -0.5:
			macdState = "Strong Bearish"
			macdVerdict.Score = -2
			macdVerdict.Reason = "Histogram strongly negative — bearish momentum accelerating"
		case h < 0:
			macdState = "Bearish"
			macdVerdict.Score = -1
			macdVerdict.Reason = "Histogram negative — bearish momentum"
		default:
			macdState = "Neutral"
			macdVerdict.Score = 0
			macdVerdict.Reason = "Histogram near zero — no clear momentum"
		}
	}
	meta["macd"] = IndicatorMeta{
		Name:        "Moving Average Convergence Divergence (MACD)",
		Description: "Trend-following momentum indicator showing the relationship between two exponential moving averages of price.",
		Parameters:  map[string]interface{}{"fastPeriod": 12, "slowPeriod": 26, "signalPeriod": 9},
		Formula:     "MACD Line = EMA(12) - EMA(26). Signal Line = EMA(9) of MACD Line. Histogram = MACD - Signal.",
		Current:     map[string]interface{}{"histogram": macdHistVal},
		State:       macdState,
		Zones: map[string]string{
			"bullish":  "Histogram > 0 — MACD above signal, bullish momentum.",
			"bearish":  "Histogram < 0 — MACD below signal, bearish momentum.",
			"crossover": "Histogram crossing zero — potential trend change.",
		},
		Verdict: macdVerdict,
	}

	// ── EMA ──
	emaVerdict := &VerdictContribution{MaxScore: 2}
	emaState := "N/A"
	emaVals := map[string]interface{}{}
	if ema20[last] != nil {
		emaVals["ema20"] = round2(*ema20[last])
	}
	if ema50[last] != nil {
		emaVals["ema50"] = round2(*ema50[last])
	}
	if ema200[last] != nil {
		emaVals["ema200"] = round2(*ema200[last])
	}
	if ema20[last] != nil && ema50[last] != nil && ema200[last] != nil {
		e20, e50, e200 := *ema20[last], *ema50[last], *ema200[last]
		close := closes[last]
		above20 := close > e20
		above50 := close > e50
		above200 := close > e200
		aligned := e20 > e50 && e50 > e200
		switch {
		case above20 && above50 && above200 && aligned:
			emaState = "Perfect Bullish Alignment"
			emaVerdict.Score = 2
			emaVerdict.Reason = "Price above all EMAs with EMA20 > EMA50 > EMA200 — strong uptrend"
		case above20 && above50:
			emaState = "Above Short EMAs"
			emaVerdict.Score = 1
			emaVerdict.Reason = "Price above EMA20 and EMA50 — short-term bullish"
		case !above20 && !above50 && !above200:
			emaState = "Below All EMAs"
			emaVerdict.Score = -2
			emaVerdict.Reason = "Price below all EMAs — strong downtrend"
		case !above20 && !above50:
			emaState = "Below Short EMAs"
			emaVerdict.Score = -1
			emaVerdict.Reason = "Price below EMA20 and EMA50 — short-term bearish"
		default:
			emaState = "Mixed"
			emaVerdict.Score = 0
			emaVerdict.Reason = "Price between EMAs — no clear alignment"
		}
	}
	meta["ema"] = IndicatorMeta{
		Name:        "Exponential Moving Averages (EMA 20/50/200)",
		Description: "Trend indicators that smooth price data, giving more weight to recent prices. Three periods show short, medium, and long-term trends.",
		Parameters:  map[string]interface{}{"periods": []int{20, 50, 200}},
		Formula:     "EMA = Price × k + EMA(prev) × (1-k), where k = 2/(period+1)",
		Current:     emaVals,
		State:       emaState,
		Zones: map[string]string{
			"bullishAlignment": "EMA20 > EMA50 > EMA200 with price above all — strong uptrend.",
			"bearishAlignment": "EMA20 < EMA50 < EMA200 with price below all — strong downtrend.",
			"crossover":        "EMAs crossing each other — potential trend change.",
		},
		Verdict: emaVerdict,
	}

	// ── Supertrend ──
	stVerdict := &VerdictContribution{MaxScore: 2}
	stState := "N/A"
	var stDirStr interface{}
	if stArr.Direction[last] != nil {
		d := *stArr.Direction[last]
		if d == 1 {
			stState = "Bullish (Uptrend)"
			stDirStr = "Bullish"
			stVerdict.Score = 2
			stVerdict.Reason = "Supertrend below price — confirmed uptrend"
		} else {
			stState = "Bearish (Downtrend)"
			stDirStr = "Bearish"
			stVerdict.Score = -2
			stVerdict.Reason = "Supertrend above price — confirmed downtrend"
		}
	}
	meta["supertrend"] = IndicatorMeta{
		Name:        "Supertrend",
		Description: "ATR-based trailing stop indicator that flips direction on breakout. Green (below price) = uptrend, Red (above price) = downtrend.",
		Parameters:  map[string]interface{}{"period": 10, "multiplier": 3.0},
		Formula:     "Upper Band = HL2 + (ATR × multiplier). Lower Band = HL2 - (ATR × multiplier). Direction flips when price crosses the band.",
		Current:     stDirStr,
		State:       stState,
		Verdict:     stVerdict,
	}

	// ── Bollinger Bands ──
	bbVerdict := &VerdictContribution{MaxScore: 2}
	bbState := "N/A"
	var bbPos interface{}
	if bbArr.Upper[last] != nil && bbArr.Lower[last] != nil {
		upper := *bbArr.Upper[last]
		lower := *bbArr.Lower[last]
		width := upper - lower
		position := 0.5
		if width > 0 {
			position = (closes[last] - lower) / width
		}
		bbPos = fmt.Sprintf("%d%%", int(position*100))
		switch {
		case position < 0.2:
			bbState = "Near Lower Band"
			bbVerdict.Score = 2
			bbVerdict.Reason = "Price near lower band — potential oversold bounce"
		case position < 0.35:
			bbState = "Lower Half"
			bbVerdict.Score = 1
			bbVerdict.Reason = "Price in lower half of bands"
		case position > 0.8:
			bbState = "Near Upper Band"
			bbVerdict.Score = -2
			bbVerdict.Reason = "Price near upper band — potential overbought pullback"
		case position > 0.65:
			bbState = "Upper Half"
			bbVerdict.Score = -1
			bbVerdict.Reason = "Price in upper half of bands"
		default:
			bbState = "Middle"
			bbVerdict.Score = 0
			bbVerdict.Reason = "Price near middle of bands — neutral"
		}
	}
	meta["bb"] = IndicatorMeta{
		Name:        "Bollinger Bands",
		Description: "Volatility bands placed above and below a 20-period SMA. Bands widen in high volatility and narrow in low volatility (squeeze).",
		Parameters:  map[string]interface{}{"period": 20, "stdDev": 2.0},
		Formula:     "Middle = SMA(20). Upper = Middle + 2 × StdDev. Lower = Middle - 2 × StdDev.",
		Current:     map[string]interface{}{"position": bbPos},
		State:       bbState,
		Zones: map[string]string{
			"nearLower":  "<20% — Price near lower band, potential reversal up.",
			"nearUpper":  ">80% — Price near upper band, potential reversal down.",
			"squeeze":    "Bands narrowing — expect a breakout.",
		},
		Verdict: bbVerdict,
	}

	// ── ADX ──
	adxVerdict := &VerdictContribution{MaxScore: 2}
	adxState := "N/A"
	var adxVal interface{}
	if adxArr.ADX[last] != nil {
		a := *adxArr.ADX[last]
		adxVal = round2(a)
		totalScore := rsiVerdict.Score + macdVerdict.Score + emaVerdict.Score + stVerdict.Score + bbVerdict.Score
		switch {
		case a > 25 && totalScore > 0:
			adxState = "Strong Uptrend"
			adxVerdict.Score = 2
			adxVerdict.Reason = "ADX > 25 with net bullish score — trend is strong and confirmed"
		case a > 25 && totalScore < 0:
			adxState = "Strong Downtrend"
			adxVerdict.Score = -2
			adxVerdict.Reason = "ADX > 25 with net bearish score — downtrend is strong and confirmed"
		case a < 20:
			adxState = "Ranging / No Trend"
			adxVerdict.Score = 0
			adxVerdict.Reason = "ADX < 20 — no strong trend, market is ranging"
		default:
			adxState = "Moderate Trend"
			adxVerdict.Score = 0
			adxVerdict.Reason = "ADX 20-25 — trend developing but not yet strong"
		}
	}
	meta["adx"] = IndicatorMeta{
		Name:        "Average Directional Index (ADX)",
		Description: "Measures trend strength regardless of direction. Does NOT indicate direction — only how strong the trend is.",
		Parameters:  map[string]interface{}{"period": 14},
		Formula:     "ADX = SMA(14) of the Directional Movement Index. +DI and -DI show bullish/bearish pressure.",
		Current:     map[string]interface{}{"adx": adxVal},
		State:       adxState,
		Zones: map[string]string{
			"strong":   ">25 — Strong trend. Trade in the direction of other indicators.",
			"moderate": "20-25 — Trend developing. Wait for confirmation.",
			"weak":     "<20 — No trend. Range-bound strategies preferred.",
		},
		Verdict: adxVerdict,
	}

	// ── Stochastic ──
	stochVerdict := &VerdictContribution{MaxScore: 2}
	stochState := "N/A"
	stochVals := map[string]interface{}{}
	if stochArr.K[last] != nil && stochArr.D[last] != nil {
		k := *stochArr.K[last]
		d := *stochArr.D[last]
		stochVals["k"] = round2(k)
		stochVals["d"] = round2(d)
		switch {
		case k < 20 && k > d:
			stochState = "Oversold + Bullish Cross"
			stochVerdict.Score = 2
			stochVerdict.Reason = "%K below 20 and crossing above %D — strong bullish reversal signal"
		case k < 30:
			stochState = "Oversold"
			stochVerdict.Score = 1
			stochVerdict.Reason = "%K below 30 — oversold, potential bounce"
		case k > 80 && k < d:
			stochState = "Overbought + Bearish Cross"
			stochVerdict.Score = -2
			stochVerdict.Reason = "%K above 80 and crossing below %D — strong bearish reversal signal"
		case k > 70:
			stochState = "Overbought"
			stochVerdict.Score = -1
			stochVerdict.Reason = "%K above 70 — overbought, potential pullback"
		default:
			stochState = "Neutral"
			stochVerdict.Score = 0
			stochVerdict.Reason = "No extreme reading — neutral"
		}
	}
	meta["stochastic"] = IndicatorMeta{
		Name:        "Stochastic Oscillator (%K / %D)",
		Description: "Compares current close to the high-low range over 14 periods. Shows where price closed relative to its recent range.",
		Parameters:  map[string]interface{}{"period": 14, "signalPeriod": 3},
		Formula:     "%K = (Close - Lowest Low) / (Highest High - Lowest Low) × 100. %D = SMA(3) of %K.",
		Current:     stochVals,
		State:       stochState,
		Zones: map[string]string{
			"overbought": ">80 — Price near the top of recent range. May reverse down.",
			"oversold":   "<20 — Price near the bottom of recent range. May reverse up.",
			"crossover":  "%K crossing %D in extreme zones — strong reversal signal.",
		},
		Verdict: stochVerdict,
	}

	// ── ATR (informational, not part of verdict) ──
	var atrVal interface{}
	atrState := "N/A"
	if atrArr[last] != nil {
		a := *atrArr[last]
		atrVal = round2(a)
		pct := 0.0
		if closes[last] > 0 {
			pct = (a / closes[last]) * 100
		}
		atrState = fmt.Sprintf("%.2f%% of price", pct)
	}
	meta["atr"] = IndicatorMeta{
		Name:        "Average True Range (ATR)",
		Description: "Measures market volatility by decomposing the entire range of a price for the period. Higher ATR = more volatile.",
		Parameters:  map[string]interface{}{"period": 14},
		Formula:     "TR = max(High-Low, |High-PrevClose|, |Low-PrevClose|). ATR = SMA(14) of TR.",
		Current:     atrVal,
		State:       atrState,
	}

	// Build verdict explanation
	totalScore := rsiVerdict.Score + macdVerdict.Score + emaVerdict.Score +
		stVerdict.Score + bbVerdict.Score + adxVerdict.Score + stochVerdict.Score
	maxPossible := 14
	confidence := math.Min(100, math.Abs(float64(totalScore))/float64(maxPossible)*100)

	var signal string
	switch {
	case totalScore >= 6:
		signal = "Strong Buy"
	case totalScore >= 3:
		signal = "Buy"
	case totalScore <= -6:
		signal = "Strong Sell"
	case totalScore <= -3:
		signal = "Sell"
	default:
		signal = "Neutral"
	}

	breakdown := fmt.Sprintf("RSI(%+d) + MACD(%+d) + EMA(%+d) + Supertrend(%+d) + BB(%+d) + ADX(%+d) + Stochastic(%+d) = %d/%d",
		rsiVerdict.Score, macdVerdict.Score, emaVerdict.Score,
		stVerdict.Score, bbVerdict.Score, adxVerdict.Score, stochVerdict.Score,
		totalScore, maxPossible)

	return &MetadataResult{
		Symbol:   symbol,
		Interval: interval,
		Indicators: meta,
		Verdict: VerdictExplanation{
			TotalScore:  totalScore,
			MaxPossible: maxPossible,
			Signal:      signal,
			Confidence:  int(math.Round(confidence)),
			Breakdown:   breakdown,
		},
	}
}
