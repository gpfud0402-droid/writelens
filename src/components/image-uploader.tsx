import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Upload, Camera, X } from "lucide-react";

interface ImageUploaderProps {
  image: string | null;
  onImageChange: (image: string | null) => void;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function ImageUploader({ image, onImageChange }: ImageUploaderProps) {
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      if (!file.type.startsWith("image/")) {
        alert("Please upload an image file.");
        return;
      }
      const base64 = await fileToBase64(file);
      onImageChange(base64);
    },
    [onImageChange]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  if (image) {
    return (
      <Card className="relative overflow-hidden p-2">
        <img
          src={image}
          alt="Uploaded handwriting"
          className="max-h-64 w-full rounded-md object-contain"
        />
        <Button
          variant="destructive"
          size="icon"
          className="absolute right-3 top-3"
          onClick={() => onImageChange(null)}
        >
          <X className="h-4 w-4" />
        </Button>
      </Card>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
        dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      }`}
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
        <Upload className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="mb-2 text-sm font-medium">
        Drag and drop a handwriting photo, or click to upload
      </p>
      <p className="mb-4 text-xs text-muted-foreground">
        JPG, PNG, WEBP up to 20MB
      </p>
      <div className="flex justify-center gap-2">
        <label htmlFor="image-upload">
          <Button variant="outline" asChild>
            <span>
              <Upload className="mr-2 h-4 w-4" />
              Upload photo
            </span>
          </Button>
        </label>
        <label htmlFor="camera-capture">
          <Button variant="outline" asChild>
            <span>
              <Camera className="mr-2 h-4 w-4" />
              Take photo
            </span>
          </Button>
        </label>
      </div>
      <Input
        id="image-upload"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onChange}
      />
      <Input
        id="camera-capture"
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onChange}
      />
    </div>
  );
}
