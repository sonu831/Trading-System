package ai

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"time"
)

type Client struct {
	baseURL    string
	httpClient *http.Client
}

type FeatureVector struct {
	RSI    float64 `json:"rsi"`
	MACD   float64 `json:"macd"`
	EMA50  float64 `json:"ema50"`
	EMA200 float64 `json:"ema200"`
	Close  float64 `json:"close"`
	Volume float64 `json:"volume"`
}

type PredictionRequest struct {
	Symbol   string          `json:"symbol"`
	Features []FeatureVector `json:"features"`
}

type PredictionResponse struct {
	Symbol       string  `json:"symbol"`
	Prediction   float64 `json:"prediction"` // 0-1
	Confidence   float64 `json:"confidence"`
	ModelVersion string  `json:"model_version"`
	Reasoning    string  `json:"reasoning"`
}

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

func (c *Client) Predict(symbol string, features []FeatureVector) (*PredictionResponse, error) {
	reqBody := PredictionRequest{
		Symbol:   symbol,
		Features: features,
	}

	jsonValue, _ := json.Marshal(reqBody)
	resp, err := c.httpClient.Post(c.baseURL+"/predict", "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI Service Error: %d", resp.StatusCode)
	}

	var result PredictionResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
	return &result, nil
}

type MarketAnalysisRequest struct {
	Summaries []map[string]interface{} `json:"summaries"`
}

type MarketAnalysisResponse struct {
	Sentiment  string  `json:"sentiment"`
	Summary    string  `json:"summary"`
	Confidence float64 `json:"confidence"`
}

func (c *Client) AnalyzeMarket(summaries []map[string]interface{}) (*MarketAnalysisResponse, error) {
	reqBody := MarketAnalysisRequest{
		Summaries: summaries,
	}

	jsonValue, _ := json.Marshal(reqBody)
	resp, err := c.httpClient.Post(c.baseURL+"/analyze_market", "application/json", bytes.NewBuffer(jsonValue))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI Service Error: %d", resp.StatusCode)
	}

	var result MarketAnalysisResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
