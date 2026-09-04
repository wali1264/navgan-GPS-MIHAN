import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Customer, Vehicle, VehicleCurrentState } from '../../shared/types/models';
import { VehicleStatus } from '../../shared/types/enums';
import { Search, X, Users, User, Phone, Car, Check, ChevronDown } from 'lucide-react';

interface CustomerMapFilterProps {
  customers: Customer[];
  vehicles: Vehicle[];
  currentStates: VehicleCurrentState[];
  selectedCustomerId?: string;
  onSelectCustomer: (customerId: string | undefined) => void;
  selectedVehicleId?: string;
  onSelectVehicle: (vehicleId: string | undefined) => void;
  statusFilter?: VehicleStatus;
  onSelectStatusFilter: (status: VehicleStatus | undefined) => void;
}

export const CustomerMapFilter: React.FC<CustomerMapFilterProps> = ({
  customers,
  vehicles,
  currentStates,
  selectedCustomerId,
  onSelectCustomer,
  selectedVehicleId,
  onSelectVehicle,
  statusFilter,
  onSelectStatusFilter,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Helper to extract username
  const extractUsername = (c: Customer): string => {
    if (c.companyName?.startsWith('@')) return c.companyName.replace('@', '');
    if (c.companyName && !c.companyName.includes(' ')) return c.companyName;
    if (c.email) return c.email.split('@')[0];
    return '';
  };

  // Helper to count vehicles per customer
  const getCustomerVehicleCount = (customerId: string): number => {
    return vehicles.filter(
      (v) =>
        v.customerId === customerId ||
        (v as any).owner_id === customerId ||
        (v as any).user_id === customerId
    ).length;
  };

  // Filtered customer list for combobox
  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      const username = extractUsername(c).toLowerCase();
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      return name.includes(q) || username.includes(q) || phone.includes(q);
    });
  }, [customers, searchQuery]);

  // Selected customer object
  const selectedCustomer = useMemo(() => {
    if (!selectedCustomerId) return null;
    return customers.find((c) => c.id === selectedCustomerId) || null;
  }, [customers, selectedCustomerId]);

  // Active customer's vehicles
  const customerVehicles = useMemo(() => {
    if (!selectedCustomerId) return vehicles;
    return vehicles.filter(
      (v) =>
        v.customerId === selectedCustomerId ||
        (v as any).owner_id === selectedCustomerId ||
        (v as any).user_id === selectedCustomerId
    );
  }, [vehicles, selectedCustomerId]);

  // Status counts based on the active scope (all or selected customer)
  const scopedVehicleIds = useMemo(() => new Set(customerVehicles.map((v) => v.id)), [customerVehicles]);

  const scopedStates = useMemo(() => {
    return currentStates.filter((s) => scopedVehicleIds.has(s.vehicleId));
  }, [currentStates, scopedVehicleIds]);

  const movingCount = useMemo(() => {
    return scopedStates.filter((s) => s.onlineStatus === VehicleStatus.MOVING).length;
  }, [scopedStates]);

  const stoppedCount = useMemo(() => {
    return scopedStates.filter((s) => s.onlineStatus === VehicleStatus.STOPPED).length;
  }, [scopedStates]);

  const totalCount = customerVehicles.length;

  return (
    <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs p-3 sm:p-3.5 space-y-3 text-right" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* RIGHT SIDE (RTL): Customer Search & Filter */}
        <div className="flex-1 max-w-md relative" ref={dropdownRef}>
          {!selectedCustomer ? (
            <div className="relative">
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-slate-400">
                <Search className="w-4 h-4" />
              </div>
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onFocus={() => setIsOpen(true)}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setIsOpen(true);
                }}
                placeholder="فیلتر بر اساس مشتری (نام، نام کاربری، شماره تماس)..."
                className="w-full pl-9 pr-9 py-2 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    inputRef.current?.focus();
                  }}
                  className="absolute inset-y-0 left-0 pl-2.5 flex items-center text-slate-400 hover:text-slate-600"
                >
                  <X className="w-4 h-4" />
                </button>
              ) : (
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <ChevronDown className="w-4 h-4" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between bg-blue-50/80 border border-blue-200 rounded-lg px-3 py-1.5 shadow-xs">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-7 h-7 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0">
                  <User className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                    <span>{selectedCustomer.name}</span>
                    <span className="text-[10px] font-mono text-blue-700 bg-blue-100/80 px-1.5 py-0.5 rounded font-bold">
                      @{extractUsername(selectedCustomer)}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center gap-2">
                    {selectedCustomer.phone && (
                      <span className="font-mono text-slate-600">📞 {selectedCustomer.phone}</span>
                    )}
                    <span className="font-bold text-blue-700 font-mono">
                      • {customerVehicles.length} دستگاه
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(true);
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 rounded transition cursor-pointer"
                >
                  تغییر
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onSelectCustomer(undefined);
                    onSelectVehicle(undefined);
                    setSearchQuery('');
                  }}
                  className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                  title="حذف فیلتر مشتری (نمایش همه)"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Autocomplete Dropdown */}
          {isOpen && (
            <div className="absolute top-full mt-1.5 right-0 w-full min-w-[300px] bg-white rounded-xl border border-slate-200 shadow-xl z-[600] overflow-hidden">
              {/* Option: All Customers */}
              <div className="p-1 border-b border-slate-100 bg-slate-50/50">
                <button
                  type="button"
                  onClick={() => {
                    onSelectCustomer(undefined);
                    onSelectVehicle(undefined);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition cursor-pointer ${
                    !selectedCustomerId
                      ? 'bg-blue-600 text-white font-bold'
                      : 'text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    <span>همه مشتریان (نمایش تمام ناوگان)</span>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      !selectedCustomerId ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {vehicles.length} دستگاه
                  </span>
                </button>
              </div>

              {/* List of matched customers */}
              <div className="max-h-64 overflow-y-auto p-1 divide-y divide-slate-100">
                {filteredCustomers.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">
                    مشتری با مشخصات وارد شده یافت نشد.
                  </div>
                ) : (
                  filteredCustomers.map((c) => {
                    const count = getCustomerVehicleCount(c.id);
                    const username = extractUsername(c);
                    const isSelected = selectedCustomerId === c.id;

                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          onSelectCustomer(c.id);
                          onSelectVehicle(undefined);
                          setIsOpen(false);
                          setSearchQuery('');
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-right rounded-lg text-xs transition cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50 text-blue-900 font-bold'
                            : 'hover:bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <div
                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <div className="truncate text-right">
                            <div className="font-bold flex items-center gap-1.5">
                              <span>{c.name}</span>
                              {username && (
                                <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.2 rounded">
                                  @{username}
                                </span>
                              )}
                            </div>
                            {c.phone && (
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                <Phone className="w-2.5 h-2.5" />
                                <span>{c.phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-mono font-medium">
                            {count} دستگاه
                          </span>
                          {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* LEFT SIDE (RTL): Status Filter Buttons */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-slate-500 font-medium text-[11px]">وضعیت:</span>
          <button
            type="button"
            onClick={() => onSelectStatusFilter(undefined)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              !statusFilter
                ? 'bg-blue-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <span>همه</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-black/10">
              {totalCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectStatusFilter(VehicleStatus.MOVING)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === VehicleStatus.MOVING
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>حرکت</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-emerald-700/20">
              {movingCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectStatusFilter(VehicleStatus.STOPPED)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              statusFilter === VehicleStatus.STOPPED
                ? 'bg-slate-800 text-white shadow-xs'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60'
            }`}
          >
            <span>توقف</span>
            <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-slate-300">
              {stoppedCount}
            </span>
          </button>
        </div>
      </div>

      {/* SUB-ROW: If customer selected, show quick chips for their individual vehicles */}
      {selectedCustomer && customerVehicles.length > 0 && (
        <div className="pt-2 border-t border-slate-100 flex items-center gap-2 overflow-x-auto pb-1 text-xs">
          <span className="text-slate-400 text-[11px] shrink-0 font-medium">دستگاه‌های مشتری:</span>

          <button
            type="button"
            onClick={() => onSelectVehicle(undefined)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition shrink-0 cursor-pointer ${
              !selectedVehicleId
                ? 'bg-blue-600 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            نمایش همه ({customerVehicles.length})
          </button>

          {customerVehicles.map((veh) => {
            const isVehSelected = selectedVehicleId === veh.id;
            const st = currentStates.find((s) => s.vehicleId === veh.id);
            const isMoving = st?.onlineStatus === VehicleStatus.MOVING;

            return (
              <button
                key={veh.id}
                type="button"
                onClick={() => onSelectVehicle(veh.id)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition shrink-0 cursor-pointer flex items-center gap-1.5 border ${
                  isVehSelected
                    ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    isMoving ? 'bg-emerald-500' : 'bg-slate-400'
                  }`}
                />
                <span className="font-mono font-bold">{veh.plateNumber}</span>
                <span className="text-slate-500 text-[10px]">({veh.vehicleName})</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
