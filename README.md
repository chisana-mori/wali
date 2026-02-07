# Opencode Web (Wali)

Modern web interface for Opencode agents, built with **React** (Frontend) and **Bun** (Backend).

## Overview

Opencode Web (codenamed "Wali") provides a sleek, real-time interface for interacting with Opencode agents. It features a responsive chat UI, markdown rendering, syntax highlighting, and seamless streaming of agent responses.

## Key Features

- **Real-time Interaction**: Server-Sent Events (SSE) for instant agent feedback.
- **Modern UI**: Built with React 19, TailwindCSS, and Radix UI.
- **Rich Content**: Support for Markdown, Code blocks with syntax highlighting, and LaTeX math.
- **Agent Integration**: Direct integration with `@opencode-ai/sdk`.
- **Workspace Management**: Multi-session support.

## Project Structure

- `frontend/`: React + Vite application.
- `backend/`: Node.js server running on Bun with Express and `@opencode-ai/sdk`.

## Prerequisites

- **Bun** (v1.0+ recommended for both backend and frontend)
- **Node.js** (Optional, if using npm/pnpm heavily, but Bun covers most needs)

## Getting Started

### 1. Backend Setup

The backend acts as the bridge to the Opencode agent runtime.

```bash
cd backend
bun install
# Configure environment variables (optional, defaults provided)
# cp .env.example .env
bun dev
```

The server typically starts on `http://localhost:8080`.

### 2. Frontend Setup

The frontend provides the user interface.

```bash
cd frontend
bun install
bun run dev
```

The application typically runs on `http://localhost:5173`.

## Configuration

### Backend Environment Variables (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENCODE_ADDR` | `:8080` | Port for the backend server. |
| `OPENCODE_OPENCODE_URL` | `http://localhost:8081` | URL of the upstream Opencode service. |
| `OPENCODE_WORKSPACE_ROOT` | `./workspaces` | Directory for agent workspaces. |

### Frontend Environment Variables (`frontend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_MODEL_PROVIDER` | `zai-coding-plan` | Model provider identifier. |
| `VITE_MODEL_ID` | `glm-4.7` | Specific model ID to use. |

## Development

- **Frontend**: Utilizes Vite for fast HMR. Styles are handled via TailwindCSS.
- **Backend**: Uses Bun for fast startup and execution.
