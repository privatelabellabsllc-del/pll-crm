# PLL Manufacturing CRM

Full-stack CRM and manufacturing project management system for Private Label Labs.

## Features

- **Customer Management** - Track leads, contacts, and accounts
- **Sales Pipeline** - Manage sales stages from lead to project
- **Production Pipeline** - Track manufacturing from deposit to delivery
- **Inventory Management** - Monitor ingredients, stock levels, and locations
- **Formula Management** - Create and cost product formulas
- **Supplier Management** - Track suppliers, lead times, and contacts
- **Purchase Orders** - Manage procurement and deliveries
- **Production Planning** - Plan and schedule production runs
- **Compliance & Traceability** - Batch tracking and ingredient tracing
- **Reporting & Analytics** - Revenue, profit, and operational dashboards

## Tech Stack

- **Backend**: Express.js + better-sqlite3
- **Frontend**: Vite + React + TypeScript + DaisyUI/Tailwind
- **Auth**: JWT-based authentication with bcrypt password hashing

## Local Development

### Prerequisites
- Node.js 18+
- npm

### Setup

```bash
# Install all dependencies
npm run install:all

# Start both server and client in dev mode
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

### Default Credentials
- **Username**: admin
- **Password**: admin123

## Deployment (Railway)

### Step-by-step:

1. Push to a GitHub repository
2. Go to [railway.app](https://railway.app) and create a new project
3. Select "Deploy from GitHub repo" and connect your repository
4. Railway will auto-detect the Dockerfile
5. Set environment variables:
   - `JWT_SECRET` - Set a strong random secret (required!)
   - `PORT` - Railway sets this automatically
   - `NODE_ENV` - Set to `production`
6. Deploy!

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | 3001 | Server port (Railway auto-sets) |
| `JWT_SECRET` | Yes | dev-secret | JWT signing secret |
| `NODE_ENV` | No | development | Set to `production` for deployment |
| `FRONTEND_URL` | No | - | Frontend URL for CORS (Railway URL) |

### Persistent Storage (Railway)
To persist the SQLite database on Railway:
1. Add a volume in Railway project settings
2. Mount it at `/app/data`
3. The database file is stored at `/app/data/pll-crm.db`

## Project Structure

```
├── Dockerfile
├── README.md
├── package.json
├── server/
│   ├── package.json
│   ├── index.js          # Express server + API routes
│   ├── db.js             # SQLite setup + schema
│   └── auth.js           # JWT auth middleware
├── client/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   └── src/
│       ├── main.tsx       # Entry point
│       ├── App.tsx        # Main app with auth
│       ├── api.ts         # API layer (window.tasklet shim)
│       ├── auth.tsx       # Auth context + login screen
│       ├── types.ts       # TypeScript types
│       ├── global.d.ts    # Window type declarations
│       ├── styles.css
│       ├── utils/
│       │   └── helpers.ts
│       └── components/    # All CRM components
```
