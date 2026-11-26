"use client";
import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fetchFoodMaster, listCategories } from "@/lib/api";
import type {
  CategoryRow,
  FoodAtomicTaxonomyRow,
  FoodMasterData,
  FoodSampleMenuItem,
  StoreConfigOption,
} from "@/lib/api";

const TABS = ["taxonomy", "map", "store", "samples"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  taxonomy: "Atomic taxonomy",
  map: "Carousel map",
  store: "Store rules",
  samples: "Sample dishes",
};

function money(inr: number) {
  return `₹${inr.toLocaleString("en-IN")}`;
}

/**
 * Read-only FOOD reference master data seeded from the approved catalogue workbook (migration 0145).
 * It is the cuisine layer behind the carousel categories, the store-onboarding rule set and the
 * sample dish templates. Live seller menus stay in the Menus / Categories screens.
 */
export default function FoodMasterPage() {
  const [tab, setTab] = useState<Tab>("taxonomy");
  const [data, setData] = useState<FoodMasterData | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchFoodMaster(), listCategories("FOOD")])
      .then(([res, cats]) => {
        if (!cancelled) {
          setData(res);
          setCategories(cats);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load master data.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const needle = query.trim().toLowerCase();
  const taxonomy = useMemo(
    () =>
      (data?.atomicTaxonomy ?? []).filter(
        (r) =>
          !needle ||
          r.category.toLowerCase().includes(needle) ||
          r.subCategory.toLowerCase().includes(needle),
      ),
    [data, needle],
  );
  const storeConfig = useMemo(
    () =>
      (data?.storeConfig ?? []).filter(
        (r) =>
          !needle ||
          r.storeAttributeGroup.toLowerCase().includes(needle) ||
          r.optionValue.toLowerCase().includes(needle),
      ),
    [data, needle],
  );
  const carousel = useMemo(
    () =>
      categories
        .filter((r) => r.parentId === null && r.atomicCategory)
        .filter(
          (r) =>
            !needle ||
            r.name.toLowerCase().includes(needle) ||
            (r.atomicCategory ?? "").toLowerCase().includes(needle) ||
            (r.atomicSubcategory ?? "").toLowerCase().includes(needle),
        )
        .sort((a, b) => a.name.localeCompare(b.name)),
    [categories, needle],
  );
  const samples = useMemo(
    () =>
      (data?.sampleMenu ?? []).filter(
        (r) =>
          !needle ||
          r.dishName.toLowerCase().includes(needle) ||
          r.atomicSubcategory.toLowerCase().includes(needle),
      ),
    [data, needle],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Food master data"
        description="Reference data for the FOOD catalogue: cuisine taxonomy, store rules and sample dish templates."
      />

      <div className="flex flex-wrap items-center gap-1.5">
        {TABS.map((t) => (
          <FilterChip
            key={t}
            label={TAB_LABEL[t]}
            active={tab === t}
            onClick={() => {
              setTab(t);
              setQuery("");
            }}
          />
        ))}
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search"
          className="ml-auto h-8 w-52"
        />
      </div>

      <DataShell
        loading={loading}
        error={error ?? undefined}
        isEmpty={
          !loading &&
          !error &&
          (tab === "taxonomy"
            ? taxonomy.length === 0
            : tab === "map"
              ? carousel.length === 0
              : tab === "store"
                ? storeConfig.length === 0
                : samples.length === 0)
        }
        empty={<EmptyState title="Nothing here" description="No rows match this view." />}
      >
        {tab === "taxonomy" ? <TaxonomyTable rows={taxonomy} /> : null}
        {tab === "map" ? <CarouselMapTable rows={carousel} /> : null}
        {tab === "store" ? <StoreConfigTable rows={storeConfig} /> : null}
        {tab === "samples" ? <SampleTable rows={samples} /> : null}
      </DataShell>
    </div>
  );
}

function TaxonomyTable({ rows }: { rows: FoodAtomicTaxonomyRow[] }) {
  return (
    <SectionCard title={`Cuisine taxonomy · ${rows.length}`} bodyClassName="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Category</TableHead>
            <TableHead>Sub-category</TableHead>
            <TableHead>GST</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="h-11">
              <TableCell className="text-[13px] font-medium">{r.category}</TableCell>
              <TableCell className="text-[13px] text-muted-foreground">{r.subCategory}</TableCell>
              <TableCell className="num text-[12px] text-muted-foreground">{r.gstRatePct}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

function CarouselMapTable({ rows }: { rows: CategoryRow[] }) {
  return (
    <SectionCard title={`Carousel → cuisine map · ${rows.length}`} bodyClassName="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Carousel category</TableHead>
            <TableHead>Cuisine category</TableHead>
            <TableHead>Sub-category</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="h-11">
              <TableCell className="text-[13px] font-medium">{r.name}</TableCell>
              <TableCell className="text-[13px] text-muted-foreground">{r.atomicCategory}</TableCell>
              <TableCell className="text-[13px] text-muted-foreground">
                {r.atomicSubcategory}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

function StoreConfigTable({ rows }: { rows: StoreConfigOption[] }) {
  return (
    <SectionCard title={`Store onboarding rules · ${rows.length}`} bodyClassName="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Group</TableHead>
            <TableHead>Option</TableHead>
            <TableHead>Stage</TableHead>
            <TableHead>Behaviour</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="h-12">
              <TableCell className="text-[12px] text-muted-foreground">
                {r.storeAttributeGroup}
              </TableCell>
              <TableCell className="text-[13px] font-medium">{r.optionValue}</TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {r.collectionStage}
              </TableCell>
              <TableCell className="max-w-[22rem] truncate text-[12px] text-muted-foreground" title={r.behaviorNote}>
                {r.behaviorNote}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}

function SampleTable({ rows }: { rows: FoodSampleMenuItem[] }) {
  return (
    <SectionCard title={`Sample dishes · ${rows.length}`} bodyClassName="p-0">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dish</TableHead>
            <TableHead>Sub-category</TableHead>
            <TableHead>Diet</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Bucket</TableHead>
            <TableHead>Cuisine</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className="h-12">
              <TableCell className="text-[13px] font-medium">
                {r.dishName}
                <span className="num block text-[11px] text-muted-foreground">{r.id}</span>
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {r.atomicSubcategory}
              </TableCell>
              <TableCell className="text-[12px] text-muted-foreground">
                {r.dietaryPreference}
              </TableCell>
              <TableCell className="num text-[12px]">{money(r.basePriceInr)}</TableCell>
              <TableCell className="text-[12px] text-muted-foreground">{r.autoPriceBucket}</TableCell>
              <TableCell className="text-[12px] text-muted-foreground">{r.cuisineOrigin}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </SectionCard>
  );
}
