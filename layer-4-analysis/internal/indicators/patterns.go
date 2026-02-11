package indicators

import (
	"math"

	"github.com/sonu831/Trading-System/layer-4-analysis/internal/db"
)

// PatternMatch represents detected candlestick patterns at a specific candle
type PatternMatch struct {
	Index    int             `json:"index"`
	Time     string          `json:"time"`
	Patterns []PatternDetail `json:"patterns"`
}

// PatternDetail describes a single detected pattern
type PatternDetail struct {
	Name string `json:"name"`
	Type string `json:"type"` // "bullish" or "bearish"
}

// DetectCandlePatterns scans candles for common candlestick patterns.
// Mirrors the patterns detected by technicalindicators library in Layer 7.
func DetectCandlePatterns(candles []db.Candle) []PatternMatch {
	n := len(candles)
	if n < 4 {
		return nil
	}

	var matches []PatternMatch

	for i := 3; i < n; i++ {
		var detected []PatternDetail

		c := candles[i]
		p := candles[i-1]
		body := c.Close - c.Open
		absBody := math.Abs(body)
		rng := c.High - c.Low

		pBody := p.Close - p.Open

		// Avoid division by zero
		if rng == 0 {
			continue
		}

		upperShadow := c.High - math.Max(c.Open, c.Close)
		lowerShadow := math.Min(c.Open, c.Close) - c.Low

		// ── Bullish Patterns ────────────────────────────────────────

		// Hammer: small body at top, long lower shadow (>=2x body), downtrend context
		if absBody > 0 && lowerShadow >= 2*absBody && upperShadow <= absBody*0.3 {
			if p.Close < p.Open { // prior bearish context
				detected = append(detected, PatternDetail{Name: "Hammer", Type: "bullish"})
			}
		}

		// Bullish Engulfing: current bullish candle fully engulfs prior bearish candle
		if body > 0 && pBody < 0 {
			if c.Open <= p.Close && c.Close >= p.Open {
				detected = append(detected, PatternDetail{Name: "Bullish Engulfing", Type: "bullish"})
			}
		}

		// Bullish Harami: small bullish body inside prior large bearish body
		if body > 0 && pBody < 0 && absBody < math.Abs(pBody)*0.5 {
			if c.Open > p.Close && c.Close < p.Open {
				detected = append(detected, PatternDetail{Name: "Bullish Harami", Type: "bullish"})
			}
		}

		// Morning Star: 3-candle pattern (bearish, small body, bullish)
		if i >= 2 {
			pp := candles[i-2]
			ppBody := pp.Close - pp.Open
			pAbsBody := math.Abs(pBody)
			ppRange := pp.High - pp.Low
			if ppRange == 0 {
				ppRange = 1
			}

			if ppBody < 0 && math.Abs(ppBody)/ppRange > 0.5 && // first: large bearish
				pAbsBody/rng < 0.3 && // middle: small body (star)
				body > 0 && c.Close > (pp.Open+pp.Close)/2 { // third: bullish closing above midpoint
				detected = append(detected, PatternDetail{Name: "Morning Star", Type: "bullish"})
			}
		}

		// Dragonfly Doji: open ≈ close ≈ high, long lower shadow
		if absBody/rng < 0.05 && lowerShadow > 2*absBody && upperShadow < absBody*0.5 {
			detected = append(detected, PatternDetail{Name: "Dragonfly Doji", Type: "bullish"})
		}

		// Piercing Line: prior bearish, current opens below prior low, closes above midpoint
		if pBody < 0 && body > 0 && c.Open < p.Low {
			midpoint := (p.Open + p.Close) / 2
			if c.Close > midpoint && c.Close < p.Open {
				detected = append(detected, PatternDetail{Name: "Piercing Line", Type: "bullish"})
			}
		}

		// Three White Soldiers
		if i >= 2 {
			pp := candles[i-2]
			ppBody := pp.Close - pp.Open
			if ppBody > 0 && pBody > 0 && body > 0 {
				if p.Close > pp.Close && c.Close > p.Close &&
					p.Open > pp.Open && c.Open > p.Open {
					detected = append(detected, PatternDetail{Name: "Three White Soldiers", Type: "bullish"})
				}
			}
		}

		// ── Bearish Patterns ────────────────────────────────────────

		// Shooting Star: small body at bottom, long upper shadow, uptrend context
		if absBody > 0 && upperShadow >= 2*absBody && lowerShadow <= absBody*0.3 {
			if p.Close > p.Open { // prior bullish context
				detected = append(detected, PatternDetail{Name: "Shooting Star", Type: "bearish"})
			}
		}

		// Bearish Engulfing: current bearish candle fully engulfs prior bullish candle
		if body < 0 && pBody > 0 {
			if c.Open >= p.Close && c.Close <= p.Open {
				detected = append(detected, PatternDetail{Name: "Bearish Engulfing", Type: "bearish"})
			}
		}

		// Bearish Harami: small bearish body inside prior large bullish body
		if body < 0 && pBody > 0 && absBody < math.Abs(pBody)*0.5 {
			if c.Open < p.Close && c.Close > p.Open {
				detected = append(detected, PatternDetail{Name: "Bearish Harami", Type: "bearish"})
			}
		}

		// Evening Star: 3-candle pattern (bullish, small body, bearish)
		if i >= 2 {
			pp := candles[i-2]
			ppBody := pp.Close - pp.Open
			pAbsBody := math.Abs(pBody)
			ppRange := pp.High - pp.Low
			if ppRange == 0 {
				ppRange = 1
			}

			if ppBody > 0 && ppBody/ppRange > 0.5 && // first: large bullish
				pAbsBody/rng < 0.3 && // middle: small body (star)
				body < 0 && c.Close < (pp.Open+pp.Close)/2 { // third: bearish closing below midpoint
				detected = append(detected, PatternDetail{Name: "Evening Star", Type: "bearish"})
			}
		}

		// Gravestone Doji: open ≈ close ≈ low, long upper shadow
		if absBody/rng < 0.05 && upperShadow > 2*absBody && lowerShadow < absBody*0.5 {
			detected = append(detected, PatternDetail{Name: "Gravestone Doji", Type: "bearish"})
		}

		// Hanging Man: same shape as hammer but in uptrend context
		if absBody > 0 && lowerShadow >= 2*absBody && upperShadow <= absBody*0.3 {
			if p.Close > p.Open { // prior bullish context
				detected = append(detected, PatternDetail{Name: "Hanging Man", Type: "bearish"})
			}
		}

		// Three Black Crows
		if i >= 2 {
			pp := candles[i-2]
			ppBody := pp.Close - pp.Open
			if ppBody < 0 && pBody < 0 && body < 0 {
				if p.Close < pp.Close && c.Close < p.Close &&
					p.Open < pp.Open && c.Open < p.Open {
					detected = append(detected, PatternDetail{Name: "Three Black Crows", Type: "bearish"})
				}
			}
		}

		if len(detected) > 0 {
			matches = append(matches, PatternMatch{
				Index:    i,
				Time:     c.Time.Format("2006-01-02T15:04:05Z"),
				Patterns: detected,
			})
		}
	}

	return matches
}
