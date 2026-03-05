import React, { useEffect, useState } from 'react';
import { Users, DollarSign, GitBranch, Factory, AlertTriangle, TrendingUp, Package, Truck, ShoppingCart } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

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

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      {/* Sales & Operations Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase text-base-content/40 tracking-wider mb-3">Sales & Operations</h2>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={<Users size={20} />} label="Customers" value={String(stats.totalCustomers)} color="primary" onClick={() => onNavigate('customers')} />
          <StatCard icon={<DollarSign size={20} />} label="Pipeline Value" value={formatCurrency(stats.totalRevenue)} color="success" onClick={() => onNavigate('sales_pipeline')} />
          <StatCard icon={<GitBranch size={20} />} label="Active Deals" value={String(stats.activeDeals)} color="secondary" onClick={() => onNavigate('sales_pipeline')} />
          <StatCard icon={<Factory size={20} />} label="In Production" value={String(stats.activeProduction)} color="info" onClick={() => onNavigate('production')} />
          <StatCard icon={<TrendingUp size={20} />} label="Deposits Collected" value={formatCurrency(stats.depositsReceived)} color="success" />
          {stats.paymentAlerts > 0 && (
            <StatCard icon={<AlertTriangle size={20} />} label="Payment Alerts" value={String(stats.paymentAlerts)} color="error" onClick={() => onNavigate('production')} />
          )}
        </div>
      </div>

      {/* Supply Chain Stats */}
      <div>
        <h2 className="text-xs font-semibold uppercase text-base-content/40 tracking-wider mb-3">Supply Chain</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={<Package size={20} />} label="Inventory Items" value={String(stats.inventoryItems)} color="primary" onClick={() => onNavigate('inventory')} />
          {stats.lowStockItems > 0 ? (
            <StatCard icon={<AlertTriangle size={20} />} label="Low / Out of Stock" value={String(stats.lowStockItems)} color="warning" onClick={() => onNavigate('inventory')} />
          ) : (
            <StatCard icon={<Package size={20} />} label="Stock Status" value="All Good ✓" color="success" onClick={() => onNavigate('inventory')} />
          )}
          <StatCard icon={<DollarSign size={20} />} label="Inventory Value" value={formatCurrency(stats.inventoryValue)} color="accent" onClick={() => onNavigate('inventory')} />
          <StatCard icon={<Truck size={20} />} label="Suppliers" value={String(stats.suppliers)} color="info" onClick={() => onNavigate('suppliers')} />
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Sales Deals */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title text-sm">Recent Deals</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => onNavigate('sales_pipeline')}>View All</button>
            </div>
            {recentDeals.length === 0 ? (
              <p className="text-base-content/50 text-sm">No deals yet. Add your first project!</p>
            ) : (
              <div className="space-y-2">
                {recentDeals.map((deal) => (
                  <div key={deal.id} className="flex items-center justify-between p-2 rounded bg-base-300/50">
                    <div>
                      <p className="text-sm font-medium">{deal.project_name}</p>
                      <p className="text-xs text-base-content/50">{deal.company_name || deal.customer_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-base-content/50">{formatCurrency(deal.estimated_revenue)}</span>
                      <span className={`badge badge-xs ${salesStageColor(deal.sales_stage)}`}>{deal.sales_stage}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active Production */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title text-sm">Active Production</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => onNavigate('production')}>View All</button>
            </div>
            {activeProjects.length === 0 ? (
              <p className="text-base-content/50 text-sm">No active production projects.</p>
            ) : (
              <div className="space-y-2">
                {activeProjects.map((proj) => (
                  <div key={proj.id} className="flex items-center justify-between p-2 rounded bg-base-300/50">
                    <div>
                      <p className="text-sm font-medium">{proj.project_name}</p>
                      <p className="text-xs text-base-content/50">{proj.company_name || proj.customer_name}</p>
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
        </div>

        {/* Low Stock Alerts */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title text-sm">
                <AlertTriangle size={14} className="text-warning" /> Stock Alerts
              </h3>
              <button className="btn btn-ghost btn-xs" onClick={() => onNavigate('inventory')}>View All</button>
            </div>
            {lowStockItems.length === 0 ? (
              <div className="text-center py-4">
                <Package size={24} className="mx-auto text-success mb-2" />
                <p className="text-base-content/50 text-sm">All stock levels healthy!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {lowStockItems.map((item: any, idx: number) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded bg-base-300/50">
                    <div>
                      <p className="text-sm font-medium">{item.ingredient_name}</p>
                      <p className="text-xs text-base-content/50">{item.supplier_name || 'No supplier'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{Number(item.current_stock_kg).toFixed(2)} KG</span>
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

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, onClick }) => (
  <div className={`card bg-base-200 cursor-pointer hover:bg-base-300 transition-colors`} onClick={onClick}>
    <div className="card-body p-4 flex-row items-center gap-3">
      <div className={`p-2 rounded-lg bg-${color}/10 text-${color}`}>{icon}</div>
      <div>
        <p className="text-xs text-base-content/50">{label}</p>
        <p className="text-lg font-bold">{value}</p>
      </div>
    </div>
  </div>
);
