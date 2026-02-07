import React, { useMemo } from "react";
import { useGlobalSync } from "../contexts/GlobalSync";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { ConversationDownload } from "@/components/ai-elements/conversation";
import type { ConversationMessage } from "@/components/ai-elements/conversation";

export default function ChatHeader() {
  const { state } = useGlobalSync();
  const active = state.session.find((session) => session.id === state.activeSessionId);

  const exportMessages = useMemo<ConversationMessage[]>(() => {
    if (!state.activeSessionId) return [];
    const messages = state.message[state.activeSessionId] || [];
    return messages.map((message) => {
      const parts = state.part[message.id] || [];
      const text = parts
        .map((part) => (part.type === "text" ? part.text : part.output || part.tool || ""))
        .filter(Boolean)
        .join("\n");
      return {
        role: message.role ?? "assistant",
        content: text,
      };
    });
  }, [state.activeSessionId, state.message, state.part]);

  return (
    <div className="flex w-full items-center justify-between gap-4">
      <div className="min-w-0 flex flex-col gap-0.5">
        <h1 className="truncate text-sm font-semibold text-foreground tracking-tight">
          {active?.title ?? "OpenCode Web"}
        </h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className={cn("hidden h-1.5 w-1.5 rounded-full md:inline-block",
            state.status === "complete" ? "bg-emerald-500" :
              state.status === "loading" ? "bg-amber-500" : "bg-red-500"
          )} />
          <span>{active ? `Session ${active.id.slice(0, 8)}` : "Ready"}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
      </div>
    </div>
  );
}
