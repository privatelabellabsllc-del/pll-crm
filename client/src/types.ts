// === DATABASE ENTITY TYPES ===

export interface Customer {
  id: number;
  name: string;
  company_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  sales_rep: string | null;
  priority: 'normal' | 'high' | 'vip';
  total_revenue: number;
  order_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface SalesProject {
  id: number;
  customer_id: number;
  project_name: string;
  product_type: string | null;
  estimated_units: number | null;
  quoted_price_per_unit: number | null;
  estimated_revenue: number | null;
  scope_description: string | null;
  sales_stage: SalesStage;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  company_name?: string;
}

export interface ProductionProject {
  id: number;
  sales_project_id: number | null;
  customer_id: number;
  project_name: string;
  production_stage: ProductionStage;
  assigned_to: string | null;
  expected_completion: string | null;
  progress_percent: number;
  total_value: number;
  deposit_paid: number;
  balance_remaining: number;
  payment_status: string;
  profit_estimate: number;
  formula_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customer_name?: string;
  company_name?: string;
  formula_name?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  lead_time_days: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ingredient_count?: number;
  open_po_count?: number;
}

export interface InventoryItem {
  id: number;
  ingredient_name: string;
  supplier_id: number | null;
  cost_per_kg: number | null;
  moq_kg: number | null;
  lot_number: string | null;
  sds_path: string | null;
  warehouse_aisle: string | null;
  warehouse_shelf: string | null;
  warehouse_bin: string | null;
  current_stock_kg: number;
  low_stock_threshold_kg: number;
  item_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string;
}

export interface PurchaseOrder {
  id: number;
  supplier_id: number;
  inventory_id: number | null;
  quantity_kg: number | null;
  price: number | null;
  expected_delivery: string | null;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  eta: string | null;
  production_project_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier_name?: string;
  ingredient_name?: string;
  project_name?: string;
}

export interface Formula {
  id: number;
  formula_name: string;
  product_type: string | null;
  packaging_cost: number;
  labor_cost: number;
  overhead_cost: number;
  total_cost_per_unit: number;
  suggested_price: number;
  profit_margin: number;
  batch_size_units: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  ingredient_count?: number;
  total_ingredient_cost?: number;
}

export interface FormulaIngredient {
  id: number;
  formula_id: number;
  inventory_id: number;
  amount_grams: number;
  cost_per_batch: number;
  cost_per_unit: number;
  ingredient_name?: string;
  current_stock_kg?: number;
  cost_per_kg?: number;
}

export interface Attachment {
  id: number;
  entity_type: string;
  entity_id: number;
  file_name: string;
  file_path: string | null;
  file_type: string | null;
  uploaded_at: string;
}

// === STAGE TYPES ===

export type SalesStage =
  | 'New Lead'
  | 'Contacted'
  | 'Qualified Lead'
  | 'Quoted'
  | 'Negotiation'
  | 'Deposit Received'
  | 'Project Started';

export type ProductionStage =
  | 'Deposit Received'
  | 'Purchasing Ingredients'
  | 'Ingredients Ordered'
  | 'Ingredients Received'
  | 'Sample Batching'
  | 'Samples Sent to Customer'
  | 'Sample Revision Required'
  | 'Sample Approved'
  | 'Production Scheduled'
  | 'Production In Progress'
  | 'Quality Control'
  | 'Packaging'
  | 'Ready to Ship'
  | 'Payment Pending'
  | 'Shipped'
  | 'Completed';

export const SALES_STAGES: SalesStage[] = [
  'New Lead',
  'Contacted',
  'Qualified Lead',
  'Quoted',
  'Negotiation',
  'Deposit Received',
  'Project Started',
];

export const PRODUCTION_STAGES: ProductionStage[] = [
  'Deposit Received',
  'Purchasing Ingredients',
  'Ingredients Ordered',
  'Ingredients Received',
  'Sample Batching',
  'Samples Sent to Customer',
  'Sample Revision Required',
  'Sample Approved',
  'Production Scheduled',
  'Production In Progress',
  'Quality Control',
  'Packaging',
  'Ready to Ship',
  'Payment Pending',
  'Shipped',
  'Completed',
];

export const PRODUCT_TYPES = [
  'Serum', 'Cream', 'Oil', 'Shampoo', 'Conditioner', 'Body Wash',
  'Lotion', 'Cleanser', 'Toner', 'Mask', 'Scrub', 'Balm', 'Spray', 'Other',
];

// === PRODUCTION BATCH & COMPLIANCE TYPES ===

export interface ProductionBatch {
  id: number;
  production_project_id: number;
  batch_number: string;
  production_date: string | null;
  notes: string | null;
  created_at: string;
  project_name?: string;
  customer_name?: string;
}

export interface BatchIngredientRecord {
  id: number;
  batch_id: number;
  inventory_id: number;
  lot_number: string | null;
  supplier_lot_number: string | null;
  amount_used_grams: number | null;
  ingredient_name?: string;
  supplier_name?: string;
}

// === ANALYTICS TYPES ===

export interface ProjectProfit {
  id: number;
  project_name: string;
  customer_name: string;
  company_name: string | null;
  total_value: number;
  deposit_paid: number;
  balance_remaining: number;
  profit_estimate: number;
  production_stage: string;
  formula_name: string | null;
  formula_cost_per_unit: number | null;
  batch_size_units: number | null;
}

export interface MonthlyRevenue {
  month: string;
  revenue: number;
  deposits: number;
  project_count: number;
}

export interface TopCustomer {
  id: number;
  name: string;
  company_name: string | null;
  total_revenue: number;
  order_count: number;
  priority: string;
}

export const ITEM_TYPES = ['Raw Material', 'Packaging', 'Label', 'Bottle'];
export const INVENTORY_STATUSES = ['In Stock', 'Low Stock', 'Out of Stock'];
export const PO_STATUSES = ['Draft', 'Ordered', 'Shipped', 'Delivered', 'Received'];

export const PRIORITY_LABELS: Record<string, string> = {
  normal: 'Normal',
  high: 'High Priority',
  vip: 'VIP Account',
};

// === VIEW TYPES ===

export type MainView = 'dashboard' | 'customers' | 'sales_pipeline' | 'production' | 'inventory' | 'suppliers' | 'purchase_orders' | 'formulas' | 'production_planning' | 'reports' | 'profit_analytics' | 'compliance';

export type ModalType =
  | 'none'
  | 'add_customer' | 'edit_customer' | 'view_customer'
  | 'add_project' | 'edit_project'
  | 'add_production' | 'edit_production'
  | 'add_inventory' | 'edit_inventory'
  | 'add_supplier' | 'edit_supplier' | 'view_supplier'
  | 'add_po' | 'edit_po'
  | 'add_formula' | 'edit_formula';
