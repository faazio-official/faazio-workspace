import { useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { historyOrders, incomingPool, partner as mockPartner, initialBookings, initialGigBookings, initialWalletBalance, vouchers, initialReferrals, referralOffer, inboxMessages, type VoucherPurchase, type Referral, type Order } from "@/mocks";
import { bookGigSelection, checkoutError, voucherTotal } from './commerce-rules';
import { toggleBooking, referralError } from "./operations-rules";
import { nextStatus } from "./rules";
import { PartnerContext, type PartnerState } from "./context";
export { itemTotal, grandTotal, earnings } from "./rules";

export const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function PartnerProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState([...initialBookings, ...initialGigBookings]);
  const [cart, setCart] = useState<string[]>([]);
  const [walletBalance, setWalletBalance] = useState(initialWalletBalance);
  const [voucherPurchases, setVoucherPurchases] = useState<VoucherPurchase[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>(initialReferrals);
  const [readMessages, setReadMessages] = useState<string[]>([]);
  const [disputes, setDisputes] = useState<{ id: string; orderId: string; reason: string }[]>([]);
  const [onlineSeconds, setOnlineSeconds] = useState(0);
  const [rejections, setRejections] = useState(0);
  const [loggedIn, setLoggedIn] = useState(true);
  const [onDuty, setOnDuty] = useState(true);
  const [orders, setOrders] = useState<Order[]>(historyOrders);
  const [offer, setOffer] = useState<Order | null>(null);
  const [poolIdx, setPoolIdx] = useState(0);
  const [delivered, setDelivered] = useState(mockPartner.delivered);
  const [checkedItems, setCheckedItems] = useState<Record<string, string[]>>({});

  useEffect(() => {
    if (!onDuty || !loggedIn) return;
    const timer = setInterval(() => setOnlineSeconds(value => value + 1), 1000);
    return () => clearInterval(timer);
  }, [onDuty, loggedIn]);
  const hasActive = orders.some((o) => o.status !== "delivered");
  useEffect(() => {
    if (!onDuty || offer || hasActive || !loggedIn) return;
    const t = setTimeout(() => {
      const base = incomingPool[poolIdx % incomingPool.length];
      if (!base) return;
      setOffer({ ...base, id: `${base.id}${poolIdx ? poolIdx : ""}`, status: "assigned", createdAt: new Date().toISOString() });
      setPoolIdx((i) => i + 1);
    }, 8000);
    return () => clearTimeout(t);
  }, [onDuty, offer, hasActive, loggedIn, poolIdx]);

  const value = useMemo<PartnerState>(() => ({
    bookGigs: ids => { const next = bookGigSelection(bookings, ids); if (!next) return false; setBookings(next); return true; },
    cart, walletBalance, voucherPurchases,
    addVoucher: id => { if (vouchers.some(voucher => voucher.id === id)) setCart(current => current.includes(id) ? current : [...current, id]); },
    removeVoucher: id => setCart(current => current.filter(value => value !== id)),
    checkoutVouchers: () => {
      const error = checkoutError(cart, walletBalance); if (error) return error;
      const purchases = cart.flatMap(id => { const voucher = vouchers.find(item => item.id === id); return voucher ? [{ id: crypto.randomUUID(), voucherId: id, brand: voucher.brand, code: `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, price: voucher.price }] : []; });
      setWalletBalance(current => Math.round((current - voucherTotal(cart)) * 100) / 100);
      setVoucherPurchases(current => [...purchases, ...current]); setCart([]); return null;
    },
    bookings, toggleShift: id => setBookings(current => toggleBooking(current, id)),
    referrals, invite: (name, phone, city) => {
      const error = referralError(referrals, name, phone, city, referralOffer.cities);
      if (error) return error;
      setReferrals(current => [{ id: crypto.randomUUID(), name: name.trim(), phone, city, status: 'Invited' }, ...current]);
      return null;
    },
    readMessages, markRead: id => { if (inboxMessages.some(message => message.id === id)) setReadMessages(current => current.includes(id) ? current : [...current, id]); },
    disputes, submitDispute: (orderId, reason) => {
      if (!orders.some(order => order.id === orderId) || reason.trim().length < 10) return false;
      setDisputes(current => [{ id: crypto.randomUUID(), orderId, reason: reason.trim() }, ...current]); return true;
    },
    onlineSeconds, rejections,
    loggedIn,
    login: (e, p) => { const ok = e.trim().toLowerCase() === mockPartner.email && p === mockPartner.password; if (ok) setLoggedIn(true); return ok; },
    logout: () => { setLoggedIn(false); setOffer(null); },
    onDuty, setOnDuty: (v) => { setOnDuty(v); if (!v) setOffer(null); },
    orders, offer,
    checkedItems,
    toggleItem: (id, name) => setCheckedItems((current) => { const items = current[id] ?? []; return { ...current, [id]: items.includes(name) ? items.filter((item) => item !== name) : [...items, name] }; }),
    acceptOffer: () => { if (offer) { setOrders((os) => [offer, ...os]); setOffer(null); } },
    rejectOffer: () => { setOffer(null); setRejections(value => value + 1); },
    advance: (id, pin = "", cashCollected = false) => {
      const cur = orders.find((o) => o.id === id);
      if (!cur) return false;
      const next = nextStatus(cur, checkedItems[id] ?? [], pin, cashCollected);
      if (!next) return false;
      if (next === "delivered") setDelivered((d) => d + 1);
      setOrders((os) => os.map((o) => (o.id === id ? { ...o, status: next } : o)));
      return true;
    },
    partner: { ...mockPartner, delivered },
  }), [loggedIn, onDuty, orders, offer, delivered, checkedItems, bookings, referrals, readMessages, disputes, onlineSeconds, rejections, cart, walletBalance, voucherPurchases]);
  return <PartnerContext.Provider value={value}>{children}</PartnerContext.Provider>;
}
export const usePartner = () => { const c = useContext(PartnerContext); if (!c) throw new Error("PartnerProvider missing"); return c; };
