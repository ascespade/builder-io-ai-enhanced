const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');
const simpleGit = require('simple-git');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const querystring = require('querystring');
const rateLimit = require('rate-limiter-flexible');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3004;

// Middleware
app.use(cors());
app.use(compression());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// Disable problematic security headers for development
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginOpenerPolicy: false,
  frameguard: false,
  crossOriginResourcePolicy: false
}));

app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

const rateLimiter = new rateLimit.RateLimiterMemory({ points: 200, duration: 60 });
app.use(async (req, res, next) => {
  try { await rateLimiter.consume(req.ip); next(); } catch { res.status(429).json({ error: 'Too many requests' }); }
});

// In-memory data storage
const users = [
  {
    id: '1',
    email: 'admin@builder.io',
    password: '$2a$10$xj2eQljQk1J8q4j8V2ax3.V9ndEVCH.uOtRs.Z9XI41ke0Snz9POm', // admin123
    name: 'Admin User'
  }
];

let projects = [];
let pages = [];
let components = [];
let media = [];
// Store GitHub OAuth access tokens per user (demo persistence only)
const githubTokens = {}; // { [userId]: access_token }

// Simple JSON persistence
const DATA_DIR = 'data';
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const dataFiles = {
  projects: path.join(DATA_DIR, 'projects.json'),
  pages: path.join(DATA_DIR, 'pages.json'),
  components: path.join(DATA_DIR, 'components.json'),
  media: path.join(DATA_DIR, 'media.json')
};
function readJson(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); } catch { return []; }
}
function writeJson(fp, data) {
  try { fs.writeFileSync(fp, JSON.stringify(data, null, 2)); } catch {}
}
function loadAll() {
  projects = readJson(dataFiles.projects);
  pages = readJson(dataFiles.pages);
  components = readJson(dataFiles.components);
  media = readJson(dataFiles.media);
}
function saveAll() {
  writeJson(dataFiles.projects, projects);
  writeJson(dataFiles.pages, pages);
  writeJson(dataFiles.components, components);
  writeJson(dataFiles.media, media);
}
loadAll();

// File upload configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage, fileFilter: (req, file, cb) => {
  const allowed = ['image/', 'text/', 'application/pdf', 'application/json', 'application/zip'];
  if (allowed.some(p => file.mimetype.startsWith(p))) return cb(null, true);
  cb(new Error('Unsupported file type'));
}, limits: { fileSize: 10 * 1024 * 1024 } });

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  let token = null;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, 'your-secret-key', (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// API Routes

// Authentication
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email);
  
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const validPassword = await bcrypt.compare(password, user.password);
  if (!validPassword) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = jwt.sign({ userId: user.id, email: user.email }, 'your-secret-key', { expiresIn: '24h' });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
});

// GitHub OAuth — start
app.get('/api/auth/github/start', (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID || req.query.client_id;
  const redirectUri = (process.env.GITHUB_REDIRECT_URI || `${req.protocol}://${req.get('host')}/api/auth/github/callback`);
  const state = uuidv4();
  const scope = 'repo user:email';
  const next = req.query.redirect || '/';
  const url = `https://github.com/login/oauth/authorize?${querystring.stringify({ client_id: clientId, redirect_uri: redirectUri, scope, state })}&allow_signup=true`;
  // Save state->next mapping in-memory
  if (!global.__oauthStates) global.__oauthStates = {};
  global.__oauthStates[state] = { next, createdAt: Date.now() };
  res.redirect(url);
});

// GitHub OAuth — callback
app.get('/api/auth/github/callback', async (req, res) => {
  try {
    const code = req.query.code;
    const state = req.query.state;
    const map = global.__oauthStates || {};
    const next = (map[state] && map[state].next) || '/';
    // Exchange code for token
    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).send('Missing GITHUB_CLIENT_ID/SECRET');
    }
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code })
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      return res.status(401).send(`OAuth failed: ${tokenJson.error || 'unknown'}`);
    }
    const accessToken = tokenJson.access_token;
    // Fetch GitHub user
    const ghRes = await fetch('https://api.github.com/user', { headers: { 'Authorization': `Bearer ${accessToken}`, 'User-Agent': 'builder-ultimate-demo' } });
    const ghUser = await ghRes.json();
    if (!ghRes.ok) {
      return res.status(401).send('Failed to fetch GitHub user');
    }
    // Upsert demo user
    let user = users.find(u => u.email === `${ghUser.id}@github.local`);
    if (!user) {
      user = { id: uuidv4(), email: `${ghUser.id}@github.local`, password: '', name: ghUser.login || 'GitHub User' };
      users.push(user);
    }
    githubTokens[user.id] = accessToken;
    const jwtToken = jwt.sign({ userId: user.id, email: user.email, gh: true }, 'your-secret-key', { expiresIn: '24h' });
    // Redirect back to app with token in URL so frontend can store it
    const target = `${next}${next.includes('?') ? '&' : '?'}token=${encodeURIComponent(jwtToken)}`;
    res.redirect(target);
  } catch (e) {
    res.status(500).send('OAuth error');
  }
});

// Projects
app.get('/api/projects', authenticateToken, (req, res) => {
  res.json(projects);
});

app.post('/api/projects', authenticateToken, (req, res) => {
  const { name, description, githubUrl } = req.body;
  const project = {
    id: uuidv4(),
    name,
    description,
    githubUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  projects.push(project);
  saveAll();
  res.json(project);
});

// Pages
app.get('/api/pages', authenticateToken, (req, res) => {
  res.json(pages);
});

app.post('/api/pages', authenticateToken, (req, res) => {
  const { title, content, projectId } = req.body;
  const page = {
    id: uuidv4(),
    title,
    content,
    projectId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  pages.push(page);
  saveAll();
  res.json(page);
});

// Components
app.get('/api/components', authenticateToken, (req, res) => {
  res.json(components);
});

app.post('/api/components', authenticateToken, (req, res) => {
  const { name, code, type } = req.body;
  const component = {
    id: uuidv4(),
    name,
    code,
    type,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  components.push(component);
  saveAll();
  res.json(component);
});

// Media
app.get('/api/media', authenticateToken, (req, res) => {
  res.json(media);
});

app.post('/api/media/upload', upload.single('file'), authenticateToken, (req, res) => {
  const file = req.file;
  const mediaItem = {
    id: uuidv4(),
    filename: file.filename,
    originalName: file.originalname,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    uploadedAt: new Date().toISOString()
  };
  media.push(mediaItem);
  saveAll();
  res.json(mediaItem);
});

// GitHub Integration
app.post('/api/github/clone', authenticateToken, async (req, res) => {
  try {
    const { repoUrl, projectName, ghToken, useOAuthToken } = req.body || {};
    if (!repoUrl || !projectName) return res.status(400).json({ error: 'repoUrl and projectName are required' });

    const git = simpleGit();

    // Normalize URL: ensure .git suffix
    const ensureGit = (u) => (u.endsWith('.git') ? u : `${u}.git`);
    const baseUrl = ensureGit(repoUrl);

    // Build candidate URLs for private repos when PAT is provided
    const candidates = [];
    const effectiveToken = useOAuthToken ? githubTokens[req.user.userId] : ghToken;
    if (effectiveToken) {
      try {
        const u = new URL(baseUrl);
        const hostPath = `${u.host}${u.pathname}`;
        candidates.push(`https://${encodeURIComponent(effectiveToken)}@${hostPath}`); // token as username
        candidates.push(`https://x-access-token:${encodeURIComponent(effectiveToken)}@${hostPath}`); // token as password
      } catch {
        candidates.push(baseUrl.replace('https://', `https://${encodeURIComponent(effectiveToken)}@`));
        const noProto = baseUrl.replace('https://', '');
        candidates.push(`https://x-access-token:${encodeURIComponent(effectiveToken)}@${noProto}`);
      }
    }
    if (!effectiveToken) candidates.push(baseUrl);

    const clonePath = `projects/${projectName}`;
    if (!fs.existsSync('projects')) fs.mkdirSync('projects', { recursive: true });

    let lastErr = null;
    let success = false;
    for (const u of candidates.length ? candidates : [baseUrl]) {
      try {
        await git.clone(u, clonePath, ['--depth', '1']);
        success = true;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (!success) {
      const msg = lastErr && lastErr.message ? lastErr.message : 'Clone failed';
      return res.status(/Authentication failed|access denied|authorization failed/i.test(msg) ? 401 : 500)
        .json({ error: 'Failed to clone repository', details: msg });
    }

    const project = {
      id: uuidv4(),
      name: projectName,
      description: `Cloned from ${repoUrl}`,
      githubUrl: repoUrl,
      path: clonePath,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    projects.push(project);
    saveAll();

    res.json({ message: 'Repository cloned successfully', path: clonePath, project });
  } catch (error) {
    const msg = (error && error.message) ? error.message : String(error);
    if (/Authentication failed|access denied|authorization failed/i.test(msg)) {
      return res.status(401).json({ error: 'Authentication failed for private repository' });
    }
    res.status(500).json({ error: 'Failed to clone repository', details: msg });
  }
});

// Git utilities
app.post('/api/github/status', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath } = req.body || {}
    if (!repoPath) return res.status(400).json({ error: 'path is required' })
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: 'Repository path not found' })
    const git = simpleGit(repoPath)
    const [status, branchSummary, log] = await Promise.all([
      git.status(),
      git.branch(),
      git.log({ maxCount: 20 })
    ])
    res.json({ status, branchSummary, log })
  } catch (e) {
    res.status(500).json({ error: 'Failed to get status', details: e.message })
  }
})

app.post('/api/github/commit', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath, message, authorName, authorEmail } = req.body || {}
    if (!repoPath || !message) return res.status(400).json({ error: 'path and message are required' })
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: 'Repository path not found' })
    const git = simpleGit(repoPath)
    await git.add(['-A'])
    const opts = authorName && authorEmail ? { '--author': `${authorName} <${authorEmail}>` } : {}
    await git.commit(message, undefined, opts)
    const last = await git.log({ maxCount: 1 })
    res.json({ success: true, last: last.latest })
  } catch (e) {
    res.status(500).json({ error: 'Commit failed', details: e.message })
  }
})

app.post('/api/github/push', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath, remote = 'origin', branch, force = false } = req.body || {}
    if (!repoPath) return res.status(400).json({ error: 'path is required' })
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: 'Repository path not found' })
    const git = simpleGit(repoPath)
    const result = await git.push(remote, branch || (await git.branch()).current, { '--force': force ? null : undefined })
    res.json({ success: true, result })
  } catch (e) {
    res.status(500).json({ error: 'Push failed', details: e.message })
  }
})

app.post('/api/github/pull', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath, remote = 'origin', branch } = req.body || {}
    if (!repoPath) return res.status(400).json({ error: 'path is required' })
    if (!fs.existsSync(repoPath)) return res.status(404).json({ error: 'Repository path not found' })
    const git = simpleGit(repoPath)
    const r = await git.pull(remote, branch || (await git.branch()).current)
    res.json({ success: true, result: r })
  } catch (e) {
    res.status(500).json({ error: 'Pull failed', details: e.message })
  }
})

// Branch list/create/switch
app.post('/api/github/branches', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath } = req.body || {}
    if (!repoPath) return res.status(400).json({ error: 'path is required' })
    const git = simpleGit(repoPath)
    const branches = await git.branch()
    res.json(branches)
  } catch (e) { res.status(500).json({ error: 'Failed to list branches', details: e.message }) }
})

app.post('/api/github/branch/create', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath, name, checkout = true } = req.body || {}
    if (!repoPath || !name) return res.status(400).json({ error: 'path and name are required' })
    const git = simpleGit(repoPath)
    await git.branch([name])
    if (checkout) await git.checkout(name)
    const branches = await git.branch()
    res.json({ success:true, branches })
  } catch (e) { res.status(500).json({ error: 'Failed to create branch', details: e.message }) }
})

app.post('/api/github/branch/checkout', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath, name } = req.body || {}
    if (!repoPath || !name) return res.status(400).json({ error: 'path and name are required' })
    const git = simpleGit(repoPath)
    await git.checkout(name)
    const branches = await git.branch()
    res.json({ success:true, branches })
  } catch (e) { res.status(500).json({ error: 'Failed to checkout branch', details: e.message }) }
})

// Diff view
app.post('/api/github/diff', authenticateToken, async (req, res) => {
  try {
    const { path: repoPath, from, to } = req.body || {}
    if (!repoPath) return res.status(400).json({ error: 'path is required' })
    const git = simpleGit(repoPath)
    const diff = await git.diff([ ...(from && to ? [`${from}..${to}`] : []), '--', '.' ])
    res.type('text/plain').send(diff)
  } catch (e) { res.status(500).json({ error: 'Failed to get diff', details: e.message }) }
})

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Delete routes
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });
  projects.splice(idx, 1);
  saveAll();
  res.json({ success: true });
});

app.delete('/api/pages/:id', authenticateToken, (req, res) => {
  const idx = pages.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Page not found' });
  pages.splice(idx, 1);
  saveAll();
  res.json({ success: true });
});

app.delete('/api/components/:id', authenticateToken, (req, res) => {
  const idx = components.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Component not found' });
  components.splice(idx, 1);
  saveAll();
  res.json({ success: true });
});

app.delete('/api/media/:id', authenticateToken, (req, res) => {
  const idx = media.findIndex(m => m.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Media not found' });
  const item = media[idx];
  try {
    if (item && item.path && fs.existsSync(item.path)) {
      fs.unlinkSync(item.path);
    }
  } catch (e) {
    // ignore unlink errors in demo
  }
  media.splice(idx, 1);
  saveAll();
  res.json({ success: true });
});

// Download media
app.get('/api/media/:id/download', authenticateToken, (req, res) => {
  const item = media.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Media not found' });
  const absPath = path.resolve(item.path);
  res.download(absPath, item.originalName);
});

// Update routes
app.put('/api/projects/:id', authenticateToken, (req, res) => {
  const project = projects.find(p => p.id === req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const { name, description, githubUrl } = req.body;
  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;
  if (githubUrl !== undefined) project.githubUrl = githubUrl;
  project.updatedAt = new Date().toISOString();
  saveAll();
  res.json(project);
});

app.put('/api/pages/:id', authenticateToken, (req, res) => {
  const page = pages.find(p => p.id === req.params.id);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  const { title, content, projectId } = req.body;
  if (title !== undefined) page.title = title;
  if (content !== undefined) page.content = content;
  if (projectId !== undefined) page.projectId = projectId;
  page.updatedAt = new Date().toISOString();
  saveAll();
  res.json(page);
});

app.put('/api/components/:id', authenticateToken, (req, res) => {
  const component = components.find(c => c.id === req.params.id);
  if (!component) return res.status(404).json({ error: 'Component not found' });
  const { name, code, type } = req.body;
  if (name !== undefined) component.name = name;
  if (code !== undefined) component.code = code;
  if (type !== undefined) component.type = type;
  component.updatedAt = new Date().toISOString();
  saveAll();
  res.json(component);
});

// Stats
app.get('/api/stats', authenticateToken, (req, res) => {
  res.json({
    projects: projects.length,
    pages: pages.length,
    components: components.length,
    media: media.length
  });
});

// AI: Gemini proxy
app.post('/api/ai/gemini', authenticateToken, async (req, res) => {
  try {
    const key = process.env.GEMINI_API_KEY || req.headers['x-gemini-key'];
    if (!key) return res.status(400).json({ error: 'Missing Gemini API key' });
    const { system, messages, model } = req.body || {};
    const m = model || 'gemini-1.5-pro';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:generateContent?key=${encodeURIComponent(key)}`;

    const contents = (messages || []).map((msg) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(msg.content || '') }]
    }));

    const body = {
      contents,
      systemInstruction: system ? { role: 'user', parts: [{ text: String(system) }] } : undefined,
      generationConfig: { temperature: 0.3, topP: 0.95, topK: 40, maxOutputTokens: 2048 }
    };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(resp.status).json(data);
    }
    const text = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts)
      ? data.candidates[0].content.parts.map(p => p.text || '').join('')
      : '';
    res.json({ text, raw: data });
  } catch (e) {
    res.status(500).json({ error: 'AI request failed', details: e.message });
  }
});

// Create necessary directories
const dirs = ['public', 'uploads', 'projects'];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Socket.IO for real-time collaboration
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('join-project', (projectId) => {
    socket.join(projectId);
    console.log(`User ${socket.id} joined project ${projectId}`);
  });

  socket.on('page-update', (data) => {
    socket.to(data.projectId).emit('page-updated', data);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Builder.io Ultimate Server running on port ${PORT}`);
  console.log(`Access at: http://0.0.0.0:${PORT}`);
});
