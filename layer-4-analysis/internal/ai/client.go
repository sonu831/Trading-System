// Package ai provides HTTP client for Layer 9 AI inference service
package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

// Client wraps HTTP client for AI service communication
type Client struct {
	baseURL    string
	httpClient *http.Client
}

// FeatureVector represents input features for AI prediction
type FeatureVector struct {
	RSI    float64 `json:"rsi"`
	MACD   float64 `json:"macd"`
	EMA50  float64 `json:"ema50"`
	EMA200 float64 `json:"ema200"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

// PredictionRequest is the request body for /predict endpoint
type PredictionRequest struct {
	Symbol   string          `json:"symbol"`
	Features []FeatureVector `json:"features"`
}

// PredictionResponse is the response from /predict endpoint
type PredictionResponse struct {
	Symbol       string  `json:"symbol"`
	Prediction   float64 `json:"prediction"` // 0-1
	Confidence   float64 `json:"confidence"`
	ModelVersion string  `json:"model_version"`
	Reasoning    string  `json:"reasoning"`
}

// NewClient creates a new AI service client
func NewClient() *Client {
	url := os.Getenv("AI_INFERENCE_URL")
	if url == "" {
		url = "http://ai-inference:8000"
	}
	// For local dev override
	if os.Getenv("GO_ENV") == "local" {
		url = "http://localhost:8000"
	}

	return &Client{
		baseURL: url,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// Predict sends features to AI service and returns prediction
// Uses context with timeout per instruction §7b (200ms timeout for AI calls)
func (c *Client) Predict(ctx context.Context, symbol string, features []FeatureVector) (*PredictionResponse, error) {
	// Apply 200ms timeout for AI inference per instruction §3b Wave 4
	ctx, cancel := context.WithTimeout(ctx, 200*time.Millisecond)
	defer cancel()

	reqBody := PredictionRequest{
		Symbol:   symbol,
		Features: features,
	}

	jsonValue, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal prediction request for %s: %w", symbol, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/predict", bytes.NewBuffer(jsonValue))
	if err != nil {
		return nil, fmt.Errorf("create prediction request for %s: %w", symbol, err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("AI inference for %s: %w", symbol, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service error for %s: status %d", symbol, resp.StatusCode)
	}

	var result PredictionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode prediction response for %s: %w", symbol, err)
	}

	return &result, nil
}

// MarketAnalysisRequest is the request body for /analyze_market endpoint
type MarketAnalysisRequest struct {
	Summaries []map[string]interface{} `json:"summaries"`
}

// MarketAnalysisResponse is the response from /analyze_market endpoint
type MarketAnalysisResponse struct {
	Sentiment  string  `json:"sentiment"`
	Summary    string  `json:"summary"`
	Confidence float64 `json:"confidence"`
}

// AnalyzeMarket sends market summaries for AI analysis
func (c *Client) AnalyzeMarket(ctx context.Context, summaries []map[string]interface{}) (*MarketAnalysisResponse, error) {
	reqBody := MarketAnalysisRequest{
		Summaries: summaries,
	}

	jsonValue, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal market analysis request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/analyze_market", bytes.NewBuffer(jsonValue))
	if err != nil {
		return nil, fmt.Errorf("create market analysis request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("market analysis request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service error: status %d", resp.StatusCode)
	}

	var result MarketAnalysisResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode market analysis response: %w", err)
	}

	return &result, nil
}
