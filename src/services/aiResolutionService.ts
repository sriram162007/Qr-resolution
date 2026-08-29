export interface ResolutionSuggestionRequest {
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
}

export interface ResolutionSuggestion {
  likelyCause: string;
  recommendedAction: string;
  requiredTeam: string;
  estimatedUrgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  resolutionSteps: string[];
  safetyNote: string;
}

const API_URL = "/api/suggest-resolution";

export async function suggestResolution(request: ResolutionSuggestionRequest): Promise<ResolutionSuggestion> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Resolution assistant is temporarily unavailable.");
  }

  return response.json();
}
