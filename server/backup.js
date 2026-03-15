const { queryAll, runSql, saveDb } = require('./db');
const fs = require('fs');
const path = require('path');

const SEED_PATH = path.join(__dirname, '..', 'data', 'seed-data.json');

const ALL_TABLES = [
  'customers', 'sales_projects', 'production_projects', 
  'inventory', 'suppliers', 'purchase_orders',
  'formulas', 'formula_ingredients', 'production_batches', 
  'batch_ingredients', 'attachments'
];

function exportBackup() {
  const backup = { 
    version: 1, 
    created_at: new Date().toISOString(),
    tables: {} 
  };
  for (const table of ALL_TABLES) {
    try {
      backup.tables[table] = queryAll(`SELECT * FROM ${table}`);
    } catch(e) {
      backup.tables[table] = [];
    }
  }
  return backup;
}

function importRestore(backupData) {
  const results = { restored: [], errors: [] };
  
  if (!backupData || !backupData.tables) {
    results.errors.push('Invalid backup format');
    return results;
  }
  
  for (const table of ALL_TABLES) {
    if (!backupData.tables[table] || backupData.tables[table].length === 0) continue;
    
    try {
      runSql(`DELETE FROM ${table}`);
      
      const rows = backupData.tables[table];
      let inserted = 0;
      
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(c => row[c]);
        runSql(
          `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
        inserted++;
      }
      
      results.restored.push({ table, count: inserted });
    } catch(e) {
      results.errors.push(`${table}: ${e.message}`);
    }
  }
  
  saveDb();
  return results;
}

function saveSeedFile() {
  const backup = exportBackup();
  const hasData = Object.values(backup.tables).some(rows => rows.length > 0);
  if (!hasData) return false;
  
  const dir = path.dirname(SEED_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(SEED_PATH, JSON.stringify(backup, null, 2));
  return true;
}

function loadSeedFile() {
  if (!fs.existsSync(SEED_PATH)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
    return data;
  } catch(e) {
    console.error('Failed to read seed file:', e.message);
    return null;
  }
}

function isDbEmpty() {
  for (const table of ALL_TABLES) {
    try {
      const rows = queryAll(`SELECT COUNT(*) as c FROM ${table}`);
      if (rows[0].c > 0) return false;
    } catch(e) {}
  }
  return true;
}

module.exports = { exportBackup, importRestore, saveSeedFile, loadSeedFile, isDbEmpty, SEED_PATH };
