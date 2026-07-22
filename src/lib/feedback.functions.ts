import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output, NoObjectGeneratedError } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

// Lenient schemas: no min/max/length bounds — the model may drift slightly
// and strict bounds cause post-hoc validation failures. We clamp in code.
const ScoreSchema = z.object({
  task_response: z.number(),
  coherence: z.number(),
  language: z.number(),
  vocabulary: z.number(),
  total_score: z.number(),
});

const CorrectionSchema = z.object({
  original: z.string(),
  corrected: z.string(),
  explanation: z.string(),
});

const RewriteQuestionSchema = z.object({
  question: z.string(),
  hint: z.string(),
  focus: z.string(),
});

export const FeedbackSchema = z.object({
  scores: ScoreSchema,
  reasons: z.string(),
  corrections: z.array(CorrectionSchema),
  weaknesses: z.array(z.string()),
  rewrite_questions: z.array(RewriteQuestionSchema),
});

export type Feedback = z.infer<typeof FeedbackSchema>;

function clamp(n: number, min = 0, max = 5) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function normalizeFeedback(raw: unknown): Feedback {
  const r = (raw ?? {}) as Record<string, unknown>;
  const s = (r.scores ?? {}) as Record<string, unknown>;
  return FeedbackSchema.parse({
    scores: {
      task_response: clamp(Number(s.task_response)),
      coherence: clamp(Number(s.coherence)),
      language: clamp(Number(s.language)),
      vocabulary: clamp(Number(s.vocabulary)),
      total_score: clamp(Number(s.total_score)),
    },
    reasons: typeof r.reasons === "string" ? r.reasons : "",
    corrections: Array.isArray(r.corrections) ? r.corrections : [],
    weaknesses: Array.isArray(r.weaknesses) ? r.weaknesses : [],
    rewrite_questions: Array.isArray(r.rewrite_questions) ? r.rewrite_questions : [],
  });
}

const EvaluateInput = z.object({
  text: z.string().min(1),
  taskType: z.enum(["independent", "academic_discussion"]),
  prompt: z.string().optional(),
});

const INDEPENDENT_RUBRIC = `
TOEFL Independent Writing Rubric (0-5 per category):
1. Task Response: Does the essay address the topic? Is there a clear opinion and supporting reasons/examples?
2. Coherence & Cohesion: Is the essay well-organized with clear transitions and logical paragraphing?
3. Language Use: Grammar accuracy, sentence variety, and mechanics.
4. Vocabulary: Word choice range, precision, and collocations.
`;

const ACADEMIC_DISCUSSION_RUBRIC = `
TOEFL Academic Discussion Writing Rubric (0-5 per category):
1. Task Response: Does the response contribute to the discussion, build on the professor's question and other students' ideas?
2. Coherence & Cohesion: Is the response clear, concise, and connected?
3. Language Use: Grammar accuracy and sentence variety.
4. Vocabulary: Appropriate academic word choice.
`;

export const evaluateAnswer = createServerFn({ method: "POST" })
  .validator((input: unknown) => EvaluateInput.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) {
      throw new Error("Missing LOVABLE_API_KEY");
    }

    const gateway = createLovableAiGatewayProvider(apiKey);
    const rubric =
      data.taskType === "independent" ? INDEPENDENT_RUBRIC : ACADEMIC_DISCUSSION_RUBRIC;

    const prompt = `You are an expert TOEFL Writing tutor. Evaluate the following essay strictly based on the official TOEFL rubric below. Provide specific, actionable feedback. Write reasons in Korean, but keep original and corrected English examples in English.

${rubric}

Task Type: ${data.taskType}
${data.prompt ? `Prompt: ${data.prompt}` : ""}

Essay:
"""
${data.text}
"""

Return a JSON object with:
- scores: {task_response, coherence, language, vocabulary, total_score} — each a number between 0 and 5
- reasons: a short Korean summary of the biggest strengths and weaknesses
- corrections: an array of 2-5 specific English grammar/usage corrections with explanations in Korean
- weaknesses: an array of 2-3 key improvement areas in Korean
- rewrite_questions: an array of 1-2 targeted rewrite exercises with Korean hints
`;

    console.log("[evaluateAnswer] taskType:", data.taskType);
    console.log("[evaluateAnswer] essay length:", data.text.length);
    console.log("[evaluateAnswer] essay preview:", data.text.slice(0, 200));
    console.log("[evaluateAnswer] prompt contains essay:", prompt.includes(data.text));

    try {
      const { output } = await generateText({
        model: gateway("google/gemini-2.5-flash"),
        output: Output.object({
          schema: z.object({
            scores: ScoreSchema,
            reasons: z.string(),
            corrections: z.array(CorrectionSchema),
            weaknesses: z.array(z.string()),
            rewrite_questions: z.array(RewriteQuestionSchema),
          }),
        }),
        prompt,
      });

      return normalizeFeedback(output);
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        console.error("[evaluateAnswer] NoObjectGeneratedError");
        console.error("[evaluateAnswer] raw text:", error.text);
        console.error("[evaluateAnswer] cause:", error.cause);
        console.error("[evaluateAnswer] finishReason:", error.finishReason);
        // Try to salvage: parse raw text as JSON and normalize
        if (error.text) {
          try {
            const cleaned = error.text
              .replace(/^```(?:json)?\s*/i, "")
              .replace(/\s*```\s*$/i, "")
              .trim();
            const parsed = JSON.parse(cleaned);
            console.log("[evaluateAnswer] recovered from raw text");
            return normalizeFeedback(parsed);
          } catch (parseErr) {
            console.error("[evaluateAnswer] failed to parse raw text:", parseErr);
          }
        }
      } else {
        console.error("[evaluateAnswer] unexpected error:", error);
      }
      throw error;
    }
  });

const RewriteInput = z.object({
  originalText: z.string().min(1),
  rewrittenText: z.string().min(1),
  taskType: z.enum(["independent", "academic_discussion"]),
  prompt: z.string().optional(),
});

export const evaluateRewrite = createServerFn({ method: "POST" })
  .validator((input: unknown) => RewriteInput.parse(input))
  .handler(async ({ data }) => {
    const feedback = await evaluateAnswer({
      data: {
        text: data.rewrittenText,
        taskType: data.taskType,
        prompt: data.prompt,
      },
    });

    return {
      feedback,
      comparison: {
        original_length: data.originalText.length,
        rewritten_length: data.rewrittenText.length,
      },
    };
  });
