/**
 * Auth Controller — US-3
 * Endpoints: signup, login, refresh, google SSO
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const {
  findUserByEmail,
  findUserByGoogleId,
  createUser,
  storeRefreshToken,
  findRefreshToken,
  revokeRefreshToken,
} = require('../store');

const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret_change_me';
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || 'dev_jwt_refresh_secret_change_me';
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
const REFRESH_TOKEN_TTL_STR = '7d';

// ---- Token helpers ----

function generateAccessToken(userId) {
  return jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function generateRefreshToken(userId) {
  const token = uuidv4() + '.' + uuidv4(); // opaque random token
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS).toISOString();
  storeRefreshToken({ userId, token, expiresAt });
  return { token, expiresAt };
}

function buildTokenResponse(userId) {
  const access_token = generateAccessToken(userId);
  const { token: refresh_token } = generateRefreshToken(userId);
  return { access_token, refresh_token, token_type: 'Bearer' };
}

// ---- POST /api/auth/signup ----

async function signup(req, res) {
  const { email, password, name } = req.body || {};

  if (
    !email ||
    typeof email !== 'string' ||
    !password ||
    typeof password !== 'string' ||
    !name ||
    typeof name !== 'string'
  ) {
    return res.status(400).json({ error: 'Dados invalidos' });
  }

  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail.includes('@')) {
    return res.status(400).json({ error: 'Dados invalidos' });
  }

  if (findUserByEmail(trimmedEmail)) {
    return res.status(409).json({ error: 'Email ja cadastrado' });
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = createUser({ email: trimmedEmail, passwordHash, name: name.trim() });

  return res.status(201).json({ id: user.id, email: user.email, name: user.name });
}

// ---- POST /api/auth/login ----

async function login(req, res) {
  const { email, password } = req.body || {};

  if (!email || !password) {
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }

  const user = findUserByEmail(email.trim().toLowerCase());
  if (!user || !user.passwordHash) {
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }

  const match = await bcrypt.compare(password, user.passwordHash);
  if (!match) {
    return res.status(401).json({ error: 'Credenciais invalidas' });
  }

  return res.status(200).json(buildTokenResponse(user.id));
}

// ---- POST /api/auth/refresh ----

function refresh(req, res) {
  const { refresh_token } = req.body || {};

  if (!refresh_token) {
    return res.status(401).json({ error: 'Refresh token invalido ou expirado' });
  }

  const stored = findRefreshToken(refresh_token);
  if (!stored) {
    return res.status(401).json({ error: 'Refresh token invalido ou expirado' });
  }

  if (stored.revokedAt) {
    return res.status(401).json({ error: 'Refresh token invalido ou expirado' });
  }

  if (new Date(stored.expiresAt) < new Date()) {
    return res.status(401).json({ error: 'Refresh token invalido ou expirado' });
  }

  // Token rotation — revoke old, issue new
  revokeRefreshToken(refresh_token);

  return res.status(200).json(buildTokenResponse(stored.userId));
}

// ---- GET /api/auth/google ----
// Redirects to Google OAuth consent screen

function googleAuth(req, res) {
  if (!GOOGLE_CLIENT_ID) {
    return res.status(500).json({ error: 'Erro ao iniciar SSO' });
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    access_type: 'offline',
    prompt: 'select_account',
  });

  return res.redirect(302, `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

// ---- GET /api/auth/google/callback ----
// Receives code from Google, exchanges for user info, issues tokens

async function googleCallback(req, res) {
  const { code } = req.query;

  if (!code) {
    return res.status(401).json({ error: 'Autenticacao Google falhou' });
  }

  try {
    // Exchange code for tokens
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      return res.status(401).json({ error: 'Autenticacao Google falhou' });
    }

    const tokenData = await tokenRes.json();
    const { access_token: googleAccessToken } = tokenData;

    // Get user info from Google
    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${googleAccessToken}` },
    });

    if (!userInfoRes.ok) {
      return res.status(401).json({ error: 'Autenticacao Google falhou' });
    }

    const googleUser = await userInfoRes.json();
    const { sub: googleId, email, name } = googleUser;

    if (!googleId || !email) {
      return res.status(401).json({ error: 'Autenticacao Google falhou' });
    }

    // Find by googleId or email; link accounts if email matches
    let user = findUserByGoogleId(googleId);
    if (!user) {
      user = findUserByEmail(email.toLowerCase());
      if (user) {
        // Associate googleId with existing user
        user.googleId = googleId;
      } else {
        // Create new SSO user
        user = createUser({
          email: email.toLowerCase(),
          passwordHash: null,
          name: name || email,
          googleId,
        });
      }
    }

    return res.status(200).json(buildTokenResponse(user.id));
  } catch {
    return res.status(401).json({ error: 'Autenticacao Google falhou' });
  }
}

module.exports = { signup, login, refresh, googleAuth, googleCallback };
