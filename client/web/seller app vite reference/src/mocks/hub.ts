export const salesSummary = {
  range: "Yesterday • 31 Oct 26",
  compared: "Compared against 24 Oct'26",
  netSales: 530,
  netSalesDelta: "↓ 45%",
  ordersDelivered: 2,
  ordersDelta: "↓ 50%",
  aov: 265,
  aovDelta: "↑ 17%",
  hourly: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
};

export const mealtimes = [
  { name: "Breakfast", time: "7:00 am - 11:00 am", orders: 0, delta: "0%" },
  { name: "Lunch", time: "11:00 am - 3:00 pm", orders: 0, delta: "0%" },
  { name: "Evening snacks", time: "3:00 pm - 7:00 pm", orders: 0, delta: "↓ 100%" },
  { name: "Dinner", time: "7:00 pm - 11:00 pm", orders: 1, delta: "↓ 50%" },
  { name: "Late night", time: "11:00 pm - 7:00 am", orders: 1, delta: "↑ 100%" },
];

export const helpTopics = ["Manage outlets", "Offers and ads", "Payouts", "See all options"];

export const funnel = [
  { label: "Menu opens", value: 142, delta: "↓ 12%" },
  { label: "Cart builds", value: 21, delta: "↓ 8%" },
  { label: "Orders placed", value: 2, delta: "↓ 50%" },
];

export const serviceQuality = [
  { label: "Rejected orders", value: "0%", good: true },
  { label: "Avg. kitchen prep time", value: "9 mins", good: true },
  { label: "Order ready accuracy", value: "72%", good: false },
  { label: "Complaints", value: "0", good: true },
];

export const kitchenMetrics = [
  { label: "Food prep time (KPT)", value: "8.6 mins" },
  { label: "Delayed orders", value: "1" },
  { label: "Rider wait time", value: "3.2 mins" },
];

export const menuScore = {
  label: "Poor",
  score: 29,
  imagesPct: 29,
  descPct: 40,
  tasks: [
    { title: "Add images to items", sub: "78 items are missing images" },
    { title: "Add item descriptions", sub: "66 items are missing descriptions" },
  ],
};
