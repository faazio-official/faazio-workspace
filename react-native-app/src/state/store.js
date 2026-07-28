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
exports.usePharmaStore = exports.useBookingStore = exports.useCartStore = exports.useAuthStore = void 0;
var zustand_1 = require("zustand");
exports.useAuthStore = (0, zustand_1.create)()(function (set) { return ({
    isAuthenticated: false,
    user: null,
    login: function (userData) { return set({ isAuthenticated: true, user: userData }); },
    logout: function () { return set({ isAuthenticated: false, user: null }); },
}); });
exports.useCartStore = (0, zustand_1.create)()(function (set, get) { return ({
    cart: [],
    addToCart: function (item) { return set(function (state) {
        var existing = state.cart.find(function (i) { return i.id === item.id; });
        if (existing) {
            return {
                cart: state.cart.map(function (i) { return i.id === item.id ? __assign(__assign({}, i), { quantity: i.quantity + item.quantity }) : i; })
            };
        }
        return { cart: __spreadArray(__spreadArray([], state.cart, true), [item], false) };
    }); },
    removeFromCart: function (itemId) { return set(function (state) { return ({
        cart: state.cart.filter(function (i) { return i.id !== itemId; })
    }); }); },
    updateQuantity: function (itemId, quantity) { return set(function (state) { return ({
        cart: state.cart.map(function (i) { return i.id === itemId ? __assign(__assign({}, i), { quantity: quantity }) : i; })
    }); }); },
    clearCart: function () { return set({ cart: [] }); },
    getCartTotal: function () {
        return get().cart.reduce(function (total, item) { return total + item.price * item.quantity; }, 0);
    }
}); });
exports.useBookingStore = (0, zustand_1.create)()(function (set) { return ({
    bookings: [],
    addBooking: function (booking) { return set(function (state) { return ({
        bookings: __spreadArray(__spreadArray([], state.bookings, true), [
            __assign(__assign({}, booking), { id: Math.random().toString(36).substring(2, 9), status: 'confirmed' })
        ], false)
    }); }); },
    cancelBooking: function (bookingId) { return set(function (state) { return ({
        bookings: state.bookings.map(function (b) { return b.id === bookingId ? __assign(__assign({}, b), { status: 'cancelled' }) : b; })
    }); }); }
}); });
exports.usePharmaStore = (0, zustand_1.create)()(function (set) { return ({
    prescriptions: [],
    uploadPrescription: function (uri, fileName) { return set(function (state) { return ({
        prescriptions: __spreadArray(__spreadArray([], state.prescriptions, true), [
            {
                id: Math.random().toString(36).substring(2, 9),
                uri: uri,
                fileName: fileName,
                uploadDate: new Date().toISOString()
            }
        ], false)
    }); }); },
    removePrescription: function (id) { return set(function (state) { return ({
        prescriptions: state.prescriptions.filter(function (p) { return p.id !== id; })
    }); }); }
}); });
