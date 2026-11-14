export interface ZoneLandmark {
  name: string;
  x: number;
  y: number;
  kind: "town" | "restaurant" | "park";
}

export interface DeliveryZone {
  id: string;
  name: string;
  district: string;
  boundary: [number, number][];
  rider: { x: number; y: number };
  activeRestaurants: number;
  demand: string;
  landmarks: ZoneLandmark[];
  roads: string[];
}

// Illustrative local coordinates, not GPS or a surveyed service boundary.
export const assignedZone: DeliveryZone = {
  id: "karaikal-central",
  name: "Karaikal Central",
  district: "Karaikal, Puducherry",
  boundary: [[180, 285], [440, 245], [602, 350], [648, 570], [617, 785], [560, 1090], [320, 1160], [165, 980], [115, 695], [140, 460]],
  rider: { x: 405, y: 743 },
  activeRestaurants: 18,
  demand: "Steady demand",
  landmarks: [
    { name: "KOTTUCHERRY", x: 330, y: 380, kind: "town" },
    { name: "KARAIKAL", x: 380, y: 675, kind: "town" },
    { name: "AKKARAIVATTAM", x: 365, y: 1030, kind: "town" },
    { name: "Thalatheru", x: 220, y: 525, kind: "town" },
    { name: "Neravy", x: 165, y: 1195, kind: "town" },
    { name: "Beach Road", x: 585, y: 870, kind: "town" },
    { name: "Lunch Box", x: 290, y: 780, kind: "restaurant" },
    { name: "City Kitchen", x: 485, y: 570, kind: "restaurant" },
    { name: "Green park", x: 185, y: 850, kind: "park" },
  ],
  roads: [
    "M290 0 C310 240 275 450 340 630 S420 1080 360 1500",
    "M0 680 C220 620 440 700 697 665",
    "M0 1040 C200 965 430 970 657 995",
    "M100 0 C145 380 85 780 150 1500",
    "M530 0 C460 350 590 740 500 1500",
    "M0 330 L660 470", "M0 500 L700 565", "M0 830 L680 810",
    "M0 1200 L660 1160", "M0 1380 L615 1300",
    "M220 0 L230 1500", "M420 0 L445 1500", "M605 0 L580 1500",
  ],
};