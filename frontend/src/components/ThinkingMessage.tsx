import { Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function ThinkingMessage() {
    return (
        <div className="flex items-center gap-2.5 py-1 px-3 rounded-xl bg-gradient-to-r from-sky-500/5 via-sky-500/10 to-sky-500/5 border border-sky-500/10 w-fit animate-in fade-in zoom-in-95 duration-500 mt-2">
            <div className="relative flex items-center justify-center h-4 w-4">
                <div className="absolute inset-0 bg-sky-500/20 rounded-full animate-ping opacity-20 duration-2000" />
                <div className="relative h-4 w-4 rounded-full bg-background/80 flex items-center justify-center shadow-sm ring-1 ring-sky-500/20">
                    <Sparkles className="h-2.5 w-2.5 text-sky-500 animate-[pulse_3s_ease-in-out_infinite]" />
                </div>
            </div>
            <div className="flex flex-col gap-0 justify-center">
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold text-sky-600 tracking-wide uppercase">AI 正在思考</span>
                    <div className="flex items-center gap-0.5">
                        <span className="h-0.5 w-0.5 rounded-full bg-sky-500 animate-[bounce_1s_infinite_-0.2s]" />
                        <span className="h-0.5 w-0.5 rounded-full bg-sky-500 animate-[bounce_1s_infinite_-0.1s]" />
                        <span className="h-0.5 w-0.5 rounded-full bg-sky-500 animate-[bounce_1s_infinite]" />
                    </div>
                </div>
            </div>
        </div>
    );
}
