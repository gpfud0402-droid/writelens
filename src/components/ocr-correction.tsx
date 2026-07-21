import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Pencil } from "lucide-react";

interface OcrCorrectionProps {
  image: string;
  text: string;
  source: "cloud" | "npu" | null;
  onTextChange: (text: string) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function OcrCorrection({
  image,
  text,
  source,
  onTextChange,
  onSubmit,
  loading,
}: OcrCorrectionProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Original image</CardTitle>
        </CardHeader>
        <CardContent>
          <img
            src={image}
            alt="Handwritten submission"
            className="max-h-96 w-full rounded-md border object-contain"
          />
        </CardContent>
      </Card>

      <Card className="flex flex-col">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Transcribed text</CardTitle>
            {source && (
              <Badge variant={source === "npu" ? "default" : "secondary"}>
                {source === "npu" ? "NPU OCR" : "Cloud OCR"}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Review the transcription and fix any mistakes before submitting.
          </p>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col gap-4">
          <Textarea
            value={text}
            onChange={(e) => onTextChange(e.target.value)}
            className="min-h-64 flex-1 font-mono leading-relaxed"
            placeholder="OCR text will appear here..."
          />
          <Button onClick={onSubmit} disabled={loading || !text.trim()} className="w-full">
            <Pencil className="mr-2 h-4 w-4" />
            {loading ? "Evaluating..." : "Evaluate essay"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
