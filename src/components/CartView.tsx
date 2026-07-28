import React, { useState } from 'react';
import { 
  ArrowRight, 
  MapPin, 
  Tag, 
  ChevronRight, 
  CreditCard, 
  CheckCircle, 
  Truck, 
  Check, 
  Ticket,
  ChevronLeft,
  Smartphone,
  Wallet,
  Coins,
  ShieldCheck,
  AlertCircle,
  ShoppingBag
} from 'lucide-react';
import EnterpriseIcon from './EnterpriseIcon';

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  emoji: string;
}

export const getAppLabel = (itemId: string) => {
  const id = itemId.toLowerCase();
  if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) {
    return { name: 'Fa Pharma', color: 'text-rose-500 bg-rose-50 border-rose-100', icon: '💊' };
  }
  if (id.startsWith('gr-') || id.includes('grocery') || id.startsWith('cat-gr') || id.startsWith('cat-fb')) {
    return { name: 'Faazio Grocery', color: 'text-emerald-600 bg-emerald-50 border-emerald-100', icon: '🥦' };
  }
  if (id.startsWith('fm-') || id.includes('mart') || id.startsWith('cat-mt') || id.startsWith('cat-mf')) {
    return { name: 'FA Mart', color: 'text-indigo-600 bg-indigo-50 border-indigo-100', icon: '🛍️' };
  }
  return { name: 'Food', color: 'text-amber-600 bg-amber-50 border-amber-100', icon: '🍔' };
};

interface CartViewProps {
  cartItems: CartItem[];
  setCartItems: React.Dispatch<React.SetStateAction<CartItem[]>>;
  updateCartQuantity: (id: string, delta: number) => void;
  setActiveTab: (tab: 'Home' | 'Categories' | 'Explore' | 'Account' | 'Cart') => void;
}

type CheckoutStep = 'BAG' | 'ADDRESS' | 'PAYMENT' | 'RECEIPT';

export default function CartView({ cartItems, setCartItems, updateCartQuantity, setActiveTab }: CartViewProps) {
  const [step, setStep] = useState<CheckoutStep>('BAG');
  
  // Fully active promo codes
  const [promoCode, setPromoCode] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Address choices
  const [addresses, setAddresses] = useState([
    { id: 'addr-1', label: '🏠 Home (Primary)', address: 'Flat 405, Sea Breeze Residency, Bandra West, Mumbai - 400050', selected: true },
    { id: 'addr-2', label: '🏢 Office / Co-Working', address: 'Block C, Maker Chambers VI, Nariman Point, Mumbai - 400021', selected: false },
  ]);
  const [customAddress, setCustomAddress] = useState('');
  const [showAddAddress, setShowAddAddress] = useState(false);

  // Payment methods
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'COD'>('UPI');
  const [upiId, setUpiId] = useState('user@upi');
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [paymentProcessing, setPaymentProcessing] = useState(false);

  // Order Receipt state
  const [placedOrderDetails, setPlacedOrderDetails] = useState<{
    orderId: string;
    items: CartItem[];
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    deliveryAddress: string;
    payment: string;
    eta: string;
  } | null>(null);

  // Math totals
  const subtotal = cartItems.reduce((acc, curr) => acc + curr.price * curr.quantity, 0);
  const deliveryFee = subtotal > 499 ? 0 : 49;
  const tax = Math.round(subtotal * 0.05); // 5% GST
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  const finalTotal = Math.max(0, subtotal + deliveryFee + tax - discountAmount);

  // Coupon applicator
  const applyCoupon = () => {
    setPromoError(null);
    const code = promoCode.toUpperCase().trim();
    if (code === 'FAAZIO20') {
      const amt = Math.round(subtotal * 0.20);
      setAppliedDiscount({ code: 'FAAZIO20 (20% OFF)', amount: amt });
    } else if (code === 'SUPER50') {
      const amt = Math.round(subtotal * 0.50);
      setAppliedDiscount({ code: 'SUPER50 (50% OFF)', amount: amt });
    } else if (code === 'FREESHIP') {
      setAppliedDiscount({ code: 'FREESHIP (Delivery Save)', amount: deliveryFee });
    } else {
      setPromoError('Invalid coupon code. Try FAAZIO20 or SUPER50!');
    }
  };

  const removeCoupon = () => {
    setAppliedDiscount(null);
    setPromoCode('');
  };

  const addNewAddress = (e: React.FormEvent) => {
    e.preventDefault();
    if (customAddress.trim() === '') return;
    const newId = `addr-${Date.now()}`;
    setAddresses(prev => {
      const unselected = prev.map(a => ({ ...a, selected: false }));
      return [...unselected, { id: newId, label: '📍 New Address', address: customAddress.trim(), selected: true }];
    });
    setCustomAddress('');
    setShowAddAddress(false);
  };

  const selectAddress = (id: string) => {
    setAddresses(prev => prev.map(a => ({ ...a, selected: a.id === id })));
  };

  const selectedAddressObj = addresses.find(a => a.selected) || addresses[0];

  const handlePlaceOrder = () => {
    setPaymentProcessing(true);
    setTimeout(() => {
      const details = {
        orderId: `FZ-${Math.floor(100000 + Math.random() * 900000)}`,
        items: [...cartItems],
        subtotal,
        discount: discountAmount,
        tax,
        total: finalTotal,
        deliveryAddress: selectedAddressObj ? selectedAddressObj.address : 'Default Address',
        payment: paymentMethod === 'UPI' ? `UPI (${upiId})` : paymentMethod === 'CARD' ? `Credit Card (*${cardNumber.slice(-4) || '4242'})` : 'Cash on Delivery',
        eta: '12-15 Mins'
      };
      setPlacedOrderDetails(details);
      setCartItems([]);
      setStep('RECEIPT');
      setPaymentProcessing(false);
    }, 2000);
  };

  // BAG STEP
  if (step === 'BAG') {
    return (
      <div className="space-y-4 animate-fade-in pb-20 text-slate-850 select-none">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <ShoppingBag size={13} className="text-slate-900" />
              <span>Your Shopping Bag</span>
            </h4>
            <span className="text-[9.5px] text-slate-500 font-bold bg-slate-100 px-2.5 py-0.5 rounded-full">
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {cartItems.length === 0 ? (
            <div className="text-center py-10 text-slate-400 space-y-4">
              <div className="w-14 h-14 rounded-full bg-slate-50 flex items-center justify-center mx-auto text-slate-400 border border-slate-150 shadow-inner animate-bounce">
                <ShoppingBag size={22} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-slate-800">Your bag is empty</p>
                <p className="text-[9.5px] text-slate-400 max-w-[220px] mx-auto leading-relaxed">
                  Browse Food, FA Mart, Grocery, or Pharma and tap 'Add to Bag' to get started!
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('Home')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-[9px] font-black uppercase tracking-wider transition-colors border-none cursor-pointer"
              >
                Go to Hub
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Classified Cart List Grouped by App Source */}
              <div className="max-h-[260px] overflow-y-auto pr-1 space-y-3.5 scrollbar-none">
                {(() => {
                  const grouped: Record<string, { label: ReturnType<typeof getAppLabel>; items: CartItem[] }> = {};
                  cartItems.forEach(item => {
                    const label = getAppLabel(item.id);
                    if (!grouped[label.name]) {
                      grouped[label.name] = { label, items: [] };
                    }
                    grouped[label.name].items.push(item);
                  });

                  return Object.values(grouped).map((group) => (
                    <div key={group.label.name} className="space-y-1.5">
                      {/* App Origin Tag */}
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider border ${group.label.color}`}>
                          <span>{group.label.icon}</span>
                          <span>{group.label.name}</span>
                        </span>
                        <span className="text-[8px] text-slate-400 font-bold">
                          {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>

                      {/* Items under this app */}
                      <div className="divide-y divide-slate-100/70 border border-slate-100 bg-slate-50/20 rounded-2xl p-2.5 space-y-2">
                        {group.items.map((item) => (
                          <div key={item.id} className="pt-2 first:pt-0 flex items-center justify-between gap-3 group">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <EnterpriseIcon emoji={item.emoji} className="w-8.5 h-8.5 border border-slate-150 shadow-xs group-hover:scale-105 transition-transform duration-200" size={11} variant="square" />
                              <div className="min-w-0 space-y-0.5">
                                <h5 className="text-[11px] font-black text-slate-900 truncate leading-tight">{item.name}</h5>
                                <span className="text-[8px] text-slate-400 font-bold block">₹{item.price.toLocaleString('en-IN')} each</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 bg-white border border-slate-200/50 p-0.5 px-1 rounded-lg shadow-xs">
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, -1)}
                                className="w-4.5 h-4.5 rounded-md hover:bg-slate-100 active:scale-90 flex items-center justify-center text-slate-600 font-extrabold text-[10px] transition-colors border-none bg-transparent cursor-pointer"
                              >
                                -
                              </button>
                              <span className="text-[9.5px] font-black text-slate-800 min-w-[12px] text-center">{item.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateCartQuantity(item.id, 1)}
                                className="w-4.5 h-4.5 rounded-md hover:bg-slate-100 active:scale-90 flex items-center justify-center text-slate-600 font-extrabold text-[10px] transition-colors border-none bg-transparent cursor-pointer"
                              >
                                +
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ));
                })()}
              </div>

              {/* Coupon System */}
              <div className="border-t border-slate-100 pt-3.5 space-y-2">
                <span className="text-[8.5px] font-black text-slate-400 uppercase tracking-wider block">Have a Promo Coupon?</span>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-slate-400">
                      <Ticket size={14} />
                    </span>
                    <input 
                      type="text" 
                      placeholder="e.g. FAAZIO20, SUPER50" 
                      value={promoCode}
                      onChange={(e) => {
                        setPromoCode(e.target.value);
                        setPromoError(null);
                      }}
                      className="w-full h-9 pl-9 pr-3 bg-slate-50 border border-slate-100 focus:bg-white focus:ring-1 focus:ring-slate-900 text-[10px] font-black text-slate-800 placeholder:text-slate-400 placeholder:font-semibold uppercase rounded-xl focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={applyCoupon}
                    className="px-4 bg-slate-900 hover:bg-slate-850 active:scale-95 text-white font-black text-[10px] uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer shrink-0"
                  >
                    Apply
                  </button>
                </div>

                {appliedDiscount && (
                  <div className="bg-emerald-50 border border-emerald-100 px-3 py-1.5 rounded-xl flex items-center justify-between text-[9px] text-emerald-800 font-black uppercase tracking-wide">
                    <div className="flex items-center gap-1.5">
                      <Check size={12} className="stroke-[3]" />
                      <span>Applied: {appliedDiscount.code}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={removeCoupon} 
                      className="text-slate-400 hover:text-slate-600 bg-transparent border-none font-bold cursor-pointer underline text-[8.5px]"
                    >
                      Remove
                    </button>
                  </div>
                )}

                {promoError && (
                  <div className="flex items-center gap-1 text-[8.5px] text-rose-500 font-black uppercase">
                    <AlertCircle size={10} />
                    <span>{promoError}</span>
                  </div>
                )}
              </div>

              {/* Price Breakdown */}
              <div className="border-t border-slate-100 pt-3.5 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                {appliedDiscount && (
                  <div className="flex items-center justify-between text-[10px] font-black text-emerald-600">
                    <span>Coupon Discount</span>
                    <span>-₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>GST Taxes (5%)</span>
                  <span>₹{tax.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold text-slate-400">
                  <span>Delivery Charges</span>
                  {deliveryFee === 0 ? (
                    <span className="text-[#56B821] font-black">FREE (₹49 Saved)</span>
                  ) : (
                    <span>₹{deliveryFee}</span>
                  )}
                </div>
                
                {deliveryFee > 0 && (
                  <p className="text-[7.5px] text-slate-400 font-semibold leading-relaxed bg-slate-50 p-2 rounded-lg border border-slate-100/50">
                    💡 Tip: Add items worth <span className="font-bold text-slate-700">₹{(500 - subtotal).toLocaleString('en-IN')}</span> more to qualify for <span className="text-emerald-600 font-bold">FREE Delivery</span>!
                  </p>
                )}

                <div className="flex items-center justify-between text-xs font-black text-slate-900 pt-2 border-t border-slate-50">
                  <span>Grand Total</span>
                  <span className="text-sm">₹{finalTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Action Button */}
              <button
                type="button"
                onClick={() => setStep('ADDRESS')}
                className="w-full h-11 bg-slate-950 hover:bg-slate-900 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-2xl shadow-lg transition-all border-none cursor-pointer"
              >
                <span>Select Delivery Address</span>
                <ArrowRight size={13} className="stroke-[2.5]" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ADDRESS STEP
  if (step === 'ADDRESS') {
    return (
      <div className="space-y-4 animate-fade-in pb-20 text-slate-850 select-none">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <button
              type="button"
              onClick={() => setStep('BAG')}
              className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"
            >
              <ChevronLeft size={12} className="stroke-[2.5]" />
              Back
            </button>
            <h4 className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider">
              Select Delivery Address
            </h4>
            <div className="w-8 h-1" />
          </div>

          {/* Address List */}
          <div className="space-y-2.5">
            {addresses.map(addr => (
              <div
                key={addr.id}
                onClick={() => selectAddress(addr.id)}
                className={`p-3.5 rounded-2xl border transition-all cursor-pointer flex items-start gap-3 relative ${
                  addr.selected 
                    ? 'border-slate-900 bg-slate-50/50 shadow-sm' 
                    : 'border-slate-100 hover:border-slate-200'
                }`}
              >
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  addr.selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  <MapPin size={14} />
                </div>

                <div className="min-w-0 pr-6 space-y-0.5">
                  <div className="text-[10px] font-black text-slate-800 uppercase tracking-wide leading-tight">
                    {addr.label}
                  </div>
                  <p className="text-[9px] text-slate-400 font-semibold leading-relaxed">
                    {addr.address}
                  </p>
                </div>

                {addr.selected && (
                  <span className="absolute top-3.5 right-3.5 w-4 h-4 rounded-full bg-slate-900 text-white flex items-center justify-center text-[8px]">
                    ✓
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Add custom Address Form */}
          {showAddAddress ? (
            <form onSubmit={addNewAddress} className="bg-slate-50 p-3.5 rounded-2xl border border-slate-100/80 space-y-2.5 animate-fade-in">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Type Custom Address</span>
              <textarea
                value={customAddress}
                onChange={(e) => setCustomAddress(e.target.value)}
                placeholder="Apartment/Flat No, Landmark, Street name, Pincode"
                rows={3}
                className="w-full p-2.5 bg-white border border-slate-150 text-[10px] font-semibold text-slate-800 placeholder-slate-400 rounded-xl focus:outline-none focus:ring-1 focus:ring-slate-900"
              />
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddAddress(false)}
                  className="px-3 py-1.5 bg-transparent text-slate-400 hover:text-slate-600 font-black text-[9px] uppercase tracking-wider border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-slate-900 hover:bg-slate-850 text-white font-black text-[9px] uppercase tracking-wider rounded-lg border-none cursor-pointer"
                >
                  Save Address
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setShowAddAddress(true)}
              className="w-full py-2.5 border-dashed border-2 border-slate-200 hover:border-slate-350 text-slate-500 hover:text-slate-700 text-[10px] font-black uppercase tracking-wider rounded-2xl flex items-center justify-center gap-1.5 bg-transparent cursor-pointer transition-colors"
            >
              <span>+ Add Delivery Location</span>
            </button>
          )}

          {/* Checkout Footer */}
          <div className="border-t border-slate-100 pt-4 mt-2">
            <button
              type="button"
              onClick={() => setStep('PAYMENT')}
              className="w-full h-11 bg-slate-950 hover:bg-slate-900 active:scale-95 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-2xl shadow-lg transition-all border-none cursor-pointer"
            >
              <span>Proceed to Payment</span>
              <ArrowRight size={13} className="stroke-[2.5]" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // PAYMENT STEP
  if (step === 'PAYMENT') {
    return (
      <div className="space-y-4 animate-fade-in pb-20 text-slate-850 select-none">
        <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3">
            <button
              type="button"
              onClick={() => setStep('ADDRESS')}
              className="flex items-center gap-1 text-[10px] font-black uppercase text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer"
            >
              <ChevronLeft size={12} className="stroke-[2.5]" />
              Back
            </button>
            <h4 className="text-[10.5px] font-black text-slate-900 uppercase tracking-wider">
              Choose Payment Method
            </h4>
            <div className="w-8 h-1" />
          </div>

          {/* Payment Method Selector Grid */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('UPI')}
              className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer bg-transparent ${
                paymentMethod === 'UPI' ? 'border-slate-900 bg-slate-50/50 font-black' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <Smartphone size={16} className={paymentMethod === 'UPI' ? 'text-slate-900' : 'text-slate-400'} />
              <span className="text-[9px] font-black uppercase tracking-wide">UPI Pay</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('CARD')}
              className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer bg-transparent ${
                paymentMethod === 'CARD' ? 'border-slate-900 bg-slate-50/50 font-black' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <CreditCard size={16} className={paymentMethod === 'CARD' ? 'text-slate-900' : 'text-slate-400'} />
              <span className="text-[9px] font-black uppercase tracking-wide">Card</span>
            </button>
            <button
              type="button"
              onClick={() => setPaymentMethod('COD')}
              className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer bg-transparent ${
                paymentMethod === 'COD' ? 'border-slate-900 bg-slate-50/50 font-black' : 'border-slate-100 hover:border-slate-200'
              }`}
            >
              <Coins size={16} className={paymentMethod === 'COD' ? 'text-slate-900' : 'text-slate-400'} />
              <span className="text-[9px] font-black uppercase tracking-wide">Cash</span>
            </button>
          </div>

          {/* UPI dynamic panel details */}
          {paymentMethod === 'UPI' && (
            <div className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl space-y-3 animate-fade-in">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Verify Unified Payment VPA</span>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="flex-1 h-9 px-3 bg-white border border-slate-150 text-[10px] font-bold text-slate-800 rounded-xl focus:outline-none"
                />
                <span className="bg-slate-200/50 px-2.5 flex items-center justify-center text-[8px] font-black text-slate-500 rounded-xl">
                  Verified
                </span>
              </div>
              <p className="text-[7.5px] text-slate-400 font-semibold">
                🔒 UPI transaction is encrypted securely under Faazio Gateway protocol.
              </p>
            </div>
          )}

          {/* CARD Details */}
          {paymentMethod === 'CARD' && (
            <div className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl space-y-3 animate-fade-in">
              <div className="space-y-1">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Card Number</span>
                <input
                  type="text"
                  maxLength={19}
                  placeholder="4242 4242 4242 4242"
                  value={cardNumber}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                    setCardNumber(val);
                  }}
                  className="w-full h-9 px-3 bg-white border border-slate-150 text-[10.5px] font-bold text-slate-800 rounded-xl focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Expiry Date</span>
                  <input
                    type="text"
                    maxLength={5}
                    placeholder="MM/YY"
                    value={cardExpiry}
                    onChange={(e) => setCardExpiry(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-150 text-[10.5px] font-bold text-slate-800 rounded-xl focus:outline-none text-center"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">CVV Code</span>
                  <input
                    type="password"
                    maxLength={3}
                    placeholder="***"
                    value={cardCvv}
                    onChange={(e) => setCardCvv(e.target.value)}
                    className="w-full h-9 px-3 bg-white border border-slate-150 text-[10.5px] font-bold text-slate-800 rounded-xl focus:outline-none text-center"
                  />
                </div>
              </div>
            </div>
          )}

          {/* COD DETAILS */}
          {paymentMethod === 'COD' && (
            <div className="bg-slate-50/50 border border-slate-100 p-3.5 rounded-2xl flex items-center gap-3 animate-fade-in">
              <span className="text-xl">💵</span>
              <div className="min-w-0">
                <div className="text-[9.5px] font-black text-slate-800">Cash on Delivery selected</div>
                <p className="text-[7.5px] text-slate-400 font-semibold leading-relaxed mt-0.5">
                  Simply pay using cash or local phone QR scanner to your delivery partner when they arrive.
                </p>
              </div>
            </div>
          )}

          {/* Secure details */}
          <div className="flex items-center gap-2 bg-emerald-50/50 border border-emerald-100/50 p-2.5 rounded-xl">
            <ShieldCheck size={14} className="text-emerald-600 shrink-0" />
            <span className="text-[8px] font-black text-emerald-800 uppercase tracking-wider">
              Secure SSL 256-bit Certified Transaction
            </span>
          </div>

          {/* Summary pricing block */}
          <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Delivery Address</span>
              <span className="text-[9px] text-slate-800 font-black truncate max-w-[180px] block">
                {selectedAddressObj.address}
              </span>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Total Payment</span>
              <span className="text-xs font-black text-slate-900 block">
                ₹{finalTotal.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Checkout Footer */}
          <div className="pt-2">
            <button
              type="button"
              disabled={paymentProcessing}
              onClick={handlePlaceOrder}
              className="w-full h-11 bg-[#7CE045] hover:bg-[#6FD237] active:scale-95 disabled:opacity-75 text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 rounded-2xl shadow-[0_4px_16px_rgba(124,224,69,0.3)] transition-all border-none cursor-pointer"
            >
              {paymentProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Processing Payment...</span>
                </>
              ) : (
                <>
                  <span>PAY & PLACE ORDER NOW</span>
                  <CheckCircle size={13} className="stroke-[2.5]" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RECEIPT / LIVE TRACKING STEP
  return (
    <div className="space-y-4 animate-fade-in pb-20 text-slate-850 select-none">
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        {/* Confirmed Animation */}
        <div className="text-center py-4 space-y-2">
          <div className="w-12 h-12 rounded-full bg-[#EBFBE5] text-[#56B821] flex items-center justify-center mx-auto shadow-md">
            <CheckCircle size={24} className="stroke-[2.5]" />
          </div>
          <div className="space-y-0.5">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Order Confirmed!</h3>
            <p className="text-[9px] text-slate-400 font-black uppercase">ID: {placedOrderDetails?.orderId}</p>
          </div>
        </div>

        {/* Live Delivery status steps */}
        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/50">
            <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Truck size={10} className="text-slate-500 animate-pulse" />
              Real-Time Tracking Status
            </span>
            <span className="text-[8px] font-black text-[#56B821] bg-[#EBFBE5] border border-green-150 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Arriving in {placedOrderDetails?.eta}
            </span>
          </div>

          <div className="space-y-3 pl-2.5 relative border-l border-slate-200">
            {/* Step 1 */}
            <div className="flex items-start gap-3 relative">
              <span className="absolute left-[-14px] top-1 w-2.5 h-2.5 rounded-full bg-[#56B821] border-2 border-white ring-1 ring-emerald-500/30" />
              <div className="min-w-0">
                <div className="text-[9.5px] font-black text-slate-850 leading-none">Order Accepted by Hub</div>
                <p className="text-[8px] text-slate-400 font-bold mt-1">Confirmed at local Faazio distribution centre</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex items-start gap-3 relative">
              <span className="absolute left-[-14px] top-1 w-2.5 h-2.5 rounded-full bg-[#56B821] border-2 border-white ring-1 ring-emerald-500/30 animate-pulse" />
              <div className="min-w-0">
                <div className="text-[9.5px] font-black text-slate-850 leading-none">Rider Assigning...</div>
                <p className="text-[8px] text-slate-400 font-bold mt-1">Simulated delivery executive moving to pick location</p>
              </div>
            </div>
          </div>
        </div>

        {/* Order details specifications */}
        <div className="space-y-2.5 border-t border-slate-50 pt-3">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Items Purchased</span>
          <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1 scrollbar-none">
            {placedOrderDetails?.items.map(item => (
              <div key={item.id} className="flex items-center justify-between text-[10px] font-black text-slate-800 py-0.5">
                <div className="flex items-center gap-1.5 min-w-0">
                  <EnterpriseIcon emoji={item.emoji} className="w-4.5 h-4.5 border-none bg-transparent shrink-0" size={10} variant="flat" />
                  <span className="truncate max-w-[170px]">{item.name} <span className="text-slate-400 font-bold">x {item.quantity}</span></span>
                </div>
                <span>₹{(item.price * item.quantity).toLocaleString('en-IN')}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Delivery location address */}
        <div className="space-y-1 border-t border-slate-50 pt-3">
          <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider block">Delivering To</span>
          <p className="text-[9px] text-slate-500 font-semibold leading-relaxed">
            {placedOrderDetails?.deliveryAddress}
          </p>
        </div>

        {/* Payment info */}
        <div className="flex items-center justify-between text-[9px] font-black text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="uppercase tracking-wider">Payment Protocol:</span>
          <span className="text-slate-900 uppercase tracking-wide">{placedOrderDetails?.payment}</span>
        </div>

        {/* Close and Hub button */}
        <div className="grid grid-cols-2 gap-2.5 pt-1 border-t border-slate-100">
          <button
            type="button"
            onClick={() => {
              setStep('BAG');
              setPlacedOrderDetails(null);
            }}
            className="h-10 border border-slate-200 hover:bg-slate-50 text-slate-600 font-black text-[9.5px] uppercase tracking-wider rounded-xl cursor-pointer bg-transparent"
          >
            New Order
          </button>
          
          <button
            type="button"
            onClick={() => {
              setActiveTab('Home');
              setStep('BAG');
              setPlacedOrderDetails(null);
            }}
            className="h-10 bg-slate-950 hover:bg-slate-900 text-white font-black text-[9.5px] uppercase tracking-wider rounded-xl border-none cursor-pointer flex items-center justify-center gap-1 shadow-md"
          >
            Go to Hub
          </button>
        </div>
      </div>
    </div>
  );
}
