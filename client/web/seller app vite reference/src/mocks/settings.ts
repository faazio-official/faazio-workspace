export const appSettings = {
  swipeToReady: true,
  autoKot: false,
  paperSize: "3 inch (80mm)",
  floatingCount: false,
};

export const paperSizes = ["2 inch (58mm)", "3 inch (80mm)"];

export const communications = {
  whatsapp: true,
  dailyWhatsapp: false,
  dailyEmail: false,
  weeklyWhatsapp: true,
  weeklyEmail: false,
  orderNotifications: true,
  ringVolume: 70,
  ringSilent: false,
  liveComplaints: true,
  liveComplaintsWhatsapp: false,
  emails: [] as string[],
};

export const deliverySettings = {
  selfDelivery: false,
  packagingCharge: 10,
  minOrder: 99,
  radiusKm: 6,
};
