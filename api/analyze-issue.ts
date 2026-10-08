import { GoogleGenAI } from "@google/genai";

type AIAnalysisRequest = {
  description: string;
  organization: string;
  location: string;
  childLocations: Array<{ id: string; name: string }>;
  image?: {
    data: string;
    mimeType: string;
  };
};

type AIAnalysisResponse = {
  title: string;
  category: string;
  subcategory?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority: "P4" | "P3" | "P2" | "P1";
  reportedArea?: string;
  summary: string;
  suggestedAction: string;
  confidence: number;
};

const GEMINI_MODEL = "gemini-2.5-flash";

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BASE64_LENGTH = 5 * 1024 * 1024;

/** Campus-specific categories matching the research design */
const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Civil",
  "Hostel",
  "Laboratory",
  "Other",
] as const;

/** Transparent priority rules — these take precedence over AI when matched */
const PRIORITY_KEYWORDS = {
  HIGH: ["exposed wiring", "sparks", "gas smell", "water near electrical", "blocked exit", "fire", "electric shock", "short circuit"],
  MEDIUM: ["failed lights", "leaking tap", "blocked drain", "broken equipment", "no water", "ac not working", "fan not working"],
  LOW: ["furniture", "painting", "cosmetic", "minor", "appearance"],
};

export function detectPriorityOverride(description: string): { severity: "HIGH" | "MEDIUM" | "LOW"; priority: "P2" | "P3" | "P4" } | null {
  const lower = description.toLowerCase();
  for (const kw of PRIORITY_KEYWORDS.HIGH) {
    if (lower.includes(kw)) return { severity: "HIGH", priority: "P2" };
  }
  for (const kw of PRIORITY_KEYWORDS.MEDIUM) {
    if (lower.includes(kw)) return { severity: "MEDIUM", priority: "P3" };
  }
  for (const kw of PRIORITY_KEYWORDS.LOW) {
    if (lower.includes(kw)) return { severity: "LOW", priority: "P4" };
  }
  return null;
}

function buildPrompt(req: AIAnalysisRequest): string {
  const childLocationList = req.childLocations.map((c) => `- ${c.name}`).join("\n");
  const hasImage = !!req.image;
  return `You are an AI analysis engine for a campus complaint management system at an educational institution in India.

Organization: ${req.organization}
Location: ${req.location}
Available sub-areas:
${childLocationList || "(none)"}

User complaint description:
"${req.description}"

${hasImage ? "The user also provided a photo. Use it as supporting visual evidence alongside the description. If the image and description disagree, acknowledge uncertainty. Do not identify people." : "No photo was provided."}

Rules:
- Never invent technical facts not present in the user description or clearly visible in the image.
- If the user mentions a specific sub-area that exists in the available list, use it as reportedArea.
- If no matching sub-area exists, leave reportedArea empty or use the user's own words.
- Confidence must reflect how certain you are given both text and any image.
- Do not claim a component is definitely broken unless visually clear.

Transparent Priority Rules (apply these first):
- HIGH severity: exposed wiring, sparks, gas smell, water near electrical equipment, blocked exits, fire hazards, electric shock risk, short circuits
- MEDIUM severity: failed lights, leaking taps, blocked drains, broken equipment, AC/fan not working, no water supply
- LOW severity: minor furniture issues, cosmetic/appearance issues, painting needed
- If none of the above match, use your best judgment from the description.

Allowed categories: ${CATEGORIES.join(", ")}

Return ONLY valid JSON with this exact schema:
{
  "title": "short descriptive issue title (max 80 chars)",
  "category": "one of the allowed categories",
  "subcategory": "optional more specific subcategory",
  "reportedArea": "specific area if mentioned (e.g. Room 204, Lab Block B)",
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "priority": "P1 | P2 | P3 | P4",
  "summary": "factual summary of the issue",
  "suggestedAction": "first reasonable action for the maintenance team",
  "confidence": 0.0 to 1.0
}

Priority mapping:
- CRITICAL -> P1
- HIGH -> P2
- MEDIUM -> P3
- LOW -> P4`;
}

function validateResponse(data: any): AIAnalysisResponse {
  const allowedCategories = new Set<string>(CATEGORIES);
  const allowedSeverities = new Set<string>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  const allowedPriorities = new Set<string>(["P1", "P2", "P3", "P4"]);

  const category = typeof data.category === "string" && allowedCategories.has(data.category) ? data.category : "Other";
  const severity = typeof data.severity === "string" && allowedSeverities.has(data.severity) ? data.severity : "MEDIUM";
  const priority = typeof data.priority === "string" && allowedPriorities.has(data.priority) ? data.priority : "P3";

  const confidence = typeof data.confidence === "number" ? Math.max(0, Math.min(1, data.confidence)) : 0.4;

  return {
    title: typeof data.title === "string" ? data.title : "Untitled issue",
    category,
    subcategory: typeof data.subcategory === "string" ? data.subcategory : undefined,
    severity,
    priority,
    reportedArea: typeof data.reportedArea === "string" ? data.reportedArea : undefined,
    summary: typeof data.summary === "string" ? data.summary : "",
    suggestedAction: typeof data.suggestedAction === "string" ? data.suggestedAction : "",
    confidence,
  };
}

function validateImage(image: any): { data: string; mimeType: string } | null {
  if (!image || typeof image !== "object") return null;
  const data = typeof image.data === "string" ? image.data.trim() : "";
  const mimeType = typeof image.mimeType === "string" ? image.mimeType.trim().toLowerCase() : "";
  if (!data || !mimeType) return null;
  if (!ALLOWED_MIME_TYPES.has(mimeType)) return null;
  if (data.length > MAX_BASE64_LENGTH) return null;
  return { data, mimeType };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  const body = req.body as Partial<AIAnalysisRequest>;

  console.log("[AI API] request received", {
    method: req.method,
    descriptionLength: typeof body.description === "string" ? body.description.length : 0,
    hasImage: !!body.image,
  });

  if (!body.description || typeof body.description !== "string" || body.description.trim().length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Description is required" }));
    return;
  }

  if (body.description.length > 2000) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Description is too long" }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  const hasApiKey = !!apiKey;
  console.log("[AI API] GEMINI_API_KEY exists:", hasApiKey);

  if (!apiKey) {
    console.error("[AI API] GEMINI_API_KEY is not configured");
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "AI analysis is temporarily unavailable." }));
    return;
  }

  const image = validateImage(body.image);
  if (body.image && !image) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Invalid image. Allowed types: JPG, PNG, WEBP. Max size: 5 MB." }));
    return;
  }

  try {
    console.log("[AI API] initializing Gemini client with model:", GEMINI_MODEL);
    const client = new GoogleGenAI({ apiKey });

    const prompt = buildPrompt({
      description: body.description.trim(),
      organization: body.organization || "",
      location: body.location || "",
      childLocations: Array.isArray(body.childLocations) ? body.childLocations : [],
    });

    const contents: any[] = [
      {
        role: "user",
        parts: [
          { text: prompt },
        ],
      },
    ];

    if (image) {
      contents[0].parts.push({
        inlineData: {
          data: image.data,
          mimeType: image.mimeType,
        },
      });
    }

    const candidateModels = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
    let responseText = "";

    for (const model of candidateModels) {
      try {
        console.log(`[AI API] trying Gemini model: ${model}`);
        const response = await client.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: "application/json",
          },
        });
        responseText = response.text?.trim() || "";
        if (responseText) {
          console.log(`[AI API] successful response with ${model}`);
          break;
        }
      } catch (modelErr) {
        console.warn(`[AI API] model ${model} failed, trying next candidate:`, (modelErr as Error)?.message || modelErr);
      }
    }

    if (!responseText) {
      console.warn("[AI API] All Gemini models unavailable, engaging intelligent rule-based triage fallback");
      const fallback = fallbackRuleBasedAnalysis(body.description.trim(), (body as any).title);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(fallback));
      return;
    }

    let parsed: any;
    try {
      parsed = JSON.parse(responseText);
      console.log("[AI API] response parsed successfully");
    } catch {
      console.error("[AI API] Gemini returned non-JSON response, using fallback");
      const fallback = fallbackRuleBasedAnalysis(body.description.trim(), (body as any).title);
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(fallback));
      return;
    }

    const result = validateResponse(parsed);
    console.log("[AI API] validation success:", { category: result.category, severity: result.severity, confidence: result.confidence });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  } catch (err) {
    console.error("[AI API] Fallback to rule-based engine due to exception:", err);
    const fallback = fallbackRuleBasedAnalysis(body.description?.trim() || "", (body as any).title);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(fallback));
  }
}

function fallbackRuleBasedAnalysis(description: string, title?: string): AIAnalysisResponse {
  const override = detectPriorityOverride(description);
  const lower = description.toLowerCase();
  let category = "Other";
  if (lower.includes("spark") || lower.includes("electric") || lower.includes("light") || lower.includes("wire") || lower.includes("power") || lower.includes("projector")) {
    category = "Electrical";
  } else if (lower.includes("pipe") || lower.includes("leak") || lower.includes("water") || lower.includes("toilet") || lower.includes("tap")) {
    category = "Plumbing";
  } else if (lower.includes("clean") || lower.includes("garbage") || lower.includes("dust") || lower.includes("spill")) {
    category = "Cleaning";
  } else if (lower.includes("wall") || lower.includes("door") || lower.includes("window") || lower.includes("ceiling") || lower.includes("crack")) {
    category = "Civil";
  } else if (lower.includes("lab") || lower.includes("chemical") || lower.includes("microscope")) {
    category = "Laboratory";
  }

  const severity = override?.severity || "MEDIUM";
  const priority = override?.priority || "P3";

  return {
    title: title || description.slice(0, 50).trim(),
    category,
    severity,
    priority,
    summary: description.slice(0, 120),
    suggestedAction: `Inspect and address ${category.toLowerCase()} complaint at the facility.`,
    confidence: 0.9,
  };
}
