import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateText, Output } from "ai";
import { createLovableAiGatewayProvider } from "./ai-gateway.server";

const ScoreSchema = z.object({
  task_response: z.number().min(0).max(5),
  coherence: z.number().min(0).max(5),
  language: z.number().min(0).max(5),
  vocabulary: z.number().min(0).max(5),
  total_score: z.number().min(0).max(5),
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
      prompt: `You are an expert TOEFL Writing tutor. Evaluate the following essay strictly based on the official TOEFL rubric below. Provide specific, actionable feedback. Write reasons in Korean, but keep original and corrected English examples in English.

${rubric}

Task Type: ${data.taskType}
${data.prompt ? `Prompt: ${data.prompt}` : ""}

Essay:
"""
${data.text}
"""

Return a JSON object with:
- scores: {task_response, coherence, language, vocabulary, total_score} (0-5)
- reasons: a short Korean summary of the biggest strengths and weaknesses
- corrections: an array of 2-5 specific English grammar/usage corrections with explanations in Korean
- weaknesses: an array of 2-3 key improvement areas in Korean
- rewrite_questions: an array of 1-2 targeted rewrite exercises with Korean hints
`,
    });

    return FeedbackSchema.parse(output);
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
