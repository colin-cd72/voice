import express from 'express';
import { getDb } from '../db.js';
import { listAccountVoices, searchSharedVoices } from '../elevenlabs.js';
import { getOrGenerate, cacheKey } from '../audio-cache.js';

const MAX_TEXT_LEN = 1000;

export function publicRouter({ dataDir, defaultModel }) {
  const router = express.Router();

  function loadProject(req, res, next) {
    const { slug } = req.params;
    const db = getDb();
    const project = db.prepare('SELECT id, slug, name, default_script FROM projects WHERE slug = ?').get(slug);
    if (!project) return res.status(404).json({ error: 'project not found' });
    req.project = project;
    next();
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

  router.post('/c/:slug/generate', loadProject, async (req, res) => {
    const { voice_id, text } = req.body || {};
    if (!voice_id || typeof voice_id !== 'string') return res.status(400).json({ error: 'voice_id required' });
    if (!text || typeof text !== 'string') return res.status(400).json({ error: 'text required' });
    if (text.length > MAX_TEXT_LEN) return res.status(400).json({ error: `text too long (max ${MAX_TEXT_LEN})` });

    try {
      const { key } = await getOrGenerate({
        voiceId: voice_id,
        text,
        model: defaultModel,
        dataDir,
      });
      res.json({ cache_key: key, audio_url: `/audio/${key}.mp3` });
    } catch (e) {
      console.error(e);
      res.status(502).json({ error: 'generation failed', detail: String(e.message || e) });
    }
  });

  router.get('/c/:slug/generation-url', loadProject, (req, res) => {
    const { voice_id, text } = req.query;
    if (!voice_id || !text) return res.status(400).json({ error: 'voice_id and text required' });
    const key = cacheKey({ voiceId: voice_id, text, model: defaultModel });
    const db = getDb();
    const row = db.prepare('SELECT cache_key FROM generations WHERE cache_key = ?').get(key);
    res.json({ cache_key: key, exists: !!row, audio_url: row ? `/audio/${key}.mp3` : null });
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
