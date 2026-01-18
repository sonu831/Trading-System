// Package breadth provides market breadth calculations
package breadth

// StockResult represents analysis result from Layer 4
type StockResult struct {
	Symbol         string          `json:"symbol"`
	LTP            float64         `json:"ltp"`
	Change         float64         `json:"change"`
	ChangePct      float64         `json:"change_pct"`
	RSI            float64         `json:"rsi"`
	EMAs           map[int]float64 `json:"emas"`
	TrendScore     float64         `json:"trend_score"`
	MomentumScore  float64         `json:"momentum_score"`
	CompositeScore float64         `json:"composite_score"`
}

// BreadthMetrics represents market breadth indicators
type BreadthMetrics struct {
	TotalStocks        int     `json:"total_stocks"`
	Advancing          int     `json:"advancing"`
	Declining          int     `json:"declining"`
	Unchanged          int     `json:"unchanged"`
	AdvanceDecline     float64 `json:"advance_decline_ratio"`
	AboveEMA20         int     `json:"above_ema20"`
	AboveEMA50         int     `json:"above_ema50"`
	AboveEMA200        int     `json:"above_ema200"`
	PercentAboveEMA20  float64 `json:"percent_above_ema20"`
	PercentAboveEMA50  float64 `json:"percent_above_ema50"`
	PercentAboveEMA200 float64 `json:"percent_above_ema200"`
	BullishCount       int     `json:"bullish_count"`
	BearishCount       int     `json:"bearish_count"`
	NeutralCount       int     `json:"neutral_count"`
	AverageRSI         float64 `json:"average_rsi"`
	MarketSentiment    string  `json:"market_sentiment"`
}

// CalculateBreadth computes market breadth from stock results
func CalculateBreadth(stocks []StockResult) BreadthMetrics {
	if len(stocks) == 0 {
		return BreadthMetrics{}
	}

	metrics := BreadthMetrics{
		TotalStocks: len(stocks),
	}

	var totalRSI float64

	for _, stock := range stocks {
		// Advance/Decline
		if stock.ChangePct > 0 {
			metrics.Advancing++
		} else if stock.ChangePct < 0 {
			metrics.Declining++
		} else {
			metrics.Unchanged++
		}

		// EMA checks
		if ema20, ok := stock.EMAs[20]; ok && stock.LTP > ema20 {
			metrics.AboveEMA20++
		}
		if ema50, ok := stock.EMAs[50]; ok && stock.LTP > ema50 {
			metrics.AboveEMA50++
		}
		if ema200, ok := stock.EMAs[200]; ok && stock.LTP > ema200 {
			metrics.AboveEMA200++
		}

		// Trend classification
		if stock.CompositeScore > 0.3 {
			metrics.BullishCount++
		} else if stock.CompositeScore < -0.3 {
			metrics.BearishCount++
		} else {
			metrics.NeutralCount++
		}

		totalRSI += stock.RSI
	}

	// Calculate ratios
	if metrics.Declining > 0 {
		metrics.AdvanceDecline = float64(metrics.Advancing) / float64(metrics.Declining)
	} else {
		metrics.AdvanceDecline = float64(metrics.Advancing)
	}

	n := float64(len(stocks))
	metrics.PercentAboveEMA20 = (float64(metrics.AboveEMA20) / n) * 100
	metrics.PercentAboveEMA50 = (float64(metrics.AboveEMA50) / n) * 100
	metrics.PercentAboveEMA200 = (float64(metrics.AboveEMA200) / n) * 100
	metrics.AverageRSI = totalRSI / n

	// Determine market sentiment
	if metrics.AdvanceDecline > 1.5 && metrics.BullishCount > metrics.BearishCount*2 {
		metrics.MarketSentiment = "STRONGLY_BULLISH"
	} else if metrics.AdvanceDecline > 1.0 && metrics.BullishCount > metrics.BearishCount {
		metrics.MarketSentiment = "BULLISH"
	} else if metrics.AdvanceDecline < 0.67 && metrics.BearishCount > metrics.BullishCount*2 {
		metrics.MarketSentiment = "STRONGLY_BEARISH"
	} else if metrics.AdvanceDecline < 1.0 && metrics.BearishCount > metrics.BullishCount {
		metrics.MarketSentiment = "BEARISH"
	} else {
		metrics.MarketSentiment = "NEUTRAL"
	}

	return metrics
}
