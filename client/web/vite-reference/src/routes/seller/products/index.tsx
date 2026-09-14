// 'use client'
import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill, StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { pageMeta } from "@/lib/seo";
import { formatINR } from "@/lib/format";
import { useMockLoading, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { FilterChip } from "@/components/patterns/FilterChip";
import { ProductThumb } from "@/components/patterns/ProductThumb";
import type { ProductStatus, Sector } from "@/data/types";

export const Route = createFileRoute("/seller/products/")({
  head: () =>
    pageMeta("My products", "Search, filter and manage every listing you supply to the Faazio app."),
  component: SellerProducts,
});

const SECTORS: (Sector | "ALL")[] = ["ALL", "MART", "FOOD", "PHARMA"];
const STATUSES: (ProductStatus | "ALL")[] = ["ALL", "ACTIVE", "PENDING_REVIEW", "DELISTED"];

function SellerProducts() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<Sector | "ALL">("ALL");
  const [status, setStatus] = useState<ProductStatus | "ALL">("ALL");
  const [limit, setLimit] = useState(10);

  const products = useProducts({ sellerId, query, sector, status });
  const rows = products.slice(0, limit);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        description="Everything a shopper can buy from you starts as a row here."
        actions={
          <>
            <Button asChild size="sm" variant="outline">
              <Link to="/seller/products/new">Bulk CSV upload</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/seller/products/new">Add product</Link>
            </Button>
          </>
        }
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <div className="relative w-full max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              className="h-9 pl-8"
              placeholder="Search name or product id"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {SECTORS.map((option) => (
              <FilterChip
                key={option}
                label={option}
                active={sector === option}
                onClick={() => setSector(option)}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((option) => (
              <FilterChip
                key={option}
                label={option.replace(/_/g, " ")}
                active={status === option}
                onClick={() => setStatus(option)}
              />
            ))}
          </div>
        </div>

        <DataShell
          loading={loading}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              title="No products match"
              description="Clear the filters, or list a new product to start selling."
              action={
                <Button asChild size="sm">
                  <Link to="/seller/products/new">Add your first product</Link>
                </Button>
              }
            />
          }
        >
          <Table>
            <TableHeader className="sticky top-14 bg-card">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Discount</TableHead>
                <TableHead className="text-right">Quality</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((product) => (
                <TableRow key={product.productId} className="h-12">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProductThumb product={product} size="md" />
                      <div>
                        <p className="text-[13px] font-medium">{product.name}</p>
                        <p className="num text-[11px] text-muted-foreground">{product.productId}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SectorPill sector={product.sector} />
                  </TableCell>
                  <TableCell className="text-[12px] text-muted-foreground">
                    {product.category}
                  </TableCell>
                  <TableCell className="num text-right">{formatINR(product.pricePaisa)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">
                    {formatINR(product.mrpPaisa)}
                  </TableCell>
                  <TableCell className="num text-right">{product.discountPercent}%</TableCell>
                  <TableCell className="num text-right">{product.qualityScore}</TableCell>
                  <TableCell>
                    <StatusPill status={product.status} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button asChild size="sm" variant="ghost">
                      <Link to="/seller/products/$id/edit" params={{ id: product.productId }}>
                        Edit
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {products.length > rows.length ? (
            <div className="border-t border-border p-3 text-center">
              <Button size="sm" variant="outline" onClick={() => setLimit((l) => l + 10)}>
                Load more
              </Button>
            </div>
          ) : null}
        </DataShell>
      </SectionCard>
    </div>
  );
}
