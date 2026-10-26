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
	ID         string        `bson:"id"`
	Title      string        `bson:"title"`
	Subtitle   string        `bson:"subtitle"`
	Accent     string        `bson:"accent"`
	ProductIDs []string      `bson:"productIds"`
	StoreIDs   []string      `bson:"storeIds"`
	Chips      []chipDoc     `bson:"chips"`
	Banners    []bannerDoc   `bson:"banners"`
	Campaigns  []campaignDoc `bson:"campaigns"`
}

type chipDoc struct {
	ID         string   `bson:"id"`
	Label      string   `bson:"label"`
	Accent     string   `bson:"accent"`
	ProductIDs []string `bson:"productIds"`
}

// campaignDoc is one editorial vendor campaign (ID-only: a directory store id + catalog product ids).
// Never money — the store and prices are always joined at compile time.
type campaignDoc struct {
	ID         string   `bson:"id"`
	StoreID    string   `bson:"storeId"`
	ProductIDs []string `bson:"productIds"`
	Carousel   int      `bson:"carousel"`
}

// bannerDoc is one editorial hero banner (image URL + copy) — the only non-ID leaf in the
// ID-only doc. Never money: prices are always joined from the catalog.
type bannerDoc struct {
	ID       string `bson:"id"`
	Title    string `bson:"title"`
	Subtitle string `bson:"subtitle"`
	Accent   string `bson:"accent"`
	ImageURL string `bson:"imageUrl"`
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
		for _, b := range s.Banners {
			sec.Banners = append(sec.Banners, contracts.SduiBanner{
				ID: b.ID, Title: b.Title, Subtitle: b.Subtitle, Accent: b.Accent, ImageURL: b.ImageURL,
			})
		}
		for _, c := range s.Campaigns {
			sec.Campaigns = append(sec.Campaigns, contracts.SduiCampaign{
				ID: c.ID, StoreID: c.StoreID, ProductIDs: emptyIfNil(c.ProductIDs), Carousel: c.Carousel,
			})
		}
		out = append(out, sec)
	}
	return out, doc.Version, nil
}

// SaveHome replaces the Home layout's sections and bumps its version, returning the new version.
// Admin-published (super-admin only) — the ID-only shape is preserved (no embedded docs, ID refs
// only) and the atomic `$inc` guarantees a monotonic version for the ETag / cache purge.
func (r *Repo) SaveHome(ctx context.Context, sections []contracts.SduiSection) (int64, error) {
	if r.db == nil {
		return 0, fmt.Errorf("reco: mongo not configured")
	}
	docs := make([]sectionDoc, 0, len(sections))
	for _, s := range sections {
		sec := sectionDoc{
			ID: s.ID, Title: s.Title, Subtitle: s.Subtitle, Accent: s.Accent,
			ProductIDs: emptyIfNil(s.ProductIDs), StoreIDs: emptyIfNil(s.StoreIDs),
		}
		for _, c := range s.Chips {
			sec.Chips = append(sec.Chips, chipDoc{
				ID: c.ID, Label: c.Label, Accent: c.Accent, ProductIDs: emptyIfNil(c.ProductIDs),
			})
		}
		for _, b := range s.Banners {
			sec.Banners = append(sec.Banners, bannerDoc{
				ID: b.ID, Title: b.Title, Subtitle: b.Subtitle, Accent: b.Accent, ImageURL: b.ImageURL,
			})
		}
		for _, c := range s.Campaigns {
			sec.Campaigns = append(sec.Campaigns, campaignDoc{
				ID: c.ID, StoreID: c.StoreID, ProductIDs: emptyIfNil(c.ProductIDs), Carousel: c.Carousel,
			})
		}
		docs = append(docs, sec)
	}
	var out layoutDoc
	err := r.db.Collection("sdui_layouts").FindOneAndUpdate(ctx,
		bson.M{"_id": "home"},
		bson.M{
			"$set":         bson.M{"sections": docs, "updatedAt": time.Now().UTC()},
			"$setOnInsert": bson.M{"locale": "en"},
			"$inc":         bson.M{"version": 1},
		},
		options.FindOneAndUpdate().SetUpsert(true).SetReturnDocument(options.After),
	).Decode(&out)
	if err != nil {
		return 0, err
	}
	return out.Version, nil
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

// TrailEvent is one user_events row as an admin reads it (ID-only: never a raw user id or PII).
type TrailEvent struct {
	Event     string `json:"event"`
	ProductID string `json:"productId"`
	At        string `json:"at"`
}

// UserTrail returns a user's recent behaviour events (newest first) by matching the stored hash.
// Admin-only read over the same ID-only collection the app writes; the raw user id never leaves.
func (r *Repo) UserTrail(ctx context.Context, userID string, limit int64) ([]TrailEvent, error) {
	if r.db == nil {
		return nil, fmt.Errorf("reco: mongo not configured")
	}
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	cur, err := r.db.Collection("user_events").Find(ctx,
		bson.M{"userIdHash": hashUser(userID)},
		options.Find().SetSort(bson.D{{Key: "at", Value: -1}}).SetLimit(limit))
	if err != nil {
		return nil, err
	}
	defer func() { _ = cur.Close(ctx) }()
	out := []TrailEvent{}
	for cur.Next(ctx) {
		var row struct {
			Event     string    `bson:"event"`
			ProductID string    `bson:"productId"`
			At        time.Time `bson:"at"`
		}
		if err := cur.Decode(&row); err != nil {
			return nil, err
		}
		out = append(out, TrailEvent{
			Event:     row.Event,
			ProductID: row.ProductID,
			At:        row.At.UTC().Format(time.RFC3339),
		})
	}
	return out, cur.Err()
}

func hashUser(userID string) string {
	sum := sha256.Sum256([]byte(userID))
	return "sha256:" + hex.EncodeToString(sum[:])
}

// Recommendations returns the caller's ranked product ids: the precomputed `recommendations` doc for
// the user's hash, else the global top-`product_stats`. Both collections are written by the
// scaling-stage batch job; while empty they resolve to no ids and the client renders an honest empty
// state (no fixture substitution).
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
