import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { getDb } from './db.js';
import { generateTts } from './elevenlabs.js';

function pcmSampleRate(format) {
  const m = format.match(/^pcm_(\d+)$/);
  return m ? parseInt(m[1], 10) : null;
}

export function extensionFor(format) {
  return pcmSampleRate(format) ? 'wav' : 'mp3';
}

function buildWavHeader(pcmByteLen, sampleRate, channels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * channels * bitsPerSample) / 8;
  const blockAlign = (channels * bitsPerSample) / 8;
  const buf = Buffer.alloc(44);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + pcmByteLen, 4);
  buf.write('WAVE', 8);
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(pcmByteLen, 40);
  return buf;
}

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

  let buf = await generateTts({ voiceId, text, model, speed, outputFormat });
  const sr = pcmSampleRate(outputFormat);
  if (sr) {
    const header = buildWavHeader(buf.length, sr);
    buf = Buffer.concat([header, buf]);
  }
  const ext = extensionFor(outputFormat);
  const relPath = path.join('audio', `${key}.${ext}`);
  const absPath = path.join(dataDir, relPath);
  fs.writeFileSync(absPath, buf);

  db.prepare(
    'INSERT INTO generations (cache_key, voice_id, script, model, audio_path, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(key, voiceId, text, model, relPath, Date.now());

  return { key, audioPath: relPath };
}
