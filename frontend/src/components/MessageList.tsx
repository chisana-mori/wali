import React, { useMemo, useEffect, useRef, useState } from "react";
import { ThinkingMessage } from "./ThinkingMessage";
import { Sparkles, ChevronRight } from "lucide-react";
import { useGlobalSync } from "../contexts/GlobalSync";
import type { QuestionRequest, QuestionOption } from "../contexts/GlobalSync";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import { StepCard } from "./StepCard";
import { QuestionInlineCard } from "./QuestionInlineCard";
import { SopDrawer } from "./SopDrawer";
import type { StepView, StepKind } from "../types/ir";

const DEBUG_QUESTIONS = true;

function sortById<T extends { id?: string }>(list: T[]) {
  return list.slice().sort((a, b) => {
    const aId = a.id ?? "";
    const bId = b.id ?? "";
    if (aId < bId) return -1;
    if (aId > bId) return 1;
    return 0;
  });
}

function mapPartToStep(part: any, role?: string): StepView {
  const input = part.state?.input ?? part.input;
  const output = part.state?.output ?? part.output;
  const error = part.state?.error ?? part.error;

  const statusMap: Record<string, StepView['status']> = {
    running: 'inProgress',
    pending: 'pending',
    error: 'failed',
    completed: 'completed',
  };

  const partStatus = part.state?.status;
  // If part has no explicit status, assume completed for text/static parts, unless it's the last one?
  // Actually opencode parts usually have state if they are tools.

  let status: StepView['status'] = partStatus ? (statusMap[partStatus] ?? 'pending') : 'completed';

  let kind: StepKind = role === 'user' ? 'userMessage' : 'assistantMessage';
  let stream = part.text;
  let meta: any = {};
  let result = output;

  if (part.type === 'reasoning') {
    kind = 'reasoning';
    // Reasoning usually doesn't have state object in some implementations, but if it's text based:
    stream = part.text;
  } else if (part.type === 'tool') {
    const tool = part.tool;

    // Default meta from input
    meta = { ...input };

    if (tool === 'bash' || tool === 'run_command') {
      kind = 'commandExecution';
      meta = { command: input?.command ?? input?.CommandLine, cwd: input?.cwd ?? input?.Cwd };
    } else if (tool === 'edit' || tool === 'write' || tool === 'replace_file_content' || tool === 'write_to_file' || tool === 'multi_replace_file_content') {
      kind = 'fileChange';
      const path = input?.targetFile ?? input?.TargetFile ?? input?.path ?? input?.Path;
      meta = {
        changes: [{
          kind: tool.includes('write') ? 'add' : 'mod',
          path: path
        }]
      };
    } else if (tool === 'websearch' || tool === 'search_web' || tool === 'webfetch') {
      kind = 'webSearch';
    } else {
      kind = 'mcpToolCall';
      // Try to determine server name if possible, otherwise just use tool name
      meta = { tool: tool, server: 'mcp' };
      if (input) meta.arguments = input;
    }

    if (error) {
      status = 'failed';
      result = { error: error };
    }
  } else if (part.type === 'patch') {
    kind = 'fileChange';
    meta = {
      changes: part.files?.map((f: string) => ({ kind: 'mod', path: f })) ?? []
    };
  } else if (part.type === 'text') {
    kind = role === 'user' ? 'userMessage' : 'assistantMessage';
    meta = { text: part.text };
  } else if (part.type === 'file') {
    kind = 'fileChange'; // View file?
    // Or maybe just show as system note or attachment?
    // StepCard handles fileChange better.
    meta = { changes: [{ kind: 'read', path: part.filename ?? part.url }] };
  }

  return {
    stepId: part.id ?? `step-${Math.random().toString(36).substr(2, 9)}`,
    kind,
    status,
    stream,
    meta,
    result,
    tsStart: Date.now(),
    approval: undefined, // Add approval logic if part has approval request
  };
}

function stripMarkdown(text: string): string {
  if (!text) return text;
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*>\s?/gm, "")
    .replace(/^\s*([-*+]|\d+\.)\s+/gm, "")
    .replace(/!\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[*_~]+/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function splitQuestionLine(line: string): QuestionOption[] {
  const segments = line.split(/(?=(?:^|[\s\u3000])(?:[A-F]|[1-9])(?:[\.、\):：]|\s))/);
  const options: QuestionOption[] = [];
  for (const segment of segments) {
    const trimmed = segment.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-F]|[1-9])(?:[\.、\):：]|\s)+(.*)$/);
    if (!match) continue;
    const marker = match[1];
    const body = stripMarkdown(match[2].trim());
    if (!body) continue;
    const parts = body.split(/\s*[—–-]\s*/);
    const labelText = stripMarkdown((parts[0] || "").trim());
    const description = parts.length > 1 ? stripMarkdown(parts.slice(1).join(" - ").trim()) : undefined;
    const label = labelText ? `${marker}. ${labelText}` : `${marker}.`;
    options.push({ label, description });
  }
  return options;
}

function findQuestionLine(lines: string[], optionsLineIndex: number): string | null {
  for (let i = optionsLineIndex - 1; i >= 0; i -= 1) {
    const line = stripMarkdown(lines[i]?.trim() || "");
    if (!line) continue;
    if (/^问题\s*\d+[:：]?$/.test(line)) continue;
    return line;
  }
  return null;
}

function inferMultiple(question: string): boolean {
  const normalized = question.toLowerCase();
  return (
    normalized.includes("多选") ||
    normalized.includes("可多选") ||
    normalized.includes("可选择多个") ||
    normalized.includes("可选多项") ||
    normalized.includes("multiple")
  );
}

type ParsedQuestion = { question: string; options: QuestionOption[]; multiple: boolean };

function parseFallbackQuestions(text: string): ParsedQuestion[] {
  if (!text) return [];
  const rawLines = text.split("\n");

  const optionLines: { index: number; marker: string; option: QuestionOption }[] = [];
  rawLines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const match = trimmed.match(/^([A-F]|[1-9])(?:[\.、\):：]|\s)+(.*)$/);
    if (!match) return;
    const marker = match[1];
    const body = stripMarkdown(match[2].trim());
    if (!body) return;
    const parts = body.split(/\s*[—–-]\s*/);
    const labelText = stripMarkdown((parts[0] || "").trim());
    const description = parts.length > 1 ? stripMarkdown(parts.slice(1).join(" - ").trim()) : undefined;
    const label = labelText ? `${marker}. ${labelText}` : `${marker}.`;
    optionLines.push({ index, marker, option: { label, description } });
  });

  const groups: { startIndex: number; options: QuestionOption[] }[] = [];
  if (optionLines.length >= 3) {
    let current: { startIndex: number; options: QuestionOption[] } | null = null;
    let seenMarkers = new Set<string>();
    for (const item of optionLines) {
      if (!current || seenMarkers.has(item.marker)) {
        if (current && current.options.length >= 3) {
          groups.push(current);
        }
        current = { startIndex: item.index, options: [] };
        seenMarkers = new Set<string>();
      }
      current.options.push(item.option);
      seenMarkers.add(item.marker);
    }
    if (current && current.options.length >= 3) {
      groups.push(current);
    }
  }

  if (groups.length === 0) {
    for (let i = 0; i < rawLines.length; i += 1) {
      const line = rawLines[i];
      const options = splitQuestionLine(line);
      if (options.length >= 3) {
        groups.push({ startIndex: i, options });
      }
    }
  }

  return groups.map((group) => {
    const questionLine = findQuestionLine(rawLines, group.startIndex);
    const questionText = stripMarkdown(questionLine || "请选择一个选项");
    return {
      question: questionText,
      options: group.options,
      multiple: inferMultiple(questionText),
    };
  });
}

const SOP_START = "<!-- SOP_START -->";
const SOP_END = "<!-- SOP_END -->";

function extractSopContent(text: string): string | null {
  if (!text) return null;
  const startIndex = text.indexOf(SOP_START);
  if (startIndex === -1) return null;
  let content = text.slice(startIndex + SOP_START.length);
  const endIndex = content.indexOf(SOP_END);
  if (endIndex !== -1) {
    content = content.slice(0, endIndex);
  }
  const trimmed = content.trim();
  return trimmed || null;
}

function hasQuestionIntent(text: string): boolean {
  if (!text) return false;
  return /[？?]|问题|请选择|请确认|请提供|选项|单选|多选|choose|select/i.test(text);
}

export default function MessageList() {
  const { state, answerQuestion, sendPrompt } = useGlobalSync();
  const sessionId = state.activeSessionId;
  const hiddenSelectionsRef = useRef<Set<string>>(new Set());
  const [sopOpen, setSopOpen] = useState(false);
  const lastAutoOpenedRef = useRef<string | null>(null);

  const messages = useMemo(() => {
    if (!sessionId) return [];
    return sortById(state.message[sessionId] || []);
  }, [sessionId, state.message]);

  const questions = useMemo(() => {
    if (!sessionId) return [];
    return (state.question[sessionId] || []).slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  }, [sessionId, state.question]);

  useEffect(() => {
    if (!DEBUG_QUESTIONS) return;
    if (!sessionId) {
      console.debug("[question-debug]", "no active session");
      return;
    }
    console.debug("[question-debug]", "questions updated", {
      sessionId,
      count: questions.length,
      questions: questions.map((q) => ({ id: q.id, tool: q.tool, qCount: q.questions?.length })),
    });
  }, [questions, sessionId]);

  const messageIdSet = useMemo(
    () => new Set(messages.filter((m) => m.role !== "system").map((m) => m.id)),
    [messages]
  );

  const lastVisibleMessageId = useMemo(() => {
    const list = messages.filter((m) => m.role !== "system");
    return list.length > 0 ? list[list.length - 1].id : null;
  }, [messages]);

  const questionBuckets = useMemo(() => {
    const anchored = new Map<string, typeof questions>();
    const unanchored: typeof questions = [];
    for (const q of questions) {
      const messageID = q.tool?.messageID;
      if (messageID && messageIdSet.has(messageID)) {
        const list = anchored.get(messageID) || [];
        list.push(q);
        anchored.set(messageID, list);
      } else {
        unanchored.push(q);
      }
    }
    if (DEBUG_QUESTIONS) {
      console.debug("[question-debug]", "question buckets", {
        anchored: Array.from(anchored.entries()).map(([id, list]) => ({ messageID: id, count: list.length })),
        unanchored: unanchored.map((q) => ({ id: q.id, tool: q.tool })),
      });
    }
    return { anchored, unanchored };
  }, [questions, messageIdSet]);

  const fallbackQuestionBuckets = useMemo(() => {
    const buckets = new Map<string, QuestionRequest[]>();
    if (!sessionId) return buckets;
    if (questions.length > 0) return buckets;
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const parts = state.part[message.id] || [];
      const text = parts
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n");
      if (!text) continue;
      // Never infer "questions" from generated SOP markdown content.
      if (extractSopContent(text)) continue;
      // Fallback parsing should only run when text clearly has question intent.
      if (!hasQuestionIntent(text)) continue;
      const parsed = parseFallbackQuestions(text);
      if (!parsed || parsed.length === 0) continue;
      const request: QuestionRequest = {
        id: `local-${message.id}`,
        sessionID: sessionId,
        questions: parsed.map((item) => ({
          question: item.question,
          header: "",
          options: item.options,
          multiple: item.multiple,
          custom: false,
        })),
        tool: { messageID: message.id, callID: "local" },
      };
      buckets.set(message.id, [request]);
    }
    return buckets;
  }, [messages, questions.length, sessionId, state.part]);

  const sopByMessage = useMemo(() => {
    const map = new Map<string, string>();
    if (!sessionId) return map;
    for (const message of messages) {
      if (message.role !== "assistant") continue;
      const parts = sortById(state.part[message.id] || []);
      const fullText = parts
        .filter((part) => part.type === "text" && typeof part.text === "string")
        .map((part) => part.text)
        .join("\n");
      const sopContent = extractSopContent(fullText);
      if (sopContent) {
        map.set(message.id, sopContent);
      }
    }
    return map;
  }, [messages, sessionId, state.part]);

  const latestSop = useMemo(() => {
    if (!sessionId || sopByMessage.size === 0) return null;
    let latest: { messageId: string; content: string } | null = null;
    for (const message of messages) {
      const content = sopByMessage.get(message.id);
      if (!content) continue;
      latest = { messageId: message.id, content };
    }
    return latest;
  }, [messages, sessionId, sopByMessage]);

  useEffect(() => {
    lastAutoOpenedRef.current = null;
  }, [sessionId]);

  useEffect(() => {
    if (!latestSop) {
      setSopOpen(false);
      return;
    }
    const key = `${sessionId ?? "no-session"}::${latestSop.messageId}`;
    if (lastAutoOpenedRef.current !== key) {
      lastAutoOpenedRef.current = key;
      setSopOpen(true);
    }
  }, [latestSop, sessionId]);

  const empty = !sessionId
    ? "Select a session to start chatting."
    : messages.length === 0
      ? "No messages yet."
      : null;

  return (
    <Conversation className="border-none bg-transparent shadow-none">
      <ConversationContent className="px-6 py-6 pb-24">
        {empty ? (
          <ConversationEmptyState title={empty} />
        ) : (
          messages.map((message) => {
            if (message.role === 'system') return null;
            if (message.role === 'user') {
              const parts = sortById(state.part[message.id] || []);
              const userText = parts
                .filter((part) => part.type === 'text' && typeof part.text === 'string')
                .map((part) => part.text)
                .join("\n")
                .trim();
              if (userText && hiddenSelectionsRef.current.has(`${message.sessionID}::${userText}`)) {
                return null;
              }
            }
            const anchoredQuestions = questionBuckets.anchored.get(message.id) || [];
            const fallbackQuestions = fallbackQuestionBuckets.get(message.id) || [];
            const hasFallbackQuestion = fallbackQuestions.length > 0;

            const parts = sortById(state.part[message.id] || []);
            const sopContent = sopByMessage.get(message.id) || null;
            const messageHasSop = Boolean(sopContent);
            const isLatestSop = Boolean(latestSop && latestSop.messageId === message.id);

            // Hide internal instruction messages that shouldn't be visible to the user
            const isInternalMessage = parts.some(p =>
              typeof p.text === 'string' && (
                p.text.includes("[search-mode]") ||
                p.text.includes("<EXTREMELY_IMPORTANT>") ||
                p.text.startsWith("IMPORTANT: The using-superpowers skill")
              )
            );

            if (isInternalMessage) return null;
            if (messageHasSop && !isLatestSop) return null;
            // Filter out empty parts or handle them

            return (
              <Message key={message.id} from={message.role ?? "assistant"}>
                <MessageContent className="w-full gap-3 bg-transparent p-0 shadow-none border-none group-[.is-user]:bg-transparent group-[.is-user]:text-foreground">

                  {!hasFallbackQuestion && !messageHasSop && (
                    <>
                      {parts.length > 0 && parts.map((part, index) => {
                        if (part.type === 'step-start' || part.type === 'step-finish' || part.type === 'agent') return null;
                        const step = mapPartToStep(part, message.role);
                        if (!step.stream && Object.keys(step.meta ?? {}).length === 0 && !step.result && step.status === 'completed') {
                          return null;
                        }
                        return (
                          <StepCard
                            key={part.id ?? `${message.id}-${index}`}
                            step={step}
                          />
                        );
                      })}

                      {message.role === "assistant" && message.id === lastVisibleMessageId && (() => {
                        // Check if we should show the thinking/working indicator
                        if (parts.length === 0) return <ThinkingMessage />;

                        // If parts exist, check if the turn seems active
                        const lastPart = parts[parts.length - 1];
                        const lastStepStatus = (lastPart as any).state?.status;

                        // Heuristic: Show if last part is reasoning, tool, or explicitly in progress
                        // Text usually marks the end unless it's explicitly streaming (which we can't easily detect without status)
                        // But often text parts don't have status 'inProgress' on them in some backends.
                        // We'll trust that 'tool' and 'reasoning' imply more to come, or if status is explicitly 'running'/'pending'.
                        const isWorking =
                          lastPart.type === 'reasoning' ||
                          lastPart.type === 'tool' ||
                          lastStepStatus === 'running' ||
                          lastStepStatus === 'pending' ||
                          lastStepStatus === 'inProgress';

                        return isWorking ? <ThinkingMessage /> : null;
                      })()}
                    </>
                  )}

                  {messageHasSop && sopContent && isLatestSop && (
                    <div className="mt-4 group/sop max-w-xl w-full mr-auto">
                      <button
                        type="button"
                        onClick={() => setSopOpen(true)}
                        className="w-full text-left relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-0 transition-all duration-300 hover:shadow-md hover:border-primary/20 group-hover/sop:translate-y-[-2px]"
                      >


                        <div className="flex items-stretch">
                          <div className="w-1 bg-gradient-to-b from-primary/80 to-purple-500/80" />
                          <div className="flex-1 p-3.5 flex items-center gap-3">
                            <div className="h-8 w-8 shrink-0 rounded-md bg-primary/10 ring-1 ring-primary/20 flex items-center justify-center shadow-sm group-hover/sop:bg-primary/20 transition-colors">
                              <Sparkles className="h-4 w-4 text-primary" />
                            </div>

                            <div className="flex-1 min-w-0 space-y-0.5">
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-semibold text-xs text-foreground tracking-tight">SOP 标准作业程序</h3>
                                <span className="px-1 py-[1px] rounded-[3px] text-[8px] font-bold bg-primary/10 text-primary uppercase tracking-wider border border-primary/20">
                                  生成的文档
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground line-clamp-1 pr-2">
                                点击展开查看完整的操作流程与执行标准
                              </p>
                            </div>

                            <div className="h-6 w-6 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground group-hover/sop:text-foreground group-hover/sop:border-primary/30 transition-all">
                              <ChevronRight className="h-3 w-3" />
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  {anchoredQuestions.map((request) => (
                    <div key={request.id} className="mt-4">
                      <QuestionInlineCard
                        request={request}
                        onSubmit={(answers) => answerQuestion(request.id, answers)}
                      />
                    </div>
                  ))}

                  {fallbackQuestions.map((request) => (
                    <div key={request.id} className="mt-4">
                      <QuestionInlineCard
                        request={request}
                        onSubmit={async (answers) => {
                          if (!sessionId) return;
                          const text = answers
                            .map((group) => group.join(", "))
                            .filter(Boolean)
                            .join("\n")
                            .trim();
                          if (!text) return;
                          const ok = await sendPrompt(sessionId, text);
                          if (ok) {
                            hiddenSelectionsRef.current.add(`${sessionId}::${text}`);
                          }
                          return ok;
                        }}
                      />
                    </div>
                  ))}
                </MessageContent>
              </Message>
            );
          })
        )}

        {questionBuckets.unanchored.length > 0 && (
          <div className="space-y-6">
            {questionBuckets.unanchored.map((request) => (
              <QuestionInlineCard
                key={request.id}
                request={request}
                onSubmit={(answers) => answerQuestion(request.id, answers)}
              />
            ))}
          </div>
        )}
        <div className="h-48 w-full shrink-0" />
      </ConversationContent>
      <ConversationScrollButton />
      {latestSop && (
        <SopDrawer
          open={sopOpen}
          onOpenChange={setSopOpen}
          content={latestSop.content}
        />
      )}
    </Conversation>
  );
}
