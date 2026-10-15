"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { discountPercent } from "@/lib/pricing/rules";
import { SectionCard } from "@/components/patterns/SectionCard";
import { KpiStrip } from "@/components/patterns/KpiCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { SectorPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, formatNumber } from "@/lib/format";
import { useMockLoading, useProducts } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ProductThumb } from "@/components/patterns/ProductThumb";


function PricingAudit() {
  const session = useSession();
  const stateCode = session?.stateCode ?? "MH";
  const loading = useMockLoading();
  const products = useProducts({ stateCode });

  const medianByCategory = new Map<string, number>();
  for (const category of new Set(products.map((p) => p.category))) {
    const prices = products
      .filter((p) => p.category === category)
      .map((p) => p.pricePaisa)
      .sort((a, b) => a - b);
    const mid = Math.floor(prices.length / 2);
    medianByCategory.set(
      category,
      prices.length % 2 ? (prices[mid] ?? 0) : ((prices[mid - 1] ?? 0) + (prices[mid] ?? 0)) / 2,
    );
  }

  const flagged = products
    .map((product) => {
      const median = medianByCategory.get(product.category) ?? product.pricePaisa;
      const reasons: string[] = [];
      if (discountPercent(product.mrpPaisa, product.pricePaisa) >= 60) reasons.push("Discount above 60%");
      if (product.mrpPaisa > median * 2.5) reasons.push("MRP far above category median");
      if (product.pricePaisa < median * 0.4) reasons.push("Price far below category median");
      return { product, median, reasons };
    })
    .filter((row) => row.reasons.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pricing audit"
        description="Read-only: you can flag and contact sellers, but everyday pricing stays with them."
      />

      <KpiStrip
        items={[
          { label: "Products audited", value: formatNumber(products.length) },
          { label: "Anomalies", value: formatNumber(flagged.length) },
          { label: "Categories", value: formatNumber(medianByCategory.size) },
        ]}
      />

      <SectionCard title="Flagged listings" bodyClassName="p-0">
        <DataShell
          loading={loading}
          isEmpty={flagged.length === 0}
          empty={<EmptyState title="No anomalies" description="Every price in your state sits inside the expected band." />}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead className="text-right">MRP</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Category median</TableHead>
                <TableHead>Flags</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {flagged.map(({ product, median, reasons }) => (
                <TableRow key={product.productId} className="h-12">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ProductThumb product={product} />
                      <span className="text-[13px] font-medium">{product.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <SectorPill sector={product.sector} />
                  </TableCell>
                  <TableCell className="num text-right">{formatINR(product.mrpPaisa)}</TableCell>
                  <TableCell className="num text-right">{formatINR(product.pricePaisa)}</TableCell>
                  <TableCell className="num text-right text-muted-foreground">{formatINR(median)}</TableCell>
                  <TableCell className="text-[12px] text-warning">{reasons.join(" · ")}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.success(`Notice sent to ${product.sellerId}`)}
                    >
                      Contact seller
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>
    </div>
  );
}

export default PricingAudit;
