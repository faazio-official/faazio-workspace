// 'use client'
import { createFileRoute } from "@tanstack/react-router";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pageMeta } from "@/lib/seo";
import { formatNumber } from "@/lib/format";
import {
  useAdSlots,
  useCampaigns,
  useCoupons,
  useOrders,
  useProducts,
  useReviews,
  useSectorCaps,
  useStock,
  useStores,
} from "@/lib/api/hooks";

export const Route = createFileRoute("/admin/super/coverage")({
  head: () =>
    pageMeta(
      "Consumer app coverage",
      "Every surface in the Faazio app mapped to the data table that feeds it and who maintains it.",
    ),
  component: Coverage,
});

function Coverage() {
  const products = useProducts();
  const stores = useStores();
  const orders = useOrders();
  const stock = useStock();
  const coupons = useCoupons();
  const ads = useAdSlots();
  const campaigns = useCampaigns();
  const caps = useSectorCaps();
  const reviews = useReviews();

  const rows: { surface: string; table: string; owner: string; rows: number }[] = [
    {
      surface: "Mart / Food / Pharma grids, search, categories",
      table: "catalog.products",
      owner: "Seller uploads · admins moderate",
      rows: products.length,
    },
    {
      surface: "Store profiles and self-pickup points",
      table: "directory.stores",
      owner: "Seller onboarding and store settings",
      rows: stores.length,
    },
    {
      surface: "Deals of the day, food specials, booking dishes",
      table: "catalog.products (deal variants)",
      owner: "Seller offers module",
      rows: products.filter((p) => p.discountPercent > 0).length,
    },
    {
      surface: "Home top ad carousel and sponsored showcase",
      table: "ads.sponsored_slots",
      owner: "Seller requests · admin approves",
      rows: ads.length,
    },
    {
      surface: "Today's offers, rails, curated picks, filter feed",
      table: "recommendations.sdui_layouts",
      owner: "Admin content curation",
      rows: products.filter((p) => p.status === "ACTIVE").length,
    },
    {
      surface: "Product detail reviews, specs, highlights",
      table: "reviews.reviews",
      owner: "Shoppers · seller replies · admin moderation",
      rows: reviews.length,
    },
    {
      surface: "Stock, availability and delivery ETA",
      table: "inventory.stock",
      owner: "Seller",
      rows: stock.length,
    },
    {
      surface: "Cart and checkout coupons",
      table: "promo.coupons",
      owner: "State and Super Admin",
      rows: coupons.length,
    },
    {
      surface: "Orders, statuses and returns",
      table: "checkout.orders",
      owner: "Shoppers · seller ops · admin monitoring",
      rows: orders.length,
    },
    {
      surface: "Pharma prescription gating",
      table: "catalog.products.is_prescription",
      owner: "Seller sets · admin verifies",
      rows: products.filter((p) => p.isPrescription).length,
    },
    {
      surface: "Festival pricing on product pages",
      table: "promo.festival_campaigns / sector_caps",
      owner: "Super sets caps · state runs campaigns · seller opts in",
      rows: campaigns.length + caps.length,
    },
    {
      surface: "FaazioCoins rates and streak card",
      table: "ops.platform_settings",
      owner: "Super Admin",
      rows: 5,
    },
  ];

  const gaps = rows.filter((row) => row.rows === 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Consumer app coverage"
        description="If a surface here shows zero rows, shoppers would see an empty screen."
      />

      <KpiStrip
        items={[
          { label: "Surfaces tracked", value: formatNumber(rows.length) },
          { label: "Covered", value: formatNumber(rows.length - gaps.length) },
          { label: "Gaps", value: formatNumber(gaps.length) },
        ]}
      />

      <SectionCard title="Surface to data mapping" bodyClassName="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Consumer app surface</TableHead>
              <TableHead>Owning table</TableHead>
              <TableHead>Maintained by</TableHead>
              <TableHead className="text-right">Rows</TableHead>
              <TableHead>Coverage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.surface} className="h-12">
                <TableCell className="text-[13px] font-medium">{row.surface}</TableCell>
                <TableCell className="num text-[12px] text-muted-foreground">{row.table}</TableCell>
                <TableCell className="text-[12px]">{row.owner}</TableCell>
                <TableCell className="num text-right">{formatNumber(row.rows)}</TableCell>
                <TableCell>
                  {row.rows > 0 ? (
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-success">
                      <CheckCircle2 className="size-4" /> Covered
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-[12px] font-semibold text-warning">
                      <AlertTriangle className="size-4" /> Needs data
                    </span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
