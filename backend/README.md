# OpenCode Web Backend (Node.js)

This is the Node.js implementation of the OpenCode Web Backend, migrated from Go.

## Prerequisites

- [Bun](https://bun.sh) (v1.0.0 or higher)

## Setup

1. Install dependencies:
   ```bash
   bun install
   ```

2. Configure environment variables:
   Copy `.env.example` (if exists) or create `.env`:
   ```env
   OPENCODE_ADDR=:8080
   OPENCODE_OPENCODE_URL=http://localhost:8081
   OPENCODE_WORKSPACE_ROOT=./workspaces
   ```

## Running

- **Development**:
  ```bash
  bun run dev
  ```

- **Production**:
  ```bash
  bun run start
  ```

## Legacy Code

The original Go implementation has been moved to the `go-legacy` directory.

## API Endpoints

- `GET /api/health`: Health check
- `GET /api/sse`: Proxy to upstream SSE
- `ALL /api/session/*`: Proxy to upstream session API
