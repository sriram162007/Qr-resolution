import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQRCode } from "@/services/qrService";
import { getOrganization } from "@/services/organizationService";
import { getLocation, getChildLocations } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { analyzeIssue } from "@/services/aiIssueService";
import { createTicket } from "@/services/ticketService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Location } from "@/types";

const CATEGORIES = [
  { value: "Electrical", label: "Electrical" },
  { value: "Plumbing", label: "Plumbing / Water" },
  { value: "Cleaning", label: "Cleaning" },
  { value: "Furniture", label: "Furniture" },
  { value: "HVAC", label: "HVAC" },
  { value: "Network", label: "Network / Wi-Fi" },
  { value: "Safety", label: "Safety" },
  { value: "Infrastructure", label: "Infrastructure" },
  { value: "Other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

interface AIResult {
  title: string;
  category: string;
  subcategory?: string;
  reportedArea?: string;
  severity: Severity;
  priority: "P4" | "P3" | "P2" | "P1";
  summary: string;
  suggestedAction: string;
  confidence: number;
}


export default function PublicReport() {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();
  const [qr, setQR] = useState<{ name: string; locationId: string; organizationId: string } | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [childLocations, setChildLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [photoName, setPhotoName] = useState("");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [useManual, setUseManual] = useState(false);

  const [manualCategory, setManualCategory] = useState<Category>("Other");
  const [manualArea, setManualArea] = useState<string>("");
  const [manualSeverity, setManualSeverity] = useState<Severity>("MEDIUM");

  useEffect(() => {
    async function load() {
      if (!qrId) return;
      setLoading(true);
      try {
        const data = await getQRCode(qrId);
        if (!data || !data.isActive) {
          setQR(null);
          return;
        }
        setQR({ name: data.name, locationId: data.locationId, organizationId: data.organizationId });
        const [org, loc, children] = await Promise.all([
          getOrganization(data.organizationId),
          getLocation(data.locationId),
          getChildLocations(data.locationId),
        ]);
        if (org) setOrganizationName(org.name);
        if (loc) setLocationName(getLocationPath([loc], loc.id));
        setChildLocations(children);
      } catch {
        setQR(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [qrId]);

  const handleAnalyze = async () => {
    if (!description.trim() || !qr) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await analyzeIssue({
        description: description.trim(),
        organization: organizationName || qr.name,
        location: locationName || "",
        childLocations: childLocations.map((loc) => ({ id: loc.id, name: loc.name })),
      });
      setAiResult(result);
      setUseManual(false);
    } catch (err) {
      setAiError("AI analysis is temporarily unavailable. You can submit manually.");
      setUseManual(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !qr) return;

    let finalCategory: string = manualCategory;
    let finalArea = manualArea;
    let finalSeverity = manualSeverity;
    let finalSummary = description.trim();
    let finalSuggestedAction = "";
    let finalConfidence = 0;
    let finalTitle = description.trim().slice(0, 80);

    if (!useManual && aiResult) {
      finalCategory = aiResult.category;
      finalArea = aiResult.reportedArea || manualArea;
      finalSeverity = aiResult.severity;
      finalSummary = aiResult.summary || description.trim();
      finalSuggestedAction = aiResult.suggestedAction;
      finalConfidence = aiResult.confidence || 0;
      finalTitle = aiResult.title || description.trim().slice(0, 80);
    }

    setSubmitting(true);
    try {
      const newTicketId = await createTicket({
        ticketId: "",
        qrId: qrId || "",
        organizationId: qr.organizationId,
        locationId: qr.locationId,
        category: finalCategory,
        subcategory: undefined,
        title: finalTitle,
        description: description.trim(),
        reportedArea: finalArea || undefined,
        severity: finalSeverity,
        priority: finalSeverity === "CRITICAL" ? "P1" : finalSeverity === "HIGH" ? "P2" : finalSeverity === "MEDIUM" ? "P3" : "P4",
        status: "OPEN",
        aiSummary: finalSummary,
        aiConfidence: finalConfidence,
        aiSuggestedAction: finalSuggestedAction || undefined,
        photoUrl: undefined,
      });
      setTicketId(newTicketId);
    } catch {
      setAiError("Failed to create ticket. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
          </div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">QR Code Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                This QR code is invalid or inactive. Please scan a valid QR code.
              </p>
              <Button className="w-full mt-4" variant="outline" onClick={() => navigate("/")}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (ticketId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
          </div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Issue Reported Successfully</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Your issue has been reported with ticket ID:
              </p>
              <p className="text-center font-mono text-lg font-semibold">{ticketId}</p>
              <Button className="w-full" size="lg" onClick={() => navigate(`/track/${ticketId}`)}>
                Track Your Issue
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Report an Issue</CardTitle>
            <CardDescription className="space-y-1">
              {organizationName && <p><span className="font-medium">Organization:</span> {organizationName}</p>}
              {locationName && <p><span className="font-medium">Location:</span> {locationName}</p>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  What happened? <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Describe the problem in your own words..."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Example: The AC in Room 204 is not working and the room is very hot.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="photo" className="text-sm font-medium">
                  Add a photo (optional)
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPhotoName(file ? file.name : "");
                  }}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {photoName && (
                  <p className="text-xs text-muted-foreground">Selected: {photoName}</p>
                )}
              </div>

              {!aiResult && !useManual && (
                <Button
                  type="button"
                  className="w-full"
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={aiLoading || !description.trim()}
                >
                  {aiLoading ? "AI is understanding your issue..." : "Analyze Issue"}
                </Button>
              )}

              {aiError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  {aiError}
                </div>
              )}

              {aiResult && !useManual && (
                <div className="space-y-3 rounded-md border bg-muted/50 p-4">
                  <h3 className="text-sm font-semibold">AI Analysis Result</h3>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="font-medium">Category:</span> {aiResult.category}
                    </div>
                    <div>
                      <span className="font-medium">Severity:</span> {aiResult.severity}
                    </div>
                    <div>
                      <span className="font-medium">Priority:</span> {aiResult.priority}
                    </div>
                    {aiResult.reportedArea && (
                      <div>
                        <span className="font-medium">Area:</span> {aiResult.reportedArea}
                      </div>
                    )}
                  </div>
                  <div className="text-xs space-y-1">
                    <p><span className="font-medium">Summary:</span> {aiResult.summary}</p>
                    <p><span className="font-medium">Suggested action:</span> {aiResult.suggestedAction}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    AI confidence: {Math.round((aiResult.confidence || 0) * 100)}%
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" className="flex-1" size="sm" onClick={() => setUseManual(true)}>
                      Edit Manually
                    </Button>
                    <Button type="submit" className="flex-1" size="sm" disabled={submitting}>
                      {submitting ? "Submitting..." : "Review & Submit"}
                    </Button>
                  </div>
                </div>
              )}

              {(useManual || aiResult) && (
                <div className="space-y-3 rounded-md border bg-muted/30 p-4">
                  <h3 className="text-sm font-semibold">Manual Details</h3>
                  <div className="space-y-2">
                    <label htmlFor="manualCategory" className="text-sm font-medium">
                      Category
                    </label>
                    <select
                      id="manualCategory"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value as Category)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="manualArea" className="text-sm font-medium">
                      Exact Area
                    </label>
                    <input
                      id="manualArea"
                      value={manualArea}
                      onChange={(e) => setManualArea(e.target.value)}
                      placeholder="e.g. Room 204"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="manualSeverity" className="text-sm font-medium">
                      Severity
                    </label>
                    <select
                      id="manualSeverity"
                      value={manualSeverity}
                      onChange={(e) => setManualSeverity(e.target.value as Severity)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                  {useManual && (
                    <Button type="submit" className="w-full" size="lg" disabled={submitting || !description.trim()}>
                      {submitting ? "Submitting..." : "Submit Issue"}
                    </Button>
                  )}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
