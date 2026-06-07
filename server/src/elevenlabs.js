const BASE = 'https://api.elevenlabs.io/v1';

function headers() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new Error('ELEVENLABS_API_KEY not set');
  return { 'xi-api-key': key };
}

export async function listAccountVoices() {
  const res = await fetch(`${BASE}/voices`, { headers: headers() });
  if (!res.ok) throw new Error(`ElevenLabs voices failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.voices || []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    preview_url: v.preview_url,
    labels: v.labels || {},
    description: v.description || '',
    category: v.category || 'account',
    source: 'account',
  }));
}

export async function searchSharedVoices({ search = '', gender = '', age = '', accent = '', useCase = '', language = '', pageSize = 24, page = 0 } = {}) {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  if (gender) params.set('gender', gender);
  if (age) params.set('age', age);
  if (accent) params.set('accent', accent);
  if (useCase) params.set('use_cases', useCase);
  if (language) params.set('language', language);
  params.set('page_size', String(pageSize));
  params.set('page', String(page));

  const res = await fetch(`${BASE}/shared-voices?${params.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(`ElevenLabs shared-voices failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.voices || []).map((v) => ({
    voice_id: v.voice_id,
    name: v.name,
    preview_url: v.preview_url,
    labels: {
      gender: v.gender,
      age: v.age,
      accent: v.accent,
      use_case: v.use_case,
      language: v.language,
      descriptive: v.descriptive,
    },
    description: v.description || '',
    category: v.category || 'professional',
    source: 'library',
  }));
}

export async function generateTts({ voiceId, text, model }) {
  const res = await fetch(`${BASE}/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify({
      text,
      model_id: model,
      voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`ElevenLabs TTS failed: ${res.status} ${body}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}
