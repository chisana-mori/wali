import React, { useEffect, useMemo, useState } from "react";
import type { QuestionInfo, QuestionOption, QuestionRequest } from "../contexts/GlobalSync";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MessageCircleQuestion, Check, ChevronRight, HelpCircle, Loader2 } from "lucide-react";

export function QuestionInlineCard({
  request,
  onSubmit,
}: {
  request: QuestionRequest;
  onSubmit: (answers: string[][]) => void | boolean | Promise<void | boolean>;
}) {
  const parsedQuestions = useMemo(
    () => normalizeQuestions(request.questions || []),
    [request.questions]
  );

  // Initial answers state
  const [answers, setAnswers] = useState<string[][]>(
    parsedQuestions.map(() => [])
  );
  const [extraNotes, setExtraNotes] = useState<string[]>(
    parsedQuestions.map(() => "")
  );
  const [tab, setTab] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const questions = parsedQuestions;
  const single = questions.length === 1 && !normalizeMultiple(questions[0]?.multiple);
  const currentQuestion = questions[tab];

  const buildNextAnswers = (
    source: string[][],
    qIndex: number,
    value: string,
    multiple: boolean
  ) => {
    const next = source.map((a) => [...a]);
    const currentQAnswers = next[qIndex] || [];
    if (multiple) {
      if (currentQAnswers.includes(value)) {
        next[qIndex] = currentQAnswers.filter((v) => v !== value);
      } else {
        next[qIndex] = [...currentQAnswers, value];
      }
    } else {
      next[qIndex] = [value];
    }
    return next;
  };

  useEffect(() => {
    setAnswers(parsedQuestions.map(() => []));
    setExtraNotes(parsedQuestions.map(() => ""));
    setTab(0);
    setSubmitted(false);
  }, [request.id]);

  useEffect(() => {
    if (tab >= questions.length && questions.length > 0) {
      setTab(questions.length - 1);
    }
  }, [tab, questions.length]);

  const handleSelect = (qIndex: number, value: string, multiple: boolean) => {
    setAnswers((prev) => buildNextAnswers(prev, qIndex, value, multiple));
  };

  const buildSubmitAnswers = (baseAnswers: string[][], notes: string[]) => {
    return baseAnswers.map((items, index) => {
      const note = (notes[index] || "").trim();
      if (!note) return items;
      return [...items, `补充信息: ${note}`];
    });
  };

  const handleSubmit = async (overrideAnswers?: string[][], overrideNotes?: string[]) => {
    if (submitted) return;
    setIsSubmitting(true);
    try {
      const result = await onSubmit(
        buildSubmitAnswers(overrideAnswers ?? answers, overrideNotes ?? extraNotes)
      );
      if (result !== false) {
        setSubmitted(true);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = answers.every((a) => a.length > 0);
  const isMulti = normalizeMultiple(currentQuestion?.multiple);

  return (
    <Card className="overflow-hidden border border-primary/20 shadow-md bg-card/95 backdrop-blur-sm transition-all hover:shadow-lg duration-500 w-full max-w-2xl mr-auto ring-1 ring-primary/5">
      <CardHeader className="bg-gradient-to-br from-primary/5 via-primary/5 to-transparent pb-3 pt-3 px-3.5 border-b border-primary/10">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex items-center justify-center p-0.5 rounded-md bg-primary/10 ring-1 ring-primary/20 shadow-sm">
            <MessageCircleQuestion className="h-3 w-3 text-primary" />
          </div>
          <Badge variant="default" className="text-[9px] font-bold px-1 py-0 h-3.5 bg-primary/10 text-primary border-primary/20 shadow-none hover:bg-primary/20">
            需要确认
          </Badge>
        </div>
        <CardTitle className="text-[13px] font-bold tracking-tight text-foreground/90">
          请提供详细信息
        </CardTitle>
        <CardDescription className="text-[10px] text-muted-foreground/80 mt-0.5 leading-relaxed">
          为了更准确地完成任务，助手需要您确认以下关键信息。
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3 px-3.5 pb-3.5 pt-3.5">
        {!single && (
          <div className="flex flex-wrap gap-1 pb-2 border-b border-border/40">
            {questions.map((q, qIndex) => {
              const active = qIndex === tab;
              const answered = (answers[qIndex]?.length ?? 0) > 0;
              return (
                <button
                  key={qIndex}
                  className={cn(
                    "group relative flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all duration-300 border select-none",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20 border-primary"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted hover:text-foreground border-border/50 hover:border-border"
                  )}
                  onClick={() => setTab(qIndex)}
                >
                  <span className={cn(
                    "flex items-center justify-center h-3 w-3 rounded-full text-[8px] font-bold transition-colors",
                    active ? "bg-background/20 text-current" : "bg-muted-foreground/20 text-muted-foreground group-hover:bg-muted-foreground/30"
                  )}>
                    {qIndex + 1}
                  </span>
                  <span className="truncate max-w-[50px]">{q.header || `问题 ${qIndex + 1}`}</span>
                  {answered && <Check className={cn("h-2 w-2", active ? "text-primary-foreground/90" : "text-emerald-500")} />}
                </button>
              );
            })}
          </div>
        )}

        {currentQuestion && (
          <div className="animate-in fade-in slide-in-from-right-2 duration-300 ease-out">
            <div className="mb-2 space-y-0.5">
              <h3 className="text-[13px] font-semibold text-foreground leading-snug flex items-start gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                {currentQuestion.question}
              </h3>
              {currentQuestion.header && (
                <p className="text-[10px] text-muted-foreground pl-5">
                  {currentQuestion.header}
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5">
              {(currentQuestion.options || []).map((opt, optIndex) => {
                const isSelected = answers[tab]?.includes(opt.label);
                return (
                  <button
                    key={optIndex}
                    type="button"
                    className={cn(
                      "relative group flex flex-col items-start p-2 rounded-lg border text-left transition-all duration-200 outline-none",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20 z-10"
                        : "border-border/60 bg-card hover:bg-accent/50 hover:border-accent-foreground/20 hover:shadow-sm"
                    )}
                    disabled={submitted || isSubmitting}
                    onClick={() => {
                      const nextAnswers = buildNextAnswers(answers, tab, opt.label, isMulti);
                      setAnswers(nextAnswers);
                      if (!isMulti) {
                        const nextUnanswered = questions.findIndex(
                          (_, idx) => idx > tab && (nextAnswers[idx]?.length ?? 0) === 0
                        );
                        if (nextUnanswered !== -1) {
                          setTab(nextUnanswered);
                        } else {
                          const nextTab = tab + 1;
                          if (nextTab < questions.length) {
                            setTab(nextTab);
                          } else if (single) {
                            // When backend asks questions sequentially (e.g. "1/5"), auto-submit current answer.
                            void handleSubmit(nextAnswers, extraNotes);
                          }
                        }
                      }
                    }}
                  >
                    <div className="w-full flex justify-between items-start gap-2">
                      <div className="space-y-0 flex-1 min-w-0">
                        <span className={cn(
                          "block font-medium text-[12px] transition-colors whitespace-normal break-words",
                          isSelected ? "text-primary" : "text-foreground group-hover:text-foreground"
                        )}>
                          {opt.label}
                        </span>
                        {opt.description && (
                          <span className={cn(
                            "block text-[10px] leading-relaxed transition-colors whitespace-normal break-words mt-0.5",
                            isSelected ? "text-primary/70" : "text-muted-foreground group-hover:text-foreground/70"
                          )}>
                            {opt.description}
                          </span>
                        )}
                      </div>
                      <div className={cn(
                        "h-3.5 w-3.5 rounded-full border flex items-center justify-center shrink-0 transition-all mt-0.5",
                        isSelected
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-muted-foreground/30 bg-transparent group-hover:border-primary/50"
                      )}>
                        {isSelected && <Check className="h-2 w-2 stroke-[3]" />}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-2 space-y-1">
              <p className="text-[10px] text-muted-foreground">
                补充信息（可选）
              </p>
              <Textarea
                value={extraNotes[tab] || ""}
                disabled={submitted || isSubmitting}
                onChange={(event) => {
                  const value = event.target.value;
                  setExtraNotes((prev) => {
                    const next = [...prev];
                    next[tab] = value;
                    return next;
                  });
                }}
                placeholder="自定义输入"
                className="min-h-[64px] resize-y text-[11px] leading-relaxed"
              />
            </div>
          </div>
        )}

      </CardContent>

      <CardFooter className="flex justify-between items-center px-3.5 py-2.5 border-t border-border/40 bg-muted/20">
        <div className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
          {submitted ? (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse relative">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping"></span>
              </span>
              <span>已提交</span>
            </div>
          ) : (
            <>
              {isComplete ? (
                <div className="flex items-center gap-1 text-primary">
                  <Check className="h-2.5 w-2.5" /> <span>准备就绪</span>
                </div>
              ) : (
                <span className="opacity-70">请回答所有必选项</span>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!single && isMulti && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTab(tab + 1)}
              disabled={submitted || isSubmitting || (answers[tab]?.length ?? 0) === 0}
              className="text-muted-foreground hover:text-foreground text-[10px] h-6 px-2.5"
            >
              下一步 <ChevronRight className="ml-0.5 h-2 w-2" />
            </Button>
          )}

          <Button
            onClick={() => {
              void handleSubmit();
            }}
            disabled={submitted || !isComplete || isSubmitting}
            size="sm"
            className={cn(
              "px-3 font-medium shadow-md transition-all duration-300 text-[10px] h-6",
              !submitted && isComplete ? "hover:scale-105 hover:shadow-primary/20 bg-primary/90 hover:bg-primary" : ""
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1 h-3 w-3 animate-spin" /> 提交中...
              </>
            ) : submitted ? (
              "已保存"
            ) : (
              "确认提交"
            )}
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}

function normalizeQuestions(questions: QuestionInfo[]): QuestionInfo[] {
  return questions.map((question) => {
    const normalizedOptions = normalizeOptions(question.options);
    const normalizedMultiple = normalizeMultiple(question.multiple);
    if (normalizedOptions.length > 0) {
      return {
        ...question,
        multiple: normalizedMultiple,
        options: normalizedOptions,
      };
    }

    const parsed = parseOptionsFromQuestionText(question.question);
    if (parsed.options.length > 0) {
      return {
        ...question,
        multiple: normalizedMultiple,
        question: parsed.question || question.question,
        options: parsed.options,
      };
    }

    return {
      ...question,
      multiple: normalizedMultiple,
      options: [],
    };
  });
}

function normalizeMultiple(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return false;
    if (["true", "1", "yes", "y", "multi", "multiple"].includes(normalized)) return true;
    if (["false", "0", "no", "n", "single"].includes(normalized)) return false;
  }
  return false;
}

function normalizeOptions(rawOptions: unknown): QuestionOption[] {
  if (!Array.isArray(rawOptions)) return [];
  const options: QuestionOption[] = [];
  for (const rawOption of rawOptions) {
    if (typeof rawOption === "string") {
      const label = rawOption.trim();
      if (label) options.push({ label });
      continue;
    }

    if (!rawOption || typeof rawOption !== "object") continue;
    const optionRecord = rawOption as Record<string, unknown>;
    const labelCandidate =
      optionRecord.label ??
      optionRecord.title ??
      optionRecord.text ??
      optionRecord.value;
    const descriptionCandidate = optionRecord.description ?? optionRecord.desc ?? optionRecord.detail;

    const label = typeof labelCandidate === "string" ? labelCandidate.trim() : "";
    if (!label) continue;
    const description =
      typeof descriptionCandidate === "string" && descriptionCandidate.trim()
        ? descriptionCandidate.trim()
        : undefined;
    options.push({ label, description });
  }
  return options;
}

function parseOptionsFromQuestionText(questionText: string): { question: string; options: QuestionOption[] } {
  if (!questionText) return { question: questionText, options: [] };
  const lines = questionText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const optionPattern = /^([A-Fa-f]|\d{1,2})(?:[\.、:：\)]|\s)+(.*)$/;
  const options: QuestionOption[] = [];
  const questionLines: string[] = [];

  for (const line of lines) {
    const matched = line.match(optionPattern);
    if (!matched) {
      questionLines.push(line);
      continue;
    }
    const marker = matched[1];
    const body = matched[2]?.trim();
    if (!body) continue;
    const parts = body.split(/\s*[—–-]\s*/);
    const label = `${marker}. ${(parts[0] || "").trim()}`.trim();
    const description = parts.length > 1 ? parts.slice(1).join(" - ").trim() : undefined;
    if (!label || label === `${marker}.`) continue;
    options.push({ label, description });
  }

  const question = questionLines.length > 0 ? questionLines.join(" ") : questionText;
  return { question, options };
}
