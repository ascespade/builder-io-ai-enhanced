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

// In-memory data storage
const users = [
  {
    id: '1',
    email: 'admin@builder.io',
    password: '$2a$10$xj2eQljQk1J8q4j8V2ax3.V9ndEVCH.uOtRs.Z9XI41ke0Snz9POm', // admin123
    name: 'Admin User'
  }
];

const projects = [];
const pages = [];
const components = [];
const media = [];

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

const upload = multer({ storage: storage });

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
  res.json(mediaItem);
});

// GitHub Integration
app.post('/api/github/clone', authenticateToken, async (req, res) => {
  try {
    const { repoUrl, projectName } = req.body;
    const git = simpleGit();
    
    // Clone repository
    const clonePath = `projects/${projectName}`;
    await git.clone(repoUrl, clonePath);
    
    res.json({ message: 'Repository cloned successfully', path: clonePath });
  } catch (error) {
    res.status(500).json({ error: 'Failed to clone repository', details: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Delete routes
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  const idx = projects.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Project not found' });
  projects.splice(idx, 1);
  res.json({ success: true });
});

app.delete('/api/pages/:id', authenticateToken, (req, res) => {
  const idx = pages.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Page not found' });
  pages.splice(idx, 1);
  res.json({ success: true });
});

app.delete('/api/components/:id', authenticateToken, (req, res) => {
  const idx = components.findIndex(c => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Component not found' });
  components.splice(idx, 1);
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
  res.json({ success: true });
});

// Download media
app.get('/api/media/:id/download', authenticateToken, (req, res) => {
  const item = media.find(m => m.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Media not found' });
  const absPath = path.resolve(item.path);
  res.download(absPath, item.originalName);
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
