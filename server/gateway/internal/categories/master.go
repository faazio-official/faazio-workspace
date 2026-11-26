package categories

import (
	"context"
	"fmt"
	"net/http"

	"github.com/faazio/server/gateway/internal/platform/httpx"
)

// AtomicTaxonomy is one row of the Atomic Food Taxonomy v2 reference (migration 0145). It is the
// cuisine layer behind the FOOD carousel categories — e.g. South Indian → Chettinad Cuisine.
type AtomicTaxonomy struct {
	ID              string `json:"id"`
	App             string `json:"app"`
	RecordType      string `json:"recordType"`
	Category        string `json:"category"`
	SubCategory     string `json:"subCategory"`
	GSTCategoryName string `json:"gstCategoryName"`
	GSTSlug         string `json:"gstSlug"`
	GSTRatePct      int    `json:"gstRatePct"`
	GSTRuleStatus   string `json:"gstRuleStatus"`
	DisplayOrder    int    `json:"displayOrder"`
}

// StoreConfigOption is one store-onboarding rule from the workbook: a group (Schedule, Dietary
// Policy, Trust & Rating, Delivery & Offers) and its selectable value.
type StoreConfigOption struct {
	ID                  string `json:"id"`
	StoreAttributeGroup string `json:"storeAttributeGroup"`
	OptionValue         string `json:"optionValue"`
	AtomicCategory      string `json:"atomicCategory,omitempty"`
	AtomicSubcategory   string `json:"atomicSubcategory,omitempty"`
	CollectionStage     string `json:"collectionStage"`
	BehaviorNote        string `json:"behaviorNote"`
	DisplayOrder        int    `json:"displayOrder"`
}

// SampleMenuItem is one generated sample dish (template) from the workbook. It is reference data for
// the seller form; it is not a live directory.menus listing.
type SampleMenuItem struct {
	ID                         string `json:"id"`
	DishName                   string `json:"dishName"`
	AppSubcategory             string `json:"appSubcategory"`
	AtomicCategory             string `json:"atomicCategory"`
	AtomicSubcategory          string `json:"atomicSubcategory"`
	DietaryPreference          string `json:"dietaryPreference"`
	BasePriceINR               int    `json:"basePriceInr"`
	AutoPriceBucket            string `json:"autoPriceBucket"`
	PrimaryFlavourOrIngredient string `json:"primaryFlavourOrIngredient"`
	MasterTabGroup             string `json:"masterTabGroup"`
	TypeOrBase                 string `json:"typeOrBase"`
	AdditiveOrSauce            string `json:"additiveOrSauce"`
	CuisineOrigin              string `json:"cuisineOrigin"`
	DeliveryMode               string `json:"deliveryMode"`
	ApplicableGSTRate          string `json:"applicableGstRate"`
	DisplayOrder               int    `json:"displayOrder"`
}

// FoodMasterData bundles the read-only FOOD reference master data the superadmin portal shows.
type FoodMasterData struct {
	AtomicTaxonomy []AtomicTaxonomy    `json:"atomicTaxonomy"`
	StoreConfig    []StoreConfigOption `json:"storeConfig"`
	SampleMenu     []SampleMenuItem    `json:"sampleMenu"`
}

// FoodMasterData reads the workbook reference tables seeded by migration 0145.
func (r *Repo) FoodMasterData(ctx context.Context) (FoodMasterData, error) {
	if r.pool == nil {
		return FoodMasterData{}, fmt.Errorf("categories: database not configured")
	}
	out := FoodMasterData{
		AtomicTaxonomy: []AtomicTaxonomy{},
		StoreConfig:    []StoreConfigOption{},
		SampleMenu:     []SampleMenuItem{},
	}

	rows, err := r.pool.Query(ctx, `
		select id, app::text, record_type, category, sub_category, gst_category_name,
		       gst_slug, gst_rate_pct, gst_rule_status, display_order
		  from taxonomy.food_atomic_taxonomy
		 where app = 'FOOD'
		 order by display_order asc, category asc, sub_category asc`)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var t AtomicTaxonomy
		if err := rows.Scan(&t.ID, &t.App, &t.RecordType, &t.Category, &t.SubCategory,
			&t.GSTCategoryName, &t.GSTSlug, &t.GSTRatePct, &t.GSTRuleStatus, &t.DisplayOrder); err != nil {
			rows.Close()
			return out, err
		}
		out.AtomicTaxonomy = append(out.AtomicTaxonomy, t)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return out, err
	}
	rows.Close()

	rows, err = r.pool.Query(ctx, `
		select id, store_attribute_group, option_value, coalesce(atomic_category, ''),
		       coalesce(atomic_subcategory, ''), collection_stage, behavior_note, display_order
		  from taxonomy.store_config_options
		 where is_active
		 order by display_order asc, store_attribute_group asc`)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var o StoreConfigOption
		if err := rows.Scan(&o.ID, &o.StoreAttributeGroup, &o.OptionValue, &o.AtomicCategory,
			&o.AtomicSubcategory, &o.CollectionStage, &o.BehaviorNote, &o.DisplayOrder); err != nil {
			rows.Close()
			return out, err
		}
		out.StoreConfig = append(out.StoreConfig, o)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return out, err
	}
	rows.Close()

	rows, err = r.pool.Query(ctx, `
		select id, dish_name, app_subcategory, atomic_category, atomic_subcategory,
		       dietary_preference, base_price_inr, auto_price_bucket, primary_flavour_or_ingredient,
		       master_tab_group, type_or_base, additive_or_sauce, cuisine_origin, delivery_mode,
		       applicable_gst_rate, display_order
		  from taxonomy.food_sample_menu_items
		 order by display_order asc`)
	if err != nil {
		return out, err
	}
	for rows.Next() {
		var s SampleMenuItem
		if err := rows.Scan(&s.ID, &s.DishName, &s.AppSubcategory, &s.AtomicCategory,
			&s.AtomicSubcategory, &s.DietaryPreference, &s.BasePriceINR, &s.AutoPriceBucket,
			&s.PrimaryFlavourOrIngredient, &s.MasterTabGroup, &s.TypeOrBase, &s.AdditiveOrSauce,
			&s.CuisineOrigin, &s.DeliveryMode, &s.ApplicableGSTRate, &s.DisplayOrder); err != nil {
			rows.Close()
			return out, err
		}
		out.SampleMenu = append(out.SampleMenu, s)
	}
	return out, rows.Err()
}

// foodMaster serves the read-only FOOD reference master data to the superadmin portal.
func (h *Handler) foodMaster(w http.ResponseWriter, r *http.Request) {
	data, err := h.repo.FoodMasterData(r.Context())
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "master_data_unavailable", "master data unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, data)
}
