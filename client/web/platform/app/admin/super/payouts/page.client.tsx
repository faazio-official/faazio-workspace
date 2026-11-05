"use client";
import { DeliveryPayoutBoard } from "@/components/delivery/DeliveryPayoutBoard";
import { SellerPayoutBoard } from "@/components/payouts/SellerPayoutBoard";

export default function SuperAdminManualPayouts() {
  return (
    <div className="space-y-6">
      <SellerPayoutBoard scope="SUPER" />
      <DeliveryPayoutBoard scope="SUPER" />
    </div>
  );
}