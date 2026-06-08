import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from './db.js';
import { generateTts } from './elevenlabs.js';

export function cacheKey({ voiceId, text, model, speed = 1.0, outputFormat = 'mp3_44100_192' }) {
  const h = crypto.createHash('sha256');
  h.update(voiceId);
  h.update('|');
  h.update(model);
  h.update('|');
  h.update(`s${Number(speed).toFixed(2)}`);
  h.update('|');
  h.update(outputFormat);
  h.update('|');
  h.update(text);
  return h.digest('hex');
}

export async function getOrGenerate({ voiceId, text, model, speed = 1.0, outputFormat = 'mp3_44100_192', dataDir }) {
  const key = cacheKey({ voiceId, text, model, speed, outputFormat });
  const db = getDb();
  const existing = db.prepare('SELECT * FROM generations WHERE cache_key = ?').get(key);
  if (existing) {
    const abs = path.join(dataDir, existing.audio_path);
    if (fs.existsSync(abs)) {
      return { key, audioPath: existing.audio_path };
    }
    db.prepare('DELETE FROM generations WHERE cache_key = ?').run(key);
  }

  const buf = await generateTts({ voiceId, text, model, speed, outputFormat });
  const relPath = path.join('audio', `${key}.mp3`);
  const absPath = path.join(dataDir, relPath);
  fs.writeFileSync(absPath, buf);

  db.prepare(
    'INSERT INTO generations (cache_key, voice_id, script, model, audio_path, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(key, voiceId, text, model, relPath, Date.now());

  return { key, audioPath: relPath };
}
