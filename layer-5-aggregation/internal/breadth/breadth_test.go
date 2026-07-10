package breadth

import (
	"math"
	"testing"
)

// ── Test helpers ──────────────────────────────────
func makeStockResult(symbol string, ltp, changePct, rsi, compositeScore float64, emas map[int]float64) StockResult {
	return StockResult{
		Symbol:         symbol,
		LTP:            ltp,
		ChangePct:      changePct,
		RSI:            rsi,
		CompositeScore: compositeScore,
		EMAs:           emas,
	}
}

// ── Breadth metrics tests ─────────────────────────
func TestCalculateBreadth_BullishMarket(t *testing.T) {
	stocks := []StockResult{
		makeStockResult("A", 2500, 2.0, 65, 0.5, map[int]float64{20: 2480, 50: 2450, 200: 2400}),
		makeStockResult("B", 3000, 1.5, 60, 0.4, map[int]float64{20: 2980, 50: 2950, 200: 2900}),
		makeStockResult("C", 1500, -0.5, 45, -0.1, map[int]float64{20: 1510, 50: 1520, 200: 1480}),
		makeStockResult("D", 5000, 3.0, 70, 0.6, map[int]float64{20: 4950, 50: 4900, 200: 4800}),
	}

	b := CalculateBreadth(stocks)
	if b.TotalStocks != 4 { t.Errorf("TotalStocks expected 4, got %d", b.TotalStocks) }
	if b.Advancing < 2 { t.Errorf("Advancing expected >=2, got %d", b.Advancing) }
	if b.Declining < 0 { t.Errorf("Declining expected >=0, got %d", b.Declining) }
	if b.ADRatio <= 1 { t.Errorf("ADRatio expected >1, got %.4f", b.ADRatio) }
}

func TestCalculateBreadth_AllBullish(t *testing.T) {
	stocks := make([]StockResult, 10)
	for i := range stocks {
		stocks[i] = makeStockResult("S", 1000, 5.0, 75, 0.8, map[int]float64{20: 990, 50: 980, 200: 950})
	}
	b := CalculateBreadth(stocks)
	if b.Sentiment != "STRONGLY_BULLISH" && b.Sentiment != "BULLISH" {
		t.Errorf("All-bullish market should be BULLISH+, got %s", b.Sentiment)
	}
	if b.AboveEMA20Pct != 100 {
		t.Errorf("AboveEMA20Pct expected 100, got %.2f", b.AboveEMA20Pct)
	}
}

func TestCalculateBreadth_AllBearish(t *testing.T) {
	stocks := make([]StockResult, 10)
	for i := range stocks {
		stocks[i] = makeStockResult("S", 1000, -5.0, 25, -0.8, map[int]float64{20: 1020, 50: 1050, 200: 1100})
	}
	b := CalculateBreadth(stocks)
	if b.Sentiment != "STRONGLY_BEARISH" && b.Sentiment != "BEARISH" {
		t.Errorf("All-bearish market should be BEARISH+, got %s", b.Sentiment)
	}
	if b.Advancing > 0 { t.Errorf("Advancing expected 0, got %d", b.Advancing) }
}

func TestCalculateBreadth_NeutralMarket(t *testing.T) {
	stocks := []StockResult{
		makeStockResult("A", 2500, 0.5, 52, 0.1, map[int]float64{20: 2495, 50: 2500, 200: 2480}),
		makeStockResult("B", 3000, -0.3, 48, -0.05, map[int]float64{20: 3010, 50: 2990, 200: 3050}),
		makeStockResult("C", 1500, 0.2, 50, 0.0, map[int]float64{20: 1498, 50: 1505, 200: 1490}),
	}

	b := CalculateBreadth(stocks)
	if b.Sentiment != "NEUTRAL" {
		t.Errorf("Mixed market should be NEUTRAL, got %s", b.Sentiment)
	}
	// AD ratio should be close to 1
	if math.Abs(b.ADRatio-1.0) > 2.0 {
		t.Errorf("ADRatio expected ~1.0, got %.4f", b.ADRatio)
	}
}

func TestCalculateBreadth_AvgRSI(t *testing.T) {
	stocks := []StockResult{
		makeStockResult("A", 100, 0, 60, 0.2, nil),
		makeStockResult("B", 200, 0, 40, -0.2, nil),
	}
	b := CalculateBreadth(stocks)
	expectedAvg := 50.0
	if math.Abs(b.AverageRSI-expectedAvg) > 0.1 {
		t.Errorf("AverageRSI expected %.1f, got %.2f", expectedAvg, b.AverageRSI)
	}
}

func TestCalculateBreadth_EMAThresholds(t *testing.T) {
	stocks := []StockResult{
		makeStockResult("A", 100, 0, 50, 0, map[int]float64{20: 99, 50: 98, 200: 95}),   // above all
		makeStockResult("B", 100, 0, 50, 0, map[int]float64{20: 102, 50: 101, 200: 98}),  // below 20/50
		makeStockResult("C", 100, 0, 50, 0, map[int]float64{20: 98, 50: 99, 200: 101}),   // above 20, below 50/200
	}
	b := CalculateBreadth(stocks)
	if b.AboveEMA20Pct <= 0 || b.AboveEMA20Pct > 100 {
		t.Errorf("AboveEMA20Pct should be 0-100, got %.2f", b.AboveEMA20Pct)
	}
	if b.AboveEMA200Pct <= 0 || b.AboveEMA200Pct > 100 {
		t.Errorf("AboveEMA200Pct should be 0-100, got %.2f", b.AboveEMA200Pct)
	}
}

func TestCalculateBreadth_EmptyInput(t *testing.T) {
	b := CalculateBreadth([]StockResult{})
	if b.TotalStocks != 0 { t.Errorf("Empty input should have 0 stocks") }
	if b.Sentiment != "NEUTRAL" { t.Errorf("Empty input sentiment should be NEUTRAL, got %s", b.Sentiment) }
}
