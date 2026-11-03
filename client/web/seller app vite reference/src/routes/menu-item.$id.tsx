import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ImageIcon, Trash2 } from "lucide-react";
import { MobileFrame } from "@/components/app/shells";
import { PageHeader, TextField, PrimaryButton, inr, EmptyState } from "@/components/app/kit";
import { useApp, actions, getState, stockLabel } from "@/store/app-store";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/menu-item/$id")({
  validateSearch: (s: Record<string, unknown>): { view?: boolean } => (s.view === true || s.view === "true" ? { view: true } : {}),
  head: () => ({ meta: [{ title: "Menu item — Restaurant Partner" }, { name: "description", content: "Edit a menu item." }, { property: "og:title", content: "Menu item" }, { property: "og:description", content: "Edit a menu item." }] }),
  component: ItemEditor,
});

function ItemEditor() {
  const { id } = Route.useParams();
  const { view } = Route.useSearch();
  const navigate = useNavigate();
  const cats = useApp((s) => s.categories);
  const isNew = id === "new";
  const found = cats.flatMap((c) => c.items.map((i) => ({ i, c }))).find((x) => x.i.id === id);
  const [name, setName] = useState(found?.i.name ?? "");
  const [price, setPrice] = useState(String(found?.i.price ?? ""));
  const [desc, setDesc] = useState(found?.i.description ?? "");
  const [veg, setVeg] = useState(found?.i.veg ?? true);
  const [cat, setCat] = useState(found?.c.id ?? cats[0]?.id);
  const [image, setImage] = useState<string | undefined>(found?.i.image);

  if (!isNew && !found) return <MobileFrame><PageHeader title="Item" /><EmptyState text="Item not found" /></MobileFrame>;

  if (view && found) {
    return (
      <MobileFrame>
        <PageHeader title={found.i.name} sub={found.c.name} />
        <div className="space-y-3 p-4">
          <div className="flex aspect-video items-center justify-center rounded-2xl bg-muted">{found.i.image ? <img src={found.i.image} alt={found.i.name} className="h-full w-full rounded-2xl object-cover" /> : <ImageIcon className="h-10 w-10 text-muted-foreground" />}</div>
          <p className="text-lg font-bold">{inr(found.i.price)}</p>
          <p className="text-sm text-muted-foreground">{found.i.description || "No description added"}</p>
          <p className="text-xs">Status: <b>{stockLabel(found.i.stock)}</b></p>
          <PrimaryButton className="w-full" onClick={() => navigate({ to: "/menu-item/$id", params: { id }, search: {} })}>Edit item</PrimaryButton>
        </div>
      </MobileFrame>
    );
  }

  const save = () => {
    if (!name.trim() || !price) return toast.error("Name and price are required");
    if (isNew) {
      actions.addItem(cat!, { id: "i" + Date.now(), name: name.trim(), price: +price, description: desc, veg, image, stock: { type: "in" } });
      toast.success("Item added — it will be live after review");
    } else {
      actions.updateItem(id, { name: name.trim(), price: +price, description: desc, veg, image });
      toast.success("Changes saved");
    }
    navigate({ to: "/menu" });
  };

  return (
    <MobileFrame>
      <PageHeader title={isNew ? "Add new item" : "Edit item"} right={!isNew ? <button aria-label="Delete item" onClick={() => { actions.deleteItem(id); toast("Item deleted"); navigate({ to: "/menu" }); }}><Trash2 className="h-5 w-5 text-brand" /></button> : undefined} />
      <div className="p-4 pb-28">
        <label className="mb-3 flex aspect-video cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted text-xs text-muted-foreground">
          {image ? <img src={image} alt="Item" className="h-full w-full object-cover" /> : <><ImageIcon className="mb-1 h-8 w-8" />Add item image</>}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) setImage(URL.createObjectURL(f)); }} />
        </label>
        <TextField label="Item name" value={name} onChange={setName} />
        <TextField label="Price (₹)" type="number" value={price} onChange={setPrice} />
        <label className="block py-2"><span className="mb-1 block text-xs font-medium text-muted-foreground">Description</span><textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} className="w-full rounded-xl border border-border px-3 py-2 text-sm outline-none focus:border-info" /></label>
        <label className="block py-2"><span className="mb-1 block text-xs font-medium text-muted-foreground">Category</span>
          <select value={cat} disabled={!isNew} onChange={(e) => setCat(e.target.value)} className="w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm">{getState().categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <div className="flex gap-2 py-2">
          {[true, false].map((v) => <button key={String(v)} onClick={() => setVeg(v)} className={cn("flex-1 rounded-xl border py-2 text-sm font-semibold", veg === v ? "border-foreground bg-foreground text-background" : "border-border")}>{v ? "Veg" : "Non-veg"}</button>)}
        </div>
      </div>
      <div className="fixed bottom-0 left-1/2 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-card p-3"><PrimaryButton className="w-full" onClick={save}>{isNew ? "Add item" : "Save changes"}</PrimaryButton></div>
    </MobileFrame>
  );
}
