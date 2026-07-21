import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { AuthButtons } from "@/components/auth-buttons";
import { TaskSelector, TaskType, TASK_PROMPTS } from "@/components/task-selector";
import { ImageUploader } from "@/components/image-uploader";
import { OcrCorrection } from "@/components/ocr-correction";
import { FeedbackPanel } from "@/components/feedback-panel";
import { RewritePanel } from "@/components/rewrite-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

import { runOcr, compareOcr } from "@/lib/ocr.functions";
import { evaluateAnswer, evaluateRewrite } from "@/lib/feedback.functions";
import { createSubmission } from "@/lib/submissions.functions";
import { Feedback } from "@/lib/feedback.functions";
import { OcrResult } from "@/lib/ocr.functions";
import { Sparkles, ScanLine, Wand2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      console.log("[Index] initial session", data.session?.user?.email ?? null);
      setUser(data.session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      console.log("[Index] auth event", event, newSession?.user?.email ?? null);
      setUser(newSession?.user ?? null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-5 w-5" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">WriteLens</h1>
          </div>
          <AuthButtons onSessionChange={(s) => setUser(s?.user ?? null)} />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        {authLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Progress value={0} className="w-48 animate-pulse" />
          </div>
        ) : user ? (
          <WriteLensApp />
        ) : (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="h-8 w-8" />
            </div>
            <h2 className="mt-6 text-2xl font-bold">WriteLens TOEFL Writing Coach</h2>
            <p className="mt-2 max-w-md text-muted-foreground">
              Upload your handwritten TOEFL essay, get it transcribed by NPU or cloud OCR, and
              receive rubric-based feedback from Gemini.
            </p>
            <div className="mt-8">
              <AuthButtons onSessionChange={(s) => setUser(s?.user ?? null)} />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function WriteLensApp() {
  const [taskType, setTaskType] = useState<TaskType>("independent");
  const [image, setImage] = useState<string | null>(null);
  const [ocrMode, setOcrMode] = useState<"cloud" | "npu" | "compare">("compare");
  const [npuEndpoint, setNpuEndpoint] = useState("http://localhost:8000/ocr");
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrResults, setOcrResults] = useState<{
    cloud?: OcrResult;
    npu?: OcrResult;
  } | null>(null);
  const [selectedOcr, setSelectedOcr] = useState<"cloud" | "npu">("cloud");
  const [correctedText, setCorrectedText] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("upload");

  const runOcrFn = useServerFn(runOcr);
  const compareOcrFn = useServerFn(compareOcr);
  const evaluateAnswerFn = useServerFn(evaluateAnswer);
  const evaluateRewriteFn = useServerFn(evaluateRewrite);
  const createSubmissionFn = useServerFn(createSubmission);

  const handleRunOcr = async () => {
    if (!image) return;
    setOcrLoading(true);
    try {
      let results: { cloud?: OcrResult; npu?: OcrResult } = {};
      if (ocrMode === "compare") {
        const data = await compareOcrFn({ data: { imageBase64: image, npuEndpoint } });
        results = data;
        setSelectedOcr(data.npu?.error ? "cloud" : "npu");
      } else {
        const data = await runOcrFn({ data: { imageBase64: image, mode: ocrMode, npuEndpoint } });
        results = { [ocrMode]: data };
        setSelectedOcr(ocrMode);
      }
      setOcrResults(results);
      setCorrectedText(results[selectedOcr]?.text || results.cloud?.text || results.npu?.text || "");
      setActiveTab("ocr");
    } catch (error) {
      console.error(error);
      alert("OCR failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setOcrLoading(false);
    }
  };

  const handleEvaluate = async () => {
    if (!correctedText.trim()) return;
    setFeedbackLoading(true);
    try {
      const submission = await createSubmissionFn({
        data: {
          task_type: taskType,
          image_url: image,
          original_text: correctedText,
        },
      });
      const result = await evaluateAnswerFn({
        data: {
          text: correctedText,
          taskType,
          prompt: TASK_PROMPTS[taskType],
        },
      });
      setFeedback(result);
      setActiveTab("feedback");
    } catch (error) {
      console.error(error);
      alert("Evaluation failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setFeedbackLoading(false);
    }
  };

  const handleEvaluateRewrite = async (text: string) => {
    return await evaluateRewriteFn({
      data: {
        originalText: correctedText,
        rewrittenText: text,
        taskType,
        prompt: TASK_PROMPTS[taskType],
      },
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">New submission</h2>
          <p className="text-sm text-muted-foreground">
            Choose a task type, upload your handwriting, and run OCR.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setImage(null);
            setOcrResults(null);
            setCorrectedText("");
            setFeedback(null);
            setActiveTab("upload");
          }}
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Start over
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 sm:w-auto">
          <TabsTrigger value="upload">1. Upload</TabsTrigger>
          <TabsTrigger value="ocr" disabled={!ocrResults}>
            2. OCR
          </TabsTrigger>
          <TabsTrigger value="feedback" disabled={!feedback}>
            3. Feedback
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Task type</CardTitle>
            </CardHeader>
            <CardContent>
              <TaskSelector value={taskType} onChange={setTaskType} />
              <div className="mt-4 rounded-md bg-muted p-4 text-sm text-muted-foreground">
                {TASK_PROMPTS[taskType]}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>OCR engine</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={ocrMode} onValueChange={(v) => setOcrMode(v as typeof ocrMode)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="cloud">Cloud only</TabsTrigger>
                  <TabsTrigger value="npu">NPU only</TabsTrigger>
                  <TabsTrigger value="compare">Compare both</TabsTrigger>
                </TabsList>
              </Tabs>
              {(ocrMode === "npu" || ocrMode === "compare") && (
                <div className="space-y-2">
                  <Label htmlFor="npu-endpoint">NPU OCR endpoint</Label>
                  <Input
                    id="npu-endpoint"
                    value={npuEndpoint}
                    onChange={(e) => setNpuEndpoint(e.target.value)}
                    placeholder="http://localhost:8000/ocr"
                  />
                  <p className="text-xs text-muted-foreground">
                    Run the local Renegade NPU FastAPI server and paste its URL here.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Upload handwriting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ImageUploader image={image} onImageChange={setImage} />
              <Button
                onClick={handleRunOcr}
                disabled={!image || ocrLoading}
                className="w-full"
              >
                <ScanLine className="mr-2 h-4 w-4" />
                {ocrLoading ? "Running OCR..." : "Run OCR"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ocr" className="space-y-6">
          {ocrResults && ocrMode === "compare" && (
            <Card>
              <CardHeader>
                <CardTitle>Compare OCR results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <ResultCard
                    label="Cloud OCR"
                    result={ocrResults.cloud}
                    selected={selectedOcr === "cloud"}
                    onSelect={() => {
                      setSelectedOcr("cloud");
                      setCorrectedText(ocrResults.cloud?.text || "");
                    }}
                  />
                  <ResultCard
                    label="NPU OCR"
                    result={ocrResults.npu}
                    selected={selectedOcr === "npu"}
                    onSelect={() => {
                      setSelectedOcr("npu");
                      setCorrectedText(ocrResults.npu?.text || "");
                    }}
                  />
                </div>
                <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                  Select the more accurate transcription. If NPU is unavailable, Cloud will be
                  used automatically.
                </div>
              </CardContent>
            </Card>
          )}

          {image && (
            <OcrCorrection
              image={image}
              text={correctedText}
              source={selectedOcr}
              onTextChange={setCorrectedText}
              onSubmit={handleEvaluate}
              loading={feedbackLoading}
            />
          )}
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          {feedback && (
            <>
              <FeedbackPanel feedback={feedback} />
              <RewritePanel
                feedback={feedback}
                originalText={correctedText}
                onEvaluateRewrite={handleEvaluateRewrite}
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ResultCard({
  label,
  result,
  selected,
  onSelect,
}: {
  label: string;
  result?: OcrResult;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
      className={`cursor-pointer rounded-lg border p-4 transition-colors ${
        selected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50"
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium">{label}</span>
        <Badge variant={selected ? "default" : "outline"}>{selected ? "Selected" : "Select"}</Badge>
      </div>
      {result?.error ? (
        <p className="text-sm text-destructive">{result.error}</p>
      ) : (
        <>
          <p className="line-clamp-4 text-sm text-muted-foreground">
            {result?.text || "No text returned"}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {result?.latency_ms ? `${result.latency_ms}ms` : ""}
          </p>
        </>
      )}
    </div>
  );
}
