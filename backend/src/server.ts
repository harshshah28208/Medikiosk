import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';

import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { generalLimiter } from './middleware/rateLimit.js';

// Routes
import authRoutes from './routes/auth.routes.js';
import patientRoutes from './routes/patient.routes.js';
import visitRoutes from './routes/visit.routes.js';
import queueRoutes from './routes/queue.routes.js';
import consentRoutes from './routes/consent.routes.js';
import conversationRoutes from './routes/conversation.routes.js';
import doctorRoutes from './routes/doctor.routes.js';
import vitalsRoutes from './routes/vitals.routes.js';
import triageRoutes from './routes/triage.routes.js';
import ayushRoutes from './routes/ayush.routes.js';
import documentRoutes from './routes/document.routes.js';
import adminRoutes from './routes/admin.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  },
});

app.set('io', io);

// Configure helmet with relaxed frameguard and crossOrigin policies to allow PDF iframe rendering
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  crossOriginEmbedderPolicy: false,
  frameguard: false,
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: '*',
  credentials: true,
}));

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api/', generalLimiter);

// Serve static uploaded documents (PDFs, Images)
const uploadAbsolutePath = path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadAbsolutePath));

// Health Check
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
    environment: env.NODE_ENV,
  });
});

// Mount Feature API Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/consent', consentRoutes);
app.use('/api/conversation', conversationRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/vitals', vitalsRoutes);
app.use('/api/triage', triageRoutes);
app.use('/api/ayush', ayushRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api/*', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found.' });
});

app.use(errorHandler);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  socket.on('join_room', (room: string) => {
    socket.join(room);
    console.log(`  └─ ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log(`❌ Client disconnected: ${socket.id}`);
  });
});

server.listen(env.PORT, () => {
  console.log('');
  console.log('═══════════════════════════════════════════════');
  console.log('  🏥 MediKiosk Backend v2.0 (All 12 Phases Active)');
  console.log('═══════════════════════════════════════════════');
  console.log(`  🌐 Server:    http://localhost:${env.PORT}`);
  console.log(`  📊 Health:    http://localhost:${env.PORT}/api/health`);
  console.log(`  🤖 AI:        ${env.GEMINI_API_KEY ? 'GeminiAIProvider' : 'MockAIProvider'}`);
  console.log(`  🔧 Env:       ${env.NODE_ENV}`);
  console.log('═══════════════════════════════════════════════');
  console.log('');
});

export { app, server, io };
