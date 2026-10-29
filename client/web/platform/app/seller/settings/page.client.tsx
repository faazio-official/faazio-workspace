"use client";
import { toast } from "sonner";
import { PageHeader } from "@/components/patterns/PageHeader";
import { SectionCard } from "@/components/patterns/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getBankAccount } from "@/lib/api";
import { useSeller } from "@/lib/api/hooks";
import { useSession } from "@/lib/hooks/useSession";
import { ComponentHelp } from "@/components/patterns/ComponentHelp";

function SellerSettings() {
  const session = useSession();
  const sellerId = session?.sellerId ?? "sel-1";
  const seller = useSeller(sellerId);
  const bank = getBankAccount(sellerId);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        description="Profile changes that affect KYC need admin re-verification."
      />

      <Tabs defaultValue="profile">
        <div className="flex items-center gap-1.5">
          <TabsList>
            <TabsTrigger value="profile">Profile</TabsTrigger>
            <TabsTrigger value="bank">Bank</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="users">Sub-users</TabsTrigger>
          </TabsList>
          <ComponentHelp id="profile-tabs" />
        </div>

        <TabsContent value="profile" className="mt-4">
          <SectionCard title="Business profile">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Business name" value={seller?.businessName ?? ""} />
              <Field label="Owner name" value={seller?.ownerName ?? ""} />
              <Field label="GSTIN" value={seller?.gstin ?? ""} />
              <Field label="PAN" value={seller?.pan ?? ""} />
              <Field label="Contact phone" value={seller?.contactPhone ?? ""} />
              <Field label="Registered address" value={seller?.businessAddress ?? ""} />
            </div>
            <div className="mt-4 flex justify-end">
              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  onClick={() => toast.success("Profile change sent for verification")}
                >
                  Request update
                </Button>
                <ComponentHelp id="request-update-button" />
              </div>
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="bank" className="mt-4">
          <SectionCard title="Settlement bank account" description="Payouts land in this account">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Beneficiary" value={bank?.beneficiaryName ?? "Not added"} />
              <Field label="Account number" value={bank?.accountNumberMasked ?? "Not added"} />
              <Field label="IFSC" value={bank?.ifsc ?? "Not added"} />
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="notifications" className="mt-4">
          <SectionCard title="Notifications" actions={<ComponentHelp id="notify-switches" />}>
            <div className="space-y-2">
              {[
                "New order alerts",
                "Low stock alerts",
                "SLA breach warnings",
                "Festival campaign news",
              ].map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2"
                >
                  <Label htmlFor={label}>{label}</Label>
                  <Switch id={label} defaultChecked />
                </div>
              ))}
            </div>
          </SectionCard>
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <SectionCard
            title="Sub-users"
            description="Give staff limited access to orders and inventory"
          >
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="sub-name">Name</Label>
                <Input id="sub-name" placeholder="Staff name" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="sub-email">Email</Label>
                  <ComponentHelp id="sub-user-email-input" />
                </div>
                <Input id="sub-email" placeholder="staff@example.com" />
              </div>
              <div className="flex items-end">
                <div className="flex items-center gap-1.5">
                  <Button size="sm" onClick={() => toast.success("Invite queued")}>
                    Invite
                  </Button>
                  <ComponentHelp id="invite-button" />
                </div>
              </div>
            </div>
          </SectionCard>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input defaultValue={value} />
    </div>
  );
}

export default SellerSettings;
