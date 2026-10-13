// Package reco composes ID-only Mongo recommendations with the catalog read path.
package reco

import (
	"context"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

// Service joins recommended product ids (Mongo) with catalog rows (Postgres).
type Service struct {
	repo     *Repo
	products contracts.ProductReader
	cache    *cache.Cache
}

// NewService builds the recommendations service.
func NewService(repo *Repo, products contracts.ProductReader, c *cache.Cache) *Service {
	return &Service{repo: repo, products: products, cache: c}
}

// Recommendations returns the caller's ranked products. The raw user id is never cached — only its
// sha256 hash (db-schema §8.2); the key is `faazio:v1:reco:{userIdHash}:home` (1 h).
func (s *Service) Recommendations(ctx context.Context, userID string) ([]contracts.Product, error) {
	key := cache.Reco(hashUser(userID), "home")
	var cached []contracts.Product
	if s.cache.GetJSON(ctx, key, &cached) {
		return cached, nil
	}

	ids, err := s.repo.Recommendations(ctx, userID)
	if err != nil {
		return nil, err
	}
	if len(ids) == 0 {
		return []contracts.Product{}, nil
	}

	products, err := s.products.ByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	byID := make(map[string]contracts.Product, len(products))
	for _, p := range products {
		byID[p.ID] = p
	}
	out := make([]contracts.Product, 0, len(ids))
	for _, id := range ids {
		if p, ok := byID[id]; ok {
			out = append(out, p)
		}
	}
	s.cache.SetJSON(ctx, key, out, cache.TTLReco)
	return out, nil
}