# MyTeacher Institute Backend

A modern Express.js + TypeScript backend application for the MyTeacher Institute platform.

## Project Structure

```
src/
├── config/          - Configuration files (env, database, app setup)
├── controllers/     - Request handlers
├── middleware/      - Express middleware
├── models/          - MongoDB schemas
├── routes/          - API route definitions
├── services/        - Business logic layer
├── types/           - TypeScript type definitions
├── utils/           - Utility functions
├── app.ts           - Express app setup
└── server.ts        - Server entry point
```

## Prerequisites

- Node.js 16+ (or later)
- pnpm 8+ (package manager)
- MongoDB 4.4+ (local or remote instance)

## Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and update values if needed
3. Install dependencies:

```bash
pnpm install
```

## Development

Start the development server with hot reload:

```bash
pnpm dev
```

The server will run on `http://localhost:5000`

## Available Scripts

- `pnpm dev` - Start development server with nodemon
- `pnpm build` - Build TypeScript to JavaScript
- `pnpm start` - Run production build
- `pnpm lint` - Run ESLint
- `pnpm lint:fix` - Fix ESLint issues
- `pnpm format` - Format code with Prettier

## Configuration

Environment variables (create `.env` from `.env.example`):

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/myteacher-institute
```

## MongoDB Setup

Ensure MongoDB is running locally:

```bash
# Using Docker (recommended)
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Or install MongoDB locally and start the service
```

## Code Quality

- **ESLint**: TypeScript linting
- **Prettier**: Code formatting
- **Type Safety**: Strict TypeScript configuration

Run code quality checks:

```bash
pnpm lint
pnpm format
```

## Next Steps

1. Define MongoDB schemas in `src/models/`
2. Create services for business logic in `src/services/`
3. Add controllers in `src/controllers/`
4. Define routes in `src/routes/`
5. Add middleware as needed in `src/middleware/`


## Steps to start redis in the system
1. sc query type= service state= all | findstr /I Redis
2. net stop <service_name>
3. net start <service_name> (e.g., net start Memurai)

## License

ISC

