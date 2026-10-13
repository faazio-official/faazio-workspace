"use client";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { DataShell, EmptyState } from "@/components/patterns/DataState";
import { FilterChip } from "@/components/patterns/FilterChip";
import { StatusPill } from "@/components/patterns/Pills";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatINR, parseRupeesToPaisa } from "@/lib/format";
import { deleteMenu, setMenuStatus, upsertMenu, type MenuDto } from "@/lib/api";
import { useMenus, useMockLoading } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import type { MenuItemRecord, ProductStatus } from "@/data/types";

const STATUSES: (ProductStatus | "ALL")[] = ["ALL", "DRAFT", "PENDING_REVIEW", "ACTIVE", "DELISTED"];

interface FormState {
  venueId: string;
  dishId: string;
  name: string;
  price: string;
  isVeg: boolean;
  cuisine: string;
  image: string;
}

function emptyForm(): FormState {
  return { venueId: "", dishId: "", name: "", price: "", isVeg: true, cuisine: "", image: "" };
}

function toForm(m: MenuItemRecord): FormState {
  return {
    venueId: m.venueId,
    dishId: m.dishId,
    name: m.name,
    price: String(m.pricePaisa / 100),
    isVeg: m.isVeg ?? true,
    cuisine: m.cuisine ?? "",
    image: m.image ?? "",
  };
}

function SellerMenus() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const loading = useMockLoading();
  const [status, setStatus] = useState<ProductStatus | "ALL">("ALL");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MenuItemRecord | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  const menus = useMenus({ sellerId, status }).filter((m) => {
    if (!query) return true;
    const q = query.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.dishId.toLowerCase().includes(q);
  });

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(m: MenuItemRecord) {
    setEditing(m);
    setForm(toForm(m));
    setOpen(true);
  }

  function save() {
    const pricePaisa = parseRupeesToPaisa(form.price);
    if (!form.venueId.trim() || !form.dishId.trim() || !form.name.trim() || pricePaisa < 0) {
      toast.error("Venue, dish id, name and a non-negative price are required");
      return;
    }
    const dto: MenuDto = {
      venueId: form.venueId.trim(),
      dishId: form.dishId.trim(),
      name: form.name.trim(),
      pricePaisa,
      isVeg: form.isVeg,
      cuisine: form.cuisine.trim(),
      image: form.image.trim(),
      sellerId,
    };
    upsertMenu(dto);
    toast.success(editing ? `Dish ${dto.dishId} updated` : `Dish ${dto.dishId} created`);
    setOpen(false);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Menu"
        description="Dishes are per venue. Submit a dish for review, then state admins make it live."
        actions={
          <Button size="sm" onClick={openCreate}>
            Add dish
          </Button>
        }
      />

      <SectionCard bodyClassName="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search dish name or id"
            className="max-w-xs"
          />
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((option) => (
              <FilterChip
                key={option}
                label={option}
                active={status === option}
                onClick={() => setStatus(option)}
              />
            ))}
          </div>
        </div>
        <DataShell
          loading={loading}
          isEmpty={menus.length === 0}
          empty={
            <EmptyState
              title="No dishes"
              description="Add a dish or switch the status filter to see more."
            />
          }
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Dish</TableHead>
                <TableHead>Venue</TableHead>
                <TableHead>Cuisine</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {menus.map((m) => (
                <TableRow key={`${m.venueId}:${m.dishId}`} className="h-12">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`size-2 rounded-full ${m.isVeg ? "bg-success" : "bg-destructive"}`}
                      />
                      <span className="font-medium">{m.name}</span>
                      <span className="num text-[11px] text-muted-foreground">{m.dishId}</span>
                    </div>
                  </TableCell>
                  <TableCell className="num text-muted-foreground">{m.venueId}</TableCell>
                  <TableCell className="text-muted-foreground">{m.cuisine ?? "—"}</TableCell>
                  <TableCell className="num text-right font-medium">{formatINR(m.pricePaisa)}</TableCell>
                  <TableCell>
                    <StatusPill status={m.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit(m)}>
                        Edit
                      </Button>
                      {m.status === "DRAFT" || m.status === "DELISTED" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMenuStatus(m.venueId, m.dishId, "PENDING_REVIEW");
                            toast.success(`${m.name} submitted for review`);
                          }}
                        >
                          Submit
                        </Button>
                      ) : null}
                      {m.status === "ACTIVE" || m.status === "PENDING_REVIEW" ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setMenuStatus(m.venueId, m.dishId, "DELISTED");
                            toast.success(`${m.name} delisted`);
                          }}
                        >
                          Delist
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive"
                        onClick={() => {
                          deleteMenu(m.venueId, m.dishId);
                          toast.success(`${m.name} removed`);
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DataShell>
      </SectionCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit dish" : "Add dish"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="venueId">Venue id</Label>
              <Input
                id="venueId"
                className="num"
                value={form.venueId}
                disabled={editing !== null}
                onChange={(e) => setForm({ ...form, venueId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dishId">Dish id</Label>
              <Input
                id="dishId"
                className="num"
                value={form.dishId}
                disabled={editing !== null}
                onChange={(e) => setForm({ ...form, dishId: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="name">Dish name</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="price">Price (₹)</Label>
              <Input
                id="price"
                className="num"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cuisine">Cuisine</Label>
              <Input
                id="cuisine"
                value={form.cuisine}
                onChange={(e) => setForm({ ...form, cuisine: e.target.value })}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="image">Image URL</Label>
              <Input
                id="image"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <Switch
                id="isVeg"
                checked={form.isVeg}
                onCheckedChange={(checked) => setForm({ ...form, isVeg: checked })}
              />
              <Label htmlFor="isVeg">Vegetarian</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>{editing ? "Save changes" : "Create dish"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SellerMenus;