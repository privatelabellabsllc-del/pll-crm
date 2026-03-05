const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
const dbPath = path.join(dataDir, 'pll-crm.db');

let db = null;
let saveTimer = null;

function saveDb() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

// Auto-save every 5 seconds if there are changes
function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveDb();
    saveTimer = null;
  }, 5000);
}

async function initDb() {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const buf = fs.readFileSync(dbPath);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }

  db.run("PRAGMA foreign_keys = ON");

  // Create all tables
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      display_name TEXT,
      role TEXT DEFAULT 'user',
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      company_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      website TEXT,
      sales_rep TEXT,
      priority TEXT DEFAULT 'normal',
      total_revenue REAL DEFAULT 0,
      order_count INTEGER DEFAULT 0,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS sales_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER REFERENCES customers(id),
      project_name TEXT NOT NULL,
      product_type TEXT,
      estimated_units INTEGER,
      quoted_price_per_unit REAL,
      estimated_revenue REAL,
      scope_description TEXT,
      sales_stage TEXT DEFAULT 'New Lead',
      assigned_to TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS production_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sales_project_id INTEGER REFERENCES sales_projects(id),
      customer_id INTEGER REFERENCES customers(id),
      project_name TEXT NOT NULL,
      production_stage TEXT DEFAULT 'Deposit Received',
      assigned_to TEXT,
      expected_completion TEXT,
      progress_percent INTEGER DEFAULT 0,
      total_value REAL DEFAULT 0,
      deposit_paid REAL DEFAULT 0,
      balance_remaining REAL DEFAULT 0,
      payment_status TEXT DEFAULT 'Deposit Pending',
      profit_estimate REAL DEFAULT 0,
      formula_id INTEGER REFERENCES formulas(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ingredient_name TEXT NOT NULL,
      supplier_id INTEGER REFERENCES suppliers(id),
      cost_per_kg REAL DEFAULT 0,
      moq_kg REAL,
      lot_number TEXT,
      sds_path TEXT,
      warehouse_aisle TEXT,
      warehouse_shelf TEXT,
      warehouse_bin TEXT,
      current_stock_kg REAL DEFAULT 0,
      low_stock_threshold_kg REAL DEFAULT 5,
      item_type TEXT DEFAULT 'Raw Material',
      status TEXT DEFAULT 'In Stock',
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS suppliers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact_name TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      website TEXT,
      lead_time_days INTEGER,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS purchase_orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      supplier_id INTEGER REFERENCES suppliers(id),
      inventory_id INTEGER,
      quantity_kg REAL,
      price REAL,
      expected_delivery TEXT,
      status TEXT DEFAULT 'Draft',
      carrier TEXT,
      tracking_number TEXT,
      eta TEXT,
      production_project_id INTEGER REFERENCES production_projects(id),
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS formulas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formula_name TEXT NOT NULL,
      product_type TEXT,
      packaging_cost REAL DEFAULT 0,
      labor_cost REAL DEFAULT 0,
      overhead_cost REAL DEFAULT 0,
      total_cost_per_unit REAL DEFAULT 0,
      suggested_price REAL DEFAULT 0,
      profit_margin REAL DEFAULT 0,
      batch_size_units INTEGER DEFAULT 1,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS formula_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      formula_id INTEGER REFERENCES formulas(id),
      inventory_id INTEGER REFERENCES inventory(id),
      amount_grams REAL DEFAULT 0,
      cost_per_batch REAL DEFAULT 0,
      cost_per_unit REAL DEFAULT 0
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS production_batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      production_project_id INTEGER REFERENCES production_projects(id),
      batch_number TEXT NOT NULL,
      production_date TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS batch_ingredients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      batch_id INTEGER REFERENCES production_batches(id),
      inventory_id INTEGER REFERENCES inventory(id),
      lot_number TEXT,
      supplier_lot_number TEXT,
      amount_used_grams REAL DEFAULT 0
    );
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      file_name TEXT NOT NULL,
      file_path TEXT,
      file_type TEXT,
      uploaded_at TEXT DEFAULT (datetime('now'))
    );
  `);

  saveDb();
  return db;
}

function getDb() {
  return db;
}

// Helper: execute a SELECT query, return array of objects
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length) stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: execute a non-SELECT query
function runSql(sql, params = []) {
  if (params.length) {
    db.run(sql, params);
  } else {
    db.run(sql);
  }
  const changes = db.getRowsModified();
  // Get last insert rowid
  const result = db.exec("SELECT last_insert_rowid() as id");
  const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : 0;
  scheduleSave();
  return { lastInsertRowid, changes };
}

// Graceful save on shutdown
process.on('SIGINT', () => { saveDb(); process.exit(0); });
process.on('SIGTERM', () => { saveDb(); process.exit(0); });
process.on('exit', () => { saveDb(); });

module.exports = { initDb, getDb, queryAll, runSql, saveDb };
