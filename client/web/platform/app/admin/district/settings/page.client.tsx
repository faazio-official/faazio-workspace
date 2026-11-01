"use client";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Label } from "@/components/ui/label";
import { ThemeSegmentedControl } from "@/components/layout/ThemeToggle";
import { useSession } from "@/lib/hooks/useSession";
import { districtName, stateForDistrict } from "@/data/districts";

/**
 * District console settings. Scoped to what a district admin controls: the
 * district they operate in, and their own display preferences. Platform-wide
 * values stay in the super admin console.
 */
function DistrictSettings() {
  const session = useSession();
  const code = session?.districtCode ?? "";

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Your district scope and how the console looks on this device."
      />

      <SectionCard title="District scope" description="Set by the super admin, not editable here">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>District</Label>
            <p className="text-[13px] text-foreground">
              {code ? `${code} · ${districtName(code)}` : "Not assigned"}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label>State</Label>
            <p className="text-[13px] text-foreground">
              {code ? stateForDistrict(code) : "Not assigned"}
            </p>
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Appearance"
        description="Applies to this browser, on every console you sign in to"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <Label>Theme</Label>
            <p className="mt-0.5 text-[12px] text-muted-foreground">
              Auto follows your device&apos;s light or dark setting.
            </p>
          </div>
          <ThemeSegmentedControl />
        </div>
      </SectionCard>
    </div>
  );
}

export default DistrictSettings;
