import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import bcrypt from 'bcrypt';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

import { initDb } from './db.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { publicRouter } from './routes/public.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SERVER_ROOT = path.resolve(__dirname, '..');

const PORT = parseInt(process.env.PORT || '5180', 10);
const DATA_DIR = path.resolve(SERVER_ROOT, process.env.DATA_DIR || './data');
const DEFAULT_MODEL = process.env.ELEVENLABS_MODEL || 'eleven_multilingual_v2';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'changeme';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me';

if (!process.env.ELEVENLABS_API_KEY) {
  console.warn('[warn] ELEVENLABS_API_KEY not set — TTS calls will fail');
}

initDb(DATA_DIR);
const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '256kb' }));
app.use(
  session({
    name: 'voice.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 1000 * 60 * 60 * 24 * 30,
    },
  }),
);

app.use('/api/auth', authRouter({ adminHash }));
app.use('/api/admin', adminRouter());
app.use('/api', publicRouter({ dataDir: DATA_DIR, defaultModel: DEFAULT_MODEL }));

app.use(
  '/audio',
  express.static(path.join(DATA_DIR, 'audio'), {
    maxAge: '7d',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.wav')) res.setHeader('Content-Type', 'audio/wav');
      else res.setHeader('Content-Type', 'audio/mpeg');
    },
  }),
);

const CLIENT_DIST = path.join(ROOT, 'client', 'dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/audio')) return next();
    res.sendFile(path.join(CLIENT_DIST, 'index.html'));
  });
} else {
  console.warn('[warn] client/dist not built — frontend will not be served');
}

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'server error' });
});

app.listen(PORT, () => {
  console.log(`voice server listening on :${PORT}`);
  console.log(`data dir: ${DATA_DIR}`);
});
