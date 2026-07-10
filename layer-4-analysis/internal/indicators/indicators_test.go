package indicators

import (
	"math"
	"testing"
)

// ── RSI tests ─────────────────────────────────────
func TestRSI_KnownDataset(t *testing.T) {
	// Wilder's 14-period RSI: rising from 44 to 70 over 15 days
	prices := []float64{
		44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42,
		45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00,
		46.03, 46.41, 46.22, 46.00,
	}
	rsi := RSI(prices, 14)
	if rsi < 60 || rsi > 75 {
		t.Errorf("RSI(14) expected ~67-70, got %.2f", rsi)
	}
}

func TestRSI_InsufficientData(t *testing.T) {
	rsi := RSI([]float64{100, 101, 102}, 14)
	if rsi != 50 {
		t.Errorf("RSI with insufficient data should default to 50, got %.2f", rsi)
	}
}

func TestRSI_FlatPrice(t *testing.T) {
	prices := make([]float64, 20)
	for i := range prices { prices[i] = 100 }
	rsi := RSI(prices, 14)
	if rsi != 50 {
		t.Errorf("RSI of flat price should be 50, got %.2f", rsi)
	}
}

// ── MACD tests ────────────────────────────────────
func TestMACD_KnownValues(t *testing.T) {
	prices := make([]float64, 60)
	for i := range prices { prices[i] = 100 + float64(i) }
	result := MACD(prices, 12, 26, 9)
	if math.IsNaN(result.MACD) || math.IsNaN(result.Signal) {
		t.Error("MACD returned NaN")
	}
	// MACD should be positive for rising prices
	if result.MACD <= 0 {
		t.Errorf("MACD should be positive for rising prices, got %.4f", result.MACD)
	}
}

// ── EMA tests ─────────────────────────────────────
func TestEMA_KnownValues(t *testing.T) {
	prices := []float64{22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29}
	ema := EMA(prices, 5)
	// Last 5 values: 22.18, 22.13, 22.23, 22.43, 22.24 avg ~22.24
	if ema < 22.0 || ema > 23.0 {
		t.Errorf("EMA(5) expected ~22.24, got %.4f", ema)
	}
}

func TestEMA_InsufficientData(t *testing.T) {
	prices := []float64{100, 101, 102, 103}
	ema := EMA(prices, 5)
	// With insufficient data, should use SMA of available data = 101.5
	if ema != 101.5 {
		t.Errorf("EMA(5) with 4 prices expected SMA 101.5, got %.4f", ema)
	}
}

// ── ATR tests ─────────────────────────────────────
func TestATR_KnownValues(t *testing.T) {
	highs := []float64{48.7, 48.72, 48.9, 48.87, 48.82, 49.05, 49.20, 49.35, 49.92, 50.19, 50.12, 49.66, 49.88, 50.19, 50.30}
	lows := []float64{47.79, 48.14, 48.39, 48.37, 48.24, 48.64, 48.94, 48.86, 49.50, 49.87, 49.20, 48.90, 49.43, 49.73, 49.80}
	closes := []float64{48.16, 48.61, 48.75, 48.63, 48.74, 49.03, 49.07, 49.32, 49.91, 50.13, 49.53, 49.50, 49.75, 50.03, 50.10}
	atr := ATR(highs, lows, closes, 14)
	if atr < 0.5 || atr > 1.5 {
		t.Errorf("ATR(14) expected ~0.8-1.0, got %.4f", atr)
	}
}

// ── ADX tests ─────────────────────────────────────
func TestADX_TrendingMarket(t *testing.T) {
	// Generate strong uptrend: higher highs + higher lows for 30 bars
	n := 30
	highs := make([]float64, n)
	lows := make([]float64, n)
	closes := make([]float64, n)
	for i := 0; i < n; i++ {
		base := 25000 + float64(i)*10
		highs[i] = base + 20
		lows[i] = base + 5
		closes[i] = base + 15
	}
	result := ADX(highs, lows, closes, 14)
	// Strong trend should have high ADX
	if result.ADX < 20 {
		t.Errorf("ADX in strong uptrend should be >20, got %.2f", result.ADX)
	}
	if result.PDI <= result.NDI {
		t.Errorf("+DI should be > -DI in uptrend: +DI=%.2f -DI=%.2f", result.PDI, result.NDI)
	}
}

func TestADX_RangingMarket(t *testing.T) {
	// Range-bound market: same range for 30 bars
	n := 30
	highs := make([]float64, n)
	lows := make([]float64, n)
	closes := make([]float64, n)
	for i := 0; i < n; i++ {
		highs[i] = 25020
		lows[i] = 24980
		closes[i] = 25000
	}
	result := ADX(highs, lows, closes, 14)
	if result.ADX > 15 {
		t.Errorf("ADX in range-bound market should be <15, got %.2f", result.ADX)
	}
}

// ── Supertrend tests ──────────────────────────────
func TestSupertrend_Uptrend(t *testing.T) {
	n := 30
	highs := make([]float64, n)
	lows := make([]float64, n)
	closes := make([]float64, n)
	for i := 0; i < n; i++ {
		base := 25000 + float64(i)*10
		highs[i] = base + 20
		lows[i] = base + 5
		closes[i] = base + 15
	}
	result := Supertrend(highs, lows, closes, 10, 3)
	// In a strong uptrend, Supertrend should be bullish (direction=1)
	if result.Direction != 1 {
		t.Errorf("Supertrend in uptrend should be bullish (1), got %d", result.Direction)
	}
}

// ── Performance benchmark ─────────────────────────
func BenchmarkRSI_1000Candles(b *testing.B) {
	prices := make([]float64, 1000)
	for i := range prices { prices[i] = 100 + float64(i%50) }
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		RSI(prices, 14)
	}
}
