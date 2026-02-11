// Package indicators provides array-returning technical indicator calculations
// for chart-ready output. Each function returns []*float64 where nil = JSON null
// for warmup periods where the indicator has insufficient data.
package indicators

import (
	"math"
)

// ── Array Return Types ──────────────────────────────────────────────────────

// MACDArrays holds full MACD arrays for charting
type MACDArrays struct {
	MACD      []*float64 `json:"macd"`
	Signal    []*float64 `json:"signal"`
	Histogram []*float64 `json:"histogram"`
}

// EMAArrays holds multiple EMA period arrays
type EMAArrays struct {
	EMA20  []*float64 `json:"ema20"`
	EMA50  []*float64 `json:"ema50"`
	EMA200 []*float64 `json:"ema200"`
}

// BollingerArrays holds full Bollinger Band arrays
type BollingerArrays struct {
	Upper  []*float64 `json:"upper"`
	Middle []*float64 `json:"middle"`
	Lower  []*float64 `json:"lower"`
}

// ADXArrays holds ADX and directional indicator arrays
type ADXArrays struct {
	ADX []*float64 `json:"adx"`
	PDI []*float64 `json:"pdi"`
	NDI []*float64 `json:"ndi"`
}

// StochasticArrays holds Stochastic K and D arrays
type StochasticArrays struct {
	K []*float64 `json:"k"`
	D []*float64 `json:"d"`
}

// SupertrendArrays holds Supertrend value and direction arrays
type SupertrendArrays struct {
	Value     []*float64 `json:"value"`
	Direction []*int     `json:"direction"`
}

// VolumeArrays holds volume values and SMA
type VolumeArrays struct {
	Values []int64    `json:"values"`
	SMA20  []*float64 `json:"sma20"`
}

// ── Helper ──────────────────────────────────────────────────────────────────

func ptrFloat(v float64) *float64 { return &v }
func ptrInt(v int) *int           { return &v }

// ── RSI Array ───────────────────────────────────────────────────────────────

// RSIArray returns RSI values for every data point using Wilder's smoothing.
// First `period` values are nil (warmup). Same algorithm as RSI() in indicators.go.
func RSIArray(closes []float64, period int) []*float64 {
	n := len(closes)
	result := make([]*float64, n)

	if n < period+1 {
		return result
	}

	// Initial average gain/loss over first `period` changes
	gains := 0.0
	losses := 0.0
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

	// First RSI value at index=period
	if avgLoss == 0 {
		result[period] = ptrFloat(100.0)
	} else {
		rs := avgGain / avgLoss
		result[period] = ptrFloat(100.0 - (100.0 / (1.0 + rs)))
	}

	// Wilder's smoothing for remaining values
	for i := period + 1; i < n; i++ {
		change := closes[i] - closes[i-1]
		if change > 0 {
			avgGain = (avgGain*float64(period-1) + change) / float64(period)
			avgLoss = (avgLoss * float64(period-1)) / float64(period)
		} else {
			avgGain = (avgGain * float64(period-1)) / float64(period)
			avgLoss = (avgLoss*float64(period-1) + (-change)) / float64(period)
		}

		if avgLoss == 0 {
			result[i] = ptrFloat(100.0)
		} else {
			rs := avgGain / avgLoss
			result[i] = ptrFloat(100.0 - (100.0 / (1.0 + rs)))
		}
	}

	return result
}

// ── EMA Array ───────────────────────────────────────────────────────────────

// EMAArray returns EMA values for every data point.
// First `period-1` values are nil. Uses SMA as seed, then exponential smoothing.
func EMAArray(data []float64, period int) []*float64 {
	n := len(data)
	result := make([]*float64, n)

	if n < period {
		return result
	}

	multiplier := 2.0 / float64(period+1)

	// SMA for seed
	sma := 0.0
	for i := 0; i < period; i++ {
		sma += data[i]
	}
	sma /= float64(period)

	result[period-1] = ptrFloat(sma)
	ema := sma

	for i := period; i < n; i++ {
		ema = (data[i]-ema)*multiplier + ema
		result[i] = ptrFloat(ema)
	}

	return result
}

// ── SMA Array ───────────────────────────────────────────────────────────────

// SMAArray returns SMA values using a rolling window.
// First `period-1` values are nil.
func SMAArray(data []float64, period int) []*float64 {
	n := len(data)
	result := make([]*float64, n)

	if n < period {
		return result
	}

	// Initial window sum
	sum := 0.0
	for i := 0; i < period; i++ {
		sum += data[i]
	}
	result[period-1] = ptrFloat(sum / float64(period))

	// Slide window
	for i := period; i < n; i++ {
		sum += data[i] - data[i-period]
		result[i] = ptrFloat(sum / float64(period))
	}

	return result
}

// ── MACD Array ──────────────────────────────────────────────────────────────

// MACDArray returns full MACD, Signal, and Histogram arrays.
// MACD line starts at index slowPeriod-1, Signal starts signalPeriod later.
func MACDArray(closes []float64, fastPeriod, slowPeriod, signalPeriod int) MACDArrays {
	n := len(closes)
	macdArr := make([]*float64, n)
	signalArr := make([]*float64, n)
	histArr := make([]*float64, n)

	if n < slowPeriod {
		return MACDArrays{MACD: macdArr, Signal: signalArr, Histogram: histArr}
	}

	// Compute full EMA arrays for fast and slow
	fastEMA := EMAArray(closes, fastPeriod)
	slowEMA := EMAArray(closes, slowPeriod)

	// MACD line = fastEMA - slowEMA (valid where both have values)
	macdValues := make([]float64, n)
	macdStart := slowPeriod - 1 // first index where both EMAs exist
	for i := macdStart; i < n; i++ {
		if fastEMA[i] != nil && slowEMA[i] != nil {
			v := *fastEMA[i] - *slowEMA[i]
			macdArr[i] = ptrFloat(v)
			macdValues[i] = v
		}
	}

	// Signal line = EMA of MACD values (starting from macdStart)
	// We need signalPeriod valid MACD values before we can compute signal
	signalStart := macdStart + signalPeriod - 1
	if signalStart < n {
		// Seed SMA from first signalPeriod MACD values
		sma := 0.0
		for i := macdStart; i < macdStart+signalPeriod; i++ {
			sma += macdValues[i]
		}
		sma /= float64(signalPeriod)

		multiplier := 2.0 / float64(signalPeriod+1)
		sig := sma
		signalArr[signalStart] = ptrFloat(sig)
		histArr[signalStart] = ptrFloat(macdValues[signalStart] - sig)

		for i := signalStart + 1; i < n; i++ {
			sig = (macdValues[i]-sig)*multiplier + sig
			signalArr[i] = ptrFloat(sig)
			histArr[i] = ptrFloat(macdValues[i] - sig)
		}
	}

	return MACDArrays{MACD: macdArr, Signal: signalArr, Histogram: histArr}
}

// ── ATR Array ───────────────────────────────────────────────────────────────

// ATRArray returns ATR values using Wilder's smoothing.
// First `period` values are nil (need period+1 data points for first ATR).
func ATRArray(highs, lows, closes []float64, period int) []*float64 {
	n := len(highs)
	result := make([]*float64, n)

	if n < period+1 {
		return result
	}

	// True Range values (starting from index 1)
	trValues := make([]float64, n)
	for i := 1; i < n; i++ {
		tr1 := highs[i] - lows[i]
		tr2 := math.Abs(highs[i] - closes[i-1])
		tr3 := math.Abs(lows[i] - closes[i-1])
		trValues[i] = math.Max(tr1, math.Max(tr2, tr3))
	}

	// Initial ATR = average of first `period` true range values
	atr := 0.0
	for i := 1; i <= period; i++ {
		atr += trValues[i]
	}
	atr /= float64(period)
	result[period] = ptrFloat(atr)

	// Wilder's smoothing for remaining
	for i := period + 1; i < n; i++ {
		atr = (atr*float64(period-1) + trValues[i]) / float64(period)
		result[i] = ptrFloat(atr)
	}

	return result
}

// ── Bollinger Bands Array ───────────────────────────────────────────────────

// BollingerBandsArray returns full Bollinger Band arrays.
// First `period-1` values are nil.
func BollingerBandsArray(closes []float64, period int, stdDev float64) BollingerArrays {
	n := len(closes)
	upper := make([]*float64, n)
	middle := make([]*float64, n)
	lower := make([]*float64, n)

	if n < period {
		return BollingerArrays{Upper: upper, Middle: middle, Lower: lower}
	}

	smaArr := SMAArray(closes, period)

	for i := period - 1; i < n; i++ {
		if smaArr[i] == nil {
			continue
		}
		sma := *smaArr[i]

		// Standard deviation over the window
		sum := 0.0
		for j := i - period + 1; j <= i; j++ {
			diff := closes[j] - sma
			sum += diff * diff
		}
		std := math.Sqrt(sum / float64(period))

		middle[i] = ptrFloat(sma)
		upper[i] = ptrFloat(sma + stdDev*std)
		lower[i] = ptrFloat(sma - stdDev*std)
	}

	return BollingerArrays{Upper: upper, Middle: middle, Lower: lower}
}

// ── ADX Array ───────────────────────────────────────────────────────────────

// ADXArray returns ADX, +DI, and -DI arrays.
// Requires 2*period data points for valid ADX.
func ADXArray(highs, lows, closes []float64, period int) ADXArrays {
	n := len(highs)
	adxArr := make([]*float64, n)
	pdiArr := make([]*float64, n)
	ndiArr := make([]*float64, n)

	if n < 2*period+1 {
		return ADXArrays{ADX: adxArr, PDI: pdiArr, NDI: ndiArr}
	}

	// True Range, +DM, -DM
	tr := make([]float64, n)
	plusDM := make([]float64, n)
	minusDM := make([]float64, n)

	for i := 1; i < n; i++ {
		tr1 := highs[i] - lows[i]
		tr2 := math.Abs(highs[i] - closes[i-1])
		tr3 := math.Abs(lows[i] - closes[i-1])
		tr[i] = math.Max(tr1, math.Max(tr2, tr3))

		upMove := highs[i] - highs[i-1]
		downMove := lows[i-1] - lows[i]

		if upMove > downMove && upMove > 0 {
			plusDM[i] = upMove
		}
		if downMove > upMove && downMove > 0 {
			minusDM[i] = downMove
		}
	}

	// Smoothed sums (Wilder's)
	smoothTR := 0.0
	smoothPlusDM := 0.0
	smoothMinusDM := 0.0

	for i := 1; i <= period; i++ {
		smoothTR += tr[i]
		smoothPlusDM += plusDM[i]
		smoothMinusDM += minusDM[i]
	}

	// First DI values at index=period
	if smoothTR > 0 {
		pdi := (smoothPlusDM / smoothTR) * 100
		ndi := (smoothMinusDM / smoothTR) * 100
		pdiArr[period] = ptrFloat(pdi)
		ndiArr[period] = ptrFloat(ndi)
	}

	// DX values for ADX calculation
	dxValues := make([]float64, n)
	dxCount := 0

	if pdiArr[period] != nil && ndiArr[period] != nil {
		pdi := *pdiArr[period]
		ndi := *ndiArr[period]
		sum := pdi + ndi
		if sum > 0 {
			dxValues[period] = math.Abs(pdi-ndi) / sum * 100
			dxCount++
		}
	}

	for i := period + 1; i < n; i++ {
		smoothTR = smoothTR - smoothTR/float64(period) + tr[i]
		smoothPlusDM = smoothPlusDM - smoothPlusDM/float64(period) + plusDM[i]
		smoothMinusDM = smoothMinusDM - smoothMinusDM/float64(period) + minusDM[i]

		if smoothTR > 0 {
			pdi := (smoothPlusDM / smoothTR) * 100
			ndi := (smoothMinusDM / smoothTR) * 100
			pdiArr[i] = ptrFloat(pdi)
			ndiArr[i] = ptrFloat(ndi)

			sum := pdi + ndi
			if sum > 0 {
				dxValues[i] = math.Abs(pdi-ndi) / sum * 100
				dxCount++
			}
		}

		// ADX starts when we have `period` DX values
		if dxCount == period {
			// First ADX = SMA of first `period` DX values
			adxSum := 0.0
			cnt := 0
			for j := period; j <= i; j++ {
				if dxValues[j] > 0 || (pdiArr[j] != nil && ndiArr[j] != nil) {
					adxSum += dxValues[j]
					cnt++
					if cnt == period {
						break
					}
				}
			}
			if cnt > 0 {
				adxArr[i] = ptrFloat(adxSum / float64(cnt))
			}
		} else if dxCount > period && adxArr[i-1] != nil {
			// Smooth ADX
			prevADX := *adxArr[i-1]
			adxArr[i] = ptrFloat((prevADX*float64(period-1) + dxValues[i]) / float64(period))
		}
	}

	return ADXArrays{ADX: adxArr, PDI: pdiArr, NDI: ndiArr}
}

// ── Stochastic Array ────────────────────────────────────────────────────────

// StochasticArray returns full Stochastic %K and %D arrays.
// %K starts at index period-1, %D starts signalPeriod later.
func StochasticArray(highs, lows, closes []float64, period, signalPeriod int) StochasticArrays {
	n := len(closes)
	kArr := make([]*float64, n)
	dArr := make([]*float64, n)

	if n < period {
		return StochasticArrays{K: kArr, D: dArr}
	}

	// Calculate raw %K values
	kRaw := make([]float64, n) // for D calculation
	for i := period - 1; i < n; i++ {
		high := highs[i]
		low := lows[i]
		for j := i - period + 1; j <= i; j++ {
			if highs[j] > high {
				high = highs[j]
			}
			if lows[j] < low {
				low = lows[j]
			}
		}

		if high == low {
			kArr[i] = ptrFloat(50.0)
			kRaw[i] = 50.0
		} else {
			k := ((closes[i] - low) / (high - low)) * 100
			kArr[i] = ptrFloat(k)
			kRaw[i] = k
		}
	}

	// %D = SMA of %K over signalPeriod
	kStart := period - 1
	dStart := kStart + signalPeriod - 1
	if dStart < n {
		sum := 0.0
		for i := kStart; i < kStart+signalPeriod; i++ {
			sum += kRaw[i]
		}
		dArr[dStart] = ptrFloat(sum / float64(signalPeriod))

		for i := dStart + 1; i < n; i++ {
			sum += kRaw[i] - kRaw[i-signalPeriod]
			dArr[i] = ptrFloat(sum / float64(signalPeriod))
		}
	}

	return StochasticArrays{K: kArr, D: dArr}
}

// ── Supertrend Array ────────────────────────────────────────────────────────

// SupertrendArray returns Supertrend value and direction arrays.
// Uses ATR for band calculation with trailing stop logic.
func SupertrendArray(highs, lows, closes []float64, period int, multiplier float64) SupertrendArrays {
	n := len(highs)
	valueArr := make([]*float64, n)
	dirArr := make([]*int, n)

	atrArr := ATRArray(highs, lows, closes, period)

	var prevUpperBand, prevLowerBand, prevSupertrend float64
	prevDirection := 1
	started := false

	for i := 0; i < n; i++ {
		if atrArr[i] == nil {
			continue
		}

		atr := *atrArr[i]
		hl2 := (highs[i] + lows[i]) / 2

		upperBand := hl2 + multiplier*atr
		lowerBand := hl2 - multiplier*atr

		if started && i > 0 {
			// Trailing logic
			if closes[i-1] > prevLowerBand {
				lowerBand = math.Max(lowerBand, prevLowerBand)
			}
			if closes[i-1] < prevUpperBand {
				upperBand = math.Min(upperBand, prevUpperBand)
			}
		}

		var currentDirection int
		var currentSupertrend float64

		if !started {
			if closes[i] > upperBand {
				currentDirection = 1
			} else {
				currentDirection = -1
			}
			if currentDirection == 1 {
				currentSupertrend = lowerBand
			} else {
				currentSupertrend = upperBand
			}
			started = true
		} else if prevDirection == 1 {
			if closes[i] < prevSupertrend {
				currentDirection = -1
				currentSupertrend = upperBand
			} else {
				currentDirection = 1
				currentSupertrend = lowerBand
			}
		} else {
			if closes[i] > prevSupertrend {
				currentDirection = 1
				currentSupertrend = lowerBand
			} else {
				currentDirection = -1
				currentSupertrend = upperBand
			}
		}

		valueArr[i] = ptrFloat(currentSupertrend)
		dirArr[i] = ptrInt(currentDirection)

		prevUpperBand = upperBand
		prevLowerBand = lowerBand
		prevSupertrend = currentSupertrend
		prevDirection = currentDirection
	}

	return SupertrendArrays{Value: valueArr, Direction: dirArr}
}

// ── OBV Array ───────────────────────────────────────────────────────────────

// OBVArray returns On-Balance Volume for each data point.
func OBVArray(closes []float64, volumes []int64) []*float64 {
	n := len(closes)
	result := make([]*float64, n)

	if n == 0 {
		return result
	}

	obv := 0.0
	result[0] = ptrFloat(obv)

	for i := 1; i < n; i++ {
		if closes[i] > closes[i-1] {
			obv += float64(volumes[i])
		} else if closes[i] < closes[i-1] {
			obv -= float64(volumes[i])
		}
		result[i] = ptrFloat(obv)
	}

	return result
}

// ── Support/Resistance ──────────────────────────────────────────────────────

// SupportResistanceResult holds support/resistance levels
type SupportResistanceResult struct {
	Support    []float64 `json:"support"`
	Resistance []float64 `json:"resistance"`
	PivotPoint *float64  `json:"pivotPoint"`
}

// CalculateSupportResistance finds pivot-based S/R levels.
func CalculateSupportResistance(highs, lows, closes []float64, lookback int) SupportResistanceResult {
	n := len(closes)
	if n < lookback {
		return SupportResistanceResult{Support: []float64{}, Resistance: []float64{}}
	}

	lastIdx := n - 1
	pivotPoint := (highs[lastIdx] + lows[lastIdx] + closes[lastIdx]) / 3
	rng := highs[lastIdx] - lows[lastIdx]

	r1 := 2*pivotPoint - lows[lastIdx]
	s1 := 2*pivotPoint - highs[lastIdx]
	r2 := pivotPoint + rng
	s2 := pivotPoint - rng
	r3 := highs[lastIdx] + 2*(pivotPoint-lows[lastIdx])
	s3 := lows[lastIdx] - 2*(highs[lastIdx]-pivotPoint)

	// Swing highs/lows from recent window
	start := n - lookback
	swingHighs := []float64{}
	swingLows := []float64{}
	for i := start + 2; i < n-2; i++ {
		if highs[i] > highs[i-1] && highs[i] > highs[i-2] &&
			highs[i] > highs[i+1] && highs[i] > highs[i+2] {
			swingHighs = append(swingHighs, highs[i])
		}
		if lows[i] < lows[i-1] && lows[i] < lows[i-2] &&
			lows[i] < lows[i+1] && lows[i] < lows[i+2] {
			swingLows = append(swingLows, lows[i])
		}
	}

	// Combine and sort
	support := append([]float64{s1, s2, s3}, swingLows...)
	resistance := append([]float64{r1, r2, r3}, swingHighs...)

	// Sort support descending, resistance ascending
	sortDesc(support)
	sortAsc(resistance)

	// Limit to 3
	if len(support) > 3 {
		support = support[:3]
	}
	if len(resistance) > 3 {
		resistance = resistance[:3]
	}

	return SupportResistanceResult{
		Support:    support,
		Resistance: resistance,
		PivotPoint: ptrFloat(pivotPoint),
	}
}

func sortDesc(a []float64) {
	for i := 0; i < len(a); i++ {
		for j := i + 1; j < len(a); j++ {
			if a[j] > a[i] {
				a[i], a[j] = a[j], a[i]
			}
		}
	}
}

func sortAsc(a []float64) {
	for i := 0; i < len(a); i++ {
		for j := i + 1; j < len(a); j++ {
			if a[j] < a[i] {
				a[i], a[j] = a[j], a[i]
			}
		}
	}
}
