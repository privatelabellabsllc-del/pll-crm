import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Users, DollarSign, GitBranch, Factory, AlertTriangle, TrendingUp, Package, Truck, ShoppingCart, Search, X } from 'lucide-react';
import { MainView, SalesProject, ProductionProject } from '../types';
import { formatCurrency, salesStageColor, productionStageColor } from '../utils/helpers';

interface DashboardStats {
  totalCustomers: number;
  totalRevenue: number;
  activeDeals: number;
  activeProduction: number;
  depositsReceived: number;
  paymentAlerts: number;
  inventoryItems: number;
  lowStockItems: number;
  inventoryValue: number;
  suppliers: number;
  openPOs: number;
}

interface SearchResult {
  id: number;
  name: string;
  type: string;
  category: string;
  icon: string;
  navigateTo: MainView;
}

interface DashboardProps {
  onNavigate: (view: MainView) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCustomers: 0, totalRevenue: 0, activeDeals: 0, activeProduction: 0,
    depositsReceived: 0, paymentAlerts: 0, inventoryItems: 0, lowStockItems: 0,
    inventoryValue: 0, suppliers: 0, openPOs: 0,
  });
  const [recentDeals, setRecentDeals] = useState<SalesProject[]>([]);
  const [activeProjects, setActiveProjects] = useState<ProductionProject[]>([]);
  const [lowStockItems, setLowStockItems] = useState<any[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Master Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (searchTerm.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      searchAll(searchTerm);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [searchTerm]);

  async function searchAll(term: string) {
    setSearchLoading(true);
    setShowResults(true);
    try {
      const [customers, inventory, formulas, production, suppliers, pos] = await Promise.all([
        window.tasklet.sqlQuery(`SELECT id, name FROM customers WHERE name LIKE ? OR company_name LIKE ? OR email LIKE ? LIMIT 5`, [`%${term}%`, `%${term}%`, `%${term}%`]),
        window.tasklet.sqlQuery(`SELECT id, ingredient_name as name FROM inventory WHERE ingredient_name LIKE ? LIMIT 5`, [`%${term}%`]),
        window.tasklet.sqlQuery(`SELECT id, formula_name as name FROM formulas WHERE formula_name LIKE ? LIMIT 5`, [`%${term}%`]),
        window.tasklet.sqlQuery(`SELECT id, project_name as name FROM production_projects WHERE project_name LIKE ? LIMIT 5`, [`%${term}%`]),
        window.tasklet.sqlQuery(`SELECT id, name FROM suppliers WHERE name LIKE ? OR contact_name LIKE ? LIMIT 5`, [`%${term}%`, `%${term}%`]),
        window.tasklet.sqlQuery(`SELECT id, COALESCE(supplier, 'PO-' || printf('%04d', id)) as name FROM purchase_orders WHERE supplier LIKE ? OR 'PO-' || printf('%04d', id) LIKE ? LIMIT 5`, [`%${term}%`, `%${term}%`]),
      ]);

      const results: SearchResult[] = [
        ...(customers as any[]).map(r => ({ id: r.id, name: r.name, type: 'customer', category: 'Customers', icon: '👤', navigateTo: 'customers' as MainView })),
        ...(inventory as any[]).map(r => ({ id: r.id, name: r.name, type: 'inventory', category: 'Inventory', icon: '📦', navigateTo: 'inventory' as MainView })),
        ...(formulas as any[]).map(r => ({ id: r.id, name: r.name, type: 'formula', category: 'Formulas', icon: '🧪', navigateTo: 'formulas' as MainView })),
        ...(production as any[]).map(r => ({ id: r.id, name: r.name, type: 'production', category: 'Production', icon: '🏭', navigateTo: 'production' as MainView })),
        ...(suppliers as any[]).map(r => ({ id: r.id, name: r.name, type: 'supplier', category: 'Suppliers', icon: '🚚', navigateTo: 'suppliers' as MainView })),
        ...(pos as any[]).map(r => ({ id: r.id, name: r.name, type: 'po', category: 'Purchase Orders', icon: '📋', navigateTo: 'purchase_orders' as MainView })),
      ];

      setSearchResults(results);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  async function loadDashboard() {
    try {
      const [custCount, revenue, deals, prod, deposits, alerts, invCount, lowCount, invValue, supCount, poCount] = await Promise.all([
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM customers"),
        window.tasklet.sqlQuery("SELECT COALESCE(SUM(estimated_revenue), 0) as r FROM sales_projects"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM sales_projects WHERE sales_stage NOT IN ('Project Started')"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM production_projects WHERE production_stage != 'Completed'"),
        window.tasklet.sqlQuery("SELECT COALESCE(SUM(deposit_paid), 0) as d FROM production_projects"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM production_projects WHERE payment_status IN ('Balance Due', 'Deposit Pending') AND production_stage IN ('Ready to Ship', 'Payment Pending')"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM inventory"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM inventory WHERE status IN ('Low Stock','Out of Stock')"),
        window.tasklet.sqlQuery("SELECT COALESCE(SUM(current_stock_kg * cost_per_kg), 0) as v FROM inventory"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM suppliers"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM purchase_orders WHERE status NOT IN ('Received','Delivered')"),
      ]);

      setStats({
        totalCustomers: (custCount[0] as any).c,
        totalRevenue: (revenue[0] as any).r,
        activeDeals: (deals[0] as any).c,
        activeProduction: (prod[0] as any).c,
        depositsReceived: (deposits[0] as any).d,
        paymentAlerts: (alerts[0] as any).c,
        inventoryItems: (invCount[0] as any).c,
        lowStockItems: (lowCount[0] as any).c,
        inventoryValue: (invValue[0] as any).v,
        suppliers: (supCount[0] as any).c,
        openPOs: (poCount[0] as any).c,
      });

      const recentRows = await window.tasklet.sqlQuery(
        "SELECT sp.*, c.name as customer_name, c.company_name FROM sales_projects sp LEFT JOIN customers c ON sp.customer_id = c.id ORDER BY sp.updated_at DESC LIMIT 5"
      );
      setRecentDeals(recentRows as unknown as SalesProject[]);

      const prodRows = await window.tasklet.sqlQuery(
        "SELECT pp.*, c.name as customer_name, c.company_name FROM production_projects pp LEFT JOIN customers c ON pp.customer_id = c.id WHERE pp.production_stage != 'Completed' ORDER BY pp.updated_at DESC LIMIT 5"
      );
      setActiveProjects(prodRows as unknown as ProductionProject[]);

      const lowRows = await window.tasklet.sqlQuery(
        "SELECT i.ingredient_name, i.current_stock_kg, i.low_stock_threshold_kg, i.status, s.name as supplier_name FROM inventory i LEFT JOIN suppliers s ON i.supplier_id = s.id WHERE i.status IN ('Low Stock','Out of Stock') ORDER BY i.current_stock_kg ASC LIMIT 8"
      );
      setLowStockItems(lowRows);

      const alertRows = await window.tasklet.sqlQuery(
        `SELECT id, ingredient_name, current_stock_kg, low_stock_threshold_kg, item_type 
         FROM inventory 
         WHERE current_stock_kg < low_stock_threshold_kg AND low_stock_threshold_kg > 0
         ORDER BY (current_stock_kg * 1.0 / low_stock_threshold_kg) ASC
         LIMIT 10`
      );
      setLowStockAlerts(alertRows as any[]);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  // Group search results by category
  const groupedResults: Record<string, SearchResult[]> = {};
  searchResults.forEach(r => {
    if (!groupedResults[r.category]) groupedResults[r.category] = [];
    groupedResults[r.category].push(r);
  });

  return (
    <div className="animate-in p-6 md:p-8 space-y-8 overflow-y-auto h-full">
      {/* Header */}
      <div className="page-header border-0 mb-0 pb-0">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900" style={{ letterSpacing: '-0.03em' }}>Dashboard</h2>
        <p className="text-sm text-gray-400 mt-1">Overview of your manufacturing operations</p>
      </div>

      {/* Master Search */}
      <div ref={searchRef} className="search-bar relative max-w-2xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-300" />
          <input
            type="text"
            placeholder="Search customers, inventory, formulas, suppliers..."
            className="input w-full pl-10 pr-10 h-11 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => { if (searchResults.length > 0) setShowResults(true); }}
          />
          {searchTerm && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 btn btn-ghost btn-xs btn-circle"
              onClick={() => { setSearchTerm(''); setSearchResults([]); setShowResults(false); }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 max-h-[400px] overflow-y-auto" style={{ boxShadow: '0 12px 40px rgba(0,0,0,0.12)' }}>
            {searchLoading ? (
              <div className="flex items-center justify-center py-6">
                <span className="loading loading-spinner loading-sm text-primary" />
                <span className="ml-2 text-sm text-gray-400">Searching...</span>
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-6 text-gray-400 text-sm">
                No results found for "{searchTerm}"
              </div>
            ) : (
              Object.entries(groupedResults).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-2 bg-gray-50 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
                    {items[0].icon} {category} ({items.length})
                  </div>
                  {items.map((result) => (
                    <button
                      key={`${result.type}-${result.id}`}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors flex items-center gap-3 border-b border-gray-50 last:border-0"
                      onClick={() => {
                        onNavigate(result.navigateTo);
                        setShowResults(false);
                        setSearchTerm('');
                      }}
                    >
                      <span className="text-lg">{result.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{result.name}</p>
                        <p className="text-xs text-gray-400">{result.category}</p>
                      </div>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Low Stock Alerts Banner */}
      {lowStockAlerts.length > 0 && (
        <div className="glass-card p-4 border-l-4 border-amber-400">
          <h3 className="font-semibold text-amber-700 flex items-center gap-2 mb-3">
            ⚠️ Low Stock Alerts ({lowStockAlerts.length} items)
          </h3>
          <div className="space-y-2">
            {lowStockAlerts.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-amber-50 rounded-lg cursor-pointer hover:bg-amber-100 transition-colors" onClick={() => onNavigate('inventory')}>
                <div>
                  <p className="font-medium text-sm">{item.ingredient_name}</p>
                  <p className="text-xs text-gray-500">{item.item_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-amber-600">{Number(item.current_stock_kg).toFixed(2)} kg</p>
                  <p className="text-xs text-gray-400">min: {Number(item.low_stock_threshold_kg).toFixed(2)} kg</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sales & Operations Stats */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-gray-300 tracking-wider mb-3">Sales & Operations</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={<Users size={20} />} label="Customers" value={String(stats.totalCustomers)} color="blue" onClick={() => onNavigate('customers')} />
          <StatCard icon={<DollarSign size={20} />} label="Pipeline Value" value={formatCurrency(stats.totalRevenue)} color="green" onClick={() => onNavigate('sales_pipeline')} />
          <StatCard icon={<GitBranch size={20} />} label="Active Deals" value={String(stats.activeDeals)} color="purple" onClick={() => onNavigate('sales_pipeline')} />
          <StatCard icon={<Factory size={20} />} label="In Production" value={String(stats.activeProduction)} color="cyan" onClick={() => onNavigate('production')} />
          <StatCard icon={<TrendingUp size={20} />} label="Deposits Collected" value={formatCurrency(stats.depositsReceived)} color="green" />
          {stats.paymentAlerts > 0 && (
            <StatCard icon={<AlertTriangle size={20} />} label="Payment Alerts" value={String(stats.paymentAlerts)} color="red" onClick={() => onNavigate('production')} />
          )}
        </div>
      </div>

      {/* Supply Chain Stats */}
      <div>
        <h3 className="text-xs font-semibold uppercase text-gray-300 tracking-wider mb-3">Supply Chain</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Package size={20} />} label="Inventory Items" value={String(stats.inventoryItems)} color="blue" onClick={() => onNavigate('inventory')} />
          {stats.lowStockItems > 0 ? (
            <StatCard icon={<AlertTriangle size={20} />} label="Low / Out of Stock" value={String(stats.lowStockItems)} color="amber" onClick={() => onNavigate('inventory')} />
          ) : (
            <StatCard icon={<Package size={20} />} label="Stock Status" value="All Good ✓" color="green" onClick={() => onNavigate('inventory')} />
          )}
          <StatCard icon={<DollarSign size={20} />} label="Inventory Value" value={formatCurrency(stats.inventoryValue)} color="purple" onClick={() => onNavigate('inventory')} />
          <StatCard icon={<Truck size={20} />} label="Suppliers" value={String(stats.suppliers)} color="cyan" onClick={() => onNavigate('suppliers')} />
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales Deals */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Recent Deals</h3>
            <button className="btn btn-ghost btn-xs text-blue-500" onClick={() => onNavigate('sales_pipeline')}>View All</button>
          </div>
          {recentDeals.length === 0 ? (
            <div className="empty-state py-8">
              <p className="text-sm text-gray-400">No deals yet. Add your first project!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentDeals.map((deal) => (
                <div key={deal.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{deal.project_name}</p>
                    <p className="text-xs text-gray-400">{deal.company_name || deal.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{formatCurrency(deal.estimated_revenue)}</span>
                    <span className={`badge badge-xs ${salesStageColor(deal.sales_stage)}`}>{deal.sales_stage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active Production */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Active Production</h3>
            <button className="btn btn-ghost btn-xs text-blue-500" onClick={() => onNavigate('production')}>View All</button>
          </div>
          {activeProjects.length === 0 ? (
            <div className="empty-state py-8">
              <p className="text-sm text-gray-400">No active production projects.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {activeProjects.map((proj) => (
                <div key={proj.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{proj.project_name}</p>
                    <p className="text-xs text-gray-400">{proj.company_name || proj.customer_name}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <progress className="progress progress-primary w-16" value={proj.progress_percent} max={100} />
                    <span className={`badge badge-xs ${productionStageColor(proj.production_stage)}`}>{proj.production_stage}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Low Stock Alerts */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">
              <AlertTriangle size={14} className="inline text-amber-500 mr-1" /> Stock Alerts
            </h3>
            <button className="btn btn-ghost btn-xs text-blue-500" onClick={() => onNavigate('inventory')}>View All</button>
          </div>
          {lowStockItems.length === 0 ? (
            <div className="empty-state py-8">
              <Package size={24} className="mx-auto text-green-400 mb-2" />
              <p className="text-sm text-gray-400">All stock levels healthy!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map((item: any, idx: number) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50/80 hover:bg-gray-100/80 transition-colors">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{item.ingredient_name}</p>
                    <p className="text-xs text-gray-400">{item.supplier_name || 'No supplier'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{Number(item.current_stock_kg).toFixed(2)} KG</span>
                    <span className={`badge badge-xs ${item.status === 'Out of Stock' ? 'badge-error' : 'badge-warning'}`}>
                      {item.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  onClick?: () => void;
}

const colorMap: Record<string, { bg: string; text: string; iconBg: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-600', iconBg: 'bg-blue-100' },
  green: { bg: 'bg-emerald-50', text: 'text-emerald-600', iconBg: 'bg-emerald-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-600', iconBg: 'bg-purple-100' },
  cyan: { bg: 'bg-cyan-50', text: 'text-cyan-600', iconBg: 'bg-cyan-100' },
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', iconBg: 'bg-amber-100' },
  red: { bg: 'bg-red-50', text: 'text-red-600', iconBg: 'bg-red-100' },
};

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, onClick }) => {
  const c = colorMap[color] || colorMap.blue;
  return (
    <div
      className="glass-card cursor-pointer group"
      onClick={onClick}
      style={{ padding: '16px 20px' }}
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${c.iconBg} ${c.text} transition-transform group-hover:scale-110`}>
          {icon}
        </div>
        <div>
          <p className="text-xs text-gray-400 font-medium">{label}</p>
          <p className="text-lg font-bold text-gray-900" style={{ letterSpacing: '-0.02em' }}>{value}</p>
        </div>
      </div>
    </div>
  );
};
