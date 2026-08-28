export interface AIAnalysisRequest {
  description: string;
  organization: string;
  location: string;
  childLocations: Array<{ id: string; name: string }>;
}

export interface AIAnalysisResponse {
  title: string;
  category: string;
  subcategory?: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  priority: "P4" | "P3" | "P2" | "P1";
  reportedArea?: string;
  summary: string;
  suggestedAction: string;
  confidence: number;
}

const AI_API_URL = "/api/analyze-issue";

export async function analyzeIssue(request: AIAnalysisRequest): Promise<AIAnalysisResponse> {
  const response = await fetch(AI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "AI analysis failed");
  }

  return response.json();
}
