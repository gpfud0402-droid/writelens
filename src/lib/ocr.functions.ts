import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

export const OcrWordSchema = z.object({
  text: z.string(),
  confidence: z.number().min(0).max(1).optional(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
});

export const OcrResultSchema = z.object({
  text: z.string(),
  words: z.array(OcrWordSchema).optional(),
  mode: z.enum(["cloud", "npu"]),
  latency_ms: z.number().optional(),
  error: z.string().optional(),
});

export type OcrResult = z.infer<typeof OcrResultSchema>;

const RunOcrInput = z.object({
  imageBase64: z.string().min(1),
  mode: z.enum(["cloud", "npu"]).default("cloud"),
  npuEndpoint: z.string().url().optional(),
});

export const runOcr = createServerFn({ method: "POST" })
  .validator((input: unknown) => RunOcrInput.parse(input))
  .handler(async ({ data }) => {
    const start = performance.now();

    if (data.mode === "npu") {
      const endpoint = data.npuEndpoint || process.env.NPU_OCR_ENDPOINT;
      if (!endpoint) {
        throw new Error(
          "NPU OCR endpoint is not configured. Set NPU_OCR_ENDPOINT or pass npuEndpoint."
        );
      }
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: data.imageBase64 }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`NPU OCR failed: ${response.status} ${text}`);
      }
      const result = await response.json();
      return OcrResultSchema.parse({
        ...result,
        mode: "npu",
        latency_ms: Math.round(performance.now() - start),
      });
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    const gateway = createLovableAiGatewayProvider(apiKey);

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: data.imageBase64.startsWith("data:")
                ? data.imageBase64
                : `data:image/jpeg;base64,${data.imageBase64}`,
            },
            {
              type: "text",
              text: "Transcribe all handwritten English text in this image exactly as written. Output only the transcribed text, with no extra commentary. Preserve line breaks and paragraphs.",
            },
          ],
        },
      ],
    });

    return OcrResultSchema.parse({
      text: text.trim(),
      mode: "cloud",
      latency_ms: Math.round(performance.now() - start),
    });
  });

const CompareOcrInput = z.object({
  imageBase64: z.string().min(1),
  npuEndpoint: z.string().url().optional(),
});

export const compareOcr = createServerFn({ method: "POST" })
  .validator((input: unknown) => CompareOcrInput.parse(input))
  .handler(async ({ data }) => {
    const [cloud, npu] = await Promise.all([
      runOcr({ data: { imageBase64: data.imageBase64, mode: "cloud" } }),
      runOcr({
        data: {
          imageBase64: data.imageBase64,
          mode: "npu",
          npuEndpoint: data.npuEndpoint,
        },
      }).catch((error) => {
        return OcrResultSchema.parse({
          text: "",
          mode: "npu",
          error: error instanceof Error ? error.message : String(error),
        });
      }),
    ]);
    return { cloud, npu };
  });
