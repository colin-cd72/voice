import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import archiver from 'archiver';
import { getDb } from '../db.js';
import { listAccountVoices, searchSharedVoices, getVoice } from '../elevenlabs.js';
import { getOrGenerate, cacheKey } from '../audio-cache.js';

const MAX_TEXT_LEN = 5000;

export function publicRouter({ dataDir, defaultModel }) {
  const router = express.Router();

  function loadProject(req, res, next) {
    const { slug } = req.params;
    const db = getDb();
    const project = db.prepare('SELECT id, slug, name, default_script, pronunciations FROM projects WHERE slug = ?').get(slug);
    if (!project) return res.status(404).json({ error: 'project not found' });
    req.project = project;
    next();
  }

  function parsePronunciations(raw) {
    const out = [];
    if (!raw) return out;
    for (const rawLine of String(raw).split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;
      const m = line.match(/^(.+?)\s*(?:=>|->|:|=)\s*(.+)$/);
      if (m) out.push({ term: m[1].trim(), replacement: m[2].trim() });
    }
    return out;
  }

  function applyPronunciations(text, pairs) {
    let out = text;
    for (const { term, replacement } of pairs) {
      if (!term) continue;
      const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(`\\b${esc}\\b`, 'gi');
      out = out.replace(re, replacement);
    }
    return out;
  }

  router.get('/c/:slug', loadProject, (req, res) => {
    const db = getDb();
    const items = db
      .prepare('SELECT id, voice_id, voice_name, voice_source, voice_meta, note, position, added_at FROM shortlist_items WHERE project_id = ? ORDER BY position ASC, added_at ASC')
      .all(req.project.id)
      .map((r) => ({ ...r, voice_meta: r.voice_meta ? JSON.parse(r.voice_meta) : null }));
    res.json({ project: req.project, shortlist: items });
  });

  router.get('/c/:slug/voices/account', loadProject, async (req, res) => {
    try {
      const voices = await listAccountVoices();
      res.json({ voices });
    } catch (e) {
      console.error(e);
      res.status(502).json({ error: 'elevenlabs error', detail: String(e.message || e) });
    }
  });

  router.get('/c/:slug/voices/search', loadProject, async (req, res) => {
    try {
      const voices = await searchSharedVoices({
        search: req.query.q || '',
        gender: req.query.gender || '',
        age: req.query.age || '',
        accent: req.query.accent || '',
        useCase: req.query.use_case || '',
        language: req.query.language || '',
        pageSize: Math.min(parseInt(req.query.page_size || '24', 10) || 24, 50),
        page: Math.max(parseInt(req.query.page || '0', 10) || 0, 0),
      });
      res.json({ voices });
    } catch (e) {
      console.error(e);
      res.status(502).json({ error: 'elevenlabs error', detail: String(e.message || e) });
    }
  });

  router.get('/c/:slug/voices/:voice_id', loadProject, async (req, res) => {
    const db = getDb();
    const fromShortlist = db
      .prepare('SELECT voice_id, voice_name AS name, voice_source AS source, voice_meta FROM shortlist_items WHERE project_id = ? AND voice_id = ?')
      .get(req.project.id, req.params.voice_id);
    if (fromShortlist) {
      return res.json({
        voice: {
          voice_id: fromShortlist.voice_id,
          name: fromShortlist.name,
          source: fromShortlist.source,
          labels: fromShortlist.voice_meta ? JSON.parse(fromShortlist.voice_meta) : {},
        },
      });
    }
    try {
      const voice = await getVoice(req.params.voice_id);
      res.json({ voice });
    } catch (e) {
      console.error(e);
      res.status(404).json({ error: 'voice not found', detail: String(e.message || e) });
    }
  });

  router.post('/c/:slug/generate', loadProject, async (req, res) => {
    const { voice_id, text, speed } = req.body || {};
    if (!voice_id || typeof voice_id !== 'string') return res.status(400).json({ error: 'voice_id required' });
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' });
    if (text.length > MAX_TEXT_LEN) return res.status(400).json({ error: `text too long (max ${MAX_TEXT_LEN})` });
    const cleanSpeed = Math.max(0.7, Math.min(1.2, Number(speed) || 1.0));

    const pairs = parsePronunciations(req.project.pronunciations);
    const finalText = applyPronunciations(text, pairs);

    try {
      const { key } = await getOrGenerate({
        voiceId: voice_id,
        text: finalText,
        model: defaultModel,
        speed: cleanSpeed,
        dataDir,
      });
      res.json({ cache_key: key, audio_url: `/audio/${key}.mp3` });
    } catch (e) {
      console.error(e);
      res.status(502).json({ error: 'generation failed', detail: String(e.message || e) });
    }
  });

  router.patch('/c/:slug/pronunciations', loadProject, (req, res) => {
    const { pronunciations } = req.body || {};
    if (typeof pronunciations !== 'string') return res.status(400).json({ error: 'pronunciations must be string' });
    if (pronunciations.length > 10000) return res.status(400).json({ error: 'too long' });
    const db = getDb();
    db.prepare('UPDATE projects SET pronunciations = ? WHERE id = ?').run(pronunciations, req.project.id);
    res.json({ ok: true });
  });

  router.get('/c/:slug/generation-url', loadProject, (req, res) => {
    const { voice_id, text } = req.query;
    if (!voice_id || !text) return res.status(400).json({ error: 'voice_id and text required' });
    const key = cacheKey({ voiceId: voice_id, text, model: defaultModel });
    const db = getDb();
    const row = db.prepare('SELECT cache_key FROM generations WHERE cache_key = ?').get(key);
    res.json({ cache_key: key, exists: !!row, audio_url: row ? `/audio/${key}.mp3` : null });
  });

  router.post('/c/:slug/zip', loadProject, (req, res) => {
    const { items, zip_name } = req.body || {};
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }
    const db = getDb();
    const resolved = [];
    for (const it of items) {
      if (!it.cache_key || typeof it.cache_key !== 'string') continue;
      const row = db.prepare('SELECT audio_path FROM generations WHERE cache_key = ?').get(it.cache_key);
      if (!row) continue;
      const abs = path.join(dataDir, row.audio_path);
      if (!fs.existsSync(abs)) continue;
      const safeName = (it.filename || `${it.cache_key.slice(0, 8)}.mp3`).replace(/[^a-z0-9._-]+/gi, '-');
      resolved.push({ abs, name: safeName });
    }
    if (resolved.length === 0) return res.status(404).json({ error: 'no generated audio matches' });

    const safeZipName = (zip_name || `${req.project.slug}.zip`).replace(/[^a-z0-9._-]+/gi, '-');
    res.set('Content-Type', 'application/zip');
    res.set('Content-Disposition', `attachment; filename="${safeZipName}"`);
    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.on('error', (err) => {
      console.error('archive error', err);
      try { res.status(500).end(); } catch {}
    });
    archive.pipe(res);
    const used = new Set();
    for (const r of resolved) {
      let name = r.name;
      let n = 2;
      while (used.has(name)) name = r.name.replace(/(\.mp3)?$/i, `-${n++}.mp3`);
      used.add(name);
      archive.file(r.abs, { name });
    }
    archive.finalize();
  });

  router.post('/c/:slug/shortlist', loadProject, (req, res) => {
    const { voice_id, voice_name, voice_source, voice_meta, note } = req.body || {};
    if (!voice_id || !voice_name || !voice_source) return res.status(400).json({ error: 'voice_id, voice_name, voice_source required' });
    const db = getDb();
    const max = db.prepare('SELECT COALESCE(MAX(position), -1) AS m FROM shortlist_items WHERE project_id = ?').get(req.project.id).m;
    try {
      db.prepare(
        'INSERT INTO shortlist_items (project_id, voice_id, voice_name, voice_source, voice_meta, note, position, added_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(req.project.id, voice_id, voice_name, voice_source, voice_meta ? JSON.stringify(voice_meta) : null, note || '', max + 1, Date.now());
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return res.status(409).json({ error: 'already on shortlist' });
      throw e;
    }
    const items = db
      .prepare('SELECT id, voice_id, voice_name, voice_source, voice_meta, note, position, added_at FROM shortlist_items WHERE project_id = ? ORDER BY position ASC, added_at ASC')
      .all(req.project.id)
      .map((r) => ({ ...r, voice_meta: r.voice_meta ? JSON.parse(r.voice_meta) : null }));
    res.json({ shortlist: items });
  });

  router.patch('/c/:slug/shortlist/:id', loadProject, (req, res) => {
    const { id } = req.params;
    const { note } = req.body || {};
    const db = getDb();
    db.prepare('UPDATE shortlist_items SET note = COALESCE(?, note) WHERE id = ? AND project_id = ?').run(
      typeof note === 'string' ? note : null,
      id,
      req.project.id,
    );
    res.json({ ok: true });
  });

  router.delete('/c/:slug/shortlist/:id', loadProject, (req, res) => {
    const { id } = req.params;
    const db = getDb();
    db.prepare('DELETE FROM shortlist_items WHERE id = ? AND project_id = ?').run(id, req.project.id);
    res.json({ ok: true });
  });

  return router;
}
