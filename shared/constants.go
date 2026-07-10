package constants

// Single source of truth for market regime, signal, and direction constants.
// Used by L4 (analysis) and L5 (aggregation) Go services.
// Mirrors shared/constants.js for Node.js layers.

const (
	// ── Market Regime ──
	TrendUp      = "TREND_UP"
	TrendDown    = "TREND_DOWN"
	TrendRange   = "RANGE"
	TrendUnknown = "UNKNOWN"

	SentimentStronglyBullish = "STRONGLY_BULLISH"
	SentimentBullish         = "BULLISH"
	SentimentNeutral         = "NEUTRAL"
	SentimentBearish         = "BEARISH"
	SentimentStronglyBearish = "STRONGLY_BEARISH"

	VolatilityHigh    = "HIGH"
	VolatilityNormal  = "NORMAL"
	VolatilityLow     = "LOW"
	VolatilityExtreme = "EXTREME"

	PhaseTrending      = "TRENDING"
	PhaseConsolidating = "CONSOLIDATING"
	PhaseExhaustion    = "EXHAUSTION"
	PhaseBreakout      = "BREAKOUT"

	// ── Sector Momentum ──
	SectorStrongUp   = "STRONG_UP"
	SectorUp         = "UP"
	SectorNeutral    = "NEUTRAL"
	SectorDown       = "DOWN"
	SectorStrongDown = "STRONG_DOWN"

	// ── Signal Tier ──
	TierT1 = "T1"
	TierT2 = "T2"
	TierT3 = "T3"

	// ── Broker Providers ──
	ProviderMStock    = "mstock"
	ProviderFlatTrade = "flattrade"
	ProviderKite      = "kite"
	ProviderIndianAPI = "indianapi"

	// ── Kafka Topics ──
	TopicRawTicks         = "raw-ticks"
	TopicMarketCandles    = "market_candles"
	TopicAnalysisUpdates  = "analysis_updates"
	TopicSentimentScores  = "sentiment_scores"
	TopicTradeSignals     = "trade-signals"
	TopicOptionChain      = "option-chain"
	TopicMarketRegime     = "market-regime"
	TopicExecutionEvents  = "execution-events"

	// ── Ports ──
	PortBackendAPI  = 4000
	PortIngestion   = 9101
	PortProcessing  = 3002
	PortAnalysis    = 8081
	PortAggregation = 8080
	PortSignal      = 8082
	PortExecution   = 8095
)
