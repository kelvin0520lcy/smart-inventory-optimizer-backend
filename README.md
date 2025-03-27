# Smart Inventory Optimizer - Backend

Backend service for the Smart Inventory Optimizer application.

## Environment Setup

The application requires the following environment variables:

```
NODE_ENV=production
DATABASE_URL=postgresql://postgres:password@host:5432/database
DB_HOST=host
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=database
CORS_ORIGIN=https://smart-io.online
API_URL=https://api.smart-io.online
CLIENT_URL=https://smart-io.online
USE_SSL=true
SESSION_SECRET=your_session_secret_here
OPENAI_API_KEY=your_openai_api_key
```

## Deployment on Render

1. Create a new Render Web Service
2. Connect your GitHub repository
3. Set the following configuration:
   - **Environment**: Node
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
4. Add all required environment variables
5. Deploy the service

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Create a `.env` file with the required variables
4. Run the development server: `npm run dev`

## API Documentation

The API includes the following endpoints:

- `/health` - Health check endpoint
- `/api/status` - API status check
- `/api/products` - Products CRUD endpoints
- `/api/sales` - Sales data endpoints
- `/api/integrations` - Integration management endpoints
- `/api/assistant` - AI assistant endpoints for chat-based inventory analysis 