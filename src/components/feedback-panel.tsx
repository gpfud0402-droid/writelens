import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Feedback } from "@/lib/feedback.functions";

interface FeedbackPanelProps {
  feedback: Feedback;
}

export function FeedbackPanel({ feedback }: FeedbackPanelProps) {
  const scores = feedback.scores;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rubric scores</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-2xl font-bold">{scores.total_score} / 20</span>
          </div>
          <ScoreRow label="Task response" score={scores.task_response} />
          <ScoreRow label="Coherence & cohesion" score={scores.coherence} />
          <ScoreRow label="Language use" score={scores.language} />
          <ScoreRow label="Vocabulary" score={scores.vocabulary} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Overall feedback</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
            {feedback.reasons}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Key weaknesses</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
            {feedback.weaknesses.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Targeted corrections</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion type="multiple" className="w-full">
            {feedback.corrections.map((c, i) => (
              <AccordionItem key={i} value={`correction-${i}`}>
                <AccordionTrigger className="text-sm hover:no-underline">
                  <Badge variant="outline" className="mr-2">
                    {i + 1}
                  </Badge>
                  {c.original.slice(0, 60)}
                  {c.original.length > 60 ? "..." : ""}
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    <span className="font-medium text-destructive">Original:</span>{" "}
                    {c.original}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium text-green-600">Correction:</span>{" "}
                    {c.corrected}
                  </p>
                  <p className="text-muted-foreground">
                    <span className="font-medium">Why:</span> {c.explanation}
                  </p>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rewrite training</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            Try rewriting these sentences or paragraphs to address the weakness.
          </p>
          <div className="space-y-3">
            {feedback.rewrite_questions.map((q, i) => (
              <div key={i} className="rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{q.focus}</Badge>
                </div>
                <p className="mt-1 text-sm font-medium">{q.question}</p>
                <p className="text-xs text-muted-foreground">{q.hint}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ScoreRow({ label, score }: { label: string; score: number }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score} / 5</span>
      </div>
      <Progress value={(score / 5) * 100} className="h-2" />
    </div>
  );
}
