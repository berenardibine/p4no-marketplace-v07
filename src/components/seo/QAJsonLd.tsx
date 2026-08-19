import { useEffect } from 'react';
import { getProductQa } from '@/lib/productQaCache';

interface Props { productId: string; productName?: string }
interface QA { question: string; answers: { text: string; author: string; upvoteCount: number; dateCreated: string }[]; dateCreated: string; author: string; upvoteCount: number }

/** Emits FAQPage / QAPage structured data for product questions. */
const QAJsonLd = ({ productId, productName }: Props) => {
  useEffect(() => {
    let cancelled = false;
    const scriptId = `qa-jsonld-${productId}`;
    (async () => {
      // Shares the single Q&A request with <ProductQA>; ranking is applied
      // locally so no extra PostgREST read is issued for structured data.
      const { questions, answers: ans } = await getProductQa(productId, 10);
      if (!questions.length || cancelled) return;
      const qs = [...questions].sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      const out: QA[] = qs.map((q: any) => ({
        question: q.content,
        author: q.author_name,
        upvoteCount: q.like_count || 0,
        dateCreated: q.created_at,
        answers: (ans || [])
          .filter((a: any) => a.question_id === q.id)
          .map((a: any) => ({
            text: a.content, author: a.author_name,
            upvoteCount: a.like_count || 0, dateCreated: a.created_at,
          })),
      })).filter(q => q.answers.length > 0);
      if (cancelled || out.length === 0) return;
      const faq = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        name: productName ? `${productName} - Questions & Answers` : 'Product Q&A',
        mainEntity: out.map((q) => ({
          '@type': 'Question',
          name: q.question,
          answerCount: q.answers.length,
          upvoteCount: q.upvoteCount,
          dateCreated: q.dateCreated,
          author: { '@type': 'Person', name: q.author },
          acceptedAnswer: {
            '@type': 'Answer',
            text: q.answers[0].text,
            upvoteCount: q.answers[0].upvoteCount,
            dateCreated: q.answers[0].dateCreated,
            author: { '@type': 'Person', name: q.answers[0].author },
          },
        })),
      };
      let el = document.getElementById(scriptId) as HTMLScriptElement | null;
      if (!el) {
        el = document.createElement('script');
        el.id = scriptId;
        el.type = 'application/ld+json';
        document.head.appendChild(el);
      }
      el.textContent = JSON.stringify(faq);
    })();
    return () => {
      cancelled = true;
      const el = document.getElementById(scriptId);
      if (el) el.remove();
    };
  }, [productId, productName]);

  return null;
};

export default QAJsonLd;