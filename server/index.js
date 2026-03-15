require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { initDb, queryAll, runSql, saveDb } = require('./db');
const { generateToken, hashPassword, comparePassword, authMiddleware } = require('./auth');
const { exportBackup, importRestore, saveSeedFile, loadSeedFile, isDbEmpty } = require('./backup');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function start() {
  await initDb();

  // Auto-restore from seed file if database is empty
  if (isDbEmpty()) {
    const seedData = loadSeedFile();
    if (seedData) {
      console.log('Empty database detected - restoring from seed-data.json...');
      const result = importRestore(seedData);
      console.log('Auto-restore complete:', result.restored.map(r => `${r.table}: ${r.count} rows`).join(', '));
      if (result.errors.length > 0) console.error('Restore errors:', result.errors);
    }
  }

  const app = express();
  const PORT = process.env.PORT || 3001;

  app.use(cors({
    origin: [
      'http://localhost:5173',
      'http://localhost:3001',
      process.env.FRONTEND_URL
    ].filter(Boolean),
    credentials: true,
  }));

  app.use(express.json({ limit: '10mb' }));

  // Auth routes
  app.post('/api/auth/register', (req, res) => {
    try {
      const { username, password, display_name } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

      const existing = queryAll('SELECT id FROM users WHERE username = ?', [username]);
      if (existing.length > 0) return res.status(409).json({ error: 'Username already exists' });

      const password_hash = hashPassword(password);
      const result = runSql('INSERT INTO users (username, password_hash, display_name) VALUES (?, ?, ?)', [username, password_hash, display_name || username]);
      const user = queryAll('SELECT id, username, display_name, role FROM users WHERE id = ?', [result.lastInsertRowid])[0];
      const token = generateToken(user);

      res.json({ token, user });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  app.post('/api/auth/login', (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

      const users = queryAll('SELECT * FROM users WHERE username = ?', [username]);
      if (users.length === 0 || !comparePassword(password, users[0].password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const user = users[0];
      const token = generateToken(user);
      res.json({ token, user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  app.get('/api/auth/me', authMiddleware, (req, res) => {
    const users = queryAll('SELECT id, username, display_name, role FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json({ user: users[0] });
  });

  // SQL endpoint
  app.post('/api/sql', authMiddleware, (req, res) => {
    try {
      const { query, params = [] } = req.body;
      if (!query) return res.status(400).json({ error: 'Query required' });

      const trimmed = query.trim().toUpperCase();
      const isSelect = trimmed.startsWith('SELECT') || trimmed.startsWith('PRAGMA') || trimmed.startsWith('WITH');

      if (isSelect) {
        const rows = queryAll(query, params);
        res.json({ rows });
      } else {
        const result = runSql(query, params);
        res.json({ rows: [], lastInsertRowid: result.lastInsertRowid, changes: result.changes });
      }
    } catch (err) {
      console.error('SQL error:', err.message, '\nQuery:', req.body.query);
      res.status(400).json({ error: err.message });
    }
  });

  // CSV Template Downloads
  app.get('/api/templates/:type', authMiddleware, (req, res) => {
    const templates = {
      inventory: 'ingredient_name,item_type,current_stock_kg,cost_per_kg,low_stock_threshold_kg,moq_kg,lot_number,warehouse_aisle,warehouse_shelf,warehouse_bin,status,notes\nShea Butter,Raw Material,500,2.50,50,100,LOT-001,A,1,B3,In Stock,Organic certified',
      customers: 'name,company_name,email,phone,address,website,sales_rep,priority,notes\nJohn Doe,Acme Corp,john@acme.com,555-0100,123 Main St,www.acme.com,Sarah,normal,VIP customer',
      suppliers: 'name,contact_name,email,phone,address,website,lead_time_days,notes\nNature Supplies,Jane Smith,jane@naturesupplies.com,555-0200,456 Oak Ave,www.naturesupplies.com,14,Preferred supplier'
    };

    const type = req.params.type;
    if (!templates[type]) return res.status(400).json({ error: 'Invalid template type' });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=${type}_template.csv`);
    res.send(templates[type]);
  });

  // CSV Import
  app.post('/api/import/:type', authMiddleware, upload.single('file'), (req, res) => {
    try {
      const type = req.params.type;
      if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

      const records = parse(req.file.buffer.toString(), { columns: true, skip_empty_lines: true, trim: true });

      let inserted = 0;
      let errors = [];

      if (type === 'inventory') {
        for (const [i, row] of records.entries()) {
          try {
            if (!row.ingredient_name) { errors.push(`Row ${i+2}: Missing ingredient_name`); continue; }
            runSql(
              `INSERT INTO inventory (ingredient_name, item_type, current_stock_kg, cost_per_kg, low_stock_threshold_kg, moq_kg, lot_number, warehouse_aisle, warehouse_shelf, warehouse_bin, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [row.ingredient_name, row.item_type || 'Raw Material', parseFloat(row.current_stock_kg) || 0, parseFloat(row.cost_per_kg) || 0, parseFloat(row.low_stock_threshold_kg) || 5, parseFloat(row.moq_kg) || 0, row.lot_number || '', row.warehouse_aisle || '', row.warehouse_shelf || '', row.warehouse_bin || '', row.status || 'In Stock', row.notes || '']
            );
            inserted++;
          } catch (e) { errors.push(`Row ${i+2}: ${e.message}`); }
        }
      } else if (type === 'customers') {
        for (const [i, row] of records.entries()) {
          try {
            if (!row.name) { errors.push(`Row ${i+2}: Missing name`); continue; }
            runSql(
              `INSERT INTO customers (name, company_name, email, phone, address, website, sales_rep, priority, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [row.name, row.company_name || '', row.email || '', row.phone || '', row.address || '', row.website || '', row.sales_rep || '', row.priority || 'normal', row.notes || '']
            );
            inserted++;
          } catch (e) { errors.push(`Row ${i+2}: ${e.message}`); }
        }
      } else if (type === 'suppliers') {
        for (const [i, row] of records.entries()) {
          try {
            if (!row.name) { errors.push(`Row ${i+2}: Missing name`); continue; }
            runSql(
              `INSERT INTO suppliers (name, contact_name, email, phone, address, website, lead_time_days, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [row.name, row.contact_name || '', row.email || '', row.phone || '', row.address || '', row.website || '', parseInt(row.lead_time_days) || 0, row.notes || '']
            );
            inserted++;
          } catch (e) { errors.push(`Row ${i+2}: ${e.message}`); }
        }
      } else {
        return res.status(400).json({ error: 'Invalid import type' });
      }

      saveDb();
      res.json({ success: true, inserted, errors, total: records.length });
    } catch (e) {
      res.status(400).json({ error: 'Failed to parse CSV: ' + e.message });
    }
  });

  // --- File Upload Routes ---
  const fs = require('fs');
  const uploadsDir = path.join(__dirname, '..', 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  // Upload customer photo
  app.post('/api/customers/:id/photo', authMiddleware, upload.single('photo'), (req, res) => {
    try {
      const customerId = req.params.id;
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file provided' });

      const ext = path.extname(file.originalname) || '.jpg';
      const fileName = `customer_${customerId}_photo_${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      const photoUrl = `/api/uploads/${fileName}`;
      runSql(`UPDATE customers SET photo_url = ? WHERE id = ?`, [photoUrl, customerId]);
      saveDb();

      res.json({ success: true, photo_url: photoUrl });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Upload document/attachment for any entity
  app.post('/api/attachments/:entityType/:entityId', authMiddleware, upload.single('file'), (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const file = req.file;
      if (!file) return res.status(400).json({ error: 'No file provided' });

      const ext = path.extname(file.originalname) || '';
      const fileName = `${entityType}_${entityId}_${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      const fileUrl = `/api/uploads/${fileName}`;
      const result = runSql(
        `INSERT INTO attachments (entity_type, entity_id, file_name, file_path, file_type) VALUES (?, ?, ?, ?, ?)`,
        [entityType, entityId, file.originalname, fileUrl, file.mimetype]
      );
      saveDb();

      res.json({
        success: true,
        attachment: {
          id: result.lastInsertRowid,
          entity_type: entityType,
          entity_id: parseInt(entityId),
          file_name: file.originalname,
          file_path: fileUrl,
          file_type: file.mimetype,
        }
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Get attachments for an entity
  app.get('/api/attachments/:entityType/:entityId', authMiddleware, (req, res) => {
    try {
      const { entityType, entityId } = req.params;
      const attachments = queryAll(
        `SELECT * FROM attachments WHERE entity_type = ? AND entity_id = ? ORDER BY uploaded_at DESC`,
        [entityType, entityId]
      );
      res.json(attachments);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Delete an attachment
  app.delete('/api/attachments/:id', authMiddleware, (req, res) => {
    try {
      const attachment = queryAll(`SELECT * FROM attachments WHERE id = ?`, [req.params.id]);
      if (attachment.length > 0 && attachment[0].file_path) {
        const filePath = path.join(uploadsDir, path.basename(attachment[0].file_path));
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      }
      runSql(`DELETE FROM attachments WHERE id = ?`, [req.params.id]);
      saveDb();
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve uploaded files (static)
  app.use('/api/uploads', express.static(uploadsDir));

  // --- Backup & Restore Routes ---
  
  // Download full backup as JSON
  app.get('/api/backup', authMiddleware, (req, res) => {
    try {
      const backup = exportBackup();
      const filename = `pll-crm-backup-${new Date().toISOString().slice(0,10)}.json`;
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.json(backup);
    } catch (err) {
      console.error('Backup error:', err);
      res.status(500).json({ error: 'Backup failed: ' + err.message });
    }
  });
  
  // Upload and restore from backup JSON
  app.post('/api/restore', authMiddleware, upload.single('file'), (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: 'No backup file provided' });
      
      const backupData = JSON.parse(req.file.buffer.toString());
      const result = importRestore(backupData);
      
      res.json({ 
        success: true, 
        message: 'Data restored successfully',
        restored: result.restored,
        errors: result.errors
      });
    } catch (err) {
      console.error('Restore error:', err);
      res.status(500).json({ error: 'Restore failed: ' + err.message });
    }
  });
  
  // Save current data as seed file (for bundling with deploys)
  app.post('/api/backup/save-seed', authMiddleware, (req, res) => {
    try {
      const saved = saveSeedFile();
      if (saved) {
        res.json({ success: true, message: 'Seed file saved. Include data/seed-data.json in your next deploy.' });
      } else {
        res.json({ success: false, message: 'No data to save.' });
      }
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
  
  // Get backup stats (table row counts)
  app.get('/api/backup/stats', authMiddleware, (req, res) => {
    try {
      const stats = {};
      const tables = ['customers', 'sales_projects', 'production_projects', 'inventory', 'suppliers', 'purchase_orders', 'formulas', 'formula_ingredients', 'production_batches', 'batch_ingredients', 'attachments'];
      let totalRows = 0;
      for (const table of tables) {
        try {
          const rows = queryAll(`SELECT COUNT(*) as c FROM ${table}`);
          stats[table] = rows[0].c;
          totalRows += rows[0].c;
        } catch(e) { stats[table] = 0; }
      }
      res.json({ stats, totalRows });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // Serve static files in production
  if (process.env.NODE_ENV === 'production') {
    const clientDist = path.join(__dirname, '..', 'client', 'dist');
    app.use(express.static(clientDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  // Create default admin user if no users exist
  const userCount = queryAll('SELECT COUNT(*) as c FROM users');
  if (userCount[0].c === 0) {
    const password_hash = hashPassword('admin123');
    runSql('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)', ['admin', password_hash, 'Administrator', 'admin']);
    console.log('Default admin user created (username: admin, password: admin123)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PLL CRM server running on port ${PORT}`);
  });

  // Periodic save every 30 seconds
  setInterval(() => saveDb(), 30000);
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
