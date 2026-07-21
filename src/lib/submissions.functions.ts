import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const SubmissionSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  task_type: z.enum(["independent", "academic_discussion"]),
  image_url: z.string().nullable().optional(),
  original_text: z.string().nullable().optional(),
  corrected_text: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type Submission = z.infer<typeof SubmissionSchema>;

const CreateSubmissionInput = z.object({
  task_type: z.enum(["independent", "academic_discussion"]),
  image_url: z.string().optional(),
  original_text: z.string().optional(),
});

export const createSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => CreateSubmissionInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("submissions")
      .insert({
        user_id: context.userId,
        task_type: data.task_type,
        image_url: data.image_url,
        original_text: data.original_text,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return SubmissionSchema.parse(row);
  });

const UpdateSubmissionTextInput = z.object({
  id: z.string().uuid(),
  corrected_text: z.string(),
});

export const updateSubmissionText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => UpdateSubmissionTextInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("submissions")
      .update({ corrected_text: data.corrected_text })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return SubmissionSchema.parse(row);
  });

export const listSubmissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("submissions")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return z.array(SubmissionSchema).parse(data || []);
  });

const SaveFeedbackInput = z.object({
  submission_id: z.string().uuid(),
  feedback: z.object({
    scores: z.object({
      task_response: z.number(),
      coherence: z.number(),
      language: z.number(),
      vocabulary: z.number(),
      total_score: z.number(),
    }),
    reasons: z.string(),
    corrections: z.array(
      z.object({
        original: z.string(),
        corrected: z.string(),
        explanation: z.string(),
      })
    ),
    weaknesses: z.array(z.string()),
    rewrite_questions: z.array(
      z.object({
        question: z.string(),
        hint: z.string(),
        focus: z.string(),
      })
    ),
  }),
});

export const saveFeedback = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SaveFeedbackInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("feedbacks")
      .insert({
        submission_id: data.submission_id,
        scores: data.feedback.scores,
        reasons: data.feedback.reasons,
        corrections: data.feedback.corrections,
        weaknesses: data.feedback.weaknesses,
        rewrite_questions: data.feedback.rewrite_questions,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });

const SaveRewriteInput = z.object({
  submission_id: z.string().uuid(),
  feedback_id: z.string().uuid(),
  rewritten_text: z.string(),
  scores: z.object({
    task_response: z.number(),
    coherence: z.number(),
    language: z.number(),
    vocabulary: z.number(),
    total_score: z.number(),
  }),
});

export const saveRewrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => SaveRewriteInput.parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("rewrites")
      .insert({
        submission_id: data.submission_id,
        feedback_id: data.feedback_id,
        rewritten_text: data.rewritten_text,
        scores: data.scores,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return row;
  });
