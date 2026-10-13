// Provenance: reviews.reviews (review_id, product_id, rating, body, flagged, seller_reply)
import type { ReviewRecord } from "@/data/types";

export const REVIEWS: ReviewRecord[] = [
  {
    reviewId: "rev-1",
    productId: "md-1",
    sellerId: "sel-1",
    customerName: "Rohit Sharma",
    rating: 5,
    body: "Battery lasts the full week, calls are clear.",
    flagged: false,
    sellerReply: "Thanks Rohit, glad it works for you.",
    createdAt: "2026-09-02T10:00:00.000Z",
  },
  {
    reviewId: "rev-2",
    productId: "fm-f1",
    sellerId: "sel-1",
    customerName: "Divya Iyer",
    rating: 2,
    body: "Left bud stopped charging in two weeks.",
    flagged: true,
    sellerReply: null,
    createdAt: "2026-09-08T14:20:00.000Z",
  },
  {
    reviewId: "rev-3",
    productId: "fm-m1",
    sellerId: "sel-1",
    customerName: "Neha Kulkarni",
    rating: 4,
    body: "Sealed box, delivered a day early.",
    flagged: false,
    sellerReply: null,
    createdAt: "2026-09-05T09:10:00.000Z",
  },
  {
    reviewId: "rev-4",
    productId: "ph-1",
    sellerId: "sel-4",
    customerName: "Sameer Khan",
    rating: 5,
    body: "Prescription check was quick and correct.",
    flagged: false,
    sellerReply: "Thank you for the note.",
    createdAt: "2026-09-11T18:00:00.000Z",
  },
];
