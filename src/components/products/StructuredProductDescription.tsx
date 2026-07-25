import { CheckCircle2, Sparkles, Target, Users, ThumbsUp, MessageCircleQuestion } from 'lucide-react';

export interface StructuredDescription {
  overview?: string;
  key_benefits?: string[];
  features?: string[];
  ideal_for?: string;
  why_choose?: string;
  final_thoughts?: string;
  faqs?: { q: string; a: string }[];
}

interface Props { data: StructuredDescription | null | undefined; }

const Section = ({ icon: Icon, title, children }: any) => (
  <div className="space-y-2">
    <h3 className="text-base font-bold text-foreground flex items-center gap-2">
      <Icon className="h-4 w-4 text-primary" /> {title}
    </h3>
    {children}
  </div>
);

export default function StructuredProductDescription({ data }: Props) {
  if (!data) return null;
  return (
    <article className="prose prose-sm max-w-none space-y-5 text-foreground">
      {data.overview && <p className="text-sm leading-relaxed text-muted-foreground">{data.overview}</p>}

      {data.key_benefits && data.key_benefits.length > 0 && (
        <Section icon={Sparkles} title="Key Benefits">
          <ul className="space-y-1.5 list-none p-0">
            {data.key_benefits.map((b, i) => (
              <li key={i} className="flex gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" /><span>{b}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {data.features && data.features.length > 0 && (
        <Section icon={Target} title="Features">
          <ul className="space-y-1.5 list-none p-0">
            {data.features.map((f, i) => (
              <li key={i} className="flex gap-2 text-sm"><span className="text-primary mt-0.5">•</span><span>{f}</span></li>
            ))}
          </ul>
        </Section>
      )}

      {data.ideal_for && (
        <Section icon={Users} title="Ideal For">
          <p className="text-sm leading-relaxed">{data.ideal_for}</p>
        </Section>
      )}

      {data.why_choose && (
        <Section icon={ThumbsUp} title="Why Choose This">
          <p className="text-sm leading-relaxed">{data.why_choose}</p>
        </Section>
      )}

      {data.final_thoughts && (
        <p className="text-sm leading-relaxed italic text-muted-foreground border-l-2 border-primary/40 pl-3">{data.final_thoughts}</p>
      )}

      {data.faqs && data.faqs.length > 0 && (
        <Section icon={MessageCircleQuestion} title="Frequently Asked Questions">
          <div className="space-y-2">
            {data.faqs.map((f, i) => (
              <details key={i} className="rounded-lg bg-muted/40 p-3 group">
                <summary className="font-semibold text-sm cursor-pointer">{f.q}</summary>
                <p className="mt-2 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>
      )}
    </article>
  );
}

export function ProductFaqJsonLd({ faqs }: { faqs?: { q: string; a: string }[] }) {
  if (!faqs || faqs.length === 0) return null;
  const json = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }} />;
}