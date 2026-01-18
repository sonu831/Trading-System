// Package redis provides Redis client for Layer 5
package redis

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/go-redis/redis/v8"
)

// Client wraps redis connection
type Client struct {
	rdb *redis.Client
}

// NewClient creates a new Redis client
func NewClient() (*Client, error) {
	redisURL := os.Getenv("REDIS_URL")
	if redisURL == "" {
		redisURL = "localhost:6379"
	}

	rdb := redis.NewClient(&redis.Options{
		Addr: redisURL,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Client{rdb: rdb}, nil
}

// PublishMarketView publishes aggregated market data
func (c *Client) PublishMarketView(ctx context.Context, key string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	// Store in Redis with 5 minute TTL
	if err := c.rdb.Set(ctx, key, jsonData, 5*time.Minute).Err(); err != nil {
		return err
	}

	// Also publish to channel for real-time subscribers
	return c.rdb.Publish(ctx, "market_view", jsonData).Err()
}

// GetMarketView retrieves market view from Redis
func (c *Client) GetMarketView(ctx context.Context, key string) ([]byte, error) {
	return c.rdb.Get(ctx, key).Bytes()
}

// Close closes the Redis connection
func (c *Client) Close() error {
	return c.rdb.Close()
}
