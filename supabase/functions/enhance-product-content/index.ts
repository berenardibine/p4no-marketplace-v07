import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, category, description } = await req.json();
    if (!title || typeof title !== "string" || title.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Title is required (min 2 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const prompt = `You are a product content expert for p4no, an African marketplace.
Product:
- Title: "${title}"
- Category: "${category || 'General'}"
- Current description: "${(description || '').slice(0, 800)}"

Produce a richly structured, SEO-friendly product page content. Be specific, helpful, original. Avoid generic filler.
Call the provided tool with these fields:
- seo_title: 40-80 chars, keyword-rich.
- meta_description: 130-160 chars, persuasive.
- description_structured.overview: 2-3 sentence overview.
- description_structured.key_benefits: 4-6 outcome-focused benefit strings.
- description_structured.features: 4-8 concise feature bullets.
- description_structured.ideal_for: 1-2 sentences naming who it suits.
- description_structured.why_choose: 2-3 sentences of differentiation.
- description_structured.final_thoughts: 1-2 closing sentences with soft CTA.
- tags: 5-10 short lowercase tag strings.
- faqs: 4-6 {q, a} pairs of realistic buyer questions with helpful answers.`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You always respond by calling the provided tool with rich, original content." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_enhanced",
            description: "Emit structured enhanced product content.",
            parameters: {
              type: "object",
              properties: {
                seo_title: { type: "string" },
                meta_description: { type: "string" },
                description_structured: {
                  type: "object",
                  properties: {
                    overview: { type: "string" },
                    key_benefits: { type: "array", items: { type: "string" } },
                    features: { type: "array", items: { type: "string" } },
                    ideal_for: { type: "string" },
                    why_choose: { type: "string" },
                    final_thoughts: { type: "string" },
                  },
                  required: ["overview", "key_benefits", "features", "ideal_for", "why_choose", "final_thoughts"],
                },
                tags: { type: "array", items: { type: "string" } },
                faqs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: { q: { type: "string" }, a: { type: "string" } },
                    required: ["q", "a"],
                  },
                },
              },
              required: ["seo_title", "meta_description", "description_structured", "tags", "faqs"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_enhanced" } },
      }),
    });

    if (resp.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (resp.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (!resp.ok) {
      const t = await resp.text();
      return new Response(JSON.stringify({ error: `AI gateway error: ${t}` }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const data = await resp.json();
    const args = data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!args) throw new Error("No tool call in response");
    const parsed = typeof args === "string" ? JSON.parse(args) : args;

    return new Response(JSON.stringify(parsed), { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});