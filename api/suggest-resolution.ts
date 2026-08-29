import { GoogleGenAI } from "@google/genai";

type SuggestionRequest = {
  title: string;
  description: string;
  category?: string;
  subcategory?: string;
  reportedArea?: string;
  severity?: string;
  priority?: string;
  aiSummary?: string;
  aiSuggestedAction?: string;
  photo?: {
    data: string;
    mimeType: string;
  };
};

type SuggestionResponse = {
  likelyCause: string;
  recommendedAction: string;
  requiredTeam: string;
  estimatedUrgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolutionSteps: string[];
  safetyNote: string;
};

const GEMINI_MODEL = "gemini-2.5-flash";

function buildPrompt(req: SuggestionRequest): string {
  return `You are a maintenance and facility resolution assistant.

Issue details:
- Title: ${req.title || "(none)"}
- Category: ${req.category || "(none)"}
- Subcategory: ${req.subcategory || "(none)"}
- Reported area: ${req.reportedArea || "(none)"}
- Severity: ${req.severity || "(none)"}
- Priority: ${req.priority || "(none)"}
- Description: ${req.description || "(none)"}
- AI summary: ${req.aiSummary || "(none)"}
- AI suggested action: ${req.aiSuggestedAction || "(none)"}

Return ONLY valid JSON with this exact schema:
{
  "likelyCause": "most likely cause",
  "recommendedAction": "primary recommended action",
  "requiredTeam": "team or role needed",
  "estimatedUrgency": "LOW | MEDIUM | HIGH | CRITICAL",
  "resolutionSteps": ["step 1", "step 2", "step 3"],
  "safetyNote": "any safety considerations"
}`;
}

function validateResponse(data: any): SuggestionResponse {
  const allowedUrgencies = new Set<string>(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  const urgency = typeof data.estimatedUrgency === "string" && allowedUrgencies.has(data.estimatedUrgency) ? data.estimatedUrgency : "MEDIUM";
  const steps = Array.isArray(data.resolutionSteps) ? data.resolutionSteps.filter((s: any) => typeof s === "string").slice(0, 8) : [];
  return {
    likelyCause: typeof data.likelyCause === "string" ? data.likelyCause : "",
    recommendedAction: typeof data.recommendedAction === "string" ? data.recommendedAction : "",
    requiredTeam: typeof data.requiredTeam === "string" ? data.requiredTeam : "",
    estimatedUrgency: urgency,
    resolutionSteps: steps,
    safetyNote: typeof data.safetyNote === "string" ? data.safetyNote : "",
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  const body = req.body as Partial<SuggestionRequest>;

  if (!body.description || typeof body.description !== "string" || body.description.trim().length === 0) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Description is required" }));
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("[Resolution API] GEMINI_API_KEY is not configured");
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Resolution assistant is temporarily unavailable." }));
    return;
  }

  try {
    const client = new GoogleGenAI({ apiKey });

    const prompt = buildPrompt({
      title: body.title || "",
      description: body.description.trim(),
      category: body.category,
      subcategory: body.subcategory,
      reportedArea: body.reportedArea,
      severity: body.severity,
      priority: body.priority,
      aiSummary: body.aiSummary,
      aiSuggestedAction: body.aiSuggestedAction,
    });

    const parts: any[] = [{ text: prompt }];
    if (body.photo && typeof body.photo.data === "string" && body.photo.data.trim().length > 0) {
      parts.push({
        inlineData: {
          data: body.photo.data,
          mimeType: body.photo.mimeType || "image/jpeg",
        },
      });
    }

    const response = await client.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
      },
    });

    const text = response.text?.trim() || "";
    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      console.error("[Resolution API] non-JSON response", { textLength: text.length });
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "Resolution assistant is temporarily unavailable." }));
      return;
    }

    const result = validateResponse(parsed);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[Resolution API] Gemini error:", {
      message,
      name: err instanceof Error ? err.name : undefined,
    });
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ message: "Resolution assistant is temporarily unavailable." }));
  }
}
