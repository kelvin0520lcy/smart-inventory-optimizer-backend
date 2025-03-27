// Simple test server to troubleshoot CORS issues
import express from 'express';
import cors from 'cors';

const app = express();

// Configure CORS specifically
app.use(cors({
  origin: ['https://smart-io.online'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Access-Control-Allow-Origin']
}));

// Enable JSON body parsing
app.use(express.json());

// Specific CORS middleware for auth routes
app.use('/api/auth', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'https://smart-io.online');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Test route
app.get('/api/test', (req, res) => {
  res.json({ message: 'Test API is working' });
});

// Auth login route
app.post('/api/auth/login', (req, res) => {
  console.log('Login attempt:', req.body);
  
  // Simple login logic
  const { username, password } = req.body;
  
  if (username === 'demo' && password === 'demo') {
    return res.json({
      id: 1,
      username: 'demo',
      fullName: 'Demo User',
      email: 'demo@example.com'
    });
  }
  
  return res.status(401).json({ message: 'Invalid credentials' });
});

// Start server
const PORT = process.env.PORT || 5001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Test server running on http://0.0.0.0:${PORT}`);
}); 