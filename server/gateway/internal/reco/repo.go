// Package reco serves the recommendations context (ID-only Mongo documents).
// Future service: Python + FastAPI + MongoDB (monolith-breakdown §1). The raw user
// id is never stored — only a sha256 hash (db-schema §8.2).
package reco

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/contracts"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Repo reads sdui_layouts and writes user_events.
type Repo struct {
	db *mongo.Database
}

// New returns a reco repo.
func New(db *mongo.Database) *Repo { return &Repo{db: db} }

type layoutDoc struct {
	ID        string       `bson:"_id"`
	Version   int64        `bson:"version"`
	Locale    string       `bson:"locale"`
	UpdatedAt time.Time    `bson:"updatedAt,omitempty"`
	Sections  []sectionDoc `bson:"sections"`
}

type sectionDoc struct {
	ID         string    `bson:"id"`
	Title      string    `bson:"title"`
	Subtitle   string    `bson:"subtitle"`
	Accent     string    `bson:"accent"`
	ProductIDs []string  `bson:"productIds"`
	StoreIDs   []string  `bson:"storeIds"`
	Chips      []chipDoc `bson:"chips"`
}

type chipDoc struct {
	ID         string   `bson:"id"`
	Label      string   `bson:"label"`
	Accent     string   `bson:"accent"`
	ProductIDs []string `bson:"productIds"`
}

// Home reads the ID-only Home SDUI layout plus its version (for ETag).
func (r *Repo) Home(ctx context.Context) ([]contracts.SduiSection, int64, error) {
	if r.db == nil {
		return nil, 0, fmt.Errorf("reco: mongo not configured")
	}
	var doc layoutDoc
	err := r.db.Collection("sdui_layouts").FindOne(ctx, bson.M{"_id": "home"}).Decode(&doc)
	if err != nil {
		return nil, 0, err
	}
	out := make([]contracts.SduiSection, 0, len(doc.Sections))
	for _, s := range doc.Sections {
		sec := contracts.SduiSection{
			ID:         s.ID,
			Title:      s.Title,
			Subtitle:   s.Subtitle,
			Accent:     s.Accent,
			ProductIDs: emptyIfNil(s.ProductIDs),
			StoreIDs:   s.StoreIDs,
		}
		for _, c := range s.Chips {
			sec.Chips = append(sec.Chips, contracts.SduiChip{
				ID: c.ID, Label: c.Label, Accent: c.Accent, ProductIDs: emptyIfNil(c.ProductIDs),
			})
		}
		out = append(out, sec)
	}
	return out, doc.Version, nil
}

// TrackEvent stores an anonymous, ID-only behavior event with a 90-day TTL.
func (r *Repo) TrackEvent(ctx context.Context, userID, productID, event string) error {
	if r.db == nil {
		return fmt.Errorf("reco: mongo not configured")
	}
	now := time.Now().UTC()
	_, err := r.db.Collection("user_events").InsertOne(ctx, bson.M{
		"userIdHash": hashUser(userID),
		"productId":  productID,
		"event":      event,
		"at":         now,
		"expiresAt":  now.Add(90 * 24 * time.Hour),
	}, options.InsertOne())
	return err
}

func hashUser(userID string) string {
	sum := sha256.Sum256([]byte(userID))
	return "sha256:" + hex.EncodeToString(sum[:])
}

// Recommendations returns the caller's ranked product ids: the precomputed `recommendations` doc for
// the user's hash, else the global top-`product_stats`. Both collections are written by the Future
// Prod batch job; on the empty MVP they resolve to no ids (the client falls back to fixtures).
func (r *Repo) Recommendations(ctx context.Context, userID string) ([]string, error) {
	if r.db == nil {
		return nil, fmt.Errorf("reco: mongo not configured")
	}
	var doc struct {
		ProductIDs []string `bson:"productIds"`
	}
	err := r.db.Collection("recommendations").FindOne(ctx, bson.M{"userIdHash": hashUser(userID)}).Decode(&doc)
	if err == nil {
		return emptyIfNil(doc.ProductIDs), nil
	}
	if err != mongo.ErrNoDocuments {
		return nil, err
	}

	// Cold-start fallback: globally trending products by precomputed score.
	cur, err := r.db.Collection("product_stats").Find(ctx, bson.M{},
		options.Find().SetSort(bson.D{{Key: "score", Value: -1}}).SetLimit(20).SetProjection(bson.M{"productId": 1, "_id": 0}))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cur.Close(ctx) }()
	var stats []struct {
		ProductID string `bson:"productId"`
	}
	if err := cur.All(ctx, &stats); err != nil {
		return nil, err
	}
	ids := make([]string, 0, len(stats))
	for _, s := range stats {
		if s.ProductID != "" {
			ids = append(ids, s.ProductID)
		}
	}
	return ids, nil
}

func emptyIfNil(v []string) []string {
	if v == nil {
		return []string{}
	}
	return v
}
