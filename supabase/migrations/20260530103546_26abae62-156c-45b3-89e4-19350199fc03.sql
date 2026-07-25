
-- Phase 1: Product Q&A System

CREATE TABLE public.product_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 5 AND 2000),
  is_hidden boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  like_count integer NOT NULL DEFAULT 0,
  answer_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_questions_product ON public.product_questions(product_id, created_at DESC);
CREATE INDEX idx_product_questions_user ON public.product_questions(user_id);

GRANT SELECT ON public.product_questions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_questions TO authenticated;
GRANT ALL ON public.product_questions TO service_role;

ALTER TABLE public.product_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_questions_select_public" ON public.product_questions
  FOR SELECT USING (is_deleted = false AND is_hidden = false);
CREATE POLICY "qa_questions_select_own" ON public.product_questions
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_questions_insert" ON public.product_questions
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "qa_questions_update_own" ON public.product_questions
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_questions_delete" ON public.product_questions
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.product_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  question_id uuid NOT NULL REFERENCES public.product_questions(id) ON DELETE CASCADE,
  parent_answer_id uuid REFERENCES public.product_answers(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  author_name text NOT NULL,
  content text NOT NULL CHECK (char_length(content) BETWEEN 2 AND 2000),
  is_seller_reply boolean NOT NULL DEFAULT false,
  is_hidden boolean NOT NULL DEFAULT false,
  is_deleted boolean NOT NULL DEFAULT false,
  like_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_answers_question ON public.product_answers(question_id, created_at);
CREATE INDEX idx_product_answers_user ON public.product_answers(user_id);

GRANT SELECT ON public.product_answers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_answers TO authenticated;
GRANT ALL ON public.product_answers TO service_role;

ALTER TABLE public.product_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_answers_select_public" ON public.product_answers
  FOR SELECT USING (is_deleted = false AND is_hidden = false);
CREATE POLICY "qa_answers_select_own" ON public.product_answers
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_answers_insert" ON public.product_answers
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "qa_answers_update_own" ON public.product_answers
  FOR UPDATE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "qa_answers_delete" ON public.product_answers
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

CREATE TABLE public.product_qa_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('question','answer')),
  target_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id)
);
CREATE INDEX idx_qa_likes_target ON public.product_qa_likes(target_type, target_id);

GRANT SELECT ON public.product_qa_likes TO anon;
GRANT SELECT, INSERT, DELETE ON public.product_qa_likes TO authenticated;
GRANT ALL ON public.product_qa_likes TO service_role;

ALTER TABLE public.product_qa_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qa_likes_select" ON public.product_qa_likes FOR SELECT USING (true);
CREATE POLICY "qa_likes_insert" ON public.product_qa_likes
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "qa_likes_delete" ON public.product_qa_likes
  FOR DELETE TO authenticated USING (user_id = auth.uid());

-- Like count maintenance
CREATE OR REPLACE FUNCTION public.product_qa_likes_count_trg()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.target_type = 'question' THEN
      UPDATE public.product_questions SET like_count = like_count + 1 WHERE id = NEW.target_id;
    ELSE
      UPDATE public.product_answers SET like_count = like_count + 1 WHERE id = NEW.target_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.target_type = 'question' THEN
      UPDATE public.product_questions SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    ELSE
      UPDATE public.product_answers SET like_count = GREATEST(like_count - 1, 0) WHERE id = OLD.target_id;
    END IF;
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER product_qa_likes_count_aiu
AFTER INSERT OR DELETE ON public.product_qa_likes
FOR EACH ROW EXECUTE FUNCTION public.product_qa_likes_count_trg();

-- Answer count + seller-reply + notification
CREATE OR REPLACE FUNCTION public.product_answers_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_question public.product_questions%ROWTYPE;
  v_product_seller uuid;
BEGIN
  SELECT * INTO v_question FROM public.product_questions WHERE id = NEW.question_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  SELECT seller_id INTO v_product_seller FROM public.products WHERE id = v_question.product_id;

  IF v_product_seller IS NOT NULL AND NEW.user_id = v_product_seller THEN
    UPDATE public.product_answers SET is_seller_reply = true WHERE id = NEW.id;
  END IF;

  UPDATE public.product_questions
     SET answer_count = answer_count + 1, updated_at = now()
   WHERE id = NEW.question_id;

  -- Notify question author (unless self)
  IF v_question.user_id IS NOT NULL AND v_question.user_id <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, module, entity_type, entity_id, actor_id)
    VALUES (v_question.user_id,
            'Your question received a reply',
            COALESCE(NEW.author_name,'Someone') || ' replied to your question',
            'qa_reply','marketplace','product_question', v_question.id, NEW.user_id);
  END IF;

  -- Notify parent answer author (nested reply)
  IF NEW.parent_answer_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, type, module, entity_type, entity_id, actor_id)
    SELECT pa.user_id,
           'New reply to your answer',
           COALESCE(NEW.author_name,'Someone') || ' replied to your answer',
           'qa_reply','marketplace','product_question', v_question.id, NEW.user_id
      FROM public.product_answers pa
     WHERE pa.id = NEW.parent_answer_id
       AND pa.user_id IS NOT NULL
       AND pa.user_id <> NEW.user_id
       AND pa.user_id <> v_question.user_id;
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER product_answers_after_insert_trg
AFTER INSERT ON public.product_answers
FOR EACH ROW EXECUTE FUNCTION public.product_answers_after_insert();

CREATE OR REPLACE FUNCTION public.product_answers_after_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.product_questions
     SET answer_count = GREATEST(answer_count - 1, 0)
   WHERE id = OLD.question_id;
  RETURN OLD;
END $$;

CREATE TRIGGER product_answers_after_delete_trg
AFTER DELETE ON public.product_answers
FOR EACH ROW EXECUTE FUNCTION public.product_answers_after_delete();

-- Notify product owner of new question
CREATE OR REPLACE FUNCTION public.product_questions_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_seller uuid;
  v_title text;
BEGIN
  SELECT seller_id, title INTO v_seller, v_title FROM public.products WHERE id = NEW.product_id;
  IF v_seller IS NOT NULL AND v_seller <> NEW.user_id THEN
    INSERT INTO public.notifications (user_id, title, message, type, module, entity_type, entity_id, actor_id)
    VALUES (v_seller,
            'New question on your product',
            COALESCE(NEW.author_name,'A user') || ' asked about ' || COALESCE(v_title,'your product'),
            'qa_question','marketplace','product_question', NEW.id, NEW.user_id);
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER product_questions_after_insert_trg
AFTER INSERT ON public.product_questions
FOR EACH ROW EXECUTE FUNCTION public.product_questions_after_insert();

-- updated_at maintenance
CREATE TRIGGER product_questions_set_updated_at
BEFORE UPDATE ON public.product_questions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER product_answers_set_updated_at
BEFORE UPDATE ON public.product_answers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
