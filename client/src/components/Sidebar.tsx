import React from 'react';
import { MainView } from '../types';
import { LayoutDashboard, Users, GitBranch, Factory, Package, Truck, ShoppingCart, FlaskConical, CalendarClock, BarChart3, TrendingUp, Shield } from 'lucide-react';

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
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, counts }) => {
  const navItems: { view: MainView; label: string; icon: React.ReactNode; badge?: number; badgeColor?: string }[] = [
    { view: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { view: 'customers', label: 'Customers', icon: <Users size={18} />, badge: counts.customers },
    { view: 'sales_pipeline', label: 'Sales Pipeline', icon: <GitBranch size={18} />, badge: counts.salesProjects },
    { view: 'production', label: 'Production', icon: <Factory size={18} />, badge: counts.productionProjects },
    { view: 'formulas', label: 'Formulas', icon: <FlaskConical size={18} /> },
    { view: 'production_planning', label: 'Production Planning', icon: <CalendarClock size={18} /> },
    { view: 'inventory', label: 'Inventory', icon: <Package size={18} />, badge: counts.lowStockItems, badgeColor: counts.lowStockItems > 0 ? 'badge-warning' : 'badge-ghost' },
    { view: 'suppliers', label: 'Suppliers', icon: <Truck size={18} />, badge: counts.suppliers },
    { view: 'purchase_orders', label: 'Purchase Orders', icon: <ShoppingCart size={18} />, badge: counts.openPOs, badgeColor: counts.openPOs > 0 ? 'badge-info' : 'badge-ghost' },
    { view: 'reports', label: 'Reports', icon: <BarChart3 size={18} /> },
    { view: 'profit_analytics', label: 'Profit Analytics', icon: <TrendingUp size={18} /> },
    { view: 'compliance', label: 'Compliance', icon: <Shield size={18} /> },
  ];

  return (
    <div className="w-56 bg-base-200 flex flex-col h-full border-r border-base-300">
      <div className="p-4 border-b border-base-300">
        <h1 className="text-lg font-bold text-primary">PLL CRM</h1>
        <p className="text-xs opacity-60">Manufacturing Hub</p>
      </div>

      <ul className="menu menu-sm flex-1 p-2 gap-0.5">
        {navItems.map((item) => (
          <li key={item.view}>
            <a
              className={`flex items-center gap-2 ${currentView === item.view ? 'active' : ''}`}
              onClick={() => onNavigate(item.view)}
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.badge !== undefined && item.badge > 0 && (
                <span className={`badge badge-sm ${item.badgeColor || 'badge-ghost'}`}>
                  {item.badge}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>

      <div className="p-3 border-t border-base-300 text-xs opacity-50 text-center">
        Private Label Labs
      </div>
    </div>
  );
};
