// Faazio Mongo seed — generated. Upserts the ID-only Home layout, the user_events TTL index,
// and the defence-in-depth validators for the four MVP collections. `segments` stays Future Prod.
db = db.getSiblingDB(process.env.MONGO_DATABASE || "faazio");
db.sdui_layouts.replaceOne({ _id: "home" }, {"_id":"home","version":1,"locale":"en","updatedAt":"2026-01-01T00:00:00.000Z","sections":[{"id":"martHero","title":"Mart Highlights","subtitle":null,"accent":"#F25C3D","productIds":[],"storeIds":[],"chips":[],"banners":[{"id":"hb-1","title":"Big Savings Everyday","subtitle":"UP TO 50% OFF","accent":"#FFF8D6","imageUrl":"https://images.unsplash.com/photo-1542838132-92c53300491e?fm=jpg&fit=crop&q=80&w=400&h=400"},{"id":"hb-2","title":"Fresh Groceries Doorstep","subtitle":"FREE DELIVERY","accent":"#E8F5E9","imageUrl":"https://images.unsplash.com/photo-1579113800032-c38bd1625818?fm=jpg&fit=crop&q=80&w=400&h=400"},{"id":"hb-3","title":"Electronics Mega Sale","subtitle":"FLAT 40% OFF","accent":"#FFF3E0","imageUrl":"https://images.unsplash.com/photo-1498050108023-c5249f4df085?fm=jpg&fit=crop&q=80&w=400&h=400"}]},{"id":"adBanner","title":"Offers","subtitle":null,"accent":"#111827","productIds":[],"storeIds":[],"chips":[]},{"id":"diningSpecials","title":"Today's Special","subtitle":null,"accent":"#1E5D44","productIds":[],"storeIds":["store-f1","store-f2","store-f3","store-f4","store-f5","store-f6","store-f7","store-f8","store-f9","store-f10","store-f11","store-f12"],"chips":[]},{"id":"hotBrandDeals","title":"Deals of the day","subtitle":null,"accent":"#1162D3","productIds":["hbd-1","hbd-2","hbd-3","hbd-4","hbd-5"],"storeIds":[],"chips":[]},{"id":"dealsOfDay","title":"Daily Essentials","subtitle":null,"accent":"#F25C3D","productIds":["md-1","md-2","md-3","md-4","md-5","md-6"],"storeIds":[],"chips":[]},{"id":"martDeals","title":"Deals of the Day","subtitle":null,"accent":"#F25C3D","productIds":["md-1","md-2","md-3","md-4","md-5","md-6"],"storeIds":[],"chips":[]},{"id":"martEssentials","title":"Daily Essentials","subtitle":null,"accent":"#0F766E","productIds":["gr-p3","gr-p4","gr-p5","gr-p6","gr-p7"],"storeIds":[],"chips":[]},{"id":"sponsoredRail","title":"Sponsored picks","subtitle":null,"accent":"#B45309","productIds":[],"storeIds":[],"chips":[]},{"id":"mostRatedDining","title":"Most Rated Dining","subtitle":null,"accent":"#1E5D44","productIds":[],"storeIds":["store-f1","store-f2","store-f3","store-f4","store-f5","store-f6","store-f7","store-f8","store-f9","store-f10","store-f11","store-f12"],"chips":[]},{"id":"recentlyViewedMart","title":"Recently Viewed — Mart","subtitle":null,"accent":"#1162D3","productIds":["rvm-1","rvm-2","rvm-3","rvm-4"],"storeIds":[],"chips":[]},{"id":"recentlyViewedFood","title":"Recently Viewed — Food","subtitle":null,"accent":"#1E5D44","productIds":["rvf-1","rvf-2","rvf-3"],"storeIds":[],"chips":[]},{"id":"recentlyViewedPharma","title":"Recently Viewed — Pharma","subtitle":null,"accent":"#065F46","productIds":["rvp-1","rvp-2","rvp-3"],"storeIds":[],"chips":[]},{"id":"nearbyOffers","title":"Nearby Offers","subtitle":null,"accent":"#111827","productIds":["nb-1","nb-2","nb-3","nb-4","nb-5","nb-6"],"storeIds":[],"chips":[]},{"id":"mens","title":"Men","subtitle":null,"accent":"#1162D3","productIds":["men-1","men-2","men-3","men-4","men-5","men-6"],"storeIds":[],"chips":[]},{"id":"womens","title":"Women","subtitle":null,"accent":"#1162D3","productIds":["wom-1","wom-2","wom-3","wom-4","wom-5","wom-6"],"storeIds":[],"chips":[]},{"id":"childrens","title":"Kids","subtitle":null,"accent":"#1162D3","productIds":["kid-1","kid-2","kid-3","kid-4","kid-5"],"storeIds":[],"chips":[]},{"id":"hairSkinCare","title":"Hair & Skin Care","subtitle":null,"accent":"#0F766E","productIds":["hs-1","hs-2","hs-3","hs-4","hs-5"],"storeIds":[],"chips":[]},{"id":"filterFeed","title":"Filter Feed","subtitle":null,"accent":"#8B5CF6","productIds":[],"storeIds":[],"chips":[{"id":"forYou","label":"For You","accent":"#8B5CF6","productIds":[]},{"id":"trendy","label":"Trendy","accent":"#8B5CF6","productIds":["men-1","hbd-1","rvm-2"]},{"id":"fashion","label":"Fashion","accent":"#1162D3","productIds":["men-1","men-3","wom-2","kid-3"]},{"id":"homeAppliances","label":"Home Appliances","accent":"#1162D3","productIds":["hbd-2","rvm-4"]},{"id":"fastFood","label":"Fast Food","accent":"#C2410C","productIds":["lm-1","bf-1","bf-2"]},{"id":"snacks","label":"Snacks","accent":"#10B981","productIds":["rvg-4"]},{"id":"hotMeals","label":"Hot Meals","accent":"#C2410C","productIds":["m-seafood-ramen","m-chicken-rice","m-mushroom-soup","m-crispy-dumplings"]},{"id":"skincare","label":"Skincare","accent":"#0F766E","productIds":["hs-1","hs-4"]},{"id":"freshVeggies","label":"Fresh Veggies","accent":"#10B981","productIds":["nb-3","rvg-1"]},{"id":"coughSyrup","label":"Cough Syrup","accent":"#0F766E","productIds":["ph-c1","ph-c2","ph-c3"]}]}]}, { upsert: true });
db.user_events.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "user_events_ttl" });
// Reject junk at write time (the gateway handler already allowlists); keeps Atlas M0 bounded.
db.runCommand({
  collMod: "user_events",
  validator: { $jsonSchema: {
    bsonType: "object",
    required: ["userIdHash", "productId", "event", "at", "expiresAt"],
    properties: {
      userIdHash: { bsonType: "string" },
      productId: { bsonType: "string", maxLength: 64 },
      event: { enum: ["view", "cart_add", "order", "search"] },
      at: { bsonType: "date" },
      expiresAt: { bsonType: "date" }
    }
  } },
  validationLevel: "moderate",
  validationAction: "error"
});
// recommendations + product_stats are written by the Future Prod batch job; empty on the MVP.
// Validators are created lazily via collMod so the read path never has to create the collection.
for (const def of [
  { name: "recommendations", schema: {
    bsonType: "object",
    required: ["userIdHash", "productIds", "generatedAt"],
    properties: {
      userIdHash: { bsonType: "string" },
      productIds: { bsonType: "array", maxItems: 100, items: { bsonType: "string", maxLength: 64 } },
      generatedAt: { bsonType: "date" }
    } } },
  { name: "product_stats", schema: {
    bsonType: "object",
    required: ["productId", "score", "updatedAt"],
    properties: {
      productId: { bsonType: "string", maxLength: 64 },
      score: { bsonType: "double" },
      views: { bsonType: "long" },
      cartAdds: { bsonType: "long" },
      orders: { bsonType: "long" },
      updatedAt: { bsonType: "date" }
    } } },
]) {
  if (!db.getCollectionNames().includes(def.name)) db.createCollection(def.name);
  db.runCommand({ collMod: def.name, validator: { $jsonSchema: def.schema },
    validationLevel: "moderate", validationAction: "error" });
}
print("mongo seed: sdui_layouts=home version=" + 1 + " + 4 collections");
