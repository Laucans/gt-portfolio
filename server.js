'use strict';
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const Database = require('better-sqlite3');
const { randomUUID } = require('crypto');
const path = require('path');

const app = express();
const db = new Database(path.join(__dirname, 'data.db'));

// Schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS articles (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    author_id TEXT NOT NULL,
    published_at TEXT DEFAULT (datetime('now'))
  );
`);

// Seed default account
const seed = db.prepare('SELECT id FROM users WHERE email = ?').get('laurent.canis@hec.ca');
if (!seed) {
  const hash = bcrypt.hashSync('changeme', 10);
  db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
    .run(randomUUID(), 'laurent.canis@hec.ca', hash);
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'gt-portfolio-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 }
}));

// Serve static files — no-cache for JS to avoid stale easter egg
app.use(express.static(path.join(__dirname, 'src'), {
  setHeaders(res, filePath) {
    if (filePath.endsWith('.js')) {
      res.set('Cache-Control', 'no-store');
    }
  }
}));

// ── Auth ─────────────────────────────────────────────────────────────────────

app.post('/api/register', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const hash = bcrypt.hashSync(password, 10);
  try {
    db.prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
      .run(randomUUID(), email, hash);
    res.json({ ok: true });
  } catch {
    res.status(409).json({ error: 'email already registered' });
  }
});

app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  req.session.userId = user.id;
  req.session.email = user.email;
  res.json({ ok: true, email: user.email });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  if (req.session.userId) return res.json({ loggedIn: true, email: req.session.email });
  res.json({ loggedIn: false });
});

// ── Articles ──────────────────────────────────────────────────────────────────

app.get('/api/articles', (_req, res) => {
  const rows = db.prepare(
    'SELECT id, title, published_at FROM articles ORDER BY published_at DESC'
  ).all();
  res.json(rows);
});

app.get('/api/articles/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'not found' });
  res.json(row);
});

app.post('/api/articles', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'not authenticated' });
  const { title, body } = req.body;
  if (!title || !body) return res.status(400).json({ error: 'title and body required' });
  const id = randomUUID();
  db.prepare('INSERT INTO articles (id, title, body, author_id) VALUES (?, ?, ?, ?)')
    .run(id, title, body, req.session.userId);
  res.status(201).json({ ok: true, id });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Portfolio running on http://localhost:${PORT}`));
