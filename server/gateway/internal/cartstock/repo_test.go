package cartstock

import (
	"context"
	"testing"
)

func TestMergeItem(t *testing.T) {
	cases := []struct {
		name            string
		start           []CartItem
		productID       string
		qty             int64
		wantIDs         []string
		wantQty         map[string]int64
	}{
		{
			name:    "append new",
			start:   []CartItem{{ProductID: "a", Qty: 1}},
			productID: "b", qty: 2,
			wantIDs: []string{"a", "b"},
			wantQty: map[string]int64{"a": 1, "b": 2},
		},
		{
			name:    "update existing",
			start:   []CartItem{{ProductID: "a", Qty: 1}},
			productID: "a", qty: 5,
			wantIDs: []string{"a"},
			wantQty: map[string]int64{"a": 5},
		},
		{
			name:    "zero removes",
			start:   []CartItem{{ProductID: "a", Qty: 1}, {ProductID: "b", Qty: 2}},
			productID: "a", qty: 0,
			wantIDs: []string{"b"},
			wantQty: map[string]int64{"b": 2},
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := mergeItem(tc.start, tc.productID, tc.qty)
			if len(got) != len(tc.wantIDs) {
				t.Fatalf("len = %d, want %d (%v)", len(got), len(tc.wantIDs), got)
			}
			for i, id := range tc.wantIDs {
				if got[i].ProductID != id || got[i].Qty != tc.wantQty[id] {
					t.Fatalf("item[%d] = %+v, want id=%s qty=%d", i, got[i], id, tc.wantQty[id])
				}
			}
		})
	}
}

func TestStockWithoutDBErrors(t *testing.T) {
	_, _, err := New(nil).StockByProductID(context.Background(), "md-1")
	if err == nil {
		t.Fatal("expected error when pool is nil")
	}
}