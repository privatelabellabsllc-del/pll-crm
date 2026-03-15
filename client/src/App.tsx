import React, { useState, useEffect, useCallback } from 'react';
import { MainView, ModalType, Customer, SalesProject, ProductionProject, InventoryItem, Supplier, PurchaseOrder, Formula } from './types';
import { AuthProvider, useAuth, LoginScreen } from './auth';
import './api'; // Initialize window.tasklet
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { CustomerList } from './components/CustomerList';
import { CustomerForm } from './components/CustomerForm';
import { CustomerDetail } from './components/CustomerDetail';
import { SalesPipeline } from './components/SalesPipeline';
import { ProjectForm } from './components/ProjectForm';
import { ProductionPipeline } from './components/ProductionPipeline';
import { ProductionForm } from './components/ProductionForm';
import InventoryList from './components/InventoryList';
import InventoryForm from './components/InventoryForm';
import SupplierList from './components/SupplierList';
import SupplierForm from './components/SupplierForm';
import PurchaseOrderList from './components/PurchaseOrderList';
import PurchaseOrderForm from './components/PurchaseOrderForm';
import { FormulaList } from './components/FormulaList';
import { FormulaForm } from './components/FormulaForm';
import { ProductionPlanning } from './components/ProductionPlanning';
import { ReportingDashboard } from './components/ReportingDashboard';
import { ProfitAnalytics } from './components/ProfitAnalytics';
import { ComplianceTraceability } from './components/ComplianceTraceability';
import BackupRestore from './components/BackupRestore';

const CRMApp: React.FC = () => {
  const { logout } = useAuth();
  const [currentView, setCurrentView] = useState<MainView>('dashboard');
  const [modal, setModal] = useState<ModalType>('none');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [selectedProject, setSelectedProject] = useState<SalesProject | null>(null);
  const [selectedProduction, setSelectedProduction] = useState<ProductionProject | null>(null);
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [selectedFormula, setSelectedFormula] = useState<Formula | null>(null);
  const [counts, setCounts] = useState({
    customers: 0, salesProjects: 0, productionProjects: 0,
    inventoryItems: 0, lowStockItems: 0, suppliers: 0, openPOs: 0,
  });
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Load customer data when selectedCustomerId changes
  useEffect(() => {
    if (selectedCustomerId) {
      window.tasklet.sqlQuery(`SELECT * FROM customers WHERE id = ${selectedCustomerId}`)
        .then((rows: any[]) => {
          if (rows.length > 0) setSelectedCustomer(rows[0] as unknown as Customer);
        })
        .catch((err: any) => console.error('Failed to load customer:', err));
    }
  }, [selectedCustomerId, refreshKey]);

  useEffect(() => {
    loadCounts();
  }, [refreshKey]);

  async function loadCounts() {
    try {
      const [c, s, p, inv, low, sup, po] = await Promise.all([
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM customers"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM sales_projects"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM production_projects WHERE production_stage != 'Completed'"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM inventory"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM inventory WHERE status IN ('Low Stock','Out of Stock')"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM suppliers"),
        window.tasklet.sqlQuery("SELECT COUNT(*) as c FROM purchase_orders WHERE status NOT IN ('Received','Delivered')"),
      ]);
      setCounts({
        customers: (c[0] as any).c,
        salesProjects: (s[0] as any).c,
        productionProjects: (p[0] as any).c,
        inventoryItems: (inv[0] as any).c,
        lowStockItems: (low[0] as any).c,
        suppliers: (sup[0] as any).c,
        openPOs: (po[0] as any).c,
      });
    } catch (err) {
      console.error('Failed to load counts:', err);
    }
  }

  function handleModalClose() {
    setModal('none');
    // Don't clear selectedCustomer if profile hub is open (selectedCustomerId is set)
    if (!selectedCustomerId) {
      setSelectedCustomer(null);
    }
    setSelectedProject(null);
    setSelectedProduction(null);
    setSelectedInventory(null);
    setSelectedSupplier(null);
    setSelectedPO(null);
    setSelectedFormula(null);
  }

  function handleSaved() {
    // Keep selectedCustomerId so profile hub stays open after editing
    const keepCustomerId = selectedCustomerId;
    handleModalClose();
    if (keepCustomerId) {
      setSelectedCustomerId(keepCustomerId);
    }
    refresh();
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f5f5f7' }}>
      <Sidebar currentView={currentView} onNavigate={(view) => { setCurrentView(view); setSelectedCustomerId(null); setSelectedCustomer(null); }} counts={counts} isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div className="flex-1 overflow-hidden pt-12 md:pt-0">
        <div key={currentView + refreshKey} className="animate-in h-full">
          {currentView === 'dashboard' && (
            <Dashboard key={refreshKey} onNavigate={setCurrentView} />
          )}
          {currentView === 'customers' && !selectedCustomerId && (
            <CustomerList
              key={refreshKey}
              onAddCustomer={() => setModal('add_customer')}
              onSelectCustomer={(id) => setSelectedCustomerId(id)}
              onEditCustomer={(c) => { setSelectedCustomer(c); setModal('edit_customer'); }}
            />
          )}
          {currentView === 'customers' && selectedCustomerId && selectedCustomer && (
            <CustomerDetail
              key={selectedCustomerId}
              customer={selectedCustomer}
              onClose={() => { setSelectedCustomerId(null); setSelectedCustomer(null); }}
              onEdit={() => setModal('edit_customer')}
              onAddSalesDeal={() => setModal('add_project')}
              onAddProduction={() => setModal('add_production')}
            />
          )}
          {currentView === 'sales_pipeline' && (
            <SalesPipeline
              key={refreshKey}
              onAddProject={() => setModal('add_project')}
              onEditProject={(p) => { setSelectedProject(p); setModal('edit_project'); }}
            />
          )}
          {currentView === 'production' && (
            <ProductionPipeline
              key={refreshKey}
              onAddProduction={() => setModal('add_production')}
              onEditProduction={(p) => { setSelectedProduction(p); setModal('edit_production'); }}
            />
          )}
          {currentView === 'formulas' && (
            <FormulaList
              key={refreshKey}
              onAddFormula={() => setModal('add_formula')}
              onEditFormula={(f) => { setSelectedFormula(f); setModal('edit_formula'); }}
            />
          )}
          {currentView === 'production_planning' && (
            <ProductionPlanning
              key={refreshKey}
              onNavigate={(v) => setCurrentView(v as MainView)}
            />
          )}
          {currentView === 'inventory' && (
            <InventoryList
              key={refreshKey}
              onAddItem={() => setModal('add_inventory')}
              onEditItem={(item) => { setSelectedInventory(item); setModal('edit_inventory'); }}
            />
          )}
          {currentView === 'suppliers' && (
            <SupplierList
              key={refreshKey}
              onAddSupplier={() => setModal('add_supplier')}
              onEditSupplier={(s) => { setSelectedSupplier(s); setModal('edit_supplier'); }}
              onViewSupplier={(s) => { setSelectedSupplier(s); setModal('view_supplier'); }}
            />
          )}
          {currentView === 'purchase_orders' && (
            <PurchaseOrderList
              key={refreshKey}
              onAddPO={() => setModal('add_po')}
              onEditPO={(po) => { setSelectedPO(po); setModal('edit_po'); }}
            />
          )}
          {currentView === 'reports' && (
            <ReportingDashboard key={refreshKey} onNavigate={setCurrentView} />
          )}
          {currentView === 'profit_analytics' && (
            <ProfitAnalytics key={refreshKey} />
          )}
          {currentView === 'compliance' && (
            <ComplianceTraceability key={refreshKey} onRefresh={refresh} />
          )}
          {currentView === 'backup' && (
            <BackupRestore />
          )}
        </div>
      </div>

      {/* Customer Modals */}
      {(modal === 'add_customer' || modal === 'edit_customer') && (
        <CustomerForm
          customer={modal === 'edit_customer' ? selectedCustomer : null}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
      {/* CustomerDetail is now rendered inline as a full-page profile hub */}

      {/* Sales Project Modal */}
      {(modal === 'add_project' || modal === 'edit_project') && (
        <ProjectForm
          project={modal === 'edit_project' ? selectedProject : null}
          preselectedCustomerId={selectedCustomer?.id}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}

      {/* Production Modal */}
      {(modal === 'add_production' || modal === 'edit_production') && (
        <ProductionForm
          project={modal === 'edit_production' ? selectedProduction : null}
          preselectedCustomerId={selectedCustomerId || undefined}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}

      {/* Inventory Modal */}
      {(modal === 'add_inventory' || modal === 'edit_inventory') && (
        <InventoryForm
          item={modal === 'edit_inventory' ? selectedInventory : null}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}

      {/* Supplier Modal */}
      {(modal === 'add_supplier' || modal === 'edit_supplier') && (
        <SupplierForm
          supplier={modal === 'edit_supplier' ? selectedSupplier : null}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}

      {/* Purchase Order Modal */}
      {(modal === 'add_po' || modal === 'edit_po') && (
        <PurchaseOrderForm
          po={modal === 'edit_po' ? selectedPO : null}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}

      {/* Formula Modal */}
      {(modal === 'add_formula' || modal === 'edit_formula') && (
        <FormulaForm
          formula={modal === 'edit_formula' ? selectedFormula : null}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
};

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#f5f5f7' }}>
        <div className="animate-in flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-white text-xl font-bold">P</span>
          </div>
          <span className="loading loading-spinner loading-md text-blue-500" />
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  return <CRMApp />;
}

export default App;
