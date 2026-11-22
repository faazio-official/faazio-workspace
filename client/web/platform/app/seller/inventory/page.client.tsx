"use client";
// Sector router only. A Food shop gets the dish-availability + add-on surface; Mart/Pharmacy get
// unit-count stock with ETA. The two views are separate components so no restaurant state (veg
// marks, add-on links, menu status) ever reaches a retail shop, and vice versa.
import { useSellerScope } from "@/lib/api/hooks";
import { FoodInventoryView } from "@/components/sellers/inventory/food-view";
import { RetailStockInventoryView } from "@/components/sellers/inventory/retail-view";

function SellerInventory() {
  const { sellerId, storeId, activeStore } = useSellerScope();

  if (activeStore?.sector === "FOOD") {
    return <FoodInventoryView sellerId={sellerId} storeId={storeId} />;
  }
  return (
    <RetailStockInventoryView
      sellerId={sellerId}
      storeId={storeId}
      sector={activeStore?.sector ?? "MART"}
      restockQty={activeStore?.restockQty}
      restockEtaMinutes={activeStore?.restockEtaMinutes}
    />
  );
}

export default SellerInventory;
