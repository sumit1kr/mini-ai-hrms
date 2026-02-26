# Mini AI-HRMS

A full-stack AI-powered Human Resource Management System with Web3/blockchain integration.

## 🚀 Features

- **Role-Based Access Control**: Admin and Employee roles with different permissions
- **Task Management**: Create, assign, and track tasks with priority levels
- **AI Productivity Scoring**: Automated employee performance analysis
- **Organization Management**: Multi-organization support with join request workflow
- **Web3 Integration**: MetaMask wallet connection and blockchain activity logging
- **Blockchain Logging**: Task completion tracking on Polygon Amoy testnet

## 🛠️ Tech Stack

### Backend
- Node.js + Express
- PostgreSQL
- JWT Authentication
- Winston Logger
- Ethers.js (Web3)

### Frontend
- React 18
- Vite
- Tailwind CSS
- React Router v6
- Axios

## 📋 Prerequisites

- Node.js 18+ (for local development)
- Docker & Docker Compose (for containerized setup)
- PostgreSQL (if running locally without Docker)

## 🐳 Docker Setup (Recommended)

### Development Mode

1. Clone the repository:
```bash
git clone <repository-url>
cd RizeOS1
```

2. Start all services:
```bash
docker-compose up -d
```

This will start:
- PostgreSQL on port 5432
- Backend API on port 3001
- Frontend on port 5173

3. Access the application:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/api/health

4. Stop services:
```bash
docker-compose down
```

5. Stop and remove volumes (clean slate):
```bash
docker-compose down -v
```

### Production Mode

```bash
docker-compose -f docker-compose.prod.yml up -d
```

Production setup:
- Frontend served via Nginx on port 80
- Backend on port 3001
- Optimized builds with health checks

## 💻 Local Development (Without Docker)

### Backend Setup

1. Navigate to backend:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Start PostgreSQL (if not using Docker):
```bash
# Option 1: Use Docker for PostgreSQL only
docker run -d \
  --name hrms_postgres \
  -e POSTGRES_DB=hrms_db \
  -e POSTGRES_USER=hrms_user \
  -e POSTGRES_PASSWORD=hrms_pass123 \
  -p 5432:5432 \
  postgres:15-alpine

# Option 2: Use local PostgreSQL installation
# Make sure PostgreSQL is running and update .env accordingly
```

5. Start backend:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start development server:
```bash
npm run dev
```

4. Access at http://localhost:5173

## 🔧 Environment Variables

### Backend (.env)

```env
NODE_ENV=development
PORT=3001

# Database (choose one method)
# Method 1: Connection string
DATABASE_URL=postgresql://user:password@host:5432/database

# Method 2: Individual credentials (used if DATABASE_URL not set)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hrms_db
DB_USER=hrms_user
DB_PASSWORD=hrms_pass123
DB_SSL=false

# JWT
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=24h

# CORS
CORS_ORIGIN=*

# Web3 (Optional - for blockchain features)
POLYGON_RPC_URL=https://rpc-amoy.polygon.technology/
POLYGON_CHAIN_ID=80002
CONTRACT_ADDRESS=0x0000000000000000000000000000000000000000
ADMIN_PRIVATE_KEY=your_private_key_here
```

## 📚 API Documentation

### Authentication
- `POST /api/auth/register-admin` - Register organization admin
- `POST /api/auth/register-employee` - Submit employee join request
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user

### Organizations
- `GET /api/organizations/my` - Get my organization
- `GET /api/organizations/employees` - List employees (admin)
- `GET /api/organizations/requests` - List join requests (admin)
- `POST /api/organizations/requests/:id/approve` - Approve request (admin)
- `POST /api/organizations/requests/:id/reject` - Reject request (admin)

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task (admin)
- `PUT /api/tasks/:id` - Update task
- `DELETE /api/tasks/:id` - Delete task (admin)

### Dashboard
- `GET /api/dashboard/stats` - Get dashboard statistics
- `GET /api/dashboard/my-stats` - Get my statistics (employee)

### AI
- `GET /api/ai/score/:userId` - Calculate AI productivity score
- `POST /api/ai/recalculate-all` - Recalculate all scores (admin)
- `GET /api/ai/insights` - Get AI insights (admin)

### Web3
- `GET /api/web3/status` - Check blockchain status
- `POST /api/web3/connect-wallet` - Connect MetaMask wallet
- `DELETE /api/web3/disconnect-wallet` - Disconnect wallet
- `GET /api/web3/activity/:userId` - Get blockchain activity
- `GET /api/web3/org-logs` - Get organization blockchain logs (admin)

## 🔐 Security

- JWT-based authentication
- Password hashing with bcryptjs
- Rate limiting on API endpoints
- Helmet.js security headers
- CORS configuration
- Environment variable protection

## 🧪 Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## 📦 Building for Production

### Backend
```bash
cd backend
npm run build
npm start
```

### Frontend
```bash
cd frontend
npm run build
npm run preview
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Polygon for blockchain infrastructure
- MetaMask for wallet integration
- OpenAI for AI capabilities inspiration
