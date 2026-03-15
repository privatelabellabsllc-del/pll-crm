import React from 'react';
import { MainView } from '../types';
import { LayoutDashboard, Users, GitBranch, Factory, Package, Truck, ShoppingCart, FlaskConical, CalendarClock, BarChart3, TrendingUp, Shield, HardDrive, Menu, X } from 'lucide-react';

interface SidebarProps {
  currentView: MainView;
  onNavigate: (view: MainView) => void;
  counts: {
    customers: number;
    salesProjects: number;
    productionProjects: number;
    inventoryItems: number;
    lowStockItems: number;
    suppliers: number;
    openPOs: number;
  };
  isOpen: boolean;
  onToggle: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, counts, isOpen, onToggle }) => {
  const mainNav: { view: MainView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { view: 'customers', label: 'Customers', icon: <Users size={18} />, badge: counts.customers },
    { view: 'sales_pipeline', label: 'Sales Pipeline', icon: <GitBranch size={18} />, badge: counts.salesProjects },
  ];

  const operationsNav: { view: MainView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { view: 'production', label: 'Production', icon: <Factory size={18} />, badge: counts.productionProjects },
    { view: 'formulas', label: 'Formulas', icon: <FlaskConical size={18} /> },
    { view: 'production_planning', label: 'Planning', icon: <CalendarClock size={18} /> },
    { view: 'inventory', label: 'Inventory', icon: <Package size={18} />, badge: counts.lowStockItems, badgeColor: counts.lowStockItems > 0 ? 'badge-warning' : 'badge-ghost' },
    { view: 'suppliers', label: 'Suppliers', icon: <Truck size={18} />, badge: counts.suppliers },
    { view: 'purchase_orders', label: 'Purchase Orders', icon: <ShoppingCart size={18} />, badge: counts.openPOs, badgeColor: counts.openPOs > 0 ? 'badge-info' : 'badge-ghost' },
  ];

  const analyticsNav: { view: MainView; label: string; icon: React.ReactNode }[] = [
    { view: 'reports', label: 'Reports', icon: <BarChart3 size={18} /> },
    { view: 'profit_analytics', label: 'Profit Analytics', icon: <TrendingUp size={18} /> },
    { view: 'compliance', label: 'Compliance', icon: <Shield size={18} /> },
  ];

  const systemNav: { view: MainView; label: string; icon: React.ReactNode }[] = [
    { view: 'backup', label: 'Backup & Restore', icon: <HardDrive size={18} /> },
  ];

  function handleNav(view: MainView) {
    onNavigate(view);
    // Auto-close sidebar on mobile after navigation
    if (window.innerWidth < 768) {
      onToggle();
    }
  }

  function renderNavItem(item: { view: MainView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }) {
    const isActive = currentView === item.view;
    return (
      <li key={item.view}>
        <a
          className={`flex items-center gap-2.5 ${isActive ? 'active' : ''}`}
          onClick={() => handleNav(item.view)}
        >
          <span className={isActive ? 'text-blue-500' : 'text-gray-400'}>{item.icon}</span>
          <span className="flex-1">{item.label}</span>
          {item.badge !== undefined && item.badge > 0 && (
            <span className={`badge badge-sm ${item.badgeColor || 'badge-ghost'}`}>
              {item.badge}
            </span>
          )}
        </a>
      </li>
    );
  }

  return (
    <>
      {/* Mobile hamburger button - fixed top-left */}
      <button
        className="md:hidden fixed top-3 left-3 z-50 btn btn-sm btn-ghost bg-white/80 backdrop-blur-md shadow-sm border border-gray-200/50"
        onClick={onToggle}
        aria-label="Toggle menu"
      >
        {isOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay for mobile when sidebar is open */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/30 backdrop-blur-sm z-30"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          fixed md:relative z-40 h-full
          w-60 bg-white/80 backdrop-blur-xl flex flex-col border-r border-gray-200/50
          transition-transform duration-200 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
        style={{ boxShadow: '1px 0 8px rgba(0,0,0,0.03)' }}
      >
        {/* Logo area */}
        <div className="p-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <div>
              <h1 className="text-base font-semibold text-gray-900 tracking-tight">PLL CRM</h1>
              <p className="text-[11px] text-gray-400 font-medium">Manufacturing Hub</p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 border-t border-gray-100" />

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
          {/* Main section */}
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">Main</p>
            <ul className="menu menu-sm gap-0.5 p-0">
              {mainNav.map(renderNavItem)}
            </ul>
          </div>

          {/* Operations section */}
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">Operations</p>
            <ul className="menu menu-sm gap-0.5 p-0">
              {operationsNav.map(renderNavItem)}
            </ul>
          </div>

          {/* Analytics section */}
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">Analytics</p>
            <ul className="menu menu-sm gap-0.5 p-0">
              {analyticsNav.map(renderNavItem)}
            </ul>
          </div>

          {/* System section */}
          <div>
            <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-300">System</p>
            <ul className="menu menu-sm gap-0.5 p-0">
              {systemNav.map(renderNavItem)}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <p className="text-[11px] text-gray-300 text-center font-medium">Private Label Labs</p>
        </div>
      </div>
    </>
  );
};
