/**
 * Customer Mobile Bottom Navigation Bar
 */
import React from 'react';
import { MapPin, History, Car, User } from 'lucide-react';

export type MobileTab = 'home' | 'map' | 'history' | 'vehicles' | 'account';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  activeVehiclesCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  activeVehiclesCount,
}) => {
  const tabs = [
    { id: 'map', label: 'نقشه زنده', icon: MapPin, badge: activeVehiclesCount },
    { id: 'history', label: 'تاریخچه ۳۰ روز', icon: History },
    { id: 'vehicles', label: 'لیست موترها', icon: Car },
    { id: 'account', label: 'حساب من', icon: User },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[9999] bg-white/95 backdrop-blur-md border-t border-slate-200/90 px-2 pt-1.5 flex items-center justify-around md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.08)] select-none"
      style={{
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 8px))',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id || (tab.id === 'map' && activeTab === 'home');

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id as MobileTab)}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative transition cursor-pointer active:scale-95 ${
              isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {tab.badge !== undefined && tab.badge > 0 && tab.id === 'map' && (
                <span className="absolute -top-1.5 -right-2 bg-blue-600 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full ring-2 ring-white">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-1 font-medium leading-none ${isActive ? 'font-bold text-blue-600' : ''}`}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};

