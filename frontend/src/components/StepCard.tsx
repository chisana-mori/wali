import { useEffect, useState } from 'react';
import {
    Check,
    FileDiff,
    Search,
    Terminal,
    X,
    MessageSquare,
    Lightbulb,
    Image as ImageIcon,
    Link2,
    Shield,
    ChevronDown,
    ChevronRight,
    Loader2,
    Cpu,
    Globe,
    Code2,
    Wrench
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import type { StepView } from '../types/ir';
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

import 'highlight.js/styles/github-dark.css';

interface StepCardProps {
    step: StepView;
    onApprove?: (id: string) => void;
    onDecline?: (id: string) => void;
    onSelectOption?: (approvalId: string, optionId: string) => void;
}

function formatKind(kind: StepView['kind']): string {
    switch (kind) {
        case 'assistantMessage': return 'AI 助手';
        case 'userMessage': return 'User';
        case 'reasoning': return '思考过程';
        case 'commandExecution': return '执行命令';
        case 'fileChange': return '文件变更';
        case 'mcpToolCall': return '工具调用';
        case 'collabToolCall': return '协作调用';
        case 'webSearch': return '网络搜索';
        case 'imageView': return '查看图片';
        case 'reviewMode': return '代码审查';
        case 'compacted': return '历史记录';
        case 'systemNote': return '系统通知';
        default: return 'System';
    }
}

function StatusBadge({ status }: { status: StepView['status'] }) {
    if (status === 'completed' || status === 'inProgress') return null;

    const styles: Record<string, string> = {
        pending: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800',
        failed: 'bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10',
        declined: 'bg-red-100 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800',
    };

    return (
        <Badge variant="default" className={cn("text-[10px] font-bold uppercase tracking-wider h-5 bg-background shadow-none border", styles[status])}>
            {status}
        </Badge>
    );
}

function KindIcon({ kind, className }: { kind: StepView['kind'], className?: string }) {
    const cls = cn("h-4 w-4", className);
    switch (kind) {
        case 'assistantMessage': return <MessageSquare className={cls} />;
        case 'userMessage': return <MessageSquare className={cls} />;
        case 'reasoning': return <Cpu className={cls} />;
        case 'commandExecution': return <Terminal className={cls} />;
        case 'fileChange': return <FileDiff className={cls} />;
        case 'mcpToolCall':
        case 'collabToolCall': return <Wrench className={cls} />;
        case 'webSearch': return <Globe className={cls} />;
        case 'imageView': return <ImageIcon className={cls} />;
        case 'reviewMode': return <Code2 className={cls} />;
        case 'systemNote': return <Shield className={cls} />;
        default: return <MessageSquare className={cls} />;
    }
}

function splitQuestionLine(line: string): string {
    const letterCount = (line.match(/(?:^|[\s\u3000])([A-D])(?=[\.\、\s\u3000])/g) ?? []).length;
    const numberCount = (line.match(/(?:^|[\s\u3000])([1-9])(?=[\.\、\s\u3000])/g) ?? []).length;

    if (letterCount >= 3) {
        return line
            .split(/(?=(?:^|[\s\u3000])[A-D](?=[\.\、\s\u3000]))/)
            .map((part) => part.trim())
            .filter(Boolean)
            .join('\n');
    }

    if (numberCount >= 3) {
        return line
            .split(/(?=(?:^|[\s\u3000])[1-9](?=[\.\、\s\u3000]))/)
            .map((part) => part.trim())
            .filter(Boolean)
            .join('\n');
    }

    return line;
}

function normalizeQuestionStream(text: string): string {
    if (!text) return text;

    if (!text.includes('\n')) {
        return splitQuestionLine(text);
    }

    return text
        .split('\n')
        .map((line) => splitQuestionLine(line))
        .join('\n');
}

// ... imports

// ... helper functions

export function StepCard({ step, onApprove, onDecline, onSelectOption }: StepCardProps) {
    const meta = step.meta ?? {};
    const result = step.result ?? {};
    const stream = step.stream;
    const changes = result.changes ?? meta.changes ?? [];

    const isReasoning = step.kind === 'reasoning';
    const isCompacted = step.kind === 'compacted';
    const isUser = step.kind === 'userMessage';
    const isAssistant = step.kind === 'assistantMessage';
    const isTools = !isUser && !isAssistant && !isReasoning && !isCompacted && step.kind !== 'systemNote';

    const collapsedPreview = typeof stream === 'string' ? stream.split('\n').filter(Boolean)[0] : '';
    const displayStream = isAssistant && typeof stream === 'string'
        ? normalizeQuestionStream(stream)
        : stream;

    const [isCollapsed, setIsCollapsed] = useState(() => {
        if (isReasoning && step.status === 'completed') return true;
        if (isCompacted) return true;
        return false;
    });

    useEffect(() => {
        if (isReasoning && step.status === 'completed') {
            setIsCollapsed(true);
        }
    }, [step.status, isReasoning]);

    const toggleCollapse = () => setIsCollapsed(!isCollapsed);

    // Render User Message (Bubble)
    if (isUser) {
        return (
            <div className="flex justify-end mb-2.5 w-full">
                <div className="bg-primary text-primary-foreground px-3.5 py-2 rounded-xl rounded-tr-sm max-w-[90%] shadow-sm text-[13px]">
                    {(meta.text || meta.content) ? (
                        <div className="whitespace-pre-wrap leading-normal">
                            {meta.text ? meta.text : JSON.stringify(meta.content, null, 2)}
                        </div>
                    ) : null}
                </div>
            </div>
        );
    }

    // Render Assistant Message (Markdown Text)
    if (isAssistant && displayStream) {
        return (
            <div className="mb-2 w-full text-foreground/90 leading-relaxed">
                <div className="ir-markdown">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm, remarkMath]}
                        rehypePlugins={[rehypeHighlight, rehypeKatex]}
                        components={{
                            p: ({ node, ...props }) => <p className="mb-1.5 last:mb-0" {...(props as any)} />,
                            a: ({ node, ...props }) => <a className="text-primary underline underline-offset-4 hover:text-primary/80" {...(props as any)} />,
                        }}
                    >
                        {displayStream}
                    </ReactMarkdown>
                </div>
            </div>
        );
    }

    // Render Tools, Reasoning, System Notes
    return (
        <div className={cn(
            "group relative transition-all duration-300 mb-2 font-sans w-full"
        )}>
            {/* Header for Collapsible/Card Types */}
            <div
                className={cn(
                    "flex items-center justify-between mb-1 px-1 select-none",
                    (isReasoning || isCompacted) && "cursor-pointer hover:opacity-80 transition-opacity"
                )}
                onClick={(isReasoning || isCompacted) ? toggleCollapse : undefined}
            >
                <div className="flex items-center gap-2">
                    <div className={cn(
                        "flex items-center justify-center h-5 w-5 rounded-md shadow-sm border transaction-all duration-300",
                        isReasoning ? "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-500/20" :
                            step.kind === 'systemNote' ? "bg-red-500/10 text-red-600 border-red-200" :
                                "bg-background text-muted-foreground border-border"
                    )}>
                        {step.status === 'inProgress' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                            <KindIcon kind={step.kind} className="h-3 w-3" />
                        )}
                    </div>
                    <span className={cn(
                        "text-[11px] font-semibold tracking-wide uppercase flex items-center gap-1",
                        isReasoning ? "text-amber-600/90" : "text-muted-foreground"
                    )}>
                        {formatKind(step.kind)}
                        {(isReasoning || isCompacted) && (
                            <span className="text-muted-foreground/50 transition-transform duration-200">
                                {isCollapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </span>
                        )}
                    </span>
                </div>
                <StatusBadge status={step.status} />
            </div>

            {/* Collapsed State */}
            {isCollapsed && (isReasoning || isCompacted) ? (
                <div
                    onClick={toggleCollapse}
                    className="ml-0 px-2.5 py-1.5 bg-muted/30 border border-dashed border-border/50 rounded-md cursor-pointer hover:bg-muted/50 transition-colors text-[11px] text-muted-foreground flex items-center gap-2"
                >
                    <KindIcon kind={step.kind} className="h-2.5 w-2.5 opacity-50" />
                    <span className="truncate max-w-sm">
                        {isReasoning && collapsedPreview
                            ? collapsedPreview
                            : '点击展开查看详情...'}
                    </span>
                </div>
            ) : (
                /* Expanded / Standard Card State */
                <Card className={cn(
                    "overflow-hidden transition-all duration-300 shadow-sm border animate-in fade-in slide-in-from-top-1",
                    isReasoning ? "bg-amber-50/50 border-amber-200/50 dark:bg-amber-950/10 dark:border-amber-500/20" :
                        step.kind === 'systemNote' ? "bg-red-50/50 border-red-200/50 dark:bg-red-950/10" :
                            "bg-card border-border/60"
                )}>
                    <div className="p-3 text-[13px]">
                        {/* System Note */}
                        {step.kind === 'systemNote' && (
                            <div className="space-y-2">
                                <div className="text-destructive font-medium flex items-center gap-1.5 text-xs">
                                    <Shield className="h-3.5 w-3.5" />
                                    {meta.summary ?? '系统通知'}
                                </div>
                                {meta.details && (
                                    <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-2 text-[11px] font-mono text-red-800 dark:text-red-300 overflow-x-auto">
                                        {meta.details}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Command Execution */}
                        {step.kind === 'commandExecution' && meta.command && (
                            <div className="space-y-2">
                                <div className="rounded-md bg-[#0d0d0d] border border-border/20 shadow-inner overflow-hidden font-mono text-[11px] group/cmd">
                                    <div className="flex items-center justify-between px-2.5 py-1.5 bg-[#1a1a1a] border-b border-[#262626]">
                                        <div className="flex items-center gap-1.5 text-muted-foreground">
                                            <Terminal className="h-3 w-3" />
                                            <span className="opacity-70">Console</span>
                                        </div>
                                        {meta.cwd && <span className="text-[9px] text-zinc-500">{meta.cwd}</span>}
                                    </div>
                                    <div className="p-2.5 overflow-x-auto">
                                        <div className="flex gap-2">
                                            <span className="text-emerald-500 font-bold select-none">$</span>
                                            <span className="text-zinc-300">{meta.command}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Markdown Content (Stream or static) */}
                        {displayStream && step.kind !== 'systemNote' && (
                            <div className={cn(
                                "ir-markdown text-[13px] leading-relaxed",
                                step.kind === 'reasoning' ? "text-muted-foreground/90 font-mono" : "text-foreground"
                            )}>
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm, remarkMath]}
                                    rehypePlugins={[rehypeHighlight, rehypeKatex]}
                                >
                                    {displayStream}
                                </ReactMarkdown>
                            </div>
                        )}

                        {/* File Changes */}
                        {step.kind === 'fileChange' && Array.isArray(changes) && changes.length > 0 && (
                            <div className="grid gap-1.5">
                                {changes.map((change: any, idx: number) => (
                                    <div key={idx} className="flex items-center justify-between bg-muted/30 p-2 rounded-md border border-border/40 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <div className={cn(
                                                "p-1 rounded-md shrink-0",
                                                change.kind === 'add' ? 'bg-emerald-500/10 text-emerald-600' :
                                                    change.kind === 'delete' ? 'bg-red-500/10 text-red-600' :
                                                        'bg-blue-500/10 text-blue-600'
                                            )}>
                                                {change.kind === 'add' ? <Check className="h-3 w-3" /> :
                                                    change.kind === 'delete' ? <X className="h-3 w-3" /> :
                                                        <FileDiff className="h-3 w-3" />}
                                            </div>
                                            <span className="font-mono text-[11px] text-foreground/80 truncate px-1 py-0 bg-background rounded border">{change.path}</span>
                                        </div>
                                        <Badge variant="default" className={cn(
                                            "uppercase text-[9px] h-4 px-1 border-0 shadow-none",
                                            change.kind === 'add' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' :
                                                change.kind === 'delete' ? 'bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400' :
                                                    'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'
                                        )}>
                                            {change.kind}
                                        </Badge>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* MCP Tool Call Metadata */}
                        {step.kind === 'mcpToolCall' && (
                            <div className="flex items-center gap-2.5 text-[11px] text-muted-foreground bg-muted/20 p-2 rounded-md border border-border/30">
                                <div className="h-6 w-6 rounded-full bg-background border flex items-center justify-center shadow-sm">
                                    <Wrench className="h-3.5 w-3.5 text-primary/70" />
                                </div>
                                <div className="flex flex-col gap-0">
                                    <span className="font-medium text-foreground text-xs">Function Call</span>
                                    <div className="flex items-center gap-1">
                                        <code className="bg-muted px-1 rounded text-[10px]">{meta.tool}</code>
                                        <span className="text-[9px]">on</span>
                                        <code className="bg-muted px-1 rounded text-[10px]">{meta.server}</code>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Results (Command Output, etc.) */}
                        {step.result && Object.keys(result).length > 0 && step.kind !== 'fileChange' && (
                            <div className="mt-2 pt-2 border-t border-border/40">
                                <details className="group/details" open={step.status === 'failed'}>
                                    <summary className="text-[10px] font-medium text-muted-foreground hover:text-foreground cursor-pointer flex items-center gap-1.5 select-none transition-colors">
                                        <div className="p-0.5 rounded bg-muted/50 group-hover/details:bg-muted transition-colors">
                                            {step.status === 'failed' ? <X className="h-2.5 w-2.5 text-red-500" /> : <Terminal className="h-2.5 w-2.5" />}
                                        </div>
                                        <span>Show Output</span>
                                        <ChevronDown className="h-2.5 w-2.5 ml-auto transition-transform group-open/details:rotate-180 opacity-50" />
                                    </summary>
                                    <div className="mt-1.5 rounded-md bg-zinc-950/95 border border-zinc-800 p-2 max-h-48 overflow-y-auto font-mono text-[10px] text-zinc-300 shadow-inner">
                                        <div className="whitespace-pre-wrap">
                                            {typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
                                        </div>
                                    </div>
                                </details>
                            </div>
                        )}

                        {/* Approval Inputs */}
                        {step.approval?.approvalId && step.status === 'pending' && step.approval.options?.length && onSelectOption && (
                            <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-dashed border-border/60">
                                {step.approval.options.map((option) => {
                                    const isReject = option.kind?.startsWith('reject');
                                    const isAllow = option.kind?.startsWith('allow');
                                    return (
                                        <Button
                                            key={option.optionId}
                                            size="sm"
                                            variant={isAllow ? 'default' : isReject ? 'destructive' : 'outline'}
                                            className="h-7 text-[11px] shadow-sm px-2.5"
                                            onClick={() => onSelectOption(step.approval!.approvalId, option.optionId)}
                                        >
                                            {option.label ?? option.optionId}
                                        </Button>
                                    );
                                })}
                            </div>
                        )}

                        {step.approval?.approvalId && step.status === 'pending' && !step.approval.options?.length && onApprove && onDecline && (
                            <div className="flex items-center gap-2 mt-3 pt-3 border-t border-dashed border-border/60">
                                <Button
                                    size="sm"
                                    className="h-7 text-[11px] bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1 px-3"
                                    onClick={() => onApprove(step.approval!.approvalId)}
                                >
                                    <Check className="h-3 w-3" /> 批准执行
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-[11px] border-destructive/20 text-destructive hover:bg-destructive/10 gap-1 px-3"
                                    onClick={() => onDecline(step.approval!.approvalId)}
                                >
                                    <X className="h-3 w-3" /> 拒绝并终止
                                </Button>
                            </div>
                        )}

                        {step.status === 'declined' && (
                            <div className="mt-2 bg-destructive/5 text-destructive border border-destructive/10 rounded-md p-1.5 flex items-center justify-center text-[11px] font-medium">
                                <Shield className="h-3 w-3 mr-1" /> 操作已被人为拒绝
                            </div>
                        )}
                    </div>
                </Card>
            )}
        </div>
    );
}
