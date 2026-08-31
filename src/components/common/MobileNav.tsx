/**
 * Customer Mobile Bottom Navigation Bar
 */
import React from 'react';
import { Home, MapPin, Car, Bell, User, History } from 'lucide-react';

export type MobileTab = 'home' | 'map' | 'history' | 'vehicles' | 'alerts' | 'account';

interface MobileNavProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  alertsCount: number;
  activeVehiclesCount: number;
}

export const MobileNav: React.FC<MobileNavProps> = ({
  activeTab,
  onSelectTab,
  alertsCount,
  activeVehiclesCount,
}) => {
  const tabs = [
    { id: 'home', label: 'خانه', icon: Home },
    { id: 'map', label: 'نقشه زنده', icon: MapPin, badge: activeVehiclesCount },
    { id: 'history', label: 'تاریخچه', icon: History },
    { id: 'vehicles', label: 'موترها', icon: Car },
    { id: 'alerts', label: 'هشدارها', icon: Bell, badge: alertsCount > 0 ? alertsCount : undefined },
    { id: 'account', label: 'حساب من', icon: User },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur border-t border-slate-200/80 px-2 py-1.5 flex items-center justify-around md:hidden shadow-lg">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectTab(tab.id as MobileTab)}
            className={`flex flex-col items-center justify-center flex-1 py-1 relative transition ${
              isActive ? 'text-blue-600' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="relative">
              <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
              {tab.badge !== undefined && (
                <span className="absolute -top-1.5 -right-2 bg-rose-500 text-white text-[9px] font-bold px-1.5 py-0.2 rounded-full">
                  {tab.badge}
                </span>
              )}
            </div>
            <span className={`text-[10px] mt-1 font-medium ${isActive ? 'font-bold' : ''}`}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
