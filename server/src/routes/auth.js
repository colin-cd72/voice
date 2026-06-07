import express from 'express';
import bcrypt from 'bcrypt';

export function authRouter({ adminHash }) {
  const router = express.Router();

  router.post('/login', async (req, res) => {
    const { password } = req.body || {};
    if (typeof password !== 'string' || !password) {
      return res.status(400).json({ error: 'password required' });
    }
    const ok = await bcrypt.compare(password, adminHash);
    if (!ok) return res.status(401).json({ error: 'invalid password' });
    req.session.admin = true;
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    req.session.destroy(() => res.json({ ok: true }));
  });

  router.get('/me', (req, res) => {
    res.json({ admin: !!(req.session && req.session.admin) });
  });

  return router;
}
