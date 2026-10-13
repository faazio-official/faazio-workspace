// Package rewards serves the server-authoritative rewards context (coins / streak / ledger /
// discount card). Future service: Go + CockroachDB (monolith-breakdown.md §1). The client stays
// optimistic; the server is the money-adjacent authority and reconciles on read.
package rewards

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/faazio/server/gateway/internal/platform/db"
	"github.com/jackc/pgx/v5"
)

// Reward-rate constants mirror @data/rewards (frozen; a future admin console owns these).
const (
	coinEarnRate        = 1000 // rupees spent per coin earned
	coinRedeemRate      = 100  // coins per ₹1 of redemption value
	streakTargetDays    = 7
	discountCardPercent = 10
	cardValidityDays    = 5
)

// Balance is a rewards.balances row.
type Balance struct {
	Coins        int64           `json:"coins"`
	Streak       int64           `json:"streak"`
	LastOrderDay string          `json:"lastOrderDay,omitempty"`
	Card         json.RawMessage `json:"card,omitempty"`
	UpdatedAt    string          `json:"updatedAt,omitempty"`
}

// LedgerEntry is one append-only rewards.ledger row.
type LedgerEntry struct {
	ID      string `json:"id"`
	Type    string `json:"type"`
	Coins   int64  `json:"coins"`
	Rupees  int64  `json:"rupees"`
	OrderID string `json:"orderId,omitempty"`
	At      string `json:"at"`
}

// View is the GET /rewards payload: balance + recent ledger.
type View struct {
	Balance
	Ledger []LedgerEntry `json:"ledger"`
}

// Repo reads/writes rewards.
type Repo struct {
	pool *db.Pool
}

// New returns a rewards repo.
func New(pool *db.Pool) *Repo { return &Repo{pool: pool} }

// Earn applies an order's reward effect in one transaction: streak evaluation, optional discount-card
// grant, coin earn/redeem, and the matching append-only ledger rows. It is idempotent per order via
// the caller (checkout), which only calls it once per successful order.
func (r *Repo) Earn(ctx context.Context, userID, orderID string, paidRupees, coinsRedeemed int64) error {
	if r.pool == nil {
		return fmt.Errorf("rewards: database not configured")
	}
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err := tx.Exec(ctx, `insert into rewards.balances (user_id) values ($1) on conflict (user_id) do nothing`, userID); err != nil {
		return err
	}
	var (
		coins   int64
		streak  int64
		lastDay *time.Time
		card    []byte
	)
	if err := tx.QueryRow(ctx, `
		select coins, streak, last_order_day, card from rewards.balances
		 where user_id = $1 for update`, userID).Scan(&coins, &streak, &lastDay, &card); err != nil {
		return err
	}

	now := time.Now().UTC()
	todayKey := now.Format("2006-01-02")

	// Streak evaluation (calendar-date based; mirrors features/rewards/rewardsLogic.evaluateStreak).
	streakChanged := false
	if lastDay == nil {
		streak, streakChanged = 1, true
	} else {
		gap := int(now.Truncate(24*time.Hour).Sub(lastDay.Truncate(24*time.Hour)).Hours() / 24)
		switch {
		case gap <= 0:
			// same day — unchanged
		case gap == 1:
			streak, streakChanged = streak+1, true
		default:
			streak, streakChanged = 1, true
		}
	}

	// Discount card grant at the streak target.
	var newCard []byte
	if streakChanged && streak >= streakTargetDays {
		c := map[string]any{
			"id":        "card-" + shortID(),
			"percent":   discountCardPercent,
			"grantedAt": now.Format(time.RFC3339),
			"expiresAt": now.AddDate(0, 0, cardValidityDays).Format(time.RFC3339),
		}
		newCard, _ = json.Marshal(c)
		streak = 0
	}

	// Coin delta: earn on paid rupees, redeem requested coins (clamped to the balance).
	if coinsRedeemed < 0 {
		coinsRedeemed = 0
	}
	if coinsRedeemed > coins {
		coinsRedeemed = coins
	}
	earned := paidRupees / coinEarnRate
	if paidRupees < 0 {
		earned = 0
	}
	newCoins := coins + earned - coinsRedeemed
	if newCoins < 0 {
		newCoins = 0
	}

	// Append-only ledger entries (STREAK/REDEEM/EARN), newest first on read.
	if streakChanged && len(newCard) > 0 {
		if _, err := tx.Exec(ctx, `insert into rewards.ledger (id, user_id, type, coins, rupees, order_id) values ($1,$2,'STREAK',0,0,$3)`, "rw-"+shortID(), userID, nullIfEmpty(orderID)); err != nil {
			return err
		}
	}
	if coinsRedeemed > 0 {
		if _, err := tx.Exec(ctx, `insert into rewards.ledger (id, user_id, type, coins, rupees, order_id) values ($1,$2,'REDEEM',$3,$4,$5)`, "rw-"+shortID(), userID, -coinsRedeemed, coinsRedeemed/coinRedeemRate, nullIfEmpty(orderID)); err != nil {
			return err
		}
	}
	if earned > 0 {
		if _, err := tx.Exec(ctx, `insert into rewards.ledger (id, user_id, type, coins, rupees, order_id) values ($1,$2,'EARN',$3,0,$4)`, "rw-"+shortID(), userID, earned, nullIfEmpty(orderID)); err != nil {
			return err
		}
	}

	cardUpdate := card
	if newCard != nil {
		cardUpdate = newCard
	}
	if _, err := tx.Exec(ctx, `
		update rewards.balances
		   set coins = $2, streak = $3, last_order_day = $4::date, card = $5::jsonb, updated_at = now()
		 where user_id = $1`, userID, newCoins, streak, todayKey, nullIfNilBytes(cardUpdate)); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

// View returns the caller's balance plus the 50 most recent ledger entries.
func (r *Repo) View(ctx context.Context, userID string) (View, error) {
	if r.pool == nil {
		return View{}, fmt.Errorf("rewards: database not configured")
	}
	var (
		v         View
		lastDay   *time.Time
		card      []byte
		updatedAt time.Time
	)
	err := r.pool.QueryRow(ctx, `
		select coins, streak, last_order_day, card, updated_at from rewards.balances where user_id = $1`, userID).
		Scan(&v.Coins, &v.Streak, &lastDay, &card, &updatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			v.Ledger = []LedgerEntry{}
			return v, nil
		}
		return View{}, err
	}
	if lastDay != nil {
		v.LastOrderDay = lastDay.Format("2006-01-02")
	}
	v.Card = json.RawMessage(card)
	v.UpdatedAt = updatedAt.UTC().Format(time.RFC3339)

	rows, err := r.pool.Query(ctx, `
		select id, type::text, coins, rupees, coalesce(order_id,''), created_at
		  from rewards.ledger where user_id = $1 order by created_at desc limit 50`, userID)
	if err != nil {
		return View{}, err
	}
	defer rows.Close()
	v.Ledger = []LedgerEntry{}
	for rows.Next() {
		var (
			e  LedgerEntry
			at time.Time
		)
		if err := rows.Scan(&e.ID, &e.Type, &e.Coins, &e.Rupees, &e.OrderID, &at); err != nil {
			return View{}, err
		}
		e.At = at.UTC().Format(time.RFC3339)
		v.Ledger = append(v.Ledger, e)
	}
	return v, rows.Err()
}

func shortID() string {
	b := make([]byte, 5)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func nullIfEmpty(v string) any {
	if v == "" {
		return nil
	}
	return v
}

func nullIfNilBytes(v []byte) any {
	if len(v) == 0 {
		return nil
	}
	return string(v)
}