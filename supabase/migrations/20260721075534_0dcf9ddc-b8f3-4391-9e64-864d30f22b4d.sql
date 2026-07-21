CREATE TABLE public.submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type text NOT NULL CHECK (task_type IN ('independent', 'academic_discussion')),
  image_url text,
  original_text text,
  corrected_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.submissions TO authenticated;
GRANT ALL ON public.submissions TO service_role;

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own submissions"
  ON public.submissions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL,
  scores jsonb NOT NULL,
  reasons text,
  corrections jsonb,
  weaknesses jsonb,
  rewrite_questions jsonb,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedbacks TO authenticated;
GRANT ALL ON public.feedbacks TO service_role;

ALTER TABLE public.feedbacks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own feedbacks"
  ON public.feedbacks
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
  ));

CREATE TABLE public.rewrites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE NOT NULL,
  feedback_id uuid REFERENCES public.feedbacks(id) ON DELETE CASCADE,
  rewritten_text text NOT NULL,
  scores jsonb,
  created_at timestamptz DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.rewrites TO authenticated;
GRANT ALL ON public.rewrites TO service_role;

ALTER TABLE public.rewrites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own rewrites"
  ON public.rewrites
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_submissions_updated_at
BEFORE UPDATE ON public.submissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();