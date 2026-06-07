# voice.co-l.in — ElevenLabs sample picker

Small web app for sharing ElevenLabs voice samples with clients so they can pick
a voiceover artist for a project (e.g. a conference). You curate, the client
explores, and a shared shortlist is built per project.

## Features

- Per-project pages at `/c/:slug` with shared persistent shortlist
- Voice picker over (a) your ElevenLabs account voices and (b) the public Voice Library
- Generate a TTS sample with any voice + any script
- MP3s cached on disk by `sha256(voice_id + text + model)` — no duplicate billing
- Admin login (single password, bcrypt-hashed) at `/admin` to create/manage projects
- Public-side access via unguessable random slug (no client login)

## Stack

- **Server**: Node 18+ · Express · better-sqlite3 · express-session · bcrypt
- **Client**: React 18 · Vite · Tailwind · React Router
- **Storage**: SQLite file at `server/data/voices.db` + cached MP3s in `server/data/audio/`

## Local development

```bash
# server
cd server
npm install
cp .env.example .env
# edit .env: at minimum set ELEVENLABS_API_KEY and ADMIN_PASSWORD
npm run dev          # http://localhost:5180

# client (separate terminal)
cd client
npm install
npm run dev          # http://localhost:5181 with /api + /audio proxied
```

Open `http://localhost:5181/admin/login`, sign in, create your first project.
Note the slug it generates — that's the URL you share with the client at
`http://localhost:5181/c/<slug>`.

## Deployment (VPS + CloudPanel)

### One-time setup

1. **DNS** — point `voice.co-l.in` A record at the VPS (already done as of 2026-06-07).
2. **CloudPanel** — log into the panel and create a new **Node.js** site:
   - Domain: `voice.co-l.in`
   - Node version: 20+ (or whatever the VPS has)
   - App Port: `5180` (CloudPanel will reverse-proxy from 80/443 to this port)
   - Issue Let's Encrypt SSL once the site is created
3. **SSH alias** — add to your local `~/.ssh/config`:
   ```
   Host voice
       HostName 82.25.86.219
       User root
       IdentityFile ~/.ssh/teachmegrandma
   ```
   (or whichever key has access to the VPS)
4. **GitHub** — push this repo to `https://github.com/colin-cd72/voice`.
5. **Clone on server**:
   ```bash
   ssh voice
   cd /home/voice/htdocs/voice.co-l.in
   # remove any default index.html that CloudPanel placed here
   git clone https://github.com/colin-cd72/voice.git .
   cd server
   cp .env.example .env
   nano .env   # set ELEVENLABS_API_KEY, ADMIN_PASSWORD, SESSION_SECRET, NODE_ENV=production
   ```

### Each deploy

From the project root on your laptop:

```bash
./deploy.sh
```

This pulls latest, runs `npm install` on both halves, builds the client, and
restarts the Express server.

### Server management

```bash
ssh voice
tail -f /home/voice/htdocs/voice.co-l.in/server.log
# kill server
PID=$(lsof -t -i:5180); kill $PID
# restart manually
cd /home/voice/htdocs/voice.co-l.in/server
nohup node src/index.js > ../server.log 2>&1 &
```

## API surface

Public (slug-gated):

- `GET /api/c/:slug` — project info + shortlist
- `GET /api/c/:slug/voices/account` — your ElevenLabs account voices
- `GET /api/c/:slug/voices/search?q=&gender=&age=&accent=&use_case=` — search public library
- `POST /api/c/:slug/generate` — `{ voice_id, text }` → `{ audio_url }`
- `POST /api/c/:slug/shortlist` — add a voice
- `PATCH /api/c/:slug/shortlist/:id` — update note
- `DELETE /api/c/:slug/shortlist/:id` — remove

Auth:

- `POST /api/auth/login` — `{ password }`
- `POST /api/auth/logout`
- `GET /api/auth/me`

Admin (session-gated):

- `GET /api/admin/projects`
- `POST /api/admin/projects` — `{ name, default_script }` → returns generated slug
- `PATCH /api/admin/projects/:slug` — update name / default script
- `DELETE /api/admin/projects/:slug`

Static:

- `GET /audio/<hash>.mp3` — cached generations

## Notes

- Audio files accumulate on disk. If storage gets tight, you can safely
  `rm server/data/audio/*.mp3` and clear the matching `generations` rows — files
  will re-generate on demand.
- `eleven_multilingual_v2` is the default model; change via `ELEVENLABS_MODEL`
  env var (e.g. `eleven_turbo_v2_5` for cheaper/faster).
- Max script length is 1000 chars per generation (raise in `server/src/routes/public.js`).
