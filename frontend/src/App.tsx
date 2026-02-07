import React, { useEffect, useMemo, useRef } from "react";
import { StickToBottom } from "use-stick-to-bottom";
import { GlobalSyncProvider, useGlobalSync } from "./contexts/GlobalSync";
import ChatHeader from "./components/ChatHeader";
import MessageList from "./components/MessageList";
import MessageInput from "./components/MessageInput";
import SessionSidebar from "./components/SessionSidebar";
import PermissionOverlay from "./components/PermissionOverlay";
import StatusBanner from "./components/StatusBanner";
import { ToastAction } from "@/components/ui/toast";
import { Toaster } from "@/components/ui/toaster";
import { ToastProviderInternal, useToast } from "@/hooks/use-toast";

function Layout() {
  const { state, subscribe, setActiveSession } = useGlobalSync();
  const { toast, dismiss } = useToast();
  const toastBySession = useRef(new Map<string, string>());
  const alertedAtBySession = useRef(new Map<string, number>());

  const activeSessionId = state.activeSessionId;

  useEffect(() => {
    const cooldownMs = 5000;
    return subscribe((event: any) => {
      const detail = event?.details || event;
      const type = detail?.type || event?.type || event?.event;
      if (type !== "permission.asked" && type !== "question.asked") return;
      const properties = detail?.properties || event?.properties || detail?.payload || detail?.data || detail;
      const sessionID = properties?.sessionID;
      if (!sessionID) return;
      if (sessionID === activeSessionId) return;

      const directory = event?.name || event?.directory || ".";
      const session = state.session.find((s) => s.id === sessionID);
      const sessionTitle = session?.title ?? "New Session";
      const title = type === "permission.asked" ? "Permission required" : "Question received";
      const description =
        type === "permission.asked"
          ? `Approval needed for ${sessionTitle}`
          : `Agent asked a question in ${sessionTitle}`;

      const sessionKey = `${directory}:${sessionID}`;
      const now = Date.now();
      const lastAlerted = alertedAtBySession.current.get(sessionKey) ?? 0;
      if (now - lastAlerted < cooldownMs) return;
      alertedAtBySession.current.set(sessionKey, now);

      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body: description });
      }

      const existingToast = toastBySession.current.get(sessionKey);
      if (existingToast) dismiss(existingToast);

      const toastId = toast({
        title,
        description,
        action: (
          <ToastAction altText="Go to session" onClick={() => setActiveSession(sessionID)}>
            Go to session
          </ToastAction>
        ),
      });
      toastBySession.current.set(sessionKey, toastId);
    });
  }, [subscribe, activeSessionId, state.session, toast, dismiss, setActiveSession]);

  const layoutClasses = useMemo(
    () => "flex h-screen w-full overflow-hidden bg-background text-foreground",
    []
  );

  return (
    <div className={layoutClasses}>
      <aside className="hidden w-[280px] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        <SessionSidebar />
      </aside>

      <div className="relative flex flex-1 flex-col overflow-hidden bg-background/50">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-background/95 px-6 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-20">
          <ChatHeader />
        </header>

        <StickToBottom className="flex-1 overflow-y-auto p-4 md:p-6 pb-96" resize="smooth">
          <StatusBanner />
          <div className="mx-auto flex max-w-3xl flex-col gap-8">
            <PermissionOverlay />
            <MessageList />
          </div>
        </StickToBottom>

        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-background from-20% via-background/80 to-transparent p-4 pt-12">
          <div className="pointer-events-auto mx-auto max-w-3xl mb-4">
            <MessageInput />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <GlobalSyncProvider>
      <ToastProviderInternal>
        <Layout />
        <Toaster />
      </ToastProviderInternal>
    </GlobalSyncProvider>
  );
}
