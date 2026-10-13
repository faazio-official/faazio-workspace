// Package mongo wraps the MongoDB Atlas connection used for ID-only recommendation
// documents (sdui_layouts, user_events). Returns nil when unconfigured.
package mongo

import (
	"context"
	"fmt"
	"time"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Connect opens MongoDB. Returns (nil, nil) when uri is empty.
func Connect(ctx context.Context, uri, database string) (*mongo.Database, error) {
	if uri == "" {
		return nil, nil
	}
	opts := options.Client().ApplyURI(uri).SetServerSelectionTimeout(5 * time.Second)
	client, err := mongo.Connect(ctx, opts)
	if err != nil {
		return nil, fmt.Errorf("connect mongo: %w", err)
	}
	pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	if err := client.Ping(pingCtx, nil); err != nil {
		_ = client.Disconnect(context.Background())
		return nil, fmt.Errorf("ping mongo: %w", err)
	}
	return client.Database(database), nil
}
