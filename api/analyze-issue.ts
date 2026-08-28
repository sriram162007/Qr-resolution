import { GoogleGenAI } from "@google/genai";

type AIAnalysisRequest = {
  description: string;
  organization: string;
  location: string;
  childLocations: Array<{ id: string; name: string }>;
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

const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Furniture",
  "HVAC",
  "Network",
  "Safety",
  "Infrastructure",
  "Other",
] as const;

function buildPrompt(req: AIAnalysisRequest): string {
  const childLocationList = req.childLocations.map((c) => `- ${c.name}`).join("\n");
  return `You are an issue-intelligence engine for a facility management system.

Organization: ${req.organization}
Location: ${req.location}
Available sub-areas:
${childLocationList || "(none)"}

User description:
"${req.description}"

Classify this issue into ONE of these categories:
${CATEGORIES.join(", ")}

Rules:
- Never invent technical facts not present in the user description.
- If the user mentions a specific sub-area that exists in the available list, use it as reportedArea.
- If no matching sub-area exists, leave reportedArea empty or use the user's own words.
- Severity must be grounded in the description only.
- Confidence must reflect how certain you are.

Return ONLY valid JSON with this exact schema:
{
  "title": "short issue title",
  "category": "one of the allowed categories",
  "subcategory": "optional subcategory",
  "reportedArea": "specific area if mentioned",
  "severity": "LOW | MEDIUM | HIGH | CRITICAL",
  "priority": "P1 | P2 | P3 | P4",
  "summary": "factual summary of the issue",
  "suggestedAction": "first reasonable action",
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

  try {
    console.log("[AI API] initializing Gemini client with model:", GEMINI_MODEL);
    const client = new GoogleGenAI({ apiKey });

    const prompt = buildPrompt({
      description: body.description.trim(),
      organization: body.organization || "",
      location: body.location || "",
      childLocations: Array.isArray(body.childLocations) ? body.childLocations : [],
    });

    console.log("[AI API] Gemini request started");
    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });
    console.log("[AI API] Gemini response received");

    const text = response.text?.trim() || "";
    let parsed: any;
    try {
      parsed = JSON.parse(text);
      console.log("[AI API] response parsed successfully");
    } catch {
      console.error("[AI API] Gemini returned non-JSON response", { textLength: text.length });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "AI analysis is temporarily unavailable." }));
      return;
    }

    const result = validateResponse(parsed);
    console.log("[AI API] validation success:", { category: result.category, severity: result.severity, confidence: result.confidence });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[AI API] Gemini analysis error:", {
      message,
      name: err instanceof Error ? err.name : undefined,
    });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "AI analysis is temporarily unavailable." }));
  }
}
