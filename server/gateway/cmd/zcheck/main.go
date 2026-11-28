package main

import (
	"context"
	"fmt"
	"os"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

const sellerColumns = `seller_id, owner_name, gstin, pan, address,
	coalesce(phone,''), coalesce(contact_email,''), state_code, coalesce(district_code,''), status::text, rating,
	otp_verified, otp_verified_at, coalesce(rejection_reason,''), rejection_history, created_at,
	latitude, longitude,
	terms_accepted_at, coalesce(terms_accepted_ip,''), coalesce(terms_accepted_account_id,''),
	partner_agreement_accepted_at, coalesce(partner_agreement_accepted_ip,''),
	coalesce(partner_agreement_accepted_account_id,''),
	ip_license_granted_at, coalesce(ip_license_granted_ip,''), coalesce(ip_license_granted_account_id,''),
	coalesce(contract_tier,''), coalesce(rate_card_version,''), coalesce(commission_pct,0),
	coalesce(settlement_terms,''), coalesce(compliance_status,'PENDING'), coalesce(compliance_note,''),
	validated_at, coalesce(validated_by,''),
	coalesce(source,'app'), coalesce(inquiry_category::text,''), inquiry_platform_fee_pct,
	coalesce(inquiry_notes,''), shop_photos,
	coalesce(inquiry_stage,'NEW'), coalesce(inquiry_assigned_to,''), inquiry_assigned_at`

const vendorRollup = `
	left join (
	  select seller_id as vendor_seller_id, count(*)::int as vendor_count,
	         array_agg(distinct app::text) as vendor_apps
	    from directory.stores group by seller_id
	) v on v.vendor_seller_id = s.seller_id`

const vendorRollupColumns = `, coalesce(v.vendor_count, 0), coalesce(v.vendor_apps, '{}')`

func main() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	pool, err := pgxpool.New(ctx, os.Getenv("DATABASE_URL"))
	if err != nil {
		panic(err)
	}
	defer pool.Close()

	q := `select ` + sellerColumns + vendorRollupColumns + ` from sellers.sellers s` + vendorRollup + ` order by s.created_at desc limit 1`
	r, err := pool.Query(ctx, q)
	if err != nil {
		fmt.Println("sellerSelectWithVendors ERR:", err)
		return
	}
	fmt.Println("sellerSelectWithVendors OK, fields:", len(r.FieldDescriptions()))
	r.Close()

	// insert path column check against directory.stores
	var cols string
	if err := pool.QueryRow(ctx, `select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='directory' and table_name='stores'`).Scan(&cols); err != nil {
		fmt.Println("stores_cols ERR:", err)
	} else {
		fmt.Println("stores_cols =>", cols)
	}
}
