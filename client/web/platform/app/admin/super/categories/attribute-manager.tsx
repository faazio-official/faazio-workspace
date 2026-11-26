"use client";
// Superadmin facet-tag manager. A facet group (Patty, Cheese Type, Bun, Dosa Style) is NOT a
// sub-category — it is metadata attached to one leaf sub-category, authored here and applied by
// sellers as optional chips on a dish. Everything is a full replace: the sheet loads the current
// groups, edits locally, and saves them back in one call (ids are preserved so dish tags survive).
import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  fetchSubcategoryAttributes,
  replaceSubcategoryAttributes,
  type CategoryRow,
  type MenuAttributeGroupInput,
} from "@/lib/api";
import { cn } from "@/lib/utils";

interface OptionRow {
  key: string;
  id?: string;
  label: string;
  /** Tamil display label (0141); blank = fall back to the English label. */
  nameTa: string;
  parentFilterTab: string;
  iconUrl: string;
  /** Comma-separated auto-tag keywords, e.g. "peri peri, peri-peri". */
  keywords: string;
}

interface GroupRow {
  key: string;
  id?: string;
  slug: string;
  displayName: string;
  /** Tamil display name (0141); blank = fall back to the English name. */
  nameTa: string;
  inputType: "single_select" | "multi_select";
  options: OptionRow[];
}

let seq = 0;
function nextKey(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

function newOption(): OptionRow {
  return {
    key: nextKey("opt"),
    label: "",
    nameTa: "",
    parentFilterTab: "",
    iconUrl: "",
    keywords: "",
  };
}

function newGroup(): GroupRow {
  return {
    key: nextKey("grp"),
    slug: "",
    displayName: "",
    nameTa: "",
    inputType: "multi_select",
    options: [newOption()],
  };
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function AttributeManagerSheet({
  category,
  onClose,
}: {
  category: CategoryRow | null;
  onClose: () => void;
}) {
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!category) {
      setGroups([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchSubcategoryAttributes(category.id)
      .then((rows) => {
        if (cancelled) return;
        setGroups(
          rows.map((g) => ({
            key: nextKey("grp"),
            id: g.id,
            slug: g.slug,
            displayName: g.displayName,
            nameTa: g.nameTa ?? "",
            inputType: g.inputType,
            options: g.options.map((o) => ({
              key: nextKey("opt"),
              id: o.id,
              label: o.label,
              nameTa: o.nameTa ?? "",
              parentFilterTab: o.parentFilterTab ?? "",
              iconUrl: o.iconUrl ?? "",
              keywords: (o.keywords ?? []).join(", "),
            })),
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [category]);

  if (!category) return null;

  function updateGroup(key: string, patch: Partial<GroupRow>) {
    setGroups((prev) => prev.map((g) => (g.key === key ? { ...g, ...patch } : g)));
  }

  function updateOption(groupKey: string, optionKey: string, patch: Partial<OptionRow>) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? { ...g, options: g.options.map((o) => (o.key === optionKey ? { ...o, ...patch } : o)) }
          : g,
      ),
    );
  }

  function addOption(groupKey: string) {
    setGroups((prev) =>
      prev.map((g) => (g.key === groupKey ? { ...g, options: [...g.options, newOption()] } : g)),
    );
  }

  function removeOption(groupKey: string, optionKey: string) {
    setGroups((prev) =>
      prev.map((g) =>
        g.key === groupKey
          ? { ...g, options: g.options.filter((o) => o.key !== optionKey) }
          : g,
      ),
    );
  }

  async function save() {
    const payload: MenuAttributeGroupInput[] = [];
    for (const g of groups) {
      const displayName = g.displayName.trim();
      if (!displayName) {
        toast.error("Every attribute group needs a name.");
        return;
      }
      const options = g.options
        .filter((o) => o.label.trim())
        .map((o) => ({
          ...(o.id ? { id: o.id } : {}),
          label: o.label.trim(),
          ...(o.nameTa.trim() ? { nameTa: o.nameTa.trim() } : {}),
          ...(o.parentFilterTab.trim() ? { parentFilterTab: o.parentFilterTab.trim() } : {}),
          ...(o.iconUrl.trim() ? { iconUrl: o.iconUrl.trim() } : {}),
          keywords: o.keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
        }));
      payload.push({
        ...(g.id ? { id: g.id } : {}),
        slug: g.slug.trim() || slugify(displayName),
        displayName,
        ...(g.nameTa.trim() ? { nameTa: g.nameTa.trim() } : {}),
        inputType: g.inputType,
        options,
      });
    }
    setSaving(true);
    try {
      const saved = await replaceSubcategoryAttributes(category!.id, payload);
      setGroups(
        saved.map((g) => ({
          key: nextKey("grp"),
          id: g.id,
          slug: g.slug,
          displayName: g.displayName,
          nameTa: g.nameTa ?? "",
          inputType: g.inputType,
          options: g.options.map((o) => ({
            key: nextKey("opt"),
            id: o.id,
            label: o.label,
            nameTa: o.nameTa ?? "",
            parentFilterTab: o.parentFilterTab ?? "",
            iconUrl: o.iconUrl ?? "",
            keywords: (o.keywords ?? []).join(", "),
          })),
        })),
      );
      toast.success("Filter tags saved");
    } catch (err) {
      toast.error("Could not save the filter tags", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={Boolean(category)} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-2xl lg:max-w-3xl">
        <SheetHeader>
          <SheetTitle>Filter tags · {category.name}</SheetTitle>
          <SheetDescription>
            Category-specific facets sellers apply to a dish (e.g. Patty, Cheese Type, Bun). These are
            separate from the category tree so they never create duplicate sub-categories. Keywords
            power the seller form&apos;s auto-tagger; every tag stays optional.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-4 pb-8">
          {loading ? (
            <p className="text-[12px] text-muted-foreground">Loading filter tags…</p>
          ) : groups.length === 0 ? (
            <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-[12px] text-muted-foreground">
              No filter tags yet. Add a group below — for example “Patty”, then its options (Chicken,
              Paneer, Aloo).
            </p>
          ) : null}

          {groups.map((group) => (
            <div key={group.key} className="space-y-3 rounded-lg border border-border p-3">
              <div className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor={`${group.key}-name`}>Group name</Label>
                  <Input
                    id={`${group.key}-name`}
                    value={group.displayName}
                    onChange={(e) =>
                      updateGroup(group.key, {
                        displayName: e.target.value,
                        slug: group.slug || slugify(e.target.value),
                      })
                    }
                    placeholder="e.g. Patty"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive"
                  onClick={() => setGroups((prev) => prev.filter((g) => g.key !== group.key))}
                  aria-label={`Remove ${group.displayName || "group"}`}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`${group.key}-name-ta`}>Group name (Tamil)</Label>
                <Input
                  id={`${group.key}-name-ta`}
                  lang="ta"
                  value={group.nameTa}
                  onChange={(e) => updateGroup(group.key, { nameTa: e.target.value })}
                  placeholder="தமிழில் மட்டும்"
                />
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-40 flex-1 space-y-1.5">
                  <Label htmlFor={`${group.key}-slug`}>Slug</Label>
                  <Input
                    id={`${group.key}-slug`}
                    value={group.slug}
                    onChange={(e) => updateGroup(group.key, { slug: slugify(e.target.value) })}
                    placeholder="patty"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`${group.key}-type`}>Selection</Label>
                  <select
                    id={`${group.key}-type`}
                    value={group.inputType}
                    onChange={(e) =>
                      updateGroup(group.key, {
                        inputType: e.target.value as GroupRow["inputType"],
                      })
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="multi_select">Pick many</option>
                    <option value="single_select">Pick one</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[12px] font-medium">Options</p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => addOption(group.key)}
                  >
                    <Plus className="size-3.5" /> Option
                  </Button>
                </div>
                {group.options.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground">No options yet.</p>
                ) : (
                  group.options.map((o) => (
                    <div key={o.key} className="space-y-2 rounded-md border border-border p-2.5">
                      <div className="flex items-end gap-2">
                        <div className="flex-1 space-y-1.5">
                          <Label htmlFor={`${o.key}-label`}>Label</Label>
                          <Input
                            id={`${o.key}-label`}
                            value={o.label}
                            onChange={(e) =>
                              updateOption(group.key, o.key, { label: e.target.value })
                            }
                            placeholder="Chicken"
                          />
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive"
                          onClick={() => removeOption(group.key, o.key)}
                          aria-label={`Remove ${o.label || "option"}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${o.key}-label-ta`}>Label (Tamil)</Label>
                        <Input
                          id={`${o.key}-label-ta`}
                          lang="ta"
                          value={o.nameTa}
                          onChange={(e) =>
                            updateOption(group.key, o.key, { nameTa: e.target.value })
                          }
                          placeholder="தமிழில் மட்டும்"
                        />
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="space-y-1.5">
                          <Label htmlFor={`${o.key}-tab`}>Filter tab (optional)</Label>
                          <Input
                            id={`${o.key}-tab`}
                            value={o.parentFilterTab}
                            onChange={(e) =>
                              updateOption(group.key, o.key, { parentFilterTab: e.target.value })
                            }
                            placeholder="Chicken"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`${o.key}-icon`}>Icon URL (optional)</Label>
                          <Input
                            id={`${o.key}-icon`}
                            value={o.iconUrl}
                            onChange={(e) =>
                              updateOption(group.key, o.key, { iconUrl: e.target.value })
                            }
                            placeholder="https://…"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor={`${o.key}-keywords`}>Auto-tag keywords (comma separated)</Label>
                        <Input
                          id={`${o.key}-keywords`}
                          value={o.keywords}
                          onChange={(e) =>
                            updateOption(group.key, o.key, { keywords: e.target.value })
                          }
                          placeholder="peri peri, peri-peri"
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="gap-1.5" onClick={() => setGroups((p) => [...p, newGroup()])}>
              <Plus className="size-3.5" /> Add group
            </Button>
            <span className={cn("text-[11px] text-muted-foreground", groups.length === 0 && "hidden")}>
              Tags are preserved across saves when their ids are unchanged.
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
              <Button disabled={saving || loading} onClick={() => void save()}>
                {saving ? "Saving…" : "Save filter tags"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
