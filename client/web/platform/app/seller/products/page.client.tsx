"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Loader2, Package, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Card, EmptyState, Sheet } from "@/components/sellers/kit";
import { formatINR } from "@/lib/format";
import { remoteConfigured } from "@/lib/config";
import { refreshSellerProducts } from "@/lib/api/sync";
import { usePortalLoading, useProducts, useSellerScope } from "@/lib/api/hooks";
import { sectorLabel } from "@/lib/sector";
import { cn } from "@/lib/utils";
import type { ProductRecord, ProductStatus, Sector } from "@/data/types";

const SECTORS: (Sector | "ALL")[] = ["ALL", "MART", "FOOD", "PHARMA"];
const STATUSES: (ProductStatus | "ALL")[] = ["ALL", "ACTIVE", "PENDING_REVIEW", "DELISTED"];

const STATUS_PILL: Record<ProductStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_REVIEW: "bg-warning-soft text-warning",
  ACTIVE: "bg-success-soft text-success",
  REJECTED: "bg-brand-soft text-brand",
  DELISTED: "bg-muted text-muted-foreground",
};

function SellerProducts() {
  const { sellerId, storeId } = useSellerScope();
  const loading = usePortalLoading();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<Sector | "ALL">("ALL");
  const [status, setStatus] = useState<ProductStatus | "ALL">("ALL");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [limit, setLimit] = useState(10);

  const products = useProducts({ sellerId, storeId, query, sector, status });
  const rows = products.slice(0, limit);
  const filtersActive = sector !== "ALL" || status !== "ALL";

  const [refreshing, setRefreshing] = useState(false);
  const refreshingRef = useRef(false);
  const lastRefreshRef = useRef(0);

  const handleRefresh = useCallback(async () => {
    if (refreshingRef.current || !remoteConfigured()) return;
    const now = Date.now();
    if (now - lastRefreshRef.current < 30_000) return;
    lastRefreshRef.current = now;
    refreshingRef.current = true;
    setRefreshing(true);
    try {
      await refreshSellerProducts();
      toast.success("Products refreshed");
    } catch {
      toast.error("Couldn't refresh products", {
        description: "Showing the last loaded list.",
      });
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, []);

  // Web-native equivalent of the customer app's pull-to-refresh: scrolling to the bottom of the
  // page re-fetches live rows from the gateway. The 30s cooldown stops it from looping.
  useEffect(() => {
    const onScroll = () => {
      const doc = document.documentElement;
      const nearBottom = doc.scrollHeight - (doc.scrollTop + doc.clientHeight) <= 100;
      if (nearBottom) void handleRefresh();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [handleRefresh]);

  return (
    <>
      <PageHeader
        title="Products"
        sub="Catalog"
        right={
          <div className="flex shrink-0 items-center gap-2">
            <Link
              href="/seller/products/trash"
              className="flex items-center gap-1 rounded-xl border border-border bg-card px-3 py-2 text-xs font-semibold"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Trash
            </Link>
            <Link
              href="/seller/products/new"
              className="flex items-center gap-1 rounded-xl bg-foreground px-3 py-2 text-xs font-semibold text-background"
            >
              <Plus className="h-3.5 w-3.5" />
              Add
            </Link>
          </div>
        }
      />

      <div className="space-y-3 px-4 pt-3 pb-6">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or product id"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
          <button
            aria-label="Filters"
            onClick={() => setFiltersOpen(true)}
            className={cn(
              "relative rounded-xl border p-2",
              filtersActive ? "border-foreground bg-foreground text-background" : "border-border bg-card",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {filtersActive && (
              <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-brand" />
            )}
          </button>
        </div>

        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto">
          {SECTORS.map((option) => (
            <button
              key={option}
              onClick={() => setSector(sector === option ? "ALL" : option)}
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium",
                sector === option ? "border-foreground bg-foreground text-background" : "border-border bg-card",
              )}
            >
{option === "ALL" ? "All" : sectorLabel(option)}
              {sector === option && option !== "ALL" && <X className="h-3 w-3" />}
            </button>
          ))}
        </div>

        {loading && rows.length === 0 ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Package className="h-12 w-12" strokeWidth={1.2} />}
            text="No products match — clear the filters or add a new product"
          />
        ) : (
          <div className="grid gap-3">
            {rows.map((product) => (
              <ProductRow key={product.productId} product={product} />
            ))}
          </div>
        )}

        {products.length > rows.length && (
          <button
            onClick={() => setLimit((l) => l + 10)}
            className="w-full rounded-xl border border-border bg-card py-3 text-sm font-semibold"
          >
            Load more ({products.length - rows.length} remaining)
          </button>
        )}

        {products.length === 0 && !loading && (
          <Link
            href="/seller/products/new"
            className="block rounded-xl bg-foreground py-3 text-center text-sm font-semibold text-background"
          >
            Add your first product
          </Link>
        )}

        {refreshing && (
          <div className="flex items-center justify-center gap-2 py-3 text-xs font-medium text-brand">
            <Loader2 className="h-4 w-4 animate-spin" />
            Refreshing…
          </div>
        )}
      </div>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <p className="pt-2 text-xs font-bold text-muted-foreground">Status</p>
        {STATUSES.map((option) => (
          <button
            key={option}
            onClick={() => setStatus(option === status ? "ALL" : option)}
            className="flex w-full items-center justify-between border-b border-border py-3 text-left text-sm last:border-0"
          >
            {option.replace(/_/g, " ")}
            <span
              className={cn(
                "h-3.5 w-3.5 rounded-full border-2",
                status === option ? "border-foreground bg-foreground" : "border-border",
              )}
            />
          </button>
        ))}
        <div className="flex gap-2 pt-4">
          <button
            onClick={() => setFiltersOpen(false)}
            className="flex-1 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold"
          >
            Done
          </button>
        </div>
      </Sheet>
    </>
  );
}

function ProductRow({ product }: { product: ProductRecord }) {
  return (
    <Link href={`/seller/products/${product.productId}/edit`} className="block min-w-0 max-w-full">
      <Card className="flex min-w-0 max-w-full items-center gap-2.5 overflow-hidden p-3 sm:gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-xl sm:h-14 sm:w-14 sm:text-2xl">
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            product.emoji
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="min-w-0 truncate text-sm font-semibold">{product.name}</p>
            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {product.sector}
            </span>
          </div>
          <p className="min-w-0 truncate text-[11px] text-muted-foreground">
            {product.category} · {product.productId}
          </p>
          <div className="mt-1 flex min-w-0 items-center gap-2 text-xs">
            <b className="min-w-0 truncate">{formatINR(product.pricePaisa)}</b>
            <span
              className={cn(
                "ml-auto shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold uppercase",
                STATUS_PILL[product.status],
              )}
            >
              {product.status.replace(/_/g, " ")}
            </span>
          </div>
          {product.status === "REJECTED" && product.reviewReason ? (
            <p className="mt-1 rounded bg-brand-soft px-2 py-1 text-[11px] break-words text-brand">
              {product.reviewReason}
            </p>
          ) : null}
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Card>
    </Link>
  );
}

export default SellerProducts;