import React, { useMemo } from "react";
import { useGlobalSync } from "../contexts/GlobalSync";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MessageSquare, SquarePen, MessageCircle } from "lucide-react";

export default function SessionSidebar() {
  const { state, setActiveSession, createSession } = useGlobalSync();

  const sessions = useMemo(() => {
    return [...state.session]
      .sort((a, b) => {
        const aTime = a.time?.created ?? 0;
        const bTime = b.time?.created ?? 0;
        return bTime - aTime;
      });
  }, [state.session]);

  // Group sessions by date
  const groupedSessions = useMemo(() => {
    const groups: { label: string; sessions: typeof sessions }[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 7);

    const groupMap = {
      Today: [] as typeof sessions,
      Yesterday: [] as typeof sessions,
      "Previous 7 Days": [] as typeof sessions,
      Older: [] as typeof sessions,
    };

    sessions.forEach((session) => {
      const date = new Date(session.time?.created ?? 0);
      if (date >= today) {
        groupMap.Today.push(session);
      } else if (date >= yesterday) {
        groupMap.Yesterday.push(session);
      } else if (date >= lastWeek) {
        groupMap["Previous 7 Days"].push(session);
      } else {
        groupMap.Older.push(session);
      }
    });

    if (groupMap.Today.length > 0) groups.push({ label: "Today", sessions: groupMap.Today });
    if (groupMap.Yesterday.length > 0)
      groups.push({ label: "Yesterday", sessions: groupMap.Yesterday });
    if (groupMap["Previous 7 Days"].length > 0)
      groups.push({ label: "Previous 7 Days", sessions: groupMap["Previous 7 Days"] });
    if (groupMap.Older.length > 0) groups.push({ label: "Older", sessions: groupMap.Older });

    return groups;
  }, [sessions]);

  return (
    <div className="flex h-full flex-col">
      {/* Header aligned with right side (h-14) */}
      <div className="flex h-14 items-center px-4 border-b border-sidebar-border/50 shrink-0">
        <span className="font-semibold text-lg tracking-tight text-foreground/90">WaLi</span>
      </div>

      <div className="flex-1 overflow-y-auto px-2 mt-2">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground gap-2">
            <MessageCircle className="h-8 w-8 opacity-20" />
            <p className="text-xs">No sessions found.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedSessions.map((group) => (
              <div key={group.label} className="space-y-0.5">
                <h3 className="px-2 text-[11px] font-medium text-muted-foreground/50 mb-1 uppercase tracking-wider">
                  {group.label}
                </h3>
                {group.sessions.map((session) => (
                  <button
                    key={session.id}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-all duration-200 group relative",
                      state.activeSessionId === session.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground"
                    )}
                    onClick={() => setActiveSession(session.id)}
                  >
                    <span className="truncate flex-1">
                      {session.title ?? `Session ${session.id.slice(0, 6)}`}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-sidebar-border/50 bg-sidebar/50 backdrop-blur-sm mt-auto">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => createSession()}
        >
          <SquarePen className="h-4 w-4" />
          <span className="text-sm">New Chat</span>
        </Button>
      </div>
    </div>
  );
}
