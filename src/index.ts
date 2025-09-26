import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

// Import routes
import configRoutes from './routes/config';
import loginRoutes from './routes/login';
import wechatLoginRoutes from './routes/wechat-login';
import signupRoutes from './routes/signup';
import meRoutes from './routes/me';
import promptStoreRoutes from './routes/prompt_store';
import usersRoutes from './routes/users';
import imagesRoutes from './routes/images';
import { JsonRpcService, JsonRpcErrorCode } from './jsonrpc';

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxy settings for reverse proxy (Caddy, nginx, etc.)
// Only trust the first proxy (loopback) for security - prevents IP spoofing
// In production behind Caddy, this trusts only the direct reverse proxy connection
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-hashes'"],
      scriptSrcAttr: ["'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : process.env.NODE_ENV === 'production'
    ? ['https://yourdomain.com']
    : [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5173',  // Vite default
        'http://localhost:8080',  // Vue CLI default
        'http://localhost:3088'   // Same port (admin panel)
      ];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
      return callback(null, true);
    }

    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-HTTP-Method-Override'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400 // 24 hours
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  handler: (req, res) => {
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many requests from this IP, please try again later.',
      req.body?.id || null
    );
  }
});
app.use(limiter);

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // limit each IP to 15 auth requests per windowMs
  handler: (req, res) => {
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.RATE_LIMIT_EXCEEDED,
      'Too many authentication attempts, please try again later.',
      req.body?.id || null
    );
  }
});

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files for admin panel
app.use('/admin', express.static(path.join(__dirname, '../public')));

// Serve static files for public pages (login, etc.)
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/config', configRoutes);
app.use('/api/login', authLimiter, loginRoutes);
app.use('/api/wechat-login', authLimiter, wechatLoginRoutes);
app.use('/api/signup', authLimiter, signupRoutes);
app.use('/api/me', meRoutes);
app.use('/api/prompt_store', promptStoreRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/images/generations', imagesRoutes);

// Health check endpoint - JSON-RPC 2.0 only
app.post('/health', (req, res) => {
  const healthData = {
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };

  // Validate JSON-RPC 2.0 format
  if (req.body?.jsonrpc === '2.0' && req.body?.method === 'health.check') {
    JsonRpcService.sendSuccess(res, healthData, req.body.id || null);
  } else {
    JsonRpcService.sendError(
      res,
      JsonRpcErrorCode.INVALID_REQUEST,
      'Invalid JSON-RPC request. Expected method: health.check',
      req.body?.id || null
    );
  }
});

// Admin panel routes
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-login.html'));
});

app.get('/admin-dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/admin-dashboard.html'));
});

// Root route - serve portal selection page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📊 Admin panel: http://localhost:${PORT}/admin`);
  console.log(`🔗 API base: http://localhost:${PORT}/api`);

  if (!process.env.ADMIN_PASSWORD) {
    console.warn('⚠️  ADMIN_PASSWORD not set in environment variables');
  }
  if (!process.env.JWT_SECRET) {
    console.warn('⚠️  JWT_SECRET not set in environment variables');
  }
  if (!process.env.WECHAT_APP_ID || !process.env.WECHAT_APP_SECRET) {
    console.warn('⚠️  WeChat configuration incomplete. Set WECHAT_APP_ID and WECHAT_APP_SECRET for WeChat login support');
  }
});

export default app;