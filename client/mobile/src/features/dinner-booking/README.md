# Dinner Booking Module (Seat Reservations)

Seat-based reservations for Food dining venues: a restaurant opts in (web `seller/bookings/settings`),
sets one number (`total_seats`) and a ₹50/seat platform fee is held on request, captured on accept and
refunded on reject/cancel. No slots, no tables.

## Key Files
- `BookingSheet.tsx`: bottom sheet opened from the Food restaurant profile ("Reserve seats • ₹50/seat").
  Seat stepper → N × ₹50 total → `gateway.createBooking` (server-derived fee + Razorpay order) → pending tracker.
- `MyBookingsScreen.tsx`: the caller's reservations with the fixed rejection line + cancel/refund.

## Rules
- The client never sets the fee (server constant × seats) and never sees seat totals/remaining —
  only `{bookable, feePerSeat, timingLabel, openNow}` from `getBookingAvailability`.
- A rejection shows one fixed line: "Restaurant couldn't accommodate — likely limited seats. Refund initiated."
- Payment runs through `services/payments/checkout.ts` (`PaymentCheckout`). It ships a **mock adapter**:
  the sheet receives the server Razorpay order, calls `open()` (synthetic `pay_mock_…` id) and records it
  via `attachBookingPayment`. Production installs `react-native-razorpay`, implements an adapter and
  registers it with `setPaymentCheckout()` — `BookingSheet` is unchanged.
