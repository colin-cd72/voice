import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api.js';

const MAX_LEN = 5000;

function parseScriptEmail(raw) {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return [];
  const paragraphs = text.split(/\n\s*\n+/);
  const blocks = [];
  const cueRe = /^Cue\s+[\w.-]+(?:\s*[—\-:]\s*(.+))?/i;
  for (const para of paragraphs) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;
    const m = lines[0].match(cueRe);
    if (m) {
      const label = lines[0];
      const body = lines.slice(1).join(' ').trim();
      if (body) blocks.push({ label, script: body });
    }
  }
  return blocks;
}

function extensionFor(format) {
  return format && format.startsWith('pcm') ? 'wav' : 'mp3';
}

function downloadFilenameFor(project, voice, block, idx, format) {
  const label = (block.label || '').trim();
  const m = label.match(/Cue\s+([\w.-]+)\s*[—–\-:]\s*(.+)/i);
  let base;
  if (m) {
    base = `${m[1]} ${m[2].trim()}`;
  } else if (label) {
    base = label;
  } else {
    base = `block-${idx + 1}`;
  }
  const clean = base.replace(/[^\w. -]+/g, '').replace(/\s+/g, ' ').trim();
  return `${clean || `block-${idx + 1}`}.${extensionFor(format)}`;
}

let nextId = 1;
function newBlock(initial = {}) {
  return { id: nextId++, label: '', script: '', speed: 1.0, audioUrl: null, cacheKey: null, status: 'idle', error: '', ...initial };
}

function ScriptBlock({ block, idx, voice, project, slug, onChange, onRemove, canRemove, format }) {
  async function generate() {
    if (!voice) return onChange({ ...block, error: 'pick a voice first' });
    if (!block.script.trim()) return onChange({ ...block, error: 'script is empty' });
    onChange({ ...block, status: 'busy', error: '', audioUrl: null, cacheKey: null });
    try {
      const { audio_url, cache_key } = await api.generate(slug, voice.voice_id, block.script, block.speed);
      onChange({ ...block, status: 'done', audioUrl: audio_url + '?t=' + Date.now(), cacheKey: cache_key, error: '' });
    } catch (err) {
      onChange({ ...block, status: 'error', error: err.message + (err.detail ? ` — ${err.detail}` : '') });
    }
  }

  const downloadName = downloadFilenameFor(project, voice, block, idx, format);

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="chip">{idx + 1}</span>
          <input
            className="input flex-1 text-sm"
            placeholder={`label (e.g. "Cue 102 — VOG Housekeeping")`}
            value={block.label}
            onChange={(e) => onChange({ ...block, label: e.target.value })}
          />
        </div>
        {canRemove && (
          <button onClick={onRemove} className="text-xs text-zinc-500 hover:text-red-400">
            remove
          </button>
        )}
      </div>

      <textarea
        className="input min-h-[100px] text-sm leading-relaxed"
        placeholder="paste or type the script for this block…"
        value={block.script}
        onChange={(e) => onChange({ ...block, script: e.target.value.slice(0, MAX_LEN) })}
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <span className="text-xs text-zinc-500">
          {block.script.length.toLocaleString()} / {MAX_LEN.toLocaleString()} chars
          {block.status === 'busy' && ' · generating…'}
          {block.status === 'done' && ' · ✓ ready'}
        </span>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            speed
            <input
              type="range"
              min="0.7"
              max="1.2"
              step="0.05"
              value={block.speed}
              onChange={(e) => onChange({ ...block, speed: parseFloat(e.target.value) })}
              className="accent-accent w-24"
              style={{ accentColor: 'var(--accent)' }}
            />
            <span
              className={`tabular-nums w-10 text-right ${block.speed !== 1.0 ? 'text-accent font-medium' : ''}`}
            >
              {block.speed.toFixed(2)}x
            </span>
            {block.speed !== 1.0 && (
              <button
                onClick={() => onChange({ ...block, speed: 1.0 })}
                className="text-zinc-500 hover:text-zinc-100"
                title="reset speed to 1.0"
              >
                ↺
              </button>
            )}
          </label>
          <button onClick={generate} disabled={block.status === 'busy' || !voice} className="btn-primary">
            {block.status === 'busy' ? 'generating…' : block.audioUrl ? 'regenerate' : 'generate'}
          </button>
        </div>
      </div>

      {block.error && <div className="text-sm text-red-400">{block.error}</div>}

      {block.audioUrl && (
        <div className="space-y-2 pt-2 border-t border-ink-700">
          <audio key={block.audioUrl} controls src={block.audioUrl} />
          <a href={block.audioUrl} download={downloadName} className="btn-primary w-full justify-center">
            ⬇ download {downloadName}
          </a>
        </div>
      )}
    </div>
  );
}

export default function ScriptPage() {
  const { slug, voice_id } = useParams();
  const [project, setProject] = useState(null);
  const [shortlist, setShortlist] = useState([]);
  const [voice, setVoice] = useState(null);
  const [blocks, setBlocks] = useState([newBlock()]);
  const [error, setError] = useState('');
  const [seededDefault, setSeededDefault] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');

  const [showPron, setShowPron] = useState(false);
  const [pron, setPron] = useState('');
  const [pronSavedAt, setPronSavedAt] = useState(0);
  const pronTimer = useRef(null);

  const [batchBusy, setBatchBusy] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [blocksSavedAt, setBlocksSavedAt] = useState(0);
  const [outputFormat, setOutputFormat] = useState('mp3_44100_192');
  const blocksTimer = useRef(null);
  const hasLoaded = useRef(false);

  useEffect(() => {
    api.getProject(slug)
      .then((p) => {
        setProject(p.project);
        setShortlist(p.shortlist);
        setPron(p.project.pronunciations || '');
        setOutputFormat(p.project.output_format || 'mp3_44100_192');
        let saved = [];
        try {
          saved = JSON.parse(p.project.script_blocks || '[]');
        } catch {}
        if (Array.isArray(saved) && saved.length > 0) {
          setBlocks(saved.map((b) => newBlock({ label: b.label || '', script: b.script || '', speed: Number(b.speed) || 1.0 })));
        } else if (!seededDefault && p.project.default_script) {
          setBlocks([newBlock({ script: p.project.default_script })]);
          setSeededDefault(true);
        }
        hasLoaded.current = true;
      })
      .catch((err) => setError(err.message));
  }, [slug]);

  useEffect(() => {
    if (!hasLoaded.current) return;
    if (blocksTimer.current) clearTimeout(blocksTimer.current);
    blocksTimer.current = setTimeout(async () => {
      try {
        const payload = blocks.map((b) => ({ label: b.label, script: b.script, speed: b.speed }));
        await api.updateScriptBlocks(slug, payload);
        setBlocksSavedAt(Date.now());
      } catch (err) {
        console.error('failed to save script blocks', err);
      }
    }, 700);
    return () => {
      if (blocksTimer.current) clearTimeout(blocksTimer.current);
    };
  }, [blocks, slug]);

  useEffect(() => {
    if (!voice_id) {
      setVoice(null);
      return;
    }
    api.getVoice(slug, voice_id)
      .then((v) => setVoice(v.voice))
      .catch((err) => setError(err.message));
  }, [slug, voice_id]);

  function updateBlock(updated) {
    setBlocks((bs) => bs.map((b) => (b.id === updated.id ? updated : b)));
  }
  function addBlock() {
    setBlocks((bs) => [...bs, newBlock()]);
  }
  function removeBlock(id) {
    setBlocks((bs) => bs.filter((b) => b.id !== id));
  }

  function applyImport(mode) {
    const parsed = parseScriptEmail(importText);
    if (parsed.length === 0) {
      alert('No "Cue …" blocks detected. Each block should start with a line like "Cue 102 — VOG Housekeeping".');
      return;
    }
    const newBlocks = parsed.map((p) => newBlock({ label: p.label, script: p.script }));
    setBlocks((bs) => (mode === 'append' ? [...bs.filter((b) => b.script || b.label), ...newBlocks] : newBlocks));
    setImportText('');
    setShowImport(false);
  }

  function savePronDebounced(value) {
    setPron(value);
    if (pronTimer.current) clearTimeout(pronTimer.current);
    pronTimer.current = setTimeout(async () => {
      try {
        await api.updatePronunciations(slug, value);
        setPronSavedAt(Date.now());
      } catch (err) {
        setError(err.message);
      }
    }, 700);
  }

  function resetAllSpeeds() {
    const altered = blocks.filter((b) => b.speed !== 1.0);
    if (altered.length === 0) return;
    if (!confirm(`Reset ${altered.length} block${altered.length === 1 ? '' : 's'} back to 1.00x?`)) return;
    setBlocks((bs) => bs.map((b) =>
      b.speed !== 1.0
        ? { ...b, speed: 1.0, audioUrl: null, cacheKey: null, status: 'idle', error: '' }
        : b
    ));
  }

  async function changeOutputFormat(next) {
    setOutputFormat(next);
    setBlocks((bs) => bs.map((b) => ({ ...b, audioUrl: null, cacheKey: null, status: 'idle', error: '' })));
    try {
      await api.updateOutputFormat(slug, next);
    } catch (err) {
      setError(err.message);
    }
  }

  async function generateAll() {
    setBatchBusy(true);
    try {
      for (const b of blocks) {
        if (b.status === 'done') continue;
        if (!b.script.trim()) continue;
        await new Promise((r) => setTimeout(r, 150));
        const current = blocks.find((x) => x.id === b.id) || b;
        updateBlock({ ...current, status: 'busy', error: '' });
        try {
          const { audio_url, cache_key } = await api.generate(slug, voice.voice_id, b.script, b.speed);
          updateBlock({ ...current, status: 'done', audioUrl: audio_url + '?t=' + Date.now(), cacheKey: cache_key, error: '' });
        } catch (err) {
          updateBlock({ ...current, status: 'error', error: err.message + (err.detail ? ` — ${err.detail}` : '') });
        }
      }
    } finally {
      setBatchBusy(false);
    }
  }

  async function downloadZip() {
    const ready = blocks.filter((b) => b.cacheKey);
    if (ready.length === 0) {
      alert('no generated blocks yet — click "generate all" first');
      return;
    }
    setZipBusy(true);
    try {
      const items = ready.map((b) => ({
        cache_key: b.cacheKey,
        filename: downloadFilenameFor(project, voice, b, blocks.indexOf(b), outputFormat),
      }));
      const zipName = `${project.slug}-${voice.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.zip`;
      const res = await fetch(api.zipUrl(slug), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, zip_name: zipName }),
      });
      if (!res.ok) throw new Error(`zip failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = zipName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message);
    } finally {
      setZipBusy(false);
    }
  }

  if (error && !project) {
    return (
      <div className="card p-6">
        <div className="text-red-400 mb-2">error: {error}</div>
        <Link to={`/c/${slug}`} className="text-zinc-400 hover:text-zinc-100 underline text-sm">
          back to project
        </Link>
      </div>
    );
  }
  if (!project) return <div className="text-zinc-400">loading…</div>;

  const tags = voice
    ? [voice.labels?.gender, voice.labels?.age, voice.labels?.accent, voice.labels?.use_case].filter(Boolean)
    : [];

  const readyCount = blocks.filter((b) => b.cacheKey).length;
  const nonDefaultSpeedCount = blocks.filter((b) => b.speed !== 1.0).length;

  return (
    <div className="space-y-6">
      <div>
        <Link to={`/c/${slug}`} className="text-xs text-zinc-500 hover:text-zinc-100">
          ← {project.name}
        </Link>
        <h1 className="h-display text-3xl mt-1">script</h1>
        <p className="text-sm text-zinc-500 mt-1">
          one block per cue · paste a script email to auto-import · download all as a zip
        </p>
      </div>

      {!voice_id ? (
        <div className="card p-5 space-y-3">
          <h2 className="h-display text-lg">pick a voice</h2>
          {shortlist.length === 0 ? (
            <p className="text-sm text-zinc-400">
              your shortlist is empty.{' '}
              <Link to={`/c/${slug}`} className="text-accent hover:underline">
                go back and add some voices first →
              </Link>
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {shortlist.map((item) => {
                const meta = item.voice_meta || {};
                const itemTags = [meta.gender, meta.age, meta.accent].filter(Boolean);
                return (
                  <Link
                    key={item.id}
                    to={`/c/${slug}/script/${item.voice_id}`}
                    className="card p-3 hover:ring-2 hover:ring-accent transition block"
                  >
                    <div className="font-medium">{item.voice_name}</div>
                    <div className="text-xs text-zinc-500 capitalize mt-0.5">{item.voice_source}</div>
                    {itemTags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {itemTags.map((t, i) => (
                          <span key={i} className="chip capitalize">{String(t).replace(/_/g, ' ')}</span>
                        ))}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      ) : !voice ? (
        <div className="card p-5 text-zinc-400">loading voice…</div>
      ) : (
        <div className="card p-5 space-y-3">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-zinc-500 uppercase tracking-wider">voice</div>
              <div className="font-medium text-lg mt-1">{voice.name}</div>
              <div className="text-xs text-zinc-500 capitalize mt-0.5">{voice.source}</div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              {voice.preview_url && (
                <div className="w-64 max-w-full">
                  <div className="text-xs text-zinc-500 mb-1">voice preview</div>
                  <audio controls preload="none" src={voice.preview_url} />
                </div>
              )}
              <Link to={`/c/${slug}/script`} className="btn-ghost border border-ink-700 text-xs">
                change voice
              </Link>
            </div>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map((t, i) => (
                <span key={i} className="chip capitalize">{String(t).replace(/_/g, ' ')}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {voice_id && (
        <>
          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setShowPron((v) => !v)}
                className="text-sm text-zinc-300 hover:text-zinc-100"
              >
                {showPron ? '▾' : '▸'} pronunciation overrides
                {pron && <span className="text-xs text-zinc-500 ml-2">({pron.split('\n').filter((l) => l.trim() && l.includes('=')).length} active)</span>}
              </button>
              {pronSavedAt > 0 && Date.now() - pronSavedAt < 3000 && (
                <span className="text-xs text-accent">saved ✓</span>
              )}
            </div>
            {showPron && (
              <>
                <p className="text-xs text-zinc-500">
                  one per line: <code className="chip">term =&gt; replacement</code> · case-insensitive whole-word match · applied before every generation
                </p>
                <textarea
                  className="input min-h-[110px] font-mono text-xs"
                  placeholder={'Straubel => STROW-buhl\nAaru => ARE-RU\nHoplamazian => HOP-luh-MAY-zee-un'}
                  value={pron}
                  onChange={(e) => savePronDebounced(e.target.value)}
                />
              </>
            )}
          </div>

          <div className="card p-4 space-y-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <button
                onClick={() => setShowImport((v) => !v)}
                className="text-sm text-zinc-300 hover:text-zinc-100"
              >
                {showImport ? '▾' : '▸'} import from script email
              </button>
            </div>
            {showImport && (
              <>
                <p className="text-xs text-zinc-500">
                  paste the full email — blocks like <code className="chip">Cue 102 — VOG Housekeeping</code> followed by the script will be detected
                </p>
                <textarea
                  className="input min-h-[160px] font-mono text-xs"
                  placeholder="Cue 102 — VOG Housekeeping
WELCOME BACK TO ASPEN…

Cue 104 — VOG Housekeeping
PLEASE TAKE YOUR SEATS…"
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <div className="flex gap-2">
                  <button onClick={() => applyImport('replace')} className="btn-primary">
                    replace blocks
                  </button>
                  <button onClick={() => applyImport('append')} className="btn-secondary">
                    append to current
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-between flex-wrap gap-3 sticky top-[64px] bg-ink-950/80 backdrop-blur py-3 -mx-2 px-2 rounded-lg border border-ink-800 z-[5]">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="text-sm text-zinc-400">
                {blocks.length} block{blocks.length === 1 ? '' : 's'} · {readyCount} generated
                {blocksSavedAt > 0 && Date.now() - blocksSavedAt < 3000 && (
                  <span className="text-accent ml-2">saved ✓</span>
                )}
              </div>
              <div className="flex items-center gap-1 bg-ink-800 rounded-lg p-1 border border-ink-700">
                <button
                  onClick={() => changeOutputFormat('mp3_44100_192')}
                  className={`px-2 py-1 text-xs rounded ${outputFormat === 'mp3_44100_192' ? 'bg-ink-700 text-zinc-100' : 'text-zinc-400'}`}
                  title="MP3 192 kbps — smaller files, slight compression"
                >
                  MP3 192
                </button>
                <button
                  onClick={() => changeOutputFormat('pcm_24000')}
                  className={`px-2 py-1 text-xs rounded ${outputFormat === 'pcm_24000' ? 'bg-ink-700 text-zinc-100' : 'text-zinc-400'}`}
                  title="WAV 24 kHz uncompressed — larger files, no compression artifacts"
                >
                  WAV 24k
                </button>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {nonDefaultSpeedCount > 0 && (
                <button
                  onClick={resetAllSpeeds}
                  className="btn-ghost border border-ink-700 text-xs"
                  title="Reset every block's speed back to 1.00x (speed != 1.0 causes phasing artifacts)"
                >
                  ↺ reset speeds ({nonDefaultSpeedCount})
                </button>
              )}
              <button onClick={generateAll} disabled={batchBusy || !voice} className="btn-secondary">
                {batchBusy ? 'generating…' : 'generate all'}
              </button>
              <button onClick={downloadZip} disabled={zipBusy || readyCount === 0} className="btn-primary">
                {zipBusy ? 'zipping…' : `⬇ download all (.zip${readyCount > 0 ? `, ${readyCount}` : ''})`}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {blocks.map((b, i) => (
              <ScriptBlock
                key={b.id}
                block={b}
                idx={i}
                voice={voice}
                project={project}
                slug={slug}
                onChange={updateBlock}
                onRemove={() => removeBlock(b.id)}
                canRemove={blocks.length > 1}
                format={outputFormat}
              />
            ))}
            <button onClick={addBlock} className="btn-secondary w-full">
              + add another script block
            </button>
          </div>
        </>
      )}
    </div>
  );
}
