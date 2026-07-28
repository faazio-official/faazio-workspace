"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = CartView;
var react_1 = require("react");
var react_native_1 = require("react-native");
var lucide_react_native_1 = require("lucide-react-native");
var SCREEN_WIDTH = react_native_1.Dimensions.get('window').width;
var getAppLabel = function (itemId) {
    var id = itemId.toLowerCase();
    if (id.startsWith('ph-') || id.includes('pharma') || id.includes('med')) {
        return { name: 'Fa Pharma', bgColor: '#fff1f2', textColor: '#f43f5e', border: '#ffe4e6', icon: '💊' };
    }
    if (id.startsWith('gr-') || id.includes('grocery') || id.startsWith('cat-gr') || id.startsWith('cat-fb')) {
        return { name: 'Faazio Grocery', bgColor: '#ecfdf5', textColor: '#059669', border: '#d1fae5', icon: '🥦' };
    }
    if (id.startsWith('fm-') || id.includes('mart') || id.startsWith('cat-mt') || id.startsWith('cat-mf')) {
        return { name: 'FA Mart', bgColor: '#eef2ff', textColor: '#4f46e5', border: '#e0e7ff', icon: '🛍️' };
    }
    return { name: 'Food', bgColor: '#fffbeb', textColor: '#d97706', border: '#fef3c7', icon: '🍔' };
};
function CartView(_a) {
    var cartItems = _a.cartItems, setCartItems = _a.setCartItems, updateCartQuantity = _a.updateCartQuantity, setActiveTab = _a.setActiveTab;
    var _b = (0, react_1.useState)('BAG'), step = _b[0], setStep = _b[1];
    var _c = (0, react_1.useState)(''), promoCode = _c[0], setPromoCode = _c[1];
    var _d = (0, react_1.useState)(null), appliedDiscount = _d[0], setAppliedDiscount = _d[1];
    var _e = (0, react_1.useState)(null), promoError = _e[0], setPromoError = _e[1];
    var _f = (0, react_1.useState)([
        { id: 'addr-1', label: '🏠 Home (Primary)', address: 'Flat 405, Sea Breeze Residency, Bandra West, Mumbai - 400050', selected: true },
        { id: 'addr-2', label: '🏢 Office / Co-Working', address: 'Block C, Maker Chambers VI, Nariman Point, Mumbai - 400021', selected: false },
    ]), addresses = _f[0], setAddresses = _f[1];
    var _g = (0, react_1.useState)(''), customAddress = _g[0], setCustomAddress = _g[1];
    var _h = (0, react_1.useState)(false), showAddAddress = _h[0], setShowAddAddress = _h[1];
    var _j = (0, react_1.useState)('UPI'), paymentMethod = _j[0], setPaymentMethod = _j[1];
    var _k = (0, react_1.useState)('user@upi'), upiId = _k[0], setUpiId = _k[1];
    var _l = (0, react_1.useState)(''), cardNumber = _l[0], setCardNumber = _l[1];
    var _m = (0, react_1.useState)(''), cardExpiry = _m[0], setCardExpiry = _m[1];
    var _o = (0, react_1.useState)(''), cardCvv = _o[0], setCardCvv = _o[1];
    var _p = (0, react_1.useState)(false), paymentProcessing = _p[0], setPaymentProcessing = _p[1];
    var _q = (0, react_1.useState)(null), placedOrderDetails = _q[0], setPlacedOrderDetails = _q[1];
    var subtotal = cartItems.reduce(function (acc, curr) { return acc + curr.price * curr.quantity; }, 0);
    var deliveryFee = subtotal > 499 ? 0 : 49;
    var tax = Math.round(subtotal * 0.05);
    var discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
    var finalTotal = Math.max(0, subtotal + deliveryFee + tax - discountAmount);
    var applyCoupon = function () {
        setPromoError(null);
        var code = promoCode.toUpperCase().trim();
        if (code === 'FAAZIO20') {
            var amt = Math.round(subtotal * 0.20);
            setAppliedDiscount({ code: 'FAAZIO20 (20% OFF)', amount: amt });
        }
        else if (code === 'SUPER50') {
            var amt = Math.round(subtotal * 0.50);
            setAppliedDiscount({ code: 'SUPER50 (50% OFF)', amount: amt });
        }
        else if (code === 'FREESHIP') {
            setAppliedDiscount({ code: 'FREESHIP (Delivery Save)', amount: deliveryFee });
        }
        else {
            setPromoError('Invalid coupon code. Try FAAZIO20 or SUPER50!');
        }
    };
    var removeCoupon = function () {
        setAppliedDiscount(null);
        setPromoCode('');
    };
    var selectAddress = function (id) {
        setAddresses(function (prev) { return prev.map(function (a) { return (__assign(__assign({}, a), { selected: a.id === id })); }); });
    };
    var addNewAddress = function () {
        if (customAddress.trim() === '')
            return;
        var newId = "addr-".concat(Date.now());
        setAddresses(function (prev) {
            var unselected = prev.map(function (a) { return (__assign(__assign({}, a), { selected: false })); });
            return __spreadArray(__spreadArray([], unselected, true), [{ id: newId, label: '📍 New Address', address: customAddress.trim(), selected: true }], false);
        });
        setCustomAddress('');
        setShowAddAddress(false);
    };
    var selectedAddressObj = addresses.find(function (a) { return a.selected; }) || addresses[0];
    var handlePlaceOrder = function () {
        setPaymentProcessing(true);
        setTimeout(function () {
            var details = {
                orderId: "FZ-".concat(Math.floor(100000 + Math.random() * 900000)),
                items: __spreadArray([], cartItems, true),
                subtotal: subtotal,
                discount: discountAmount,
                tax: tax,
                total: finalTotal,
                deliveryAddress: selectedAddressObj ? selectedAddressObj.address : 'Default Address',
                payment: paymentMethod === 'UPI' ? "UPI (".concat(upiId, ")") : paymentMethod === 'CARD' ? "Credit Card (*".concat(cardNumber.slice(-4) || '4242', ")") : 'Cash on Delivery',
                eta: '12-15 Mins'
            };
            setPlacedOrderDetails(details);
            setCartItems([]);
            setStep('RECEIPT');
            setPaymentProcessing(false);
        }, 2000);
    };
    if (step === 'BAG') {
        return (<react_native_1.ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <react_native_1.View style={styles.cardBox}>
          <react_native_1.View style={styles.headerRow}>
            <react_native_1.View style={styles.headerLeft}>
              <lucide_react_native_1.ShoppingBag size={13} color="#0f172a" style={{ marginRight: 6 }}/>
              <react_native_1.Text style={styles.headerTitle}>Your Shopping Bag</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.View style={styles.badgeWrap}>
              <react_native_1.Text style={styles.badgeText}>
                {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
              </react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>

          {cartItems.length === 0 ? (<react_native_1.View style={styles.emptyContainer}>
              <react_native_1.View style={styles.emptyIconCircle}>
                <lucide_react_native_1.ShoppingBag size={22} color="#94a3b8"/>
              </react_native_1.View>
              <react_native_1.Text style={styles.emptyTitle}>Your bag is empty</react_native_1.Text>
              <react_native_1.Text style={styles.emptyDesc}>
                Browse Food, FA Mart, Grocery, or Pharma and tap 'Add to Bag' to get started!
              </react_native_1.Text>
              <react_native_1.TouchableOpacity onPress={function () { return setActiveTab('Home'); }} style={styles.goToHubBtn} activeOpacity={0.8}>
                <react_native_1.Text style={styles.goToHubBtnText}>Go to Hub</react_native_1.Text>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>) : (<react_native_1.View style={{ width: '100%' }}>
              {/* Items List Grouped by App */}
              <react_native_1.View style={styles.itemsListContainer}>
                {(function () {
                    var grouped = {};
                    cartItems.forEach(function (item) {
                        var label = getAppLabel(item.id);
                        if (!grouped[label.name]) {
                            grouped[label.name] = { label: label, items: [] };
                        }
                        grouped[label.name].items.push(item);
                    });
                    return Object.values(grouped).map(function (group) { return (<react_native_1.View key={group.label.name} style={styles.groupedAppSection}>
                      <react_native_1.View style={styles.appOriginRow}>
                        <react_native_1.View style={[styles.appOriginBadge, { backgroundColor: group.label.bgColor, borderColor: group.label.border }]}>
                          <react_native_1.Text style={styles.appOriginEmoji}>{group.label.icon}</react_native_1.Text>
                          <react_native_1.Text style={[styles.appOriginName, { color: group.label.textColor }]}>{group.label.name}</react_native_1.Text>
                        </react_native_1.View>
                        <react_native_1.Text style={styles.groupCountText}>{group.items.length} items</react_native_1.Text>
                      </react_native_1.View>

                      <react_native_1.View style={styles.appItemsBox}>
                        {group.items.map(function (item) { return (<react_native_1.View key={item.id} style={styles.cartItemRow}>
                            <react_native_1.View style={styles.cartItemLeft}>
                              <react_native_1.View style={styles.cartItemEmojiCircle}>
                                <react_native_1.Text style={styles.cartItemEmoji}>{item.emoji}</react_native_1.Text>
                              </react_native_1.View>
                              <react_native_1.View style={styles.cartItemMeta}>
                                <react_native_1.Text style={styles.cartItemName} numberOfLines={1}>{item.name}</react_native_1.Text>
                                <react_native_1.Text style={styles.cartItemPrice}>₹{item.price.toLocaleString('en-IN')} each</react_native_1.Text>
                              </react_native_1.View>
                            </react_native_1.View>

                            <react_native_1.View style={styles.quantityWidget}>
                              <react_native_1.TouchableOpacity onPress={function () { return updateCartQuantity(item.id, -1); }} style={styles.qtyBtn} activeOpacity={0.8}>
                                <react_native_1.Text style={styles.qtyBtnText}>-</react_native_1.Text>
                              </react_native_1.TouchableOpacity>
                              <react_native_1.Text style={styles.qtyValue}>{item.quantity}</react_native_1.Text>
                              <react_native_1.TouchableOpacity onPress={function () { return updateCartQuantity(item.id, 1); }} style={styles.qtyBtn} activeOpacity={0.8}>
                                <react_native_1.Text style={styles.qtyBtnText}>+</react_native_1.Text>
                              </react_native_1.TouchableOpacity>
                            </react_native_1.View>
                          </react_native_1.View>); })}
                      </react_native_1.View>
                    </react_native_1.View>); });
                })()}
              </react_native_1.View>

              {/* Coupon System */}
              <react_native_1.View style={styles.couponContainer}>
                <react_native_1.Text style={styles.sectionLabel}>Have a Promo Coupon?</react_native_1.Text>
                <react_native_1.View style={styles.couponRow}>
                  <react_native_1.View style={styles.couponInputWrap}>
                    <lucide_react_native_1.Ticket size={14} color="#94a3b8" style={styles.couponIcon}/>
                    <react_native_1.TextInput placeholder="e.g. FAAZIO20, SUPER50" value={promoCode} onChangeText={function (txt) {
                    setPromoCode(txt);
                    setPromoError(null);
                }} style={styles.couponInput} placeholderTextColor="#cbd5e1" autoCapitalize="characters"/>
                  </react_native_1.View>
                  <react_native_1.TouchableOpacity onPress={applyCoupon} style={styles.couponApplyBtn} activeOpacity={0.8}>
                    <react_native_1.Text style={styles.couponApplyText}>Apply</react_native_1.Text>
                  </react_native_1.TouchableOpacity>
                </react_native_1.View>

                {appliedDiscount && (<react_native_1.View style={styles.appliedDiscountBox}>
                    <react_native_1.Text style={styles.appliedDiscountText}>Applied: {appliedDiscount.code}</react_native_1.Text>
                    <react_native_1.TouchableOpacity onPress={removeCoupon} activeOpacity={0.8}>
                      <react_native_1.Text style={styles.removeCouponText}>Remove</react_native_1.Text>
                    </react_native_1.TouchableOpacity>
                  </react_native_1.View>)}

                {promoError && (<react_native_1.View style={styles.promoErrorBox}>
                    <lucide_react_native_1.AlertCircle size={10} color="#ef4444" style={{ marginRight: 4 }}/>
                    <react_native_1.Text style={styles.promoErrorText}>{promoError}</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.View>

              {/* Price Breakdown */}
              <react_native_1.View style={styles.pricingContainer}>
                <react_native_1.View style={styles.pricingRow}>
                  <react_native_1.Text style={styles.pricingLabel}>Subtotal</react_native_1.Text>
                  <react_native_1.Text style={styles.pricingValue}>₹{subtotal.toLocaleString('en-IN')}</react_native_1.Text>
                </react_native_1.View>

                {appliedDiscount && (<react_native_1.View style={styles.pricingRow}>
                    <react_native_1.Text style={[styles.pricingLabel, { color: '#059669', fontWeight: '900' }]}>Coupon Discount</react_native_1.Text>
                    <react_native_1.Text style={[styles.pricingValue, { color: '#059669', fontWeight: '900' }]}>-₹{discountAmount.toLocaleString('en-IN')}</react_native_1.Text>
                  </react_native_1.View>)}

                <react_native_1.View style={styles.pricingRow}>
                  <react_native_1.Text style={styles.pricingLabel}>GST Taxes (5%)</react_native_1.Text>
                  <react_native_1.Text style={styles.pricingValue}>₹{tax.toLocaleString('en-IN')}</react_native_1.Text>
                </react_native_1.View>

                <react_native_1.View style={styles.pricingRow}>
                  <react_native_1.Text style={styles.pricingLabel}>Delivery Charges</react_native_1.Text>
                  {deliveryFee === 0 ? (<react_native_1.Text style={[styles.pricingValue, { color: '#16a34a', fontWeight: '900' }]}>FREE</react_native_1.Text>) : (<react_native_1.Text style={styles.pricingValue}>₹{deliveryFee}</react_native_1.Text>)}
                </react_native_1.View>

                {deliveryFee > 0 && (<react_native_1.View style={styles.tipBox}>
                    <react_native_1.Text style={styles.tipText}>
                      💡 Tip: Add items worth <react_native_1.Text style={{ fontWeight: '900', color: '#334155' }}>₹{(500 - subtotal).toLocaleString('en-IN')}</react_native_1.Text> more to qualify for <react_native_1.Text style={{ color: '#059669', fontWeight: '900' }}>FREE Delivery</react_native_1.Text>!
                    </react_native_1.Text>
                  </react_native_1.View>)}

                <react_native_1.View style={[styles.pricingRow, styles.grandTotalRow]}>
                  <react_native_1.Text style={styles.grandTotalLabel}>Grand Total</react_native_1.Text>
                  <react_native_1.Text style={styles.grandTotalValue}>₹{finalTotal.toLocaleString('en-IN')}</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>

              {/* Action Button */}
              <react_native_1.TouchableOpacity onPress={function () { return setStep('ADDRESS'); }} style={styles.mainActionBtn} activeOpacity={0.8}>
                <react_native_1.Text style={styles.mainActionBtnText}>Select Delivery Address</react_native_1.Text>
                <lucide_react_native_1.ArrowRight size={13} color="#ffffff" style={{ marginLeft: 6 }}/>
              </react_native_1.TouchableOpacity>
            </react_native_1.View>)}
        </react_native_1.View>
      </react_native_1.ScrollView>);
    }
    if (step === 'ADDRESS') {
        return (<react_native_1.ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <react_native_1.View style={styles.cardBox}>
          <react_native_1.View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }]}>
            <react_native_1.TouchableOpacity onPress={function () { return setStep('BAG'); }} style={styles.backBtn} activeOpacity={0.8}>
              <lucide_react_native_1.ChevronLeft size={12} color="#94a3b8"/>
              <react_native_1.Text style={styles.backBtnText}>Back</react_native_1.Text>
            </react_native_1.TouchableOpacity>
            <react_native_1.Text style={styles.headerTitleCenter}>Select Delivery Address</react_native_1.Text>
            <react_native_1.View style={{ width: 40 }}/>
          </react_native_1.View>

          {/* Address List */}
          <react_native_1.View style={styles.addressList}>
            {addresses.map(function (addr) { return (<react_native_1.TouchableOpacity key={addr.id} onPress={function () { return selectAddress(addr.id); }} style={[
                    styles.addressCard,
                    addr.selected ? { borderColor: '#0f172a', backgroundColor: '#f8fafc' } : null,
                ]} activeOpacity={0.9}>
                <react_native_1.View style={[styles.addressCardIconCircle, addr.selected ? { backgroundColor: '#0f172a' } : null]}>
                  <lucide_react_native_1.MapPin size={14} color={addr.selected ? '#ffffff' : '#64748b'}/>
                </react_native_1.View>
                <react_native_1.View style={styles.addressCardDetails}>
                  <react_native_1.Text style={styles.addressCardLabel}>{addr.label}</react_native_1.Text>
                  <react_native_1.Text style={styles.addressCardText}>{addr.address}</react_native_1.Text>
                </react_native_1.View>

                {addr.selected && (<react_native_1.View style={styles.addressSelectMarker}>
                    <react_native_1.Text style={styles.addressSelectMarkerText}>✓</react_native_1.Text>
                  </react_native_1.View>)}
              </react_native_1.TouchableOpacity>); })}
          </react_native_1.View>

          {/* Add custom Address Form */}
          {showAddAddress ? (<react_native_1.View style={styles.customAddressForm}>
              <react_native_1.Text style={styles.sectionLabel}>Type Custom Address</react_native_1.Text>
              <react_native_1.TextInput placeholder="Apartment/Flat No, Landmark, Street name, Pincode" value={customAddress} onChangeText={setCustomAddress} multiline numberOfLines={3} style={styles.customAddressInput} placeholderTextColor="#cbd5e1"/>
              <react_native_1.View style={styles.customAddressBtnRow}>
                <react_native_1.TouchableOpacity onPress={function () { return setShowAddAddress(false); }} style={styles.customAddressCancel} activeOpacity={0.8}>
                  <react_native_1.Text style={styles.customAddressCancelText}>Cancel</react_native_1.Text>
                </react_native_1.TouchableOpacity>
                <react_native_1.TouchableOpacity onPress={addNewAddress} style={styles.customAddressSave} activeOpacity={0.8}>
                  <react_native_1.Text style={styles.customAddressSaveText}>Save Address</react_native_1.Text>
                </react_native_1.TouchableOpacity>
              </react_native_1.View>
            </react_native_1.View>) : (<react_native_1.TouchableOpacity onPress={function () { return setShowAddAddress(true); }} style={styles.addAddressDashedBtn} activeOpacity={0.8}>
              <react_native_1.Text style={styles.addAddressDashedBtnText}>+ Add Delivery Location</react_native_1.Text>
            </react_native_1.TouchableOpacity>)}

          {/* Proceed to Payment Button */}
          <react_native_1.TouchableOpacity onPress={function () { return setStep('PAYMENT'); }} style={[styles.mainActionBtn, { marginTop: 24 }]} activeOpacity={0.8}>
            <react_native_1.Text style={styles.mainActionBtnText}>Proceed to Payment</react_native_1.Text>
            <lucide_react_native_1.ArrowRight size={13} color="#ffffff" style={{ marginLeft: 6 }}/>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.ScrollView>);
    }
    if (step === 'PAYMENT') {
        return (<react_native_1.ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <react_native_1.View style={styles.cardBox}>
          <react_native_1.View style={[styles.headerRow, { borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 10 }]}>
            <react_native_1.TouchableOpacity onPress={function () { return setStep('ADDRESS'); }} style={styles.backBtn} activeOpacity={0.8}>
              <lucide_react_native_1.ChevronLeft size={12} color="#94a3b8"/>
              <react_native_1.Text style={styles.backBtnText}>Back</react_native_1.Text>
            </react_native_1.TouchableOpacity>
            <react_native_1.Text style={styles.headerTitleCenter}>Choose Payment Method</react_native_1.Text>
            <react_native_1.View style={{ width: 40 }}/>
          </react_native_1.View>

          {/* Payment Method Selector Grid */}
          <react_native_1.View style={styles.paymentSelectorGrid}>
            <react_native_1.TouchableOpacity onPress={function () { return setPaymentMethod('UPI'); }} style={[styles.paymentGridCard, paymentMethod === 'UPI' ? styles.paymentGridCardActive : null]} activeOpacity={0.8}>
              <lucide_react_native_1.Smartphone size={16} color={paymentMethod === 'UPI' ? '#0f172a' : '#94a3b8'}/>
              <react_native_1.Text style={styles.paymentGridCardText}>UPI Pay</react_native_1.Text>
            </react_native_1.TouchableOpacity>

            <react_native_1.TouchableOpacity onPress={function () { return setPaymentMethod('CARD'); }} style={[styles.paymentGridCard, paymentMethod === 'CARD' ? styles.paymentGridCardActive : null]} activeOpacity={0.8}>
              <lucide_react_native_1.CreditCard size={16} color={paymentMethod === 'CARD' ? '#0f172a' : '#94a3b8'}/>
              <react_native_1.Text style={styles.paymentGridCardText}>Card</react_native_1.Text>
            </react_native_1.TouchableOpacity>

            <react_native_1.TouchableOpacity onPress={function () { return setPaymentMethod('COD'); }} style={[styles.paymentGridCard, paymentMethod === 'COD' ? styles.paymentGridCardActive : null]} activeOpacity={0.8}>
              <lucide_react_native_1.Coins size={16} color={paymentMethod === 'COD' ? '#0f172a' : '#94a3b8'}/>
              <react_native_1.Text style={styles.paymentGridCardText}>Cash</react_native_1.Text>
            </react_native_1.TouchableOpacity>
          </react_native_1.View>

          {/* UPI dynamic panel details */}
          {paymentMethod === 'UPI' && (<react_native_1.View style={styles.paymentDetailPanel}>
              <react_native_1.Text style={styles.sectionLabel}>Verify Unified Payment VPA</react_native_1.Text>
              <react_native_1.View style={styles.upiInputRow}>
                <react_native_1.TextInput value={upiId} onChangeText={setUpiId} style={styles.upiInput} placeholderTextColor="#94a3b8"/>
                <react_native_1.View style={styles.upiVerifiedLabel}>
                  <react_native_1.Text style={styles.upiVerifiedText}>Verified</react_native_1.Text>
                </react_native_1.View>
              </react_native_1.View>
              <react_native_1.Text style={styles.securePanelText}>🔒 UPI transaction is encrypted securely under Faazio Gateway protocol.</react_native_1.Text>
            </react_native_1.View>)}

          {/* CARD Details */}
          {paymentMethod === 'CARD' && (<react_native_1.View style={styles.paymentDetailPanel}>
              <react_native_1.View style={styles.cardInputGroup}>
                <react_native_1.Text style={styles.sectionLabel}>Card Number</react_native_1.Text>
                <react_native_1.TextInput placeholder="4242 4242 4242 4242" value={cardNumber} onChangeText={function (val) {
                    var formatted = val.replace(/\s?/g, '').replace(/(\d{4})/g, '$1 ').trim();
                    setCardNumber(formatted);
                }} maxLength={19} keyboardType="numeric" style={styles.cardNumberInput} placeholderTextColor="#cbd5e1"/>
              </react_native_1.View>

              <react_native_1.View style={styles.cardTwoColRow}>
                <react_native_1.View style={styles.cardColInput}>
                  <react_native_1.Text style={styles.sectionLabel}>Expiry Date</react_native_1.Text>
                  <react_native_1.TextInput placeholder="MM/YY" value={cardExpiry} onChangeText={setCardExpiry} maxLength={5} keyboardType="numeric" style={styles.cardCenterInput} placeholderTextColor="#cbd5e1"/>
                </react_native_1.View>
                <react_native_1.View style={styles.cardColInput}>
                  <react_native_1.Text style={styles.sectionLabel}>CVV Code</react_native_1.Text>
                  <react_native_1.TextInput placeholder="***" value={cardCvv} onChangeText={setCardCvv} maxLength={3} secureTextEntry keyboardType="numeric" style={styles.cardCenterInput} placeholderTextColor="#cbd5e1"/>
                </react_native_1.View>
              </react_native_1.View>
            </react_native_1.View>)}

          {/* COD DETAILS */}
          {paymentMethod === 'COD' && (<react_native_1.View style={styles.codBox}>
              <react_native_1.Text style={styles.codBoxEmoji}>💵</react_native_1.Text>
              <react_native_1.View style={styles.codBoxTextCol}>
                <react_native_1.Text style={styles.codBoxTitle}>Cash on Delivery selected</react_native_1.Text>
                <react_native_1.Text style={styles.codBoxDesc}>Simply pay using cash or local phone QR scanner to your delivery partner when they arrive.</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>)}

          {/* Secure Details */}
          <react_native_1.View style={styles.secureDetailsCard}>
            <lucide_react_native_1.ShieldCheck size={14} color="#059669" style={{ marginRight: 6 }}/>
            <react_native_1.Text style={styles.secureDetailsText}>Secure SSL 256-bit Certified Transaction</react_native_1.Text>
          </react_native_1.View>

          {/* Summary pricing block */}
          <react_native_1.View style={styles.paymentPriceSummary}>
            <react_native_1.View style={{ flex: 1, marginRight: 10 }}>
              <react_native_1.Text style={styles.summaryLabel}>Delivery Address</react_native_1.Text>
              <react_native_1.Text style={styles.summaryValue} numberOfLines={1}>{selectedAddressObj.address}</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.View style={styles.summaryRight}>
              <react_native_1.Text style={styles.summaryLabel}>Total Payment</react_native_1.Text>
              <react_native_1.Text style={styles.summaryPriceValue}>₹{finalTotal.toLocaleString('en-IN')}</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>

          {/* Pay Button */}
          <react_native_1.TouchableOpacity onPress={handlePlaceOrder} disabled={paymentProcessing} style={[styles.mainActionBtn, { backgroundColor: '#7CE045', marginTop: 14 }]} activeOpacity={0.8}>
            {paymentProcessing ? (<react_native_1.View style={styles.loadingRow}>
                <react_native_1.ActivityIndicator size="small" color="#ffffff" style={{ marginRight: 6 }}/>
                <react_native_1.Text style={styles.mainActionBtnText}>Processing Payment...</react_native_1.Text>
              </react_native_1.View>) : (<react_native_1.View style={styles.loadingRow}>
                <react_native_1.Text style={styles.mainActionBtnText}>PAY & PLACE ORDER NOW</react_native_1.Text>
                <lucide_react_native_1.CheckCircle size={13} color="#ffffff" style={{ marginLeft: 6 }}/>
              </react_native_1.View>)}
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.ScrollView>);
    }
    // RECEIPT VIEW
    return (<react_native_1.ScrollView style={styles.container} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <react_native_1.View style={styles.cardBox}>
        {/* Receipt Success */}
        <react_native_1.View style={styles.receiptHeader}>
          <react_native_1.View style={styles.receiptCheckCircle}>
            <lucide_react_native_1.CheckCircle size={24} color="#56B821"/>
          </react_native_1.View>
          <react_native_1.Text style={styles.receiptTitle}>Order Confirmed!</react_native_1.Text>
          <react_native_1.Text style={styles.receiptOrderId}>ID: {placedOrderDetails === null || placedOrderDetails === void 0 ? void 0 : placedOrderDetails.orderId}</react_native_1.Text>
        </react_native_1.View>

        {/* Live Delivery status steps */}
        <react_native_1.View style={styles.liveTrackingBox}>
          <react_native_1.View style={styles.liveTrackingHeader}>
            <react_native_1.View style={styles.liveTrackingHeaderLeft}>
              <lucide_react_native_1.Truck size={12} color="#475569" style={{ marginRight: 4 }}/>
              <react_native_1.Text style={styles.liveTrackingLabel}>Real-Time Tracking Status</react_native_1.Text>
            </react_native_1.View>
            <react_native_1.View style={styles.etaBadge}>
              <react_native_1.Text style={styles.etaBadgeText}>Arriving in {placedOrderDetails === null || placedOrderDetails === void 0 ? void 0 : placedOrderDetails.eta}</react_native_1.Text>
            </react_native_1.View>
          </react_native_1.View>

          <react_native_1.View style={styles.liveStepsContainer}>
            <react_native_1.View style={styles.liveStepRow}>
              <react_native_1.View style={styles.liveStepConnectorLine}/>
              <react_native_1.View style={styles.liveStepActiveDot}/>
              <react_native_1.View style={styles.liveStepTextCol}>
                <react_native_1.Text style={styles.liveStepTitle}>Order Accepted by Hub</react_native_1.Text>
                <react_native_1.Text style={styles.liveStepDesc}>Confirmed at local Faazio distribution centre</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>

            <react_native_1.View style={[styles.liveStepRow, { marginBottom: 0 }]}>
              <react_native_1.View style={styles.liveStepActiveDotPulse}/>
              <react_native_1.View style={styles.liveStepTextCol}>
                <react_native_1.Text style={styles.liveStepTitle}>Rider Assigning...</react_native_1.Text>
                <react_native_1.Text style={styles.liveStepDesc}>Simulated delivery executive moving to pick location</react_native_1.Text>
              </react_native_1.View>
            </react_native_1.View>
          </react_native_1.View>
        </react_native_1.View>

        {/* Purchased list */}
        <react_native_1.View style={styles.purchasedItemsSection}>
          <react_native_1.Text style={styles.sectionLabel}>Items Purchased</react_native_1.Text>
          <react_native_1.View style={styles.purchasedItemsList}>
            {placedOrderDetails === null || placedOrderDetails === void 0 ? void 0 : placedOrderDetails.items.map(function (item) { return (<react_native_1.View key={item.id} style={styles.purchasedItemRow}>
                <react_native_1.View style={styles.purchasedItemLeft}>
                  <react_native_1.Text style={styles.purchasedItemEmoji}>{item.emoji}</react_native_1.Text>
                  <react_native_1.Text style={styles.purchasedItemName} numberOfLines={1}>
                    {item.name} <react_native_1.Text style={{ color: '#94a3b8', fontWeight: 'bold' }}>x {item.quantity}</react_native_1.Text>
                  </react_native_1.Text>
                </react_native_1.View>
                <react_native_1.Text style={styles.purchasedItemPrice}>₹{(item.price * item.quantity).toLocaleString('en-IN')}</react_native_1.Text>
              </react_native_1.View>); })}
          </react_native_1.View>
        </react_native_1.View>

        {/* Delivering to location */}
        <react_native_1.View style={styles.deliveryLocationSection}>
          <react_native_1.Text style={styles.sectionLabel}>Delivering To</react_native_1.Text>
          <react_native_1.Text style={styles.deliveryLocationAddress}>{placedOrderDetails === null || placedOrderDetails === void 0 ? void 0 : placedOrderDetails.deliveryAddress}</react_native_1.Text>
        </react_native_1.View>

        {/* Payment info info */}
        <react_native_1.View style={styles.receiptPaymentDetails}>
          <react_native_1.Text style={styles.paymentProtocolLabel}>Payment Protocol:</react_native_1.Text>
          <react_native_1.Text style={styles.paymentProtocolValue}>{placedOrderDetails === null || placedOrderDetails === void 0 ? void 0 : placedOrderDetails.payment}</react_native_1.Text>
        </react_native_1.View>

        {/* Action Controls */}
        <react_native_1.View style={styles.receiptActionBtnRow}>
          <react_native_1.TouchableOpacity onPress={function () {
            setStep('BAG');
            setPlacedOrderDetails(null);
        }} style={styles.receiptNewOrderBtn} activeOpacity={0.8}>
            <react_native_1.Text style={styles.receiptNewOrderBtnText}>New Order</react_native_1.Text>
          </react_native_1.TouchableOpacity>

          <react_native_1.TouchableOpacity onPress={function () {
            setActiveTab('Home');
            setStep('BAG');
            setPlacedOrderDetails(null);
        }} style={styles.receiptGoToHubBtn} activeOpacity={0.8}>
            <react_native_1.Text style={styles.receiptGoToHubBtnText}>Go to Hub</react_native_1.Text>
          </react_native_1.TouchableOpacity>
        </react_native_1.View>
      </react_native_1.View>
    </react_native_1.ScrollView>);
}
var styles = react_native_1.StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    cardBox: {
        backgroundColor: '#ffffff',
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginTop: 14,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.02,
        shadowRadius: 10,
        elevation: 1,
    },
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 11.5,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
    },
    badgeWrap: {
        backgroundColor: '#f1f5f9',
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 12,
    },
    badgeText: {
        fontSize: 8.5,
        color: '#64748b',
        fontWeight: '700',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#f8fafc',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: '#1e293b',
    },
    emptyDesc: {
        fontSize: 9,
        color: '#94a3b8',
        fontWeight: '500',
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: 24,
        lineHeight: 13,
    },
    goToHubBtn: {
        backgroundColor: '#0f172a',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginTop: 16,
    },
    goToHubBtnText: {
        color: '#ffffff',
        fontSize: 8.5,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    itemsListContainer: {
        width: '100%',
    },
    groupedAppSection: {
        marginBottom: 16,
    },
    appOriginRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    appOriginBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 6,
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    appOriginEmoji: {
        fontSize: 8,
        marginRight: 4,
    },
    appOriginName: {
        fontSize: 8,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    groupCountText: {
        fontSize: 8,
        color: '#94a3b8',
        fontWeight: '600',
    },
    appItemsBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        padding: 10,
    },
    cartItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#e2e8f0',
    },
    cartItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    cartItemEmojiCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#ffffff',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: '#e2e8f0',
    },
    cartItemEmoji: {
        fontSize: 10,
    },
    cartItemMeta: {
        marginLeft: 8,
        flex: 1,
    },
    cartItemName: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#0f172a',
    },
    cartItemPrice: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '700',
        marginTop: 2,
    },
    quantityWidget: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        padding: 2,
        borderRadius: 6,
    },
    qtyBtn: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyBtnText: {
        fontSize: 10,
        fontWeight: '900',
        color: '#64748b',
    },
    qtyValue: {
        fontSize: 9,
        fontWeight: '900',
        color: '#1e293b',
        marginHorizontal: 4,
        minWidth: 10,
        textAlign: 'center',
    },
    couponContainer: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12,
        marginBottom: 16,
    },
    sectionLabel: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginBottom: 6,
    },
    couponRow: {
        flexDirection: 'row',
        gap: 8,
    },
    couponInputWrap: {
        flex: 1,
        position: 'relative',
    },
    couponIcon: {
        position: 'absolute',
        left: 10,
        top: 10,
    },
    couponInput: {
        height: 34,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 10,
        paddingLeft: 30,
        paddingRight: 10,
        fontSize: 9.5,
        fontWeight: '900',
        color: '#0f172a',
    },
    couponApplyBtn: {
        backgroundColor: '#0f172a',
        paddingHorizontal: 16,
        height: 34,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    couponApplyText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    appliedDiscountBox: {
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#d1fae5',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    appliedDiscountText: {
        fontSize: 8.5,
        color: '#065f46',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    removeCouponText: {
        fontSize: 8,
        color: '#64748b',
        fontWeight: '700',
        textDecorationLine: 'underline',
    },
    promoErrorBox: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    promoErrorText: {
        fontSize: 8,
        color: '#ef4444',
        fontWeight: '900',
    },
    pricingContainer: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 12,
        marginBottom: 16,
    },
    pricingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    pricingLabel: {
        fontSize: 9.5,
        color: '#94a3b8',
        fontWeight: '700',
    },
    pricingValue: {
        fontSize: 9.5,
        color: '#1e293b',
        fontWeight: '700',
    },
    tipBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 8,
        borderRadius: 8,
        marginVertical: 4,
    },
    tipText: {
        fontSize: 7.5,
        color: '#64748b',
        fontWeight: '500',
        lineHeight: 11,
    },
    grandTotalRow: {
        borderTopWidth: 1,
        borderTopColor: '#f8fafc',
        paddingTop: 8,
        marginTop: 4,
    },
    grandTotalLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
    },
    grandTotalValue: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0f172a',
    },
    mainActionBtn: {
        width: '100%',
        height: 42,
        backgroundColor: '#0f172a',
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
    },
    mainActionBtnText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backBtnText: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#94a3b8',
        textTransform: 'uppercase',
        marginLeft: 3,
    },
    headerTitleCenter: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#0f172a',
        textTransform: 'uppercase',
    },
    addressList: {
        width: '100%',
        gap: 8,
        marginTop: 10,
    },
    addressCard: {
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        position: 'relative',
    },
    addressCardIconCircle: {
        width: 28,
        height: 28,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressCardDetails: {
        marginLeft: 10,
        flex: 1,
        paddingRight: 20,
    },
    addressCardLabel: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#1e293b',
        textTransform: 'uppercase',
    },
    addressCardText: {
        fontSize: 8,
        color: '#94a3b8',
        fontWeight: '600',
        marginTop: 2,
        lineHeight: 11,
    },
    addressSelectMarker: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 14,
        height: 14,
        borderRadius: 7,
        backgroundColor: '#0f172a',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addressSelectMarkerText: {
        color: '#ffffff',
        fontSize: 8,
    },
    customAddressForm: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        padding: 12,
        marginTop: 12,
    },
    customAddressInput: {
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        padding: 8,
        fontSize: 9,
        fontWeight: '500',
        color: '#1e293b',
        minHeight: 50,
        textAlignVertical: 'top',
        marginTop: 4,
    },
    customAddressBtnRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginTop: 8,
    },
    customAddressCancel: {
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    customAddressCancelText: {
        fontSize: 8.5,
        color: '#94a3b8',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    customAddressSave: {
        backgroundColor: '#0f172a',
        paddingVertical: 4,
        paddingHorizontal: 12,
        borderRadius: 6,
    },
    customAddressSaveText: {
        color: '#ffffff',
        fontSize: 8.5,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    addAddressDashedBtn: {
        width: '100%',
        paddingVertical: 10,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: '#cbd5e1',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    addAddressDashedBtnText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    paymentSelectorGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 12,
        marginBottom: 12,
    },
    paymentGridCard: {
        width: '31%',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    paymentGridCardActive: {
        borderColor: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    paymentGridCardText: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#1e293b',
        textTransform: 'uppercase',
        marginTop: 6,
    },
    paymentDetailPanel: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        padding: 12,
        marginBottom: 12,
    },
    upiInputRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 4,
    },
    upiInput: {
        flex: 1,
        height: 32,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 9.5,
        fontWeight: '700',
        color: '#1e293b',
    },
    upiVerifiedLabel: {
        backgroundColor: '#f1f5f9',
        paddingHorizontal: 8,
        borderRadius: 8,
        justifyContent: 'center',
    },
    upiVerifiedText: {
        fontSize: 7.5,
        color: '#64748b',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    securePanelText: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '500',
        marginTop: 6,
    },
    cardInputGroup: {
        marginBottom: 10,
    },
    cardNumberInput: {
        height: 32,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 10,
        fontWeight: '700',
        color: '#1e293b',
        marginTop: 4,
    },
    cardTwoColRow: {
        flexDirection: 'row',
        gap: 10,
    },
    cardColInput: {
        flex: 1,
    },
    cardCenterInput: {
        height: 32,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 8,
        fontSize: 10,
        fontWeight: '700',
        color: '#1e293b',
        textAlign: 'center',
        marginTop: 4,
    },
    codBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    codBoxEmoji: {
        fontSize: 16,
        marginRight: 10,
    },
    codBoxTextCol: {
        flex: 1,
    },
    codBoxTitle: {
        fontSize: 9,
        fontWeight: '900',
        color: '#1e293b',
    },
    codBoxDesc: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '500',
        marginTop: 2,
        lineHeight: 11,
    },
    secureDetailsCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#ecfdf5',
        borderWidth: 0.5,
        borderColor: '#d1fae5',
        padding: 8,
        borderRadius: 10,
        marginBottom: 12,
    },
    secureDetailsText: {
        fontSize: 7.5,
        color: '#065f46',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    paymentPriceSummary: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        padding: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    summaryLabel: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    summaryValue: {
        fontSize: 8.5,
        color: '#1e293b',
        fontWeight: '900',
        marginTop: 2,
    },
    summaryRight: {
        alignItems: 'flex-end',
        flexShrink: 0,
    },
    summaryPriceValue: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0f172a',
        marginTop: 2,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    receiptHeader: {
        alignItems: 'center',
        paddingVertical: 10,
    },
    receiptCheckCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#f0fdf4',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    receiptTitle: {
        fontSize: 13,
        fontWeight: '900',
        color: '#1e293b',
        textTransform: 'uppercase',
    },
    receiptOrderId: {
        fontSize: 8.5,
        color: '#94a3b8',
        fontWeight: '900',
        textTransform: 'uppercase',
        marginTop: 4,
    },
    liveTrackingBox: {
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        borderRadius: 16,
        padding: 12,
        marginBottom: 14,
    },
    liveTrackingHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 0.5,
        borderBottomColor: '#cbd5e1',
        paddingBottom: 8,
        marginBottom: 10,
    },
    liveTrackingHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    liveTrackingLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    etaBadge: {
        backgroundColor: '#ecfdf5',
        borderWidth: 0.5,
        borderColor: '#a7f3d0',
        borderRadius: 6,
        paddingVertical: 1,
        paddingHorizontal: 6,
    },
    etaBadgeText: {
        fontSize: 7.5,
        color: '#047857',
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    liveStepsContainer: {
        paddingLeft: 10,
    },
    liveStepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 12,
        position: 'relative',
    },
    liveStepConnectorLine: {
        position: 'absolute',
        left: -7,
        top: 10,
        width: 1,
        height: 18,
        backgroundColor: '#cbd5e1',
    },
    liveStepActiveDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10b981',
        borderWidth: 1.5,
        borderColor: '#ffffff',
        position: 'absolute',
        left: -10,
        top: 2,
    },
    liveStepActiveDotPulse: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#3b82f6',
        borderWidth: 1.5,
        borderColor: '#ffffff',
        position: 'absolute',
        left: -10,
        top: 2,
    },
    liveStepTextCol: {
        marginLeft: 8,
        flex: 1,
    },
    liveStepTitle: {
        fontSize: 9,
        fontWeight: '900',
        color: '#1e293b',
    },
    liveStepDesc: {
        fontSize: 7.5,
        color: '#94a3b8',
        fontWeight: '700',
        marginTop: 2,
    },
    purchasedItemsSection: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    },
    purchasedItemsList: {
        marginTop: 6,
    },
    purchasedItemRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 2,
    },
    purchasedItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        marginRight: 10,
    },
    purchasedItemEmoji: {
        fontSize: 9,
        marginRight: 6,
    },
    purchasedItemName: {
        fontSize: 9,
        fontWeight: '900',
        color: '#334155',
    },
    purchasedItemPrice: {
        fontSize: 9,
        fontWeight: '900',
        color: '#1e293b',
    },
    deliveryLocationSection: {
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 10,
    },
    deliveryLocationAddress: {
        fontSize: 8.5,
        color: '#64748b',
        fontWeight: '600',
        lineHeight: 12,
        marginTop: 4,
    },
    receiptPaymentDetails: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: '#f1f5f9',
        padding: 8,
        borderRadius: 10,
        marginTop: 10,
    },
    paymentProtocolLabel: {
        fontSize: 8,
        fontWeight: '900',
        color: '#64748b',
        textTransform: 'uppercase',
    },
    paymentProtocolValue: {
        fontSize: 8,
        fontWeight: '900',
        color: '#1e293b',
        textTransform: 'uppercase',
    },
    receiptActionBtnRow: {
        flexDirection: 'row',
        gap: 10,
        borderTopWidth: 1,
        borderTopColor: '#f1f5f9',
        paddingTop: 14,
        marginTop: 12,
    },
    receiptNewOrderBtn: {
        flex: 1,
        height: 36,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#cbd5e1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptNewOrderBtnText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#475569',
        textTransform: 'uppercase',
    },
    receiptGoToHubBtn: {
        flex: 1,
        height: 36,
        backgroundColor: '#0f172a',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    receiptGoToHubBtnText: {
        fontSize: 9,
        fontWeight: '900',
        color: '#ffffff',
        textTransform: 'uppercase',
    },
});
