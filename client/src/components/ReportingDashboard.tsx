import React, { useEffect, useState } from 'react';
import { BarChart3, Users, Package, TrendingUp, DollarSign, ShoppingBag } from 'lucide-react';
import { TopCustomer, MainView } from '../types';
import { formatCurrency } from '../utils/helpers';

interface ReportingProps {
  onNavigate: (view: MainView) => void;
}

interface SummaryStats {
  totalRevenue: number;
  totalDeposits: number;
  totalProjects: number;
  completedProjects: number;
  avgProjectValue: number;
  inventoryValue: number;
  totalFormulas: number;
  totalPOSpend: number;
}

interface ProductTypeStat {
  product_type: string;
  count: number;
  revenue: number;
}

interface IngredientUsage {
  ingredient_name: string;
  formula_count: number;
  total_grams: number;
  cost_per_kg: number;
}

interface MonthlyRow {
  month: string;
  revenue: number;
  project_count: number;
}

export const ReportingDashboard: React.FC<ReportingProps> = ({ onNavigate }) => {
  const [stats, setStats] = useState<SummaryStats>({ totalRevenue: 0, totalDeposits: 0, totalProjects: 0, completedProjects: 0, avgProjectValue: 0, inventoryValue: 0, totalFormulas: 0, totalPOSpend: 0 });
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [productTypes, setProductTypes] = useState<ProductTypeStat[]>([]);
  const [ingredientUsage, setIngredientUsage] = useState<IngredientUsage[]>([]);
  const [monthlyData, setMonthlyData] = useState<MonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadReports(); }, []);

  async function loadReports() {
    try {
      const [rev, dep, proj, comp, invVal, formCount, poSpend] = await Promise.all([
        window.tasklet.sqlQuery("SELECT COALESCE(SUM(total_value), 0) as v FROM production_projects"),
        window.tasklet.sqlQuery("SELECT COALESCE(SUM(deposit_paid), 0) as v FROM production_projects"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM production_projects"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM production_projects WHERE production_stage = 'Completed'"),
        window.tasklet.sqlQuery("SELECT COALESCE(SUM(current_stock_kg * cost_per_kg), 0) as v FROM inventory"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM formulas"),
        window.tasklet.sqlQuery("SELECT COALESCE(SUM(price), 0) as v FROM purchase_orders WHERE status IN ('Ordered','Shipped','Delivered','Received')"),
      ]);

      const totalRev = Number((rev[0] as any).v);
      const totalProj = Number((proj[0] as any).c);
      setStats({
        totalRevenue: totalRev,
        totalDeposits: Number((dep[0] as any).v),
        totalProjects: totalProj,
        completedProjects: Number((comp[0] as any).c),
        avgProjectValue: totalProj > 0 ? totalRev / totalProj : 0,
        inventoryValue: Number((invVal[0] as any).v),
        totalFormulas: Number((formCount[0] as any).c),
        totalPOSpend: Number((poSpend[0] as any).v),
      });

      const custRows = await window.tasklet.sqlQuery(
        "SELECT id, name, company_name, total_revenue, order_count, priority FROM customers ORDER BY total_revenue DESC LIMIT 10"
      );
      setTopCustomers(custRows as unknown as TopCustomer[]);

      const ptRows = await window.tasklet.sqlQuery(
        `SELECT COALESCE(sp.product_type, 'Other') as product_type, COUNT(*) as count, 
         COALESCE(SUM(sp.estimated_revenue), 0) as revenue 
         FROM sales_projects sp GROUP BY sp.product_type ORDER BY revenue DESC LIMIT 10`
      );
      setProductTypes(ptRows as unknown as ProductTypeStat[]);

      const usageRows = await window.tasklet.sqlQuery(
        `SELECT i.ingredient_name, COUNT(DISTINCT fi.formula_id) as formula_count,
         COALESCE(SUM(fi.amount_grams), 0) as total_grams, COALESCE(i.cost_per_kg, 0) as cost_per_kg
         FROM formula_ingredients fi JOIN inventory i ON fi.inventory_id = i.id
         GROUP BY fi.inventory_id ORDER BY formula_count DESC, total_grams DESC LIMIT 10`
      );
      setIngredientUsage(usageRows as unknown as IngredientUsage[]);

      const monthRows = await window.tasklet.sqlQuery(
        `SELECT strftime('%Y-%m', created_at) as month, COALESCE(SUM(total_value), 0) as revenue,
         COUNT(*) as project_count FROM production_projects GROUP BY month ORDER BY month DESC LIMIT 12`
      );
      setMonthlyData((monthRows as unknown as MonthlyRow[]).reverse());

    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner loading-lg text-primary" /></div>;

  const maxMonthlyRev = Math.max(...monthlyData.map(m => m.revenue), 1);

  return (
    <div className="p-6 space-y-6 overflow-y-auto h-full">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2"><BarChart3 size={24} className="text-primary" /> Reports & Analytics</h2>
          <p className="text-sm text-base-content/50">Business overview and performance metrics</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<DollarSign size={20} />} label="Total Revenue" value={formatCurrency(stats.totalRevenue)} sub={`${stats.totalProjects} projects`} color="text-success" />
        <KpiCard icon={<TrendingUp size={20} />} label="Deposits Collected" value={formatCurrency(stats.totalDeposits)} sub={`${stats.completedProjects} completed`} color="text-primary" />
        <KpiCard icon={<ShoppingBag size={20} />} label="Avg Project Value" value={formatCurrency(stats.avgProjectValue)} sub={`${stats.totalFormulas} formulas`} color="text-secondary" />
        <KpiCard icon={<Package size={20} />} label="Inventory Value" value={formatCurrency(stats.inventoryValue)} sub={formatCurrency(stats.totalPOSpend) + ' PO spend'} color="text-accent" />
      </div>

      {/* Monthly Revenue Chart */}
      <div className="card bg-base-200">
        <div className="card-body p-4">
          <h3 className="card-title text-sm mb-4">Monthly Revenue</h3>
          {monthlyData.length === 0 ? (
            <p className="text-base-content/50 text-sm text-center py-8">No revenue data yet. Complete some projects to see trends!</p>
          ) : (
            <div className="flex items-end gap-2 h-40">
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-semibold">{formatCurrency(m.revenue)}</span>
                  <div
                    className="w-full bg-primary rounded-t transition-all"
                    style={{ height: `${Math.max((m.revenue / maxMonthlyRev) * 100, 4)}%`, minHeight: '4px' }}
                  />
                  <span className="text-xs text-base-content/50">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Three Column Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top Customers */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="card-title text-sm"><Users size={14} /> Top Customers</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => onNavigate('customers')}>View All</button>
            </div>
            {topCustomers.length === 0 ? (
              <p className="text-base-content/50 text-sm">No customers yet.</p>
            ) : (
              <div className="space-y-2">
                {topCustomers.map((c, i) => (
                  <div key={c.id} className="flex items-center justify-between p-2 rounded bg-base-300/50">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-base-content/40 w-5">#{i + 1}</span>
                      <div>
                        <p className="text-sm font-medium">{c.company_name || c.name}</p>
                        <p className="text-xs text-base-content/50">{c.order_count} orders</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-success">{formatCurrency(c.total_revenue)}</p>
                      {c.priority !== 'normal' && <span className={`badge badge-xs ${c.priority === 'vip' ? 'badge-error' : 'badge-warning'}`}>{c.priority.toUpperCase()}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Best Selling Product Types */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h3 className="card-title text-sm mb-3"><ShoppingBag size={14} /> Best Selling Products</h3>
            {productTypes.length === 0 ? (
              <p className="text-base-content/50 text-sm">No sales data yet.</p>
            ) : (
              <div className="space-y-2">
                {productTypes.map((pt, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-base-300/50">
                    <div>
                      <p className="text-sm font-medium">{pt.product_type}</p>
                      <p className="text-xs text-base-content/50">{pt.count} projects</p>
                    </div>
                    <p className="text-sm font-semibold text-success">{formatCurrency(pt.revenue)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Ingredients by Usage */}
        <div className="card bg-base-200">
          <div className="card-body p-4">
            <h3 className="card-title text-sm mb-3"><Package size={14} /> Ingredient Usage</h3>
            {ingredientUsage.length === 0 ? (
              <p className="text-base-content/50 text-sm">No formula data yet.</p>
            ) : (
              <div className="space-y-2">
                {ingredientUsage.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded bg-base-300/50">
                    <div>
                      <p className="text-sm font-medium">{ing.ingredient_name}</p>
                      <p className="text-xs text-base-content/50">In {ing.formula_count} formulas</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold">{(ing.total_grams / 1000).toFixed(2)} KG</p>
                      <p className="text-xs text-base-content/50">{formatCurrency(ing.cost_per_kg)}/KG</p>
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

const KpiCard: React.FC<{ icon: React.ReactNode; label: string; value: string; sub: string; color: string }> = ({ icon, label, value, sub, color }) => (
  <div className="card bg-base-200">
    <div className="card-body p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className={color}>{icon}</span>
        <span className="text-xs text-base-content/50">{label}</span>
      </div>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-xs text-base-content/40">{sub}</p>
    </div>
  </div>
);
