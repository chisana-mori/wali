import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createOpencodeClient } from "@opencode-ai/sdk";

export class Binary {
  static search<T, K>(list: T[], key: K, keyFn: (item: T) => K): { found: boolean; index: number } {
    let min = 0;
    let max = list.length - 1;
    while (min <= max) {
      const mid = (min + max) >>> 1;
      const itemKey = keyFn(list[mid]);
      if (itemKey < key) min = mid + 1;
      else if (itemKey > key) max = mid - 1;
      else return { found: true, index: mid };
    }
    return { found: false, index: min };
  }
}

async function retry<T>(task: () => Promise<T>, attempts = 3, delay = 1000): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export type Message = {
  id: string;
  sessionID: string;
  role: "user" | "assistant" | "system";
  time?: { created?: number; updated?: number; deleted?: number };
};

export type Part = {
  id: string;
  type: string;
  text?: string;
  tool?: string;
  output?: string;
  messageID: string;
  sessionID: string;
};

export type Session = {
  id: string;
  title?: string;
  directory?: string;
  parentID?: string;
  time: { created?: number; updated?: number; archived?: number; deleted?: number };
};

export type Todo = {
  id: string;
  subject: string;
  status: "pending" | "in_progress" | "completed";
  description?: string;
  sessionID: string;
};

export type PermissionRequest = {
  id: string;
  sessionID: string;
  description?: string;
  tool?: string;
};

export type QuestionOption = {
  label: string;
  description?: string;
};

export type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: { messageID: string; callID: string };
};

export type Config = Record<string, unknown>;
export type Project = { id: string; worktree?: string; sandboxes?: string[] };
export type ProviderListResponse = { all: unknown[]; connected: string[]; default: Record<string, unknown> };
export type FileDiff = unknown;

export type State = {
  status: "loading" | "partial" | "complete";
  agent: unknown[];
  command: unknown[];
  project: string;
  provider: ProviderListResponse;
  config: Config;
  path: Record<string, unknown>;
  session: Session[];
  sessionTotal: number;
  session_status: Record<string, unknown>;
  session_diff: Record<string, FileDiff[]>;
  todo: Record<string, Todo[]>;
  permission: Record<string, PermissionRequest[]>;
  question: Record<string, QuestionRequest[]>;
  mcp: Record<string, unknown>;
  lsp: unknown[];
  vcs: unknown;
  limit: number;
  message: Record<string, Message[]>;
  part: Record<string, Part[]>;
  activeSessionId: string | null;
};

type GlobalSyncContextValue = {
  state: State;
  createSession: () => Promise<string | null>;
  sendPrompt: (sessionId: string, text: string) => Promise<boolean>;
  respondPermission: (permissionId: string, decision: "reject" | "once" | "always") => Promise<void>;
  answerQuestion: (questionId: string, answers: string[][]) => Promise<void>;
  setActiveSession: (sessionId: string) => void;
  subscribe: (fn: (event: unknown) => void) => () => void;
};

const GlobalSyncContext = createContext<GlobalSyncContextValue | null>(null);

const DEFAULT_DIR = ".";
const DEBUG_QUESTIONS = true;
const DEBUG_MESSAGES = true;

const debugQuestion = (...args: unknown[]) => {
  if (!DEBUG_QUESTIONS) return;
  // Use debug to avoid noisy console by default
  console.debug("[question-debug]", ...args);
};

const debugMessage = (...args: unknown[]) => {
  if (!DEBUG_MESSAGES) return;
  console.debug("[message-debug]", ...args);
};

export function GlobalSyncProvider(props: { children: React.ReactNode }) {
  const [state, setState] = useState<State>({
    status: "loading",
    agent: [],
    command: [],
    project: "",
    provider: { all: [], connected: [], default: {} },
    config: {},
    path: {},
    session: [],
    sessionTotal: 0,
    session_status: {},
    session_diff: {},
    todo: {},
    permission: {},
    question: {},
    mcp: {},
    lsp: [],
    vcs: undefined,
    limit: 20,
    message: {},
    part: {},
    activeSessionId: null
  });

  const listenersRef = useRef(new Set<(event: unknown) => void>());
  const loadingMessagesRef = useRef(new Set<string>());

  const initialUserId = (() => {
    if (typeof window === "undefined") return `user_${Math.random().toString(36).slice(2, 8)}`;
    const stored = localStorage.getItem("opencode_user_id");
    return stored || `user_${Math.random().toString(36).slice(2, 8)}`;
  })();
  const userIdRef = useRef<string>(initialUserId);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("opencode_user_id", userIdRef.current);
    }
  }, []);

  const client = useMemo(() => {
    return createOpencodeClient({
      baseUrl: import.meta.env.VITE_API_BASE_URL || "/api",
      headers: { "x-user-id": userIdRef.current }
    }) as any;
  }, []);

  const subscribe = useCallback((fn: (event: unknown) => void) => {
    listenersRef.current.add(fn);
    return () => listenersRef.current.delete(fn);
  }, []);

  const updateState = (updater: (draft: State) => void) => {
    setState((prev) => {
      const next: State = {
        ...prev,
        session: prev.session.slice(),
        session_status: { ...prev.session_status },
        session_diff: { ...prev.session_diff },
        todo: { ...prev.todo },
        permission: { ...prev.permission },
        question: { ...prev.question },
        message: { ...prev.message },
        part: { ...prev.part }
      };
      updater(next);
      return next;
    });
  };

  const extractMessageList = (payload: any) => {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.messages)) return payload.messages;
    return [];
  };

  const normalizeMessages = (rawList: any[]) => {
    return rawList
      .map((item) => {
        if (!item) return null;
        // Common shape: { info: { ...message }, parts: [...] }
        if (item.info) {
          return {
            message: item.info,
            parts: Array.isArray(item.parts) ? item.parts : [],
          };
        }
        // Already a message object
        return { message: item, parts: Array.isArray(item.parts) ? item.parts : [] };
      })
      .filter(Boolean) as Array<{ message: any; parts: any[] }>;
  };

  const loadSessionMessages = async (sessionID: string) => {
    if (!sessionID) return;
    if (loadingMessagesRef.current.has(sessionID)) return;
    if (state.message[sessionID]?.length) return;
    loadingMessagesRef.current.add(sessionID);
    try {
      const res = await fetch(`/api/sessions/${sessionID}/message`, {
        headers: { "x-user-id": userIdRef.current },
      });
      if (!res.ok) return;
      const payload = await res.json().catch(() => null);
      const list = extractMessageList(payload);
      const normalized = normalizeMessages(list);
      debugMessage("message list fetched", { sessionID, count: normalized.length });
      updateState((draft) => {
        draft.message[sessionID] = normalized.map((x) => x.message);
        for (const entry of normalized) {
          const message = entry.message;
          if (message?.id) {
            if (entry.parts.length > 0) draft.part[message.id] = entry.parts;
          }
        }
      });
    } catch (err) {
      console.error("Failed to load session messages", err);
    } finally {
      loadingMessagesRef.current.delete(sessionID);
    }
  };

  const cleanupSessionCaches = (draft: State, sessionID: string | undefined) => {
    if (!sessionID) return;
    const messages = draft.message[sessionID] || [];
    for (const message of messages) {
      if (message?.id) delete draft.part[message.id];
    }
    delete draft.message[sessionID];
    delete draft.session_diff[sessionID];
    delete draft.todo[sessionID];
    delete draft.permission[sessionID];
    delete draft.question[sessionID];
    delete draft.session_status[sessionID];
  };

  const handleEvent = (event: any) => {
    if (DEBUG_QUESTIONS) {
      const detail = event?.details || event;
      const type = detail?.type || event?.type || event?.event;
      if (type?.startsWith?.("question.")) {
        debugQuestion("SSE event received", { type, event });
      }
    }
    if (DEBUG_MESSAGES) {
      const detail = event?.details || event;
      const type = detail?.type || event?.type || event?.event;
      if (type?.startsWith?.("message.") || type?.startsWith?.("session.message")) {
        debugMessage("SSE event received", { type, event });
      }
      if (type?.startsWith?.("message.part")) {
        debugMessage("SSE part event received", { type, event });
      }
    }
    listenersRef.current.forEach((fn) => {
      try {
        fn(event);
      } catch (err) {
        console.error(err);
      }
    });

    const directory = event?.name || event?.directory || DEFAULT_DIR;
    const detail = event?.details || event;
    const type = detail?.type || event?.type || event?.event;
    const properties = detail?.properties || event?.properties || detail?.payload || detail?.data || detail;

    if (!type) return;

    updateState((draft) => {
      switch (type) {
        case "session.created": {
          const info = properties.info || properties;
          if (!info?.id) return;
          // Subagent/child sessions should not appear in top-level session navigation.
          if (info.parentID) return;
          const result = Binary.search(draft.session, info.id, (s) => s.id);
          if (result.found) {
            draft.session[result.index] = { ...draft.session[result.index], ...info };
            break;
          }
          draft.session.splice(result.index, 0, info);
          draft.sessionTotal += 1;
          if (!draft.activeSessionId) draft.activeSessionId = info.id;
          break;
        }
        case "session.updated": {
          const info = properties.info || properties;
          if (!info?.id) return;
          if (info.time?.archived) {
            const result = Binary.search(draft.session, info.id, (s) => s.id);
            if (result.found) {
              draft.session.splice(result.index, 1);
              draft.sessionTotal = Math.max(0, draft.sessionTotal - 1);
            }
            cleanupSessionCaches(draft, info.id);
            break;
          }
          if (info.parentID) {
            // Defensive: if a session becomes a child session, keep it out of top-level list.
            const result = Binary.search(draft.session, info.id, (s) => s.id);
            if (result.found) {
              draft.session.splice(result.index, 1);
              draft.sessionTotal = Math.max(0, draft.sessionTotal - 1);
            }
            break;
          }
          const result = Binary.search(draft.session, info.id, (s) => s.id);
          if (result.found) {
            draft.session[result.index] = { ...draft.session[result.index], ...info };
          } else {
            draft.session.splice(result.index, 0, info);
          }
          break;
        }
        case "session.deleted": {
          const sessionID = properties.info?.id || properties.id;
          if (!sessionID) return;
          const result = Binary.search(draft.session, sessionID, (s) => s.id);
          if (result.found) {
            draft.session.splice(result.index, 1);
            draft.sessionTotal = Math.max(0, draft.sessionTotal - 1);
          }
          cleanupSessionCaches(draft, sessionID);
          if (draft.activeSessionId === sessionID) draft.activeSessionId = null;
          break;
        }
        case "session.diff": {
          if (!properties.sessionID) return;
          draft.session_diff[properties.sessionID] = properties.diff || [];
          break;
        }
        case "todo.updated": {
          if (!properties.sessionID || !properties.todos) return;
          draft.todo[properties.sessionID] = properties.todos;
          break;
        }
        case "session.status": {
          if (!properties.sessionID) return;
          draft.session_status[properties.sessionID] = properties.status || {};
          break;
        }
        case "message.updated":
        case "message.created":
        case "session.message_added":
        case "session.message_updated": {
          const info = properties.info || properties;
          if (!info?.id || !info?.sessionID) return;
          const list = draft.message[info.sessionID] || [];
          const result = Binary.search(list, info.id, (m) => m.id);
          if (result.found) list[result.index] = { ...list[result.index], ...info };
          else list.splice(result.index, 0, info);
          list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          draft.message[info.sessionID] = list;
          debugMessage("message stored", { sessionID: info.sessionID, id: info.id, role: info.role });
          break;
        }
        case "message.removed": {
          const sessionID = properties.sessionID;
          const messageID = properties.messageID;
          if (!sessionID || !messageID) return;
          const list = draft.message[sessionID];
          if (list) {
            const result = Binary.search(list, messageID, (m) => m.id);
            if (result.found) list.splice(result.index, 1);
          }
          delete draft.part[messageID];
          break;
        }
        case "message.part.updated":
        case "message.part.added": {
          const part = properties.part || properties;
          if (!part?.id || !part?.messageID) return;
          const list = draft.part[part.messageID] || [];
          const result = Binary.search(list, part.id, (p) => p.id);
          if (result.found) list[result.index] = { ...list[result.index], ...part };
          else list.splice(result.index, 0, part);
          list.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
          draft.part[part.messageID] = list;
          debugMessage("message part stored", { messageID: part.messageID, id: part.id, type: part.type });
          break;
        }
        case "message.part.removed": {
          const messageID = properties.messageID;
          const partID = properties.partID;
          if (!messageID || !partID) return;
          const list = draft.part[messageID];
          if (!list) return;
          const result = Binary.search(list, partID, (p) => p.id);
          if (result.found) list.splice(result.index, 1);
          if (list.length === 0) delete draft.part[messageID];
          break;
        }
        case "permission.asked": {
          const request = properties;
          if (!request?.sessionID) return;
          const list = draft.permission[request.sessionID] || [];
          const result = Binary.search(list, request.id, (p) => p.id);
          if (result.found) list[result.index] = { ...list[result.index], ...request };
          else list.splice(result.index, 0, request);
          draft.permission[request.sessionID] = list;
          break;
        }
        case "permission.replied":
        case "permission.approved":
        case "permission.denied": {
          const request = properties;
          const id = request.id || request.callID || request.requestID;
          const sessionID = request.sessionID;
          if (!sessionID || !id) return;
          const list = draft.permission[sessionID] || [];
          const idx = list.findIndex((p) => p.id === id);
          if (idx !== -1) list.splice(idx, 1);
          draft.permission[sessionID] = list;
          break;
        }
        case "question.asked": {
          const request = properties;
          if (!request?.sessionID) return;
          const list = draft.question[request.sessionID] || [];
          const result = Binary.search(list, request.id, (q) => q.id);
          if (result.found) list[result.index] = { ...list[result.index], ...request };
          else list.splice(result.index, 0, request);
          draft.question[request.sessionID] = list;
          debugQuestion("question.asked stored", {
            sessionID: request.sessionID,
            id: request.id,
            tool: request.tool,
            questionsCount: request.questions?.length,
          });
          break;
        }
        case "question.replied":
        case "question.answered":
        case "question.rejected": {
          const request = properties;
          const id = request.id || request.questionId || request.requestID;
          const sessionID = request.sessionID;
          if (!id) return;
          if (sessionID) {
            const list = draft.question[sessionID] || [];
            const idx = list.findIndex((q) => q.id === id);
            if (idx !== -1) list.splice(idx, 1);
            draft.question[sessionID] = list;
            debugQuestion("question removed", { type, sessionID, id });
            break;
          }
          // Some backends may omit sessionID in replied events. Remove by id globally.
          for (const [sid, list] of Object.entries(draft.question)) {
            const idx = list.findIndex((q) => q.id === id);
            if (idx !== -1) {
              list.splice(idx, 1);
              draft.question[sid] = list;
              debugQuestion("question removed (global)", { type, sessionID: sid, id });
              break;
            }
          }
          break;
        }
        case "todo.created":
        case "todo.item_added":
        case "todo.item_completed":
        case "todo.deleted": {
          const sid = properties.sessionId || properties.sessionID;
          const items = properties.items || properties.todos;
          if (sid && items) draft.todo[sid] = items;
          break;
        }
        case "lsp.updated":
        case "vcs.branch.updated":
        case "worktree.ready":
        case "worktree.failed":
        case "server.instance.disposed":
        default:
          break;
      }
    });

    if (type === "server.instance.disposed") {
      setState((prev) => ({ ...prev, status: "partial" }));
    }
  };

  useEffect(() => {
    let cancelled = false;
    const bootstrap = async () => {
      setState((prev) => ({ ...prev, status: "loading" }));
      try {
        await Promise.all([
          retry(() =>
            client.session.list({ directory: DEFAULT_DIR }).then((res: any) => {
              const list = (res.data || [])
                .filter((s: any) => !s.time?.archived)
                .filter((s: any) => !s.parentID)
                .sort((a: any, b: any) => cmp(a.id, b.id));
              updateState((draft) => {
                draft.session = list;
                draft.sessionTotal = list.length;
                if (!draft.activeSessionId && list.length > 0) draft.activeSessionId = list[0].id;
              });
            })
          ),
          retry(() =>
            client.permission.list().then((res: any) => {
              const grouped: Record<string, PermissionRequest[]> = {};
              for (const p of res.data || []) {
                if (!p.sessionID) continue;
                if (!grouped[p.sessionID]) grouped[p.sessionID] = [];
                grouped[p.sessionID].push(p);
              }
              updateState((draft) => {
                draft.permission = grouped;
              });
            })
          ).catch(() => undefined),
          retry(() =>
            client.question.list().then((res: any) => {
              const grouped: Record<string, QuestionRequest[]> = {};
              for (const q of res.data || []) {
                if (!q.sessionID) continue;
                if (!grouped[q.sessionID]) grouped[q.sessionID] = [];
                grouped[q.sessionID].push(q);
              }
              updateState((draft) => {
                draft.question = grouped;
              });
              debugQuestion("bootstrap question.list()", {
                total: (res.data || []).length,
                sessions: Object.keys(grouped).length,
              });
            })
          ).catch(() => undefined)
        ]);
        setState((prev) => ({ ...prev, status: "complete" }));
      } catch (err) {
        console.error("Bootstrap failed", err);
        setState((prev) => ({ ...prev, status: "partial" }));
      }
    };

    const connect = async () => {
      await bootstrap();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
      const url = `${baseUrl}/event`;

      try {
        const response = await fetch(url, {
          headers: { "x-user-id": userIdRef.current, Accept: "text/event-stream" }
        });
        if (!response.ok || !response.body) throw new Error("SSE failed");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split("\n\n");
          buffer = chunks.pop() || "";

          for (const chunk of chunks) {
            if (chunk.trim().startsWith("data: ")) {
              try {
                const event = JSON.parse(chunk.trim().slice(6));
                handleEvent(event);
              } catch (err) {
                console.error(err);
              }
            }
          }
        }
      } catch (err) {
        console.error("SSE error", err);
        if (!cancelled) setTimeout(connect, 5000);
      }
    };

    connect();
    return () => {
      cancelled = true;
    };
  }, [client]);

  useEffect(() => {
    if (!state.activeSessionId) return;
    void loadSessionMessages(state.activeSessionId);
  }, [state.activeSessionId]);

  const createSession = async () => {
    try {
      const res = await client.session.create({ directory: DEFAULT_DIR });
      const session = res.data;
      if (session?.id) {
        handleEvent({ type: "session.created", properties: session, directory: DEFAULT_DIR });
        setState((prev) => ({ ...prev, activeSessionId: session.id }));
        return session.id;
      }
    } catch (err) {
      console.error(err);
    }
    return null;
  };

  const sendPrompt = async (sessionId: string, text: string) => {
    if (!sessionId || !text.trim()) return false;
    try {
      await client.session.prompt({
        path: { id: sessionId },
        body: {
          model: {
            providerID: import.meta.env.VITE_MODEL_PROVIDER || "openai",
            modelID: import.meta.env.VITE_MODEL_ID || "gpt-4o"
          },
          agent: "cloud-ops-troubleshooter",
          parts: [{ type: "text", text }]
        }
      });
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  };

  const respondPermission = async (id: string, decision: "reject" | "once" | "always") => {
    let sessionID: string | undefined;
    for (const [sid, perms] of Object.entries(state.permission)) {
      if (perms.some((p) => p.id === id)) {
        sessionID = sid;
        break;
      }
    }
    if (!sessionID) return;

    await fetch(`/api/sessions/${sessionID}/permissions/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-user-id": userIdRef.current },
      body: JSON.stringify({ decision })
    });
    handleEvent({ type: "permission.replied", properties: { id, sessionID }, directory: DEFAULT_DIR });
  };

  const answerQuestion = async (id: string, answers: string[][]) => {
    let sessionID: string | undefined;
    for (const [sid, qs] of Object.entries(state.question)) {
      if (qs.some((q) => q.id === id)) {
        sessionID = sid;
        break;
      }
    }
    if (!sessionID) return;

    try {
      const res = await fetch(`/api/sessions/${sessionID}/questions/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-user-id": userIdRef.current },
        body: JSON.stringify({ answers })
      });
      if (!res.ok) {
        console.error("Failed to submit question answer", { id, sessionID, status: res.status });
        return;
      }
      // Optimistically remove answered question to avoid stale UI if SSE event is delayed/missed.
      handleEvent({ type: "question.replied", properties: { id, sessionID }, directory: DEFAULT_DIR });
    } catch (err) {
      console.error("Failed to submit question answer", err);
    }
  };

  const setActiveSession = (id: string) => {
    setState((prev) => ({ ...prev, activeSessionId: id }));
    void loadSessionMessages(id);
  };

  const value = useMemo(
    () => ({
      state,
      createSession,
      sendPrompt,
      respondPermission,
      answerQuestion,
      setActiveSession,
      subscribe
    }),
    [state, createSession, sendPrompt, respondPermission, answerQuestion, setActiveSession, subscribe]
  );

  return <GlobalSyncContext.Provider value={value}>{props.children}</GlobalSyncContext.Provider>;
}

export const useGlobalSync = () => {
  const ctx = useContext(GlobalSyncContext);
  if (!ctx) throw new Error("No GlobalSyncProvider");
  return ctx;
};
