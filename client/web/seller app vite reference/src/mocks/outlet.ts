export interface Slot {
  from: string;
  to: string;
}
export interface DayTiming {
  day: string;
  open: boolean;
  slots: Slot[];
}

export const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export const timings: DayTiming[] = days.map((day) => ({
  day,
  open: true,
  slots: [
    { from: "12:00 AM", to: "12:30 AM" },
    { from: "11:30 AM", to: "11:59 PM" },
  ],
}));

export interface Occasion {
  id: string;
  name: string;
  date: string;
  status?: "open" | "closed";
}

export const upcomingOccasions: Occasion[] = [
  { id: "o1", name: "Diwali", date: "08 Nov, 2026" },
  { id: "o2", name: "Guru Nanak Jayanti", date: "24 Nov, 2026" },
  { id: "o3", name: "Christmas", date: "25 Dec, 2026" },
  { id: "o4", name: "New Year's Eve", date: "31 Dec, 2026" },
];

export interface Staff {
  id: string;
  name: string;
  phone: string;
  role: "Owner" | "Manager" | "Staff";
}

export const staff: Staff[] = [
  { id: "s1", name: "Bangalore Juicy and Foods", phone: "+91 8015034866", role: "Owner" },
];

export const contacts = {
  orderReminder: ["+91 8015034866"],
  restaurantPage: ["+91 8015034866"],
};

export const scheduleOffReasons = [
  "Renovation or relocation of restaurant",
  "Closed due to festival",
  "Personal emergency",
  "Staff availability issues",
  "Going out of station",
  "Closed due to LPG shortage",
  "Other",
];

export const rushDurations = ["30 minutes", "1 hour", "1 hour 30 minutes", "2 hours"];
