import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollText, X, Download, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type SopDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  content: string;
};

export function SopDrawer({
  open,
  onOpenChange,
  title = "SOP 标准作业程序",
  description = "Standard Operating Procedure",
  content,
}: SopDrawerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SOP-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="fixed !left-auto !right-0 !top-0 !bottom-0 !translate-x-0 !translate-y-0 h-screen w-[800px] max-w-full rounded-none border-l shadow-2xl p-0 gap-0 bg-background/95 backdrop-blur-md data-[state=open]:!slide-in-from-right data-[state=closed]:!slide-out-to-right duration-300 sm:rounded-none">

        {/* Header */}
        <DialogHeader className="px-6 py-5 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between space-y-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20 shadow-sm">
              <ScrollText className="h-5 w-5" />
            </div>
            <div className="flex flex-col gap-0.5">
              <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground font-mono uppercase tracking-wider">
                {description}
              </DialogDescription>
            </div>
          </div>

          <div className="flex items-center gap-1.5 pl-4">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleCopy}
              title="复制 Markdown"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={handleDownload}
              title="下载文件"
            >
              <Download className="h-4 w-4" />
            </Button>
            <div className="mx-2 w-px h-4 bg-border" />
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive transition-colors">
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          <div className="mx-auto max-w-3xl">
            <div className="ir-markdown prose prose-zinc dark:prose-invert prose-headings:font-bold prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg prose-p:leading-7 prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50">
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeHighlight, rehypeKatex]}
                components={{
                  // Enhance specific elements if needed
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-primary/40 bg-primary/5 pl-4 py-1 rounded-r italic text-muted-foreground" {...(props as any)} />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>

            <div className="mt-12 pt-8 border-t border-dashed border-border/50 text-center">
              <p className="text-xs text-muted-foreground/50 font-mono">
                — End of Document —
              </p>
            </div>
          </div>
        </div>

        {/* Helper to hide default close button since we have a custom one in header */}
        <style>{`
          [data-state] > button.absolute.right-4.top-4 {
            display: none !important;
          }
        `}</style>
      </DialogContent>
    </Dialog>
  );
}
