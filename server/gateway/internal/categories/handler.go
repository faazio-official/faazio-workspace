package categories

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/faazio/server/gateway/internal/platform/auth"
	"github.com/faazio/server/gateway/internal/platform/httpx"
	"github.com/faazio/server/gateway/internal/platform/locale"
	"github.com/go-chi/chi/v5"
)

// Handler serves the superadmin category taxonomy. Reads (drill-in tree + home rail) are available to
// any signed-in account; every mutation is SUPER_ADMIN only.
type Handler struct {
	repo *Repo
}

// NewHandler builds the categories handler.
func NewHandler(repo *Repo) *Handler { return &Handler{repo: repo} }

// Register mounts the category routes.
func (h *Handler) Register(r chi.Router) {
	r.Group(func(g chi.Router) {
		g.Use(auth.Require)
		g.Get("/categories", h.list)
		g.Get("/categories/rail", h.rail)
		// Facet read: the seller form and the customer filter drawer read the same definition.
		g.Get("/categories/{id}/attribute-groups", h.listAttributeGroups)
	})
	r.Group(func(g chi.Router) {
		g.Use(auth.RequireRole(auth.RoleSuperAdmin))
		g.Get("/admin/categories", h.adminList)
		g.Get("/admin/categories/trash", h.adminTrash)
		g.Get("/admin/categories/{id}/attribute-groups", h.listAttributeGroups)
		g.Put("/admin/categories/{id}/attribute-groups", h.replaceAttributeGroups)
		g.Post("/categories", h.create)
		g.Put("/categories/{id}", h.update)
		g.Patch("/categories/{id}/toggle", h.toggle)
		g.Delete("/categories/{id}", h.remove)
		g.Post("/categories/{id}/restore", h.restore)
		g.Delete("/categories/{id}/permanent", h.permanentRemove)
	})
}

// validApp reports whether s is a known app brand. MAIN_APP_HEADER is the standalone header-only pool
// (a category that belongs to no vendor sub-app and drills into its own sub-categories).
func validApp(s string) bool {
	switch s {
	case "MART", "FOOD", "PHARMA", HeaderMainApp:
		return true
	}
	return false
}

// readListFilters applies the shared `?app=`, `?parent_id=`, `?top_level=` and `?header=` query
// filters, writing a 400 and returning false when one is malformed.
func readListFilters(w http.ResponseWriter, r *http.Request) (ListOptions, bool) {
	q := r.URL.Query()
	opts := ListOptions{
		App:    strings.ToUpper(strings.TrimSpace(q.Get("app"))),
		Header: strings.ToUpper(strings.TrimSpace(q.Get("header"))),
	}
	if opts.App != "" && !validApp(opts.App) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown app")
		return opts, false
	}
	if opts.Header != "" && !ValidHeader(opts.Header) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "unknown header")
		return opts, false
	}
	if q.Has("parent_id") {
		if pid := strings.TrimSpace(q.Get("parent_id")); pid != "" {
			opts.ParentID = &pid
		}
	}
	if q.Get("top_level") == "true" {
		opts.TopLevel = true
	}
	return opts, true
}

// list returns active categories, optionally filtered by app, header label and/or parent.
func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	opts, ok := readListFilters(w, r)
	if !ok {
		return
	}
	opts.ActiveOnly = true
	h.respond(w, r, opts)
}

// rail returns the curated categories for the shared main app header. Any tree level is eligible:
// the customer drill-in resolves the tapped id and walks its subtree, so a child chip is a valid
// entry point. FOOD never reaches here (rail writes reject it), so no app scope is applied.
func (h *Handler) rail(w http.ResponseWriter, r *http.Request) {
	opts, ok := readListFilters(w, r)
	if !ok {
		return
	}
	opts.ActiveOnly = true
	opts.HomeRailOnly = true
	h.respond(w, r, opts)
}

// adminList returns every category for the portal. `?trash=true` returns the soft-deleted ones
// instead (the Deleted tab); a live list never includes a trashed row.
func (h *Handler) adminList(w http.ResponseWriter, r *http.Request) {
	opts, ok := readListFilters(w, r)
	if !ok {
		return
	}
	opts.Trash = r.URL.Query().Get("trash") == "true"
	h.respond(w, r, opts)
}

// adminTrash lists the soft-deleted categories still inside the 7-day undo window. It runs the
// expiry purge first so an expired row never appears as restorable.
func (h *Handler) adminTrash(w http.ResponseWriter, r *http.Request) {
	opts, ok := readListFilters(w, r)
	if !ok {
		return
	}
	opts.Trash = true
	_, _ = h.repo.PurgeDeleted(r.Context(), CategoryTrashWindow)
	h.respond(w, r, opts)
}

func (h *Handler) respond(w http.ResponseWriter, r *http.Request, opts ListOptions) {
	items, err := h.repo.List(r.Context(), opts)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "categories_unavailable", "categories unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, items)
}

// validTamil reports whether a translated field is Tamil-only (blank means "not translated") and
// within its character budget.
func validTamil(value string, maxRunes int) bool {
	return locale.IsTamilText(value) && len([]rune(value)) <= maxRunes
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var req Input
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.App = strings.ToUpper(strings.TrimSpace(req.App))
	req.Name = strings.TrimSpace(req.Name)
	req.ID = strings.TrimSpace(req.ID)
	req.NameTA = strings.TrimSpace(req.NameTA)
	req.HeaderLabels = normalizeHeaderLabels(req.HeaderLabels)
	if !validApp(req.App) || req.Name == "" || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "app and name are required")
		return
	}
	if !validTamil(req.NameTA, 120) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "Tamil name accepts Tamil letters only")
		return
	}
	if req.ID != "" && !validID(req.ID) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "id must be a short slug")
		return
	}
	if !h.validParent(r.Context(), req.App, req.ParentID) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "parent category is invalid")
		return
	}
	if msg := headerLabelError(req.App, req.HeaderLabels); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	if msg := homeRailError(req.App, req.ShowOnHomeRail); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	if msg := gstError(req.App, req.GSTRateCategoryID); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	if msg := subCategoryError(req.App, req.SubCategories); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	item, err := h.repo.Create(r.Context(), req, auth.UserID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrDuplicate) {
			httpx.Fail(w, http.StatusConflict, "conflict", "a category with this id already exists")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not save category")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var req Input
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	req.App = strings.ToUpper(strings.TrimSpace(req.App))
	req.Name = strings.TrimSpace(req.Name)
	req.NameTA = strings.TrimSpace(req.NameTA)
	req.HeaderLabels = normalizeHeaderLabels(req.HeaderLabels)
	if !validApp(req.App) || req.Name == "" || len(req.Name) > 120 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "app and name are required")
		return
	}
	if !validTamil(req.NameTA, 120) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "Tamil name accepts Tamil letters only")
		return
	}
	if req.ParentID != nil && *req.ParentID == id {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "a category cannot be its own parent")
		return
	}
	if !h.validParent(r.Context(), req.App, req.ParentID) {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "parent category is invalid")
		return
	}
	if msg := headerLabelError(req.App, req.HeaderLabels); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	if msg := homeRailError(req.App, req.ShowOnHomeRail); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	// On update a blank GST pick means "unchanged" (the repo keeps the existing link); no validation
	// error. A present pick must nevertheless be a real slab, which the repo enforces.
	if msg := subCategoryError(req.App, req.SubCategories); msg != "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", msg)
		return
	}
	item, err := h.repo.Update(r.Context(), id, req, auth.UserID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "category not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not save category")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

// toggle flips the plain Active/Inactive flag (PATCH /categories/{id}/toggle) — a hide, not a delete.
// The row keeps its place in the admin list and existing references keep resolving.
func (h *Handler) toggle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		IsActive *bool `json:"isActive"`
	}
	if err := httpx.Decode(r, &req); err != nil || req.IsActive == nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "isActive is required")
		return
	}
	item, err := h.repo.SetActive(r.Context(), chi.URLParam(r, "id"), *req.IsActive, auth.UserID(r.Context()))
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			httpx.Fail(w, http.StatusNotFound, "not_found", "category not found")
			return
		}
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not update category")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

// remove moves a category and its subtree to the trash (DELETE /categories/{id}?moveTo=&reason=).
// Listings inside the subtree are never dropped: the caller must name `?moveTo=<category id>` (a live
// sibling-level category) and they are re-linked to that destination's drill-in leaf. A delete that
// would orphan listings and names no destination fails with 409 `move_required` so the portal can
// prompt for one. The row is restorable for 7 days, then the purger removes it for good.
func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	q := r.URL.Query()
	moveTo := strings.TrimSpace(q.Get("moveTo"))
	reason := strings.TrimSpace(q.Get("reason"))
	if len(reason) > 500 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "delete reason is too long")
		return
	}
	res, err := h.repo.Delete(r.Context(), id, moveTo, reason, auth.UserID(r.Context()))
	switch {
	case errors.Is(err, ErrCategoryNotFound):
		httpx.Fail(w, http.StatusNotFound, "not_found", "category not found")
		return
	case errors.Is(err, ErrCategoryHasProducts):
		httpx.Fail(w, http.StatusConflict, "move_required",
			"move the listings to another category before deleting this one")
		return
	case errors.Is(err, ErrInvalidMoveTarget):
		httpx.Fail(w, http.StatusBadRequest, "invalid_move_target",
			"pick another category at the same level in this app")
		return
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not delete category")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":            true,
		"id":            res.ID,
		"trashed":       res.Trashed,
		"movedProducts": res.MovedProducts,
		"targetId":      res.TargetID,
		"targetName":    res.TargetName,
	})
}

// restore brings a trashed category and its subtree back (POST /categories/{id}/restore). The subtree
// returns deactivated so the operator re-enables it deliberately. A row past the window is purged and
// reported as 410 `trash_expired`.
func (h *Handler) restore(w http.ResponseWriter, r *http.Request) {
	item, err := h.repo.Restore(r.Context(), chi.URLParam(r, "id"), auth.UserID(r.Context()))
	switch {
	case errors.Is(err, ErrCategoryNotFound):
		httpx.Fail(w, http.StatusNotFound, "not_found", "category not found in trash")
		return
	case errors.Is(err, ErrTrashExpired):
		httpx.Fail(w, http.StatusGone, "trash_expired",
			"the restore window has closed; this category was permanently deleted")
		return
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not restore category")
		return
	}
	httpx.JSON(w, http.StatusOK, item)
}

// permanentRemove hard-deletes one trashed, unreferenced subtree now (DELETE
// /categories/{id}/permanent). A row still referenced by a listing, store or menu is refused.
func (h *Handler) permanentRemove(w http.ResponseWriter, r *http.Request) {
	res, err := h.repo.PurgeOne(r.Context(), chi.URLParam(r, "id"))
	switch {
	case errors.Is(err, ErrCategoryNotFound):
		httpx.Fail(w, http.StatusNotFound, "not_found", "category not found in trash")
		return
	case errors.Is(err, ErrStillReferenced):
		httpx.Fail(w, http.StatusConflict, "category_in_use",
			"listings, stores or menus still point at this category — it cannot be permanently deleted")
		return
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not delete category")
		return
	}
	httpx.JSON(w, http.StatusOK, map[string]any{
		"ok":     true,
		"id":     res.ID,
		"purged": res.Purged,
	})
}

// listAttributeGroups returns the superadmin-authored facet groups + options for one sub-category.
// It is available to any signed-in account (the seller dish form and customer filter drawer read it).
func (h *Handler) listAttributeGroups(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "category id is required")
		return
	}
	groups, err := h.repo.ListAttributeGroups(r.Context(), id)
	if err != nil {
		httpx.Fail(w, http.StatusInternalServerError, "categories_unavailable", "attributes unavailable")
		return
	}
	httpx.JSON(w, http.StatusOK, groups)
}

// replaceAttributeGroups rewrites a sub-category's facet groups (superadmin only). Group/option ids
// supplied by the portal are preserved so existing dish tags survive a reorder; omitted ids are
// deleted. Everything is optional for the seller — a dish may publish with no facet tags.
func (h *Handler) replaceAttributeGroups(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(chi.URLParam(r, "id"))
	if id == "" {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "category id is required")
		return
	}
	var req struct {
		Groups []AttributeGroupInput `json:"groups"`
	}
	if err := httpx.Decode(r, &req); err != nil {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid request body")
		return
	}
	if len(req.Groups) > 40 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "too many attribute groups (max 40)")
		return
	}
	total := 0
	for _, g := range req.Groups {
		total += len(g.Options)
	}
	if total > 1000 {
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "too many attribute options (max 1000)")
		return
	}
	groups, err := h.repo.ReplaceAttributeGroups(r.Context(), id, req.Groups, auth.UserID(r.Context()))
	switch {
	case errors.Is(err, ErrNotFound):
		httpx.Fail(w, http.StatusNotFound, "not_found", "category not found")
		return
	case errors.Is(err, ErrDuplicate):
		httpx.Fail(w, http.StatusConflict, "conflict",
			"a group slug or option label is duplicated within this sub-category")
		return
	case errors.Is(err, ErrInvalidAttribute):
		httpx.Fail(w, http.StatusBadRequest, "bad_request", "invalid attribute group or option")
		return
	case err != nil:
		httpx.Fail(w, http.StatusInternalServerError, "categories_write_failed", "could not save attributes")
		return
	}
	httpx.JSON(w, http.StatusOK, groups)
}

// normalizeHeaderLabels upper-cases, trims and de-duplicates an explicit header label list so the repo
// can persist it verbatim. nil stays nil ("unchanged"); an empty array means "clear the extra labels".
func normalizeHeaderLabels(in *[]string) *[]string {
	if in == nil {
		return nil
	}
	seen := map[string]bool{}
	out := []string{}
	for _, raw := range *in {
		h := strings.ToUpper(strings.TrimSpace(raw))
		if h == "" || seen[h] {
			continue
		}
		seen[h] = true
		out = append(out, h)
	}
	return &out
}

// headerLabelError validates the curated header labels on create/update. Every value must be a known
// label, a vendor-sub-app row can only belong to its own app's list, and FOOD can never be shared into
// the main app header (it has no consumer vendor pool). A header-only row (app = MAIN_APP_HEADER)
// therefore cannot take a vendor label either — the per-label rule below already rejects it.
func headerLabelError(app string, labels *[]string) string {
	if labels == nil {
		return ""
	}
	for _, h := range *labels {
		if !ValidHeader(h) {
			return "unknown header label: " + h
		}
		switch h {
		case HeaderMart, HeaderFood, HeaderPharma:
			if h != app {
				return "a category can only be listed under its own app: " + h
			}
		}
	}
	if app == HeaderFood {
		for _, h := range *labels {
			if h == HeaderMainApp {
				return "FOOD categories cannot be tagged MAIN_APP_HEADER"
			}
		}
	}
	return ""
}

// homeRailError rejects rail selections the customer app cannot render: FOOD has no consumer vendor
// pool. A header-only row (MAIN_APP_HEADER) is a header chip by definition and a MART/PHARMA row at any
// tree level is a valid chip — the drill-in resolves the tapped id and walks its subtree. The rail
// itself is unbounded — the app scrolls horizontally — so there is no slot cap to enforce here.
func homeRailError(app string, show *bool) string {
	if show == nil || !*show {
		return ""
	}
	if app == "FOOD" {
		return "FOOD categories cannot appear on the home rail"
	}
	return ""
}

// gstError validates the mandatory GST pick on create/update. A header-only or vendor-sub-app category
// needs a real slab; FOOD is exempt because the gateway pins every FOOD row to the 5% food slab.
func gstError(app, rateCategoryID string) string {
	if app == "FOOD" {
		return ""
	}
	if strings.TrimSpace(rateCategoryID) == "" {
		return "a GST rate category is required"
	}
	return ""
}

// subCategoryError validates the inline child rows: each needs a name, a Tamil name and (outside
// FOOD) its own GST rate pick — Option B, every sub-category carries its own mandatory rate. Tamil
// copy is mandatory because every child is a customer-facing drill-in label.
func subCategoryError(app string, subs *[]SubCategoryInput) string {
	if subs == nil {
		return ""
	}
	for _, sub := range *subs {
		if strings.TrimSpace(sub.Name) == "" {
			return "every sub-category needs a name"
		}
		if strings.TrimSpace(sub.NameTA) == "" {
			return "every sub-category needs a Tamil name"
		}
		if !validTamil(sub.NameTA, 120) {
			return "sub-category Tamil name accepts Tamil letters only"
		}
		childApp := strings.ToUpper(strings.TrimSpace(sub.App))
		if childApp == "" {
			childApp = app
		}
		if childApp == "FOOD" {
			continue
		}
		if strings.TrimSpace(sub.GSTRateCategoryID) == "" {
			return "every sub-category needs a GST rate category"
		}
	}
	return ""
}

// validParent accepts a nil parent, or a parent that exists for the same app.
func (h *Handler) validParent(ctx context.Context, app string, parentID *string) bool {
	if parentID == nil || strings.TrimSpace(*parentID) == "" {
		return true
	}
	parent, err := h.repo.Get(ctx, strings.TrimSpace(*parentID))
	if err != nil {
		return false
	}
	return parent.App == app
}

// validID keeps superadmin-supplied ids to a URL-safe slug (letters, digits, dash, underscore).
func validID(s string) bool {
	if len(s) > 80 {
		return false
	}
	for _, r := range s {
		switch {
		case r >= 'a' && r <= 'z', r >= 'A' && r <= 'Z', r >= '0' && r <= '9', r == '-', r == '_':
		default:
			return false
		}
	}
	return true
}
