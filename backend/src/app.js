const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const prisma = require('./config/prisma');
const logger = require('./utils/logger');
const { helmetConfig, correlationIdMiddleware } = require('./middleware/security-headers.middleware');
const { apiLimiter, aiChatLimiter, adminLimiter, docDownloadLimiter } = require('./middleware/rate-limiters');

const authRoutes = require('./routes/auth.routes');
const emergencyRoutes = require('./routes/emergency.routes');
const hospitalRoutes = require('./routes/hospital.routes');
const doctorRoutes = require('./routes/doctor.routes');
const adminRoutes = require('./routes/admin.routes');
const chatRoutes = require('./routes/chat.routes');
const healthPackRoutes = require('./routes/health-pack.routes');
const fcmRoutes = require('./routes/fcm.routes');
const medicalDocumentRoutes = require('./routes/medical-document.routes');
const documentVerificationRoutes = require('./routes/document-verification.routes');
const geocodingRoutes = require('./routes/geocoding.routes');
const settingsRoutes = require('./routes/settings.routes');
const patientRoutes = require('./routes/patient.routes');
const accountDeletionRoutes = require('./routes/account-deletion.routes');
const govHealthDataRoutes = require('./routes/gov-health-data.routes');
const hospitalMatchingRoutes = require('./routes/hospital-matching.routes');
const hospitalSecurityRoutes = require('./routes/hospital-security.routes');

const app = express();

// Trust reverse proxy (Load Balancer / Cloudflare / Nginx) headers safely
app.set('trust proxy', 1);

// Correlation ID & Security Headers
app.use(correlationIdMiddleware);
app.use(helmetConfig);

// CORS Policy
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL,
  ...(process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()),
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || /\.trycloudflare\.com$/.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body parsing & Cookie middleware
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(morgan('dev'));

// Global API Rate Limiter
app.use('/api', apiLimiter);

// Public static uploads disabled for privacy & security compliance.
// All documents must be retrieved via authenticated, authorized API endpoints.

// API Routes
app.use('/api/auth/document-verification', documentVerificationRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/emergency', emergencyRoutes);
app.use('/api/hospitals', hospitalRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/admin/gov-health-data', adminLimiter, govHealthDataRoutes);
app.use('/api/admin/hospital-matching', adminLimiter, hospitalMatchingRoutes);
app.use('/api/account-deletion', accountDeletionRoutes);
app.use('/api/account-deletions', accountDeletionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/patient/documents', docDownloadLimiter, medicalDocumentRoutes);
app.use('/api/documents', docDownloadLimiter, medicalDocumentRoutes);
app.use('/api/medical-documents', docDownloadLimiter, medicalDocumentRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/health-pack', healthPackRoutes);
app.use('/api/healthpack', healthPackRoutes);
app.use('/api/fcm', fcmRoutes);
app.use('/api/chat', aiChatLimiter, chatRoutes);
app.use('/api/geocoding', geocodingRoutes);
app.use('/api/security', hospitalSecurityRoutes);
app.use('/api/hospital', hospitalSecurityRoutes);

// Comprehensive Deep Health Check Endpoint
app.get(['/health', '/api/health'], async (req, res) => {
  let dbStatus = 'healthy';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbStatus = 'unhealthy';
  }

  const isHealthy = dbStatus === 'healthy';
  const statusCode = isHealthy ? 200 : 503;

  return res.status(statusCode).json({
    status: isHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbStatus,
      uptimeSeconds: Math.floor(process.uptime()),
    },
    memoryUsage: process.memoryUsage(),
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found.",
  });
});

// Error Handler (Sanitizes stack traces & internal details in production)
app.use((err, req, res, next) => {
  if (err.name === 'ZodError') {
    return res.status(400).json({ error: err.issues?.[0]?.message || 'Invalid request data.' });
  }
  if (err.status) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.code === 'P2002') {
    return res.status(409).json({ error: 'A record with those details already exists.' });
  }
  if (err.code === 'P2025') {
    return res.status(404).json({ error: 'The requested record was not found.' });
  }

  logger.error('Unhandled server error', { error: err.message, stack: err.stack, path: req.originalUrl });

  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = app;
