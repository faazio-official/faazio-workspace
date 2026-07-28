import React from 'react';
import { MapPin, Compass, Activity, LogOut, Truck } from 'lucide-react';
import EnterpriseIcon from './EnterpriseIcon';

interface AccountViewProps {
  handleReset: (e?: React.MouseEvent) => void;
  setShowLocationRequestState: (val: boolean) => void;
  setIsLoggedIn: (val: boolean) => void;
}

export default function AccountView({ handleReset, setShowLocationRequestState, setIsLoggedIn }: AccountViewProps) {
  const pastOrders = [
    { id: "FA-810293", item: "Truffle Burger Duo", store: "The Gourmet Table", price: "₹450", date: "Yesterday, 8:14 PM", status: "Delivered", bg: "🍲", app: "FOOD" },
    { id: "FA-792810", item: "AC Jet Cleaning Service", store: "Apex Home Care", price: "₹1,250", date: "3 days ago", status: "Completed", bg: "🛍️", app: "MART" },
  ];

  return (
    <div className="space-y-4 animate-fade-in pb-16">
      {/* User Profile Summary */}
      <div className="bg-white rounded-xl border border-slate-100 p-4 shadow-sm text-center">
        <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-blue-500 to-indigo-600 mx-auto flex items-center justify-center text-white text-xl font-extrabold shadow-md mb-2 animate-bounce-slow">
          FB
        </div>
        <h3 className="text-sm font-black text-slate-900">Faizal Basha</h3>
        <p className="text-[9px] text-slate-400 font-bold mt-0.5">Verified SuperApp Member</p>
        
        <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-100">
          <div className="bg-slate-50 p-2 rounded-lg text-left">
            <span className="text-[7px] font-bold text-slate-400 block uppercase">Phone Number</span>
            <span className="text-[9px] font-black text-slate-800 block mt-0.5">+91 98765 43210</span>
          </div>
          <div className="bg-slate-50 p-2 rounded-lg text-left">
            <span className="text-[7px] font-bold text-slate-400 block uppercase">Email Address</span>
            <span className="text-[9px] font-black text-slate-800 block mt-0.5 truncate" title="faizalbashafaizalbasha07@gmail.com">faizalbashafaizalbasha07@gmail.com</span>
          </div>
        </div>
      </div>

      {/* Active Order Progress & Past Orders */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black text-slate-950 uppercase tracking-wider px-1">Order Tracking & History</h4>
        
        <div className="bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl p-3 text-white shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[7px] font-black uppercase tracking-wider bg-white/20 px-1.5 py-0.5 rounded">ACTIVE DELIVERY</span>
            <h4 className="text-xs font-black mt-1 leading-tight">Order #FA-882901</h4>
            <p className="text-[9px] text-blue-100 mt-0.5">Rider is picking up your fresh order basket</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center animate-pulse shrink-0">
            <Truck size={18} className="text-white" />
          </div>
        </div>

        <div className="space-y-2">
          {pastOrders.map((o, index) => (
            <div key={index} className="bg-white p-2.5 rounded-xl border border-slate-100 flex items-center gap-3 shadow-sm">
              <EnterpriseIcon emoji={o.bg} app={o.app} className="w-8 h-8 border-none" size={13} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="text-[8px] font-bold text-slate-400">Order #{o.id}</span>
                  <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">{o.status}</span>
                </div>
                <h4 className="text-[10px] font-black text-slate-900 mt-0.5 truncate">{o.item}</h4>
                <p className="text-[8px] text-slate-400 mt-0.5">{o.store} • {o.date}</p>
              </div>
              <span className="text-[10px] font-black text-slate-800 shrink-0">{o.price}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Configuration settings */}
      <div className="bg-white rounded-xl border border-slate-100 p-1 shadow-sm divide-y divide-slate-100">
        <div 
          onClick={() => {
            setShowLocationRequestState(true);
            setIsLoggedIn(false);
          }}
          className="p-2 flex items-center justify-between text-[10px] hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 text-slate-700">
            <MapPin size={13} className="text-blue-500" />
            <span className="font-bold">Primary Location Settings</span>
          </div>
          <span className="text-[9px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">Mumbai, MH</span>
        </div>

        <div className="p-2 flex items-center justify-between text-[10px] hover:bg-slate-50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2 text-slate-700">
            <Compass size={13} className="text-indigo-500" />
            <span className="font-bold">Notifications Enabled</span>
          </div>
          <span className="text-[8px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full">Active</span>
        </div>

        <div className="p-2 flex items-center justify-between text-[10px] hover:bg-slate-50 transition-colors cursor-pointer">
          <div className="flex items-center gap-2 text-slate-700">
            <Activity size={13} className="text-purple-500" />
            <span className="font-bold">Faazio App Version</span>
          </div>
          <span className="text-[8px] font-mono text-slate-400">v1.2.0-prod</span>
        </div>
      </div>

      {/* Devices Red Logout Option */}
      <button
        type="button"
        onClick={handleReset}
        className="w-full h-10 rounded-xl bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-600 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 border border-rose-200/50 transition-all cursor-pointer"
      >
        <LogOut size={12} />
        <span>Log Out From Device</span>
      </button>
    </div>
  );
}
