# Progress Log

## 2026-02-05
- Created planning files and design doc.
- Confirmed React + Vite approach and full frontend replacement.
- Replaced frontend dependencies with React + Vite setup.
- Rebuilt GlobalSync provider in React with SSE event handling.
- Implemented AI Elements message primitives and core UI components.
- Replaced Solid UI with React components and AI Elements primitives.
- Added toast notification system and permission/question overlays.
- Attempted shadcn/ai-elements CLI install; `npx`/`npm exec` timed out and registry fetch failed due to DNS.
- Added manual `components.json` and `tailwind.config.ts` to prepare for ai-elements components.
- shadcn init completed by user; updated Tailwind 4 config and dependencies.
- Official ai-elements message component present; cleaned CSS to avoid duplicate theme blocks.
- Updated MessageList to use ai-elements Conversation components.
- Replaced MessageInput with ai-elements PromptInput components.
- Added ai-elements Conversation components into MessageList.
- Updated sidebar and overlays to use shadcn/ui Button/Dialog/Separator for ai-elements-aligned styling.
- Updated ChatHeader to use ai-elements ConversationDownload and shadcn Separator.
- Replaced StatusBanner with shadcn Alert component and added Radix Toast system.
- Implemented card-based part rendering for reasoning/tool/action/etc. in MessageList.
- Added badge and enriched tool/step card rendering to align with opencode message-part semantics.
- Refined tool card subtitles to match opencode tool metadata fields while keeping strict part order.
- Reasoning card now defaults to collapsed with 2-line preview, expandable to full content.
- Added inline question prompt cards (A/B/C/D) aligned with OpenCode QuestionRequest flow.
- Added ordered sorting fallback in MessageList; added Reasoning and Step cards for alignment with OpenCode semantics.
