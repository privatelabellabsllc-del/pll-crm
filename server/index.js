require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDb, queryAll, runSql, saveDb } = require('./db');
const { generateToken, hashPassword, comparePassword, authMiddleware } = require('./auth');

async function start() {
  await initDb();

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
