# opencode-web

Multi-user web wrapper for OpenCode server with SSE event streaming.

## Structure
- `frontend/`: Solid.js + Vite client using `@opencode-ai/sdk/v2`
- `backend/`: Go server that proxies REST + SSE to OpenCode

## Local Dev
1. Backend (separate terminal):
   - `cd backend`
   - `go run ./cmd/server`
2. Frontend:
   - `pnpm install`
   - `pnpm dev`

## Configuration
Backend environment variables:
- `OPENCODE_URL` (default `http://localhost:8081`)
- `OPENCODE_ADDR` (default `:8080`)
- `WORKSPACE_ROOT` (default `./workspaces`)

Frontend environment variables:
- `VITE_MODEL_PROVIDER` (default `zai-coding-plan`)
- `VITE_MODEL_ID` (default `glm-4.7`)
