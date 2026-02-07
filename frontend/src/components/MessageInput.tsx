import React, { useState } from "react";
import type { ChatStatus } from "ai";
import { useGlobalSync } from "../contexts/GlobalSync";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputProvider,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
  usePromptInputController,
} from "@/components/ai-elements/prompt-input";

import { Package, Server, HardDrive, Database, Network, Terminal, Loader } from "lucide-react";
import { cn } from "@/lib/utils";

// ... existing imports
function PromptForm() {
  const { state, createSession, sendPrompt } = useGlobalSync();
  const controller = usePromptInputController();
  const [status, setStatus] = useState<ChatStatus | undefined>(undefined);
  const canSubmit = controller.textInput.value.trim().length > 0;

  const sessionId = state.activeSessionId;
  const isResponding = status === "submitted";
  const messageList = sessionId ? (state.message[sessionId] || []) : [];
  // Check for user interactions, IGNORING HIDDEN/INTERNAL messages.
  // We must ensure that we don't count system injections (like [search-mode] triggers) as real user activity.
  const hasUserMessages = messageList.some(m => {
    if (m.role !== 'user') return false;

    // Check if this user message is actually a hidden internal instruction
    const parts = state.part[m.id] || [];
    const isInternal = parts.some(p =>
      typeof p.text === 'string' && (
        p.text.includes("[search-mode]") ||
        p.text.includes("<EXTREMELY_IMPORTANT>") ||
        p.text.startsWith("IMPORTANT: The using-superpowers skill")
      )
    );

    return !isInternal; // It IS a user message if it's NOT internal
  });

  // Only show if no session (fresh state) or no REAL visible user messages
  const showStarterChips = (!sessionId || !hasUserMessages) && !isResponding;

  // console.log("Debug Chips:", { sessionId, msgCount: messageList.length, hasRealMessages, showStarterChips });

  const handleChipClick = async (domainLabel: string) => {
    const text = `使用头脑风暴技能，在当前${domainLabel}领域下，引导专家进行领域专家知识挖掘，通过以点到面的方式，最终输出一个操作性和质量极高的文档。`;
    setStatus("submitted");
    try {
      const sid = state.activeSessionId ?? (await createSession());
      if (sid) {
        await sendPrompt(sid, text);
      }
    } catch (error) {
      console.error("Failed to send prompt:", error);
    } finally {
      setStatus(undefined);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {showStarterChips && (
        <div className="animate-in slide-in-from-bottom-5 fade-in duration-500 px-1 pointer-events-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="h-1 w-1 rounded-full bg-primary/70" />
            <span className="text-[11px] font-medium text-muted-foreground/80 tracking-wide uppercase">
              选择一个领域进行专家SOP生成吧
            </span>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { id: 'container', label: '容器', icon: Package },
              { id: 'kvm', label: 'KVM', icon: Server },
              { id: 'storage', label: '存储', icon: HardDrive },
              { id: 'database', label: '数据库', icon: Database },
              { id: 'network', label: '网络', icon: Network },
              { id: 'ops', label: '应用运维', icon: Terminal },
            ].map((domain) => (
              <button
                key={domain.id}
                onClick={() => handleChipClick(domain.label)}
                disabled={isResponding}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 p-3 rounded-xl transition-all duration-300 group cursor-pointer",
                  "bg-background/50 border border-border/40 shadow-sm",
                  "hover:bg-primary/5 hover:border-primary/20 hover:scale-[1.02] hover:shadow-md",
                  "active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
                )}
              >
                <div className="p-1.5 rounded-lg bg-muted/50 group-hover:bg-background transition-colors">
                  <domain.icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {domain.label}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <PromptInput
        className="rounded-3xl border border-input shadow-sm bg-background p-1 transition-all focus-within:ring-1 focus-within:ring-ring/50 [&_[data-slot=input-group]]:!border-none [&_[data-slot=input-group]]:!shadow-none [&_[data-slot=input-group]]:!bg-transparent [&_[data-slot=input-group]]:!ring-0 [&_textarea]:min-h-[44px]"
        onSubmit={async (message, event) => {
          event.preventDefault();
          const text = message.text.trim();
          if (!text) return;

          // Clear immediately for better UX
          controller.textInput.clear();
          setStatus("submitted");

          try {
            const sessionId = state.activeSessionId ?? (await createSession());
            if (sessionId) {
              await sendPrompt(sessionId, text);
            }
          } catch (error) {
            console.error("Failed to send prompt:", error);
            // Optional: Restore text if sending failed?
            // For now, simpler to just log it.
          } finally {
            setStatus(undefined);
          }
        }}
      >
        <PromptInputBody>
          <PromptInputTextarea
            placeholder="Ask anything..."
            className="min-h-[44px] py-3 text-base shadow-none resize-none"
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputTools>
            <span className="text-[11px] text-muted-foreground">
              Press Enter to send, Shift+Enter for newline
            </span>
          </PromptInputTools>
          <PromptInputSubmit status={status} disabled={!canSubmit} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}

export default function MessageInput() {
  return (
    <PromptInputProvider>
      <PromptForm />
    </PromptInputProvider>
  );
}
