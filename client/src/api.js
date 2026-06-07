async function jsonFetch(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = data.detail;
    throw err;
  }
  return data;
}

export const api = {
  me: () => jsonFetch('/api/auth/me'),
  login: (password) => jsonFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => jsonFetch('/api/auth/logout', { method: 'POST' }),

  adminListProjects: () => jsonFetch('/api/admin/projects'),
  adminCreateProject: (name, default_script) =>
    jsonFetch('/api/admin/projects', { method: 'POST', body: JSON.stringify({ name, default_script }) }),
  adminUpdateProject: (slug, patch) =>
    jsonFetch(`/api/admin/projects/${slug}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  adminDeleteProject: (slug) => jsonFetch(`/api/admin/projects/${slug}`, { method: 'DELETE' }),

  getProject: (slug) => jsonFetch(`/api/c/${slug}`),
  getVoice: (slug, voiceId) => jsonFetch(`/api/c/${slug}/voices/${voiceId}`),
  accountVoices: (slug) => jsonFetch(`/api/c/${slug}/voices/account`),
  searchVoices: (slug, params) => {
    const qs = new URLSearchParams(params).toString();
    return jsonFetch(`/api/c/${slug}/voices/search?${qs}`);
  },
  generate: (slug, voice_id, text) =>
    jsonFetch(`/api/c/${slug}/generate`, { method: 'POST', body: JSON.stringify({ voice_id, text }) }),
  addToShortlist: (slug, payload) =>
    jsonFetch(`/api/c/${slug}/shortlist`, { method: 'POST', body: JSON.stringify(payload) }),
  updateShortlist: (slug, id, patch) =>
    jsonFetch(`/api/c/${slug}/shortlist/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  removeFromShortlist: (slug, id) => jsonFetch(`/api/c/${slug}/shortlist/${id}`, { method: 'DELETE' }),
};
