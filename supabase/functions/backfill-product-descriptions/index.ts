import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

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

async function generateOne(title: string, category: string | null, apiKey: string) {
  const prompt = `You are an elite e-commerce SEO copywriter for the marketplace p4no.
Write the MOST POWERFUL, conversion-focused product listing possible.

Product: "${title}"
Category: "${category || 'General'}"
Variation seed: ${Math.random().toString(36).slice(2, 8)}

Requirements:
- seo_title: max 70 chars, magnetic, keyword-rich, includes a benefit or differentiator
- seo_description: AT LEAST 1000 characters, plain text with short paragraphs separated by blank lines (no markdown, no emojis). Structure:
    1) Hook intro (1-2 sentences) that names the product and its main promise
    2) Key benefits (4-6 sentences focused on outcomes, not just specs)
    3) Who it's for / best use cases
    4) Quality, durability, or trust signals
    5) Why buy on p4no (fast contact with seller, negotiable, local availability)
    6) Strong call-to-action closing
   Naturally weave in long-tail keywords related to the product and category.
   Write 100% original copy. Never copy from any external website.
- slug: short URL-friendly slug, lowercase, hyphen-separated, max 60 chars.`;

  const callModel = async (model: string) => fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: "You are an expert marketplace SEO copywriter. Always call the provided tool with rich, original, persuasive copy." },
        { role: "user", content: prompt },
      ],
      tools: [{
        type: "function",
        function: {
          name: "emit_listing",
          parameters: {
            type: "object",
            properties: {
              seo_title: { type: "string" },
              seo_description: { type: "string" },
              slug: { type: "string" },
            },
            required: ["seo_title", "seo_description", "slug"],
          },
        },
      }],
      tool_choice: { type: "function", function: { name: "emit_listing" } },
    }),
  });

  // Try cheapest fast model first, then fall back on 429
  let r = await callModel("google/gemini-2.5-flash-lite");
  if (r.status === 429) {
    await new Promise(res => setTimeout(res, 8000));
    r = await callModel("google/gemini-2.5-flash-lite");
  }
  if (r.status === 429) {
    await new Promise(res => setTimeout(res, 15000));
    r = await callModel("google/gemini-2.5-flash");
  }
  if (!r.ok) throw new Error(`AI ${r.status}`);
  const data = await r.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("No tool call returned");
  const parsed = JSON.parse(args);
  if (!parsed.slug) parsed.slug = slugify(parsed.seo_title || title);
  return parsed as { seo_title: string; seo_description: string; slug: string };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    const url = new URL(req.url);
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 50);

    // Find products with missing or short descriptions
    const { data: products, error } = await supabase
      .from("products")
      .select("id, title, description, category, slug")
      .eq("status", "active")
      .limit(200);

    if (error) throw error;

    const targets = (products || []).filter(p =>
      !p.description || p.description.trim().length < 800
    ).slice(0, limit);

    let updated = 0;
    const errors: { id: string; error: string }[] = [];

    for (const p of targets) {
      try {
        const gen = await generateOne(p.title, p.category, LOVABLE_API_KEY);
        const update: any = {
          description: gen.seo_description,
          seo_title: gen.seo_title,
          seo_description: gen.seo_description.slice(0, 300),
        };
        if (!p.slug) update.slug = gen.slug;
        const { error: upErr } = await supabase.from("products").update(update).eq("id", p.id);
        if (upErr) throw upErr;
        updated++;
        // Throttle to stay under per-minute rate limits
        await new Promise(r => setTimeout(r, 2500));
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push({ id: p.id, error: msg });
        // If repeatedly rate-limited, back off harder before next item
        if (msg.includes("429")) await new Promise(r => setTimeout(r, 10000));
      }
    }

    return new Response(JSON.stringify({
      scanned: products?.length || 0,
      candidates: targets.length,
      updated,
      errors,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("backfill error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});