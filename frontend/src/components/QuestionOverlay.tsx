import React, { useState, useEffect } from "react";
import { useGlobalSync, QuestionRequest, QuestionInfo } from "../contexts/GlobalSync";
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
import { cn } from "@/lib/utils";

// Inline Icons to avoid dependency issues
const Icons = {
  MessageCircleQuestion: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </svg>
  ),
  Check: (props: React.SVGProps<SVGSVGElement>) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
};

export default function QuestionOverlay() {
  const { state, answerQuestion } = useGlobalSync();
  const { activeSessionId } = state;

  // Identify questions for the active session
  const questions = activeSessionId ? state.question[activeSessionId] : undefined;

  if (!questions || questions.length === 0) return null;

  return (
    <div className="space-y-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-300">
      {questions.map((request) => (
        <QuestionCard
          key={request.id}
          request={request}
          onSubmit={(answers) => answerQuestion(request.id, answers)}
        />
      ))}
    </div>
  );
}

function QuestionCard({
  request,
  onSubmit,
}: {
  request: QuestionRequest;
  onSubmit: (answers: string[][]) => void;
}) {
  // Initial answers state: array of string arrays matching questions length
  const [answers, setAnswers] = useState<string[][]>(
    request.questions.map(() => [])
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSelect = (qIndex: number, value: string, multiple: boolean) => {
    setAnswers(prev => {
      const next = [...prev];
      const currentQAnswers = next[qIndex] || [];
      if (multiple) {
        if (currentQAnswers.includes(value)) {
          next[qIndex] = currentQAnswers.filter(v => v !== value);
        } else {
          next[qIndex] = [...currentQAnswers, value];
        }
      } else {
        next[qIndex] = [value];
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit(answers);
    } finally {
      setIsSubmitting(false);
    }
  };

  const isComplete = answers.every(a => a.length > 0);

  return (
    <Card className="border-t-4 border-t-primary shadow-xl bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/75">
      <CardHeader>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="default" className="gap-1 animate-pulse">
            <Icons.MessageCircleQuestion className="h-3 w-3" />
            Input Required
          </Badge>
          <span className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Agent Request</span>
        </div>
        <CardTitle className="text-xl">
          Please provide the following information
        </CardTitle>
        <CardDescription>
          The agent needs these details to proceed with your request.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-8">
        {request.questions.map((q, qIndex) => (
          <div key={qIndex} className="space-y-4">
            <div className="space-y-1">
              <h3 className="font-semibold text-lg flex items-start gap-2">
                {q.question}
                {answers[qIndex]?.length > 0 && <Icons.Check className="h-5 w-5 text-green-500 mt-0.5" />}
              </h3>
              {q.header && <p className="text-sm text-muted-foreground">{q.header}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {q.options.map((opt, optIndex) => {
                const isSelected = answers[qIndex]?.includes(opt.label);
                return (
                  <Button
                    key={optIndex}
                    type="button"
                    variant={isSelected ? "default" : "outline"}
                    className={cn(
                      "h-auto py-3 px-4 justify-start items-start text-left transition-all duration-200",
                      isSelected ? "ring-2 ring-primary ring-offset-2" : "hover:bg-muted"
                    )}
                    onClick={() => handleSelect(qIndex, opt.label, q.multiple || false)}
                  >
                    <div className="flex flex-col gap-1 w-full">
                      <span className={cn("font-medium text-sm", isSelected ? "text-primary-foreground" : "text-foreground")}>
                        {opt.label}
                      </span>
                      {opt.description && (
                        <span className={cn("text-xs leading-relaxed", isSelected ? "text-primary-foreground/80" : "text-muted-foreground")}>
                          {opt.description}
                        </span>
                      )}
                    </div>
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </CardContent>
      <CardFooter className="flex justify-between items-center bg-muted/20 p-6 rounded-b-xl border-t">
        <p className="text-xs text-muted-foreground">
          {isComplete ? "Ready to submit" : "Please answer all questions"}
        </p>
        <Button
          onClick={handleSubmit}
          disabled={!isComplete || isSubmitting}
          size="lg"
          className="px-8 font-semibold shadow-md transition-all hover:scale-105"
        >
          {isSubmitting ? "Submitting..." : "Submit Answers"}
        </Button>
      </CardFooter>
    </Card>
  );
}
