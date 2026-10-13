// Package sdui compiles ID-only Home layouts into rendered sections. It composes the
// catalog + directory + reco contexts through contracts interfaces only.
package sdui

import (
	"context"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

// Service compiles the Home feed.
type Service struct {
	layouts  contracts.LayoutSource
	products contracts.ProductReader
	stores   contracts.StoreReader
	cache    *cache.Cache
}

// NewService builds the SDUI service.
func NewService(layouts contracts.LayoutSource, products contracts.ProductReader, stores contracts.StoreReader, c *cache.Cache) *Service {
	return &Service{layouts: layouts, products: products, stores: stores, cache: c}
}

// Home returns the compiled Home feed (ID-only sections + joined products), cached.
func (s *Service) Home(ctx context.Context, locale string) ([]contracts.HomeSection, error) {
	if locale == "" {
		locale = "en"
	}
	var cached []contracts.HomeSection
	if s.cache.GetJSON(ctx, cache.SduiHome(locale), &cached) {
		return cached, nil
	}
	sections, err := s.layouts.Home(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]contracts.HomeSection, 0, len(sections))
	for _, section := range sections {
		products, err := s.products.ByIDs(ctx, section.ProductIDs)
		if err != nil {
			return nil, err
		}
		if products == nil {
			products = []contracts.Product{}
		}
		out = append(out, contracts.HomeSection{SduiSection: section, Products: products})
	}
	s.cache.SetJSON(ctx, cache.SduiHome(locale), out, cache.TTLSdui)
	return out, nil
}
