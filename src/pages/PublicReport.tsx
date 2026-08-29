import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQRCode } from "@/services/qrService";
import { getOrganization } from "@/services/organizationService";
import { getLocation, getChildLocations } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { analyzeIssue } from "@/services/aiIssueService";
import { createTicket, generateTicketId } from "@/services/ticketService";
import { uploadTicketPhoto } from "@/services/supabaseService";
import { normalizePhoneNumber } from "@/services/whatsappService";
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

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

function validatePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[\s-]/g, "");
  if (!/^\+?\d{7,15}$/.test(digits)) {
    return "Please enter a valid phone number (e.g. +91XXXXXXXXXX).";
  }
  return null;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [useManual, setUseManual] = useState(false);

  const [manualCategory, setManualCategory] = useState<Category>("Other");
  const [manualArea, setManualArea] = useState<string>("");
  const [manualSeverity, setManualSeverity] = useState<Severity>("MEDIUM");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoError(null);
    if (!file) {
      setPhotoFile(null);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    if (!ALLOWED_TYPES.has(file.type)) {
      setPhotoError("Invalid file type. Please select a JPG, PNG, or WEBP image.");
      setPhotoFile(null);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setPhotoError("File is too large. Maximum size is 5 MB.");
      setPhotoFile(null);
      setPhotoPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPhotoFile(file);
    const preview = URL.createObjectURL(file);
    setPhotoPreview(preview);
  };

  const removePhoto = () => {
    setPhotoFile(null);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPhotoError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === "string" ? reader.result : "";
        const base64 = result.split(",")[1] || "";
        resolve(base64);
      };
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.readAsDataURL(file);
    });
  };

  const handleAnalyze = async () => {
    if (!description.trim() || !qr) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const imagePayload = photoFile ? { data: await fileToBase64(photoFile), mimeType: photoFile.type } : undefined;
      const result = await analyzeIssue({
        description: description.trim(),
        organization: organizationName || qr.name,
        location: locationName || "",
        childLocations: childLocations.map((loc) => ({ id: loc.id, name: loc.name })),
        image: imagePayload,
      });
      setAiResult(result);
      setUseManual(false);
    } catch {
      setAiError("AI analysis is temporarily unavailable. You can submit manually.");
      setUseManual(true);
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !qr) return;

    const phoneValidation = validatePhoneNumber(phoneNumber);
    if (phoneValidation) {
      setPhoneError(phoneValidation);
      return;
    }
    setPhoneError(null);

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
      const newTicketId = generateTicketId();
      let photoUrl: string | undefined;
      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      if (photoFile) {
        try {
          photoUrl = await uploadTicketPhoto(photoFile, newTicketId);
        } catch (uploadError) {
          console.error("[Ticket Submit] photo upload failed", uploadError);
          setAiError("Photo upload failed. Please try again or submit without the photo.");
          setSubmitting(false);
          return;
        }
      }

      const ticketData: Record<string, unknown> = {
        qrId: qrId || "",
        organizationId: qr.organizationId,
        locationId: qr.locationId,
        category: finalCategory,
        title: finalTitle,
        description: description.trim(),
        severity: finalSeverity,
        priority: finalSeverity === "CRITICAL" ? "P1" : finalSeverity === "HIGH" ? "P2" : finalSeverity === "MEDIUM" ? "P3" : "P4",
        status: "OPEN",
        aiSummary: finalSummary,
        aiConfidence: finalConfidence,
      };

      if (finalArea) ticketData.reportedArea = finalArea;
      if (finalSuggestedAction) ticketData.aiSuggestedAction = finalSuggestedAction;
      if (photoUrl) ticketData.photoUrl = photoUrl;
      if (normalizedPhone) ticketData.phoneNumber = normalizedPhone;

      await createTicket(ticketData as any, newTicketId);

      if (normalizedPhone) {
        try {
          await fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumber: normalizedPhone,
              ticketId: newTicketId,
              type: "created",
              title: finalTitle,
              priority: finalSeverity === "CRITICAL" ? "P1" : finalSeverity === "HIGH" ? "P2" : finalSeverity === "MEDIUM" ? "P3" : "P4",
              status: "OPEN",
            }),
          });
        } catch (whatsappError) {
          console.error("[Ticket Submit] WhatsApp notification failed", whatsappError);
        }
      }

      setTicketId(newTicketId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error("[Ticket Submit] create failed", {
        message,
        code: (err as { code?: string })?.code,
        name: (err as { name?: string })?.name,
      });
      setAiError(`Failed to create ticket: ${message}`);
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

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {photoError && (
                  <p className="text-xs text-destructive">{photoError}</p>
                )}
                {photoFile && photoPreview && (
                  <div className="space-y-2 rounded-md border bg-muted/30 p-3">
                    <img
                      src={photoPreview}
                      alt="Preview"
                      className="w-full h-40 object-cover rounded-md"
                    />
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate">{photoFile.name}</span>
                      <span>{formatFileSize(photoFile.size)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="flex-1" onClick={removePhoto}>
                        Remove
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="flex-1"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Change Photo
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium">
                  WhatsApp Number (optional)
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => {
                    setPhoneNumber(e.target.value);
                    if (phoneError) setPhoneError(null);
                  }}
                  placeholder="+91XXXXXXXXXX"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-xs text-muted-foreground">
                  Add your WhatsApp number if you want ticket updates.
                </p>
                {phoneError && (
                  <p className="text-xs text-destructive">{phoneError}</p>
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
                  {aiLoading ? "Analyzing your issue..." : "Analyze Issue"}
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
                      <span className="font-medium">Title:</span> {aiResult.title}
                    </div>
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
