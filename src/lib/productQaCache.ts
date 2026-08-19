// Shared Product Q&A reader.
// ------------------------------------------------------------------
// The forensic audit found `product_questions` fetched TWICE per product page:
// once by <ProductQA> (UI) and once by <QAJsonLd> (structured data). Both need
// the same rows, so they now share ONE request through a bucketed cache key.
//
// Bucketing matters: without it, `limit=5` and `limit=10` would be two distinct
// keys and two network requests. Limits are rounded up to the nearest 10, so
// every consumer of the same product hits the same key and the same in-flight
// promise. Consumers slice locally.

import { supabase } from '@/integrations/supabase/client';
import { cachedQuery, invalidateQuery } from './queryCache';

export interface QaAnswerRow {
  id: string;
  question_id: string;
  parent_answer_id: string | null;
  user_id: string;
  author_name: string;
  content: string;
  is_seller_reply: boolean;
  like_count: number;
  created_at: string;
}

export interface QaQuestionRow {
  id: string;
  user_id: string;
  author_name: string;
  content: string;
  like_count: number;
  answer_count: number;
  created_at: string;
}

export interface ProductQaResult {
  questions: QaQuestionRow[];
  answers: QaAnswerRow[];
  total: number;
}

const TTL_MS = 60_000;
const BUCKET = 10;

const bucketOf = (limit: number) => Math.max(BUCKET, Math.ceil(limit / BUCKET) * BUCKET);
const keyFor = (productId: string, limit: number) => `qa:${productId}:${bucketOf(limit)}`;

async function fetchProductQa(productId: string, limit: number): Promise<ProductQaResult> {
  const { data: qs, error, count } = await supabase
    .from('product_questions')
    .select('id,user_id,author_name,content,like_count,answer_count,created_at', { count: 'exact' })
    .eq('product_id', productId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const questions = (qs as QaQuestionRow[]) ?? [];
  let answers: QaAnswerRow[] = [];
  if (questions.length) {
    const { data: aData } = await supabase
      .from('product_answers')
      .select('id,question_id,parent_answer_id,user_id,author_name,content,is_seller_reply,like_count,created_at')
      .in('question_id', questions.map((q) => q.id))
      .order('created_at', { ascending: true });
    answers = (aData as QaAnswerRow[]) ?? [];
  }
  return { questions, answers, total: count ?? questions.length };
}

/** One request per (product, bucket) per TTL window, shared by all components. */
export function getProductQa(productId: string, limit = BUCKET): Promise<ProductQaResult> {
  const bucket = bucketOf(limit);
  return cachedQuery(keyFor(productId, bucket), () => fetchProductQa(productId, bucket), {
    ttlMs: TTL_MS,
    // Session-scoped only: Q&A changes with user activity, so we never persist
    // it to localStorage — the win is deduplication, not long-lived staleness.
    persist: false,
  });
}

/** Call after any Q&A mutation so the next read is authoritative. */
export function invalidateProductQa(productId: string, maxBuckets = 5): void {
  for (let i = 1; i <= maxBuckets; i++) invalidateQuery(`qa:${productId}:${i * BUCKET}`);
}
