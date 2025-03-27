// Simplified authentication handler for troubleshooting
export default function setupAuthRoutes(app, apiPrefix) {
  // Add explicit OPTIONS handler for auth routes
  app.options(`${apiPrefix}/auth/login`, (req, res) => {
    res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://smart-io.online');
    res.header('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.status(200).end();
    console.log('OPTIONS request handled for auth/login');
  });
  
  // User routes
  app.post(`${apiPrefix}/auth/login`, (req, res) => {
    try {
      console.log('Auth login route hit with method:', req.method);
      console.log('Request headers:', req.headers);
      console.log('Request body:', req.body);
      
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
      }
      
      // Simple demo authentication
      if (username === 'demo' && password === 'demo') {
        const userData = {
          id: 1,
          username: 'demo',
          fullName: 'Demo User',
          email: 'demo@example.com',
          plan: 'premium'
        };
        
        // Set CORS headers explicitly for all responses
        res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://smart-io.online');
        res.header('Access-Control-Allow-Credentials', 'true');
        
        // Set user in session
        if (req.session) {
          req.session.userId = userData.id;
        }
        
        return res.json(userData);
      }
      
      // Failed login response
      return res.status(401).json({ message: "Invalid username or password" });
      
    } catch (err) {
      console.error('Login error:', err);
      return res.status(500).json({ message: "Internal server error" });
    }
  });
} 