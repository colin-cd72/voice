import express from 'express';
import { getDb } from '../db.js';
import { requireAdmin } from '../middleware/require-admin.js';

function makeSlug(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function randomSuffix(n = 6) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let s = '';
  for (let i = 0; i < n; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

export function adminRouter() {
  const router = express.Router();
  router.use(requireAdmin);

  router.get('/projects', (req, res) => {
    const db = getDb();
    const rows = db.prepare('SELECT id, slug, name, default_script, created_at FROM projects ORDER BY created_at DESC').all();
    res.json({ projects: rows });
  });

  router.post('/projects', (req, res) => {
    const { name, default_script = '' } = req.body || {};
    if (!name || typeof name !== 'string') return res.status(400).json({ error: 'name required' });
    const db = getDb();
    let base = makeSlug(name) || 'project';
    let slug = `${base}-${randomSuffix()}`;
    const now = Date.now();
    const info = db
      .prepare('INSERT INTO projects (slug, name, default_script, created_at) VALUES (?, ?, ?, ?)')
      .run(slug, name, default_script, now);
    const row = db.prepare('SELECT id, slug, name, default_script, created_at FROM projects WHERE id = ?').get(info.lastInsertRowid);
    res.json({ project: row });
  });

  router.patch('/projects/:slug', (req, res) => {
    const { slug } = req.params;
    const { name, default_script } = req.body || {};
    const db = getDb();
    const existing = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug);
    if (!existing) return res.status(404).json({ error: 'not found' });
    db.prepare('UPDATE projects SET name = COALESCE(?, name), default_script = COALESCE(?, default_script) WHERE slug = ?').run(
      typeof name === 'string' ? name : null,
      typeof default_script === 'string' ? default_script : null,
      slug,
    );
    const row = db.prepare('SELECT id, slug, name, default_script, created_at FROM projects WHERE slug = ?').get(slug);
    res.json({ project: row });
  });

  router.delete('/projects/:slug', (req, res) => {
    const { slug } = req.params;
    const db = getDb();
    db.prepare('DELETE FROM projects WHERE slug = ?').run(slug);
    res.json({ ok: true });
  });

  return router;
}
