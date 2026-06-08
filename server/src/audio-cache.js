import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
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

function applyTempoFfmpeg(inputBuf, ext, tempo) {
  return new Promise((resolve, reject) => {
    const inFmt = ext === 'wav' ? 'wav' : 'mp3';
    const args = [
      '-loglevel', 'error',
      '-y',
      '-f', inFmt,
      '-i', 'pipe:0',
      '-af', `rubberband=tempo=${tempo.toFixed(3)}`,
      '-f', inFmt,
    ];
    if (inFmt === 'mp3') args.push('-b:a', '192k');
    args.push('pipe:1');
    const ff = spawn('ffmpeg', args);
    const chunks = [];
    let stderr = '';
    ff.stdout.on('data', (c) => chunks.push(c));
    ff.stderr.on('data', (c) => (stderr += c.toString()));
    ff.stdin.on('error', () => {});
    ff.on('error', reject);
    ff.on('close', (code) => {
      if (code !== 0) return reject(new Error(`ffmpeg exited ${code}: ${stderr}`));
      resolve(Buffer.concat(chunks));
    });
    ff.stdin.end(inputBuf);
  });
}

// v2: bumped so post-rubberband regenerations don't hit the old phasey EL-built-in-speed cache
const CACHE_VERSION = 'v2';

export function cacheKey({ voiceId, text, model, speed = 1.0, outputFormat = 'mp3_44100_192' }) {
  const h = crypto.createHash('sha256');
  h.update(CACHE_VERSION);
  h.update('|');
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

function lookupRow(key) {
  const db = getDb();
  return db.prepare('SELECT * FROM generations WHERE cache_key = ?').get(key);
}

function saveGeneration({ key, voiceId, text, model, audioRel }) {
  const db = getDb();
  db.prepare(
    'INSERT OR REPLACE INTO generations (cache_key, voice_id, script, model, audio_path, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(key, voiceId, text, model, audioRel, Date.now());
}

export async function getOrGenerate({ voiceId, text, model, speed = 1.0, outputFormat = 'mp3_44100_192', dataDir }) {
  const clampedSpeed = Math.max(0.7, Math.min(1.2, Number(speed) || 1.0));
  const ext = extensionFor(outputFormat);

  const finalKey = cacheKey({ voiceId, text, model, speed: clampedSpeed, outputFormat });
  const existing = lookupRow(finalKey);
  if (existing) {
    const abs = path.join(dataDir, existing.audio_path);
    if (fs.existsSync(abs)) return { key: finalKey, audioPath: existing.audio_path };
    const db = getDb();
    db.prepare('DELETE FROM generations WHERE cache_key = ?').run(finalKey);
  }

  const baseKey = cacheKey({ voiceId, text, model, speed: 1.0, outputFormat });
  let baseBuf = null;
  let baseRel = null;
  if (clampedSpeed !== 1.0) {
    const baseRow = lookupRow(baseKey);
    if (baseRow) {
      const baseAbs = path.join(dataDir, baseRow.audio_path);
      if (fs.existsSync(baseAbs)) {
        baseBuf = fs.readFileSync(baseAbs);
        baseRel = baseRow.audio_path;
      }
    }
  }

  if (!baseBuf) {
    baseBuf = await generateTts({ voiceId, text, model, speed: 1.0, outputFormat });
    const sr = pcmSampleRate(outputFormat);
    if (sr) baseBuf = Buffer.concat([buildWavHeader(baseBuf.length, sr), baseBuf]);
    baseRel = path.join('audio', `${baseKey}.${ext}`);
    fs.writeFileSync(path.join(dataDir, baseRel), baseBuf);
    saveGeneration({ key: baseKey, voiceId, text, model, audioRel: baseRel });
  }

  if (clampedSpeed === 1.0) {
    return { key: baseKey, audioPath: baseRel };
  }

  const finalBuf = await applyTempoFfmpeg(baseBuf, ext, clampedSpeed);
  const finalRel = path.join('audio', `${finalKey}.${ext}`);
  fs.writeFileSync(path.join(dataDir, finalRel), finalBuf);
  saveGeneration({ key: finalKey, voiceId, text, model, audioRel: finalRel });

  return { key: finalKey, audioPath: finalRel };
}
