import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const slugify = (s: string) =>
  s.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 60);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { title, category, mode } = await req.json();
    if (!title || typeof title !== "string" || title.trim().length < 2) {
      return new Response(JSON.stringify({ error: "Title is required (min 2 chars)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const isRegen = mode === "regenerate";
    const seed = isRegen ? `\nVariation seed: ${Math.random().toString(36).slice(2, 8)}` : "";

    const prompt = `You write product listings for p4no, an African marketplace. Product input:
Name: "${title}"
Category: "${category || 'General'}"${seed}

Produce:
1. seo_title: SEO-optimized product title (max 70 chars, attractive, keyword-rich, no quotes)
2. seo_description: a UNIQUE, ORIGINAL short description of MAXIMUM 50 WORDS.
   It can be shorter than 50 words when that reads better - never pad it to reach the limit.
   Plain text, 1-3 short sentences, no markdown, no bullet symbols, no headings.
   Must be clear, natural, useful and easy to read: say what it is and why it is worth buying.
   Tone: simple, persuasive, trustworthy. Do NOT copy from any website.
3. slug: short URL-friendly slug, lowercase, hyphen-separated, max 60 chars.

Return ONLY a tool call.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: "You are a marketplace SEO copywriter. Always call the provided tool." },
          { role: "user", content: prompt },
        ],
        tools: [{
          type: "function",
          function: {
            name: "emit_listing",
            description: "Emit a structured product listing.",
            parameters: {
              type: "object",
              properties: {
                seo_title: { type: "string" },
                seo_description: { type: "string" },
                slug: { type: "string" },
              },
              required: ["seo_title", "seo_description", "slug"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "emit_listing" } },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, try again later" }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add funds in Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let result: { seo_title?: string; seo_description?: string; slug?: string } = {};

    if (toolCall?.function?.arguments) {
      try { result = JSON.parse(toolCall.function.arguments); } catch {}
    }
    if (!result.seo_description) {
      const content = data.choices?.[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) { try { result = JSON.parse(jsonMatch[0]); } catch {} }
    }

    if (!result.seo_title || !result.seo_description) {
      return new Response(JSON.stringify({ error: "AI returned an incomplete response. Please retry." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Pad if AI undershoots the 800 char minimum
    if (result.seo_description.length < 800) {
      const filler = ` This product is carefully selected to meet the everyday needs of buyers across the region. With reliable quality, fair pricing, and dependable performance, it offers great value for your investment. Whether for personal use, your business, or as a thoughtful gift, you can shop with confidence on p4no — the trusted marketplace connecting buyers and sellers across communities.`;
      while (result.seo_description.length < 850) result.seo_description += filler;
    }

    if (!result.slug) result.slug = slugify(result.seo_title);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("seo-suggest error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
