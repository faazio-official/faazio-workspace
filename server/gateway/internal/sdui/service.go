// Package sdui compiles ID-only Home layouts into rendered sections. It composes the
// catalog + directory + reco contexts through contracts interfaces only.
package sdui

import (
	"context"

	"github.com/faazio/server/gateway/internal/contracts"
	"github.com/faazio/server/gateway/internal/platform/cache"
)

// cachedHome is the internal Valkey value: compiled sections + the layout version the ETag derives
// from. The key/TTL are unchanged (caching-cloudflare-valkey.md §5); only the value shape is.
type cachedHome struct {
	Version  int64                   `json:"version"`
	Sections []contracts.HomeSection `json:"sections"`
}

// Service compiles the Home feed.
type Service struct {
	layouts  contracts.LayoutSource
	writer   contracts.LayoutWriter
	products contracts.ProductReader
	stores   contracts.StoreReader
	cache    *cache.Cache
}

// NewService builds the SDUI service.
func NewService(layouts contracts.LayoutSource, writer contracts.LayoutWriter, products contracts.ProductReader, stores contracts.StoreReader, c *cache.Cache) *Service {
	return &Service{layouts: layouts, writer: writer, products: products, stores: stores, cache: c}
}

// Layout returns the raw ID-only Home sections + version (no product/store join) for the admin
// editor. It reads the source directly so a just-saved layout is never masked by the feed cache.
func (s *Service) Layout(ctx context.Context) ([]contracts.SduiSection, int64, error) {
	return s.layouts.Home(ctx)
}

// SaveHome persists a new Home layout (admin publish) and purges the compiled-feed caches so the
// next GET /sdui/home (and /sdui/mart) recompiles with the new sections and a bumped ETag.
func (s *Service) SaveHome(ctx context.Context, sections []contracts.SduiSection) (int64, error) {
	version, err := s.writer.SaveHome(ctx, sections)
	if err != nil {
		return 0, err
	}
	s.cache.Del(ctx, cache.SduiHome("en"), cache.SduiMart("en"))
	return version, nil
}

// martSectionIDs is the Mart feed's section allowlist: the three Mart rails live in the same Home
// layout doc but are served on their own endpoint (`GET /sdui/mart`) so the Mart screen never
// downloads or couples to the full Home feed (independent payload + ETag).
var martSectionIDs = map[string]struct{}{
	"martHero":       {},
	"martDeals":      {},
	"martEssentials": {},
}

// Home returns the compiled Home feed (ID-only sections + joined products) and the layout version.
func (s *Service) Home(ctx context.Context, locale string) ([]contracts.HomeSection, int64, error) {
	return s.compile(ctx, locale, cache.SduiHome(localeOrDefault(locale)), nil)
}

// Mart returns only the compiled Mart sections (martHero/martDeals/martEssentials) joined to the
// catalog, and the layout version. Cached separately from the Home feed.
func (s *Service) Mart(ctx context.Context, locale string) ([]contracts.HomeSection, int64, error) {
	return s.compile(ctx, locale, cache.SduiMart(localeOrDefault(locale)), martSectionIDs)
}

func localeOrDefault(locale string) string {
	if locale == "" {
		return "en"
	}
	return locale
}

// compile joins one layout's sections to the catalog/directory and caches the result. `only`, when
// non-nil, keeps just the allow-listed section ids (the Mart projection); the layout version and
// ETag semantics are shared with the full Home feed.
func (s *Service) compile(ctx context.Context, locale, cacheKey string, only map[string]struct{}) ([]contracts.HomeSection, int64, error) {
	if locale == "" {
		locale = "en"
	}
	var cached cachedHome
	if s.cache.GetJSON(ctx, cacheKey, &cached) {
		return cached.Sections, cached.Version, nil
	}
	sections, version, err := s.layouts.Home(ctx)
	if err != nil {
		return nil, 0, err
	}
	if only != nil {
		kept := make([]contracts.SduiSection, 0, len(only))
		for _, section := range sections {
			if _, ok := only[section.ID]; ok {
				kept = append(kept, section)
			}
		}
		sections = kept
	}

	// One batch join across every section's product ids (was one round-trip per section).
	byID, err := s.productsByID(ctx, sections)
	if err != nil {
		return nil, 0, err
	}
	// Dining rails reference stores instead of products; join them in the same pass.
	storesByID, err := s.storesByID(ctx, sections)
	if err != nil {
		return nil, 0, err
	}

	out := make([]contracts.HomeSection, 0, len(sections))
	for _, section := range sections {
		products := make([]contracts.Product, 0, len(section.ProductIDs))
		for _, id := range section.ProductIDs {
			if p, ok := byID[id]; ok {
				products = append(products, p)
			}
		}
		stores := make([]contracts.Store, 0, len(section.StoreIDs))
		for _, id := range section.StoreIDs {
			if st, ok := storesByID[id]; ok {
				stores = append(stores, st)
			}
		}
		out = append(out, contracts.HomeSection{SduiSection: section, Products: products, Stores: stores})
	}
	s.cache.SetJSON(ctx, cacheKey, cachedHome{Version: version, Sections: out}, cache.TTLSdui)
	return out, version, nil
}

// productsByID fetches every referenced product in a single query, de-duplicating ids while
// preserving section order for the caller's fan-out.
func (s *Service) productsByID(ctx context.Context, sections []contracts.SduiSection) (map[string]contracts.Product, error) {
	seen := map[string]struct{}{}
	ids := make([]string, 0)
	for _, section := range sections {
		for _, id := range section.ProductIDs {
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	byID := make(map[string]contracts.Product, len(ids))
	if len(ids) == 0 {
		return byID, nil
	}
	products, err := s.products.ByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, p := range products {
		byID[p.ID] = p
	}
	return byID, nil
}

// storesByID fetches every store referenced by a section's StoreIDs in a single query,
// de-duplicating ids while preserving section order for the caller's fan-out.
func (s *Service) storesByID(ctx context.Context, sections []contracts.SduiSection) (map[string]contracts.Store, error) {
	seen := map[string]struct{}{}
	ids := make([]string, 0)
	for _, section := range sections {
		for _, id := range section.StoreIDs {
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			ids = append(ids, id)
		}
	}
	byID := make(map[string]contracts.Store, len(ids))
	if len(ids) == 0 {
		return byID, nil
	}
	stores, err := s.stores.ByIDs(ctx, ids)
	if err != nil {
		return nil, err
	}
	for _, st := range stores {
		byID[st.ID] = st
	}
	return byID, nil
}
