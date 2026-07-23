import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Feedback } from "@/lib/feedback.functions";
import { ArrowRight } from "lucide-react";

interface RewritePanelProps {
  feedback: Feedback;
  originalText: string;
  onEvaluateRewrite: (text: string) => Promise<{
    feedback: {
      scores: {
        task_response: number;
        coherence: number;
        language: number;
        vocabulary: number;
        total_score: number;
      };
    };
  }>;
}

export function RewritePanel({
  feedback,
  originalText,
  onEvaluateRewrite,
}: RewritePanelProps) {
  const [text, setText] = useState(originalText);
  const [loading, setLoading] = useState(false);
  const [rewriteScore, setRewriteScore] = useState<{
    task_response: number;
    coherence: number;
    language: number;
    vocabulary: number;
    total_score: number;
  } | null>(null);

  const handleEvaluate = async () => {
    setLoading(true);
    try {
      const result = await onEvaluateRewrite(text);
      setRewriteScore(result.feedback.scores);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rewrite your essay</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="min-h-64 font-mono leading-relaxed"
            placeholder="Rewrite your essay here incorporating the feedback..."
          />
          <Button
            onClick={handleEvaluate}
            disabled={loading || !text.trim()}
            className="w-full"
          >
            <ArrowRight className="mr-2 h-4 w-4" />
            {loading ? "Evaluating rewrite..." : "Evaluate rewrite"}
          </Button>
        </CardContent>
      </Card>

      {rewriteScore && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rewrite score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total</span>
              <span className="text-2xl font-bold">
                {rewriteScore.total_score} / 20
              </span>
            </div>
            <ScoreRow label="Task response" score={rewriteScore.task_response} />
            <ScoreRow label="Coherence & cohesion" score={rewriteScore.coherence} />
            <ScoreRow label="Language use" score={rewriteScore.language} />
            <ScoreRow label="Vocabulary" score={rewriteScore.vocabulary} />
            <div className="flex items-center gap-2 pt-2">
              <Badge
                variant={
                  rewriteScore.total_score > feedback.scores.total_score
                    ? "default"
                    : "destructive"
                }
              >
                {rewriteScore.total_score > feedback.scores.total_score
                  ? "Improved"
                  : "Needs more work"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Previous: {feedback.scores.total_score} / 20
              </span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score} / 7.5</span>
      </div>
      <Progress value={(score / 7.5) * 100} className="h-2" />
    </div>
  );
}
