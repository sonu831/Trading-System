// Package redis provides Redis client for Layer 4 analysis
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

	var opt *redis.Options
	var err error

	if len(redisURL) > 8 && redisURL[:8] == "redis://" {
		opt, err = redis.ParseURL(redisURL)
		if err != nil {
			return nil, err
		}
	} else {
		opt = &redis.Options{
			Addr: redisURL,
		}
	}

	rdb := redis.NewClient(opt)

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}

	return &Client{rdb: rdb}, nil
}

// PublishAnalysis publishes stock analysis result
func (c *Client) PublishAnalysis(ctx context.Context, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	// Publish to channel for Layer 6 (Signal) consumers
	return c.rdb.Publish(ctx, "analysis:updates", jsonData).Err()
}

// PublishMetrics publishes system metrics
func (c *Client) PublishMetrics(ctx context.Context, key string, data interface{}) error {
	jsonData, err := json.Marshal(data)
	if err != nil {
		return err
	}
	// Store with 1 minute TTL
	return c.rdb.Set(ctx, key, jsonData, 1*time.Minute).Err()
}

// Close closes the Redis connection
func (c *Client) Close() error {
	return c.rdb.Close()
}
