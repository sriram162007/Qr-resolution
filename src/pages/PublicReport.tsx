import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQRCode } from "@/services/qrService";
import { getOrganization } from "@/services/organizationService";
import { getLocation, getChildLocations } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { analyzeIssue } from "@/services/aiIssueService";
import { createTicket, generateTicketId, generateTrackingToken, linkDuplicateTicket } from "@/services/ticketService";
import { uploadTicketPhoto } from "@/services/supabaseService";
import { normalizePhoneNumber } from "@/services/whatsappService";
import { detectAnomalies } from "@/services/anomalyService";
import { getEstimateString } from "@/lib/resolutionEstimate";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Location, AnomalyFlag } from "@/types";

const CATEGORIES = [
  { value: "Electrical", label: "⚡ Electrical" },
  { value: "Plumbing", label: "🪠 Plumbing / Water" },
  { value: "Cleaning", label: "🧹 Cleaning" },
  { value: "Civil", label: "🏗️ Civil / Infrastructure" },
  { value: "Hostel", label: "🏠 Hostel" },
  { value: "Laboratory", label: "🔬 Laboratory" },
  { value: "Other", label: "❓ Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// Transparent priority rules as defined in the research design
const PRIORITY_RULES = {
  HIGH: [
    "exposed wiring",
    "sparks",
    "gas smell",
    "water near electrical",
    "blocked exit",
    "fire",
    "electric shock",
    "short circuit",
  ],
  MEDIUM: [
    "failed lights",
    "light not working",
    "leaking tap",
    "blocked drain",
    "broken equipment",
    "no water",
    "ac not working",
    "fan not working",
  ],
  LOW: [
    "furniture",
    "painting",
    "cosmetic",
    "minor",
    "appearance",
    "aesthetic",
  ],
};

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

interface DuplicateMatch {
  ticketId: string;
  similarity: number;
  title: string;
  status: string;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const AI_CONFIDENCE_THRESHOLD = 0.6;

function validatePhoneNumber(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/[\s-]/g, "");

  // Indian number validation
  if (digits.startsWith("+91") || (digits.startsWith("91") && digits.length === 12)) {
    const mobile = digits.replace(/^\+?91/, "");
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      return "Invalid Indian mobile number. Must start with 6-9 and be 10 digits.";
    }
    return null;
  }

  if (digits.length === 10 && /^[6-9]\d{9}$/.test(digits)) return null;

  if (!/^\+?\d{7,15}$/.test(digits)) {
    return "Please enter a valid phone number (e.g. +91XXXXXXXXXX).";
  }
  return null;
}

/**
 * Apply transparent priority rules from the research design.
 * Returns null if no rule matches (defer to AI).
 */
function applyPriorityRules(description: string): { severity: Severity; priority: "P1" | "P2" | "P3" | "P4" } | null {
  const lower = description.toLowerCase();
  if (PRIORITY_RULES.HIGH.some((kw) => lower.includes(kw))) {
    return { severity: "HIGH", priority: "P2" };
  }
  if (PRIORITY_RULES.MEDIUM.some((kw) => lower.includes(kw))) {
    return { severity: "MEDIUM", priority: "P3" };
  }
  if (PRIORITY_RULES.LOW.some((kw) => lower.includes(kw))) {
    return { severity: "LOW", priority: "P4" };
  }
  return null;
}

export default function PublicReport() {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();
  const [qr, setQR] = useState<{ name: string; locationId: string; organizationId: string; department?: string } | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [childLocations, setChildLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [trackingToken, setTrackingToken] = useState<string | null>(null);

  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [useManual, setUseManual] = useState(false);
  const [lowConfidenceWarning, setLowConfidenceWarning] = useState(false);

  const [manualCategory, setManualCategory] = useState<Category>("Other");
  const [manualArea, setManualArea] = useState<string>("");
  const [manualSeverity, setManualSeverity] = useState<Severity>("MEDIUM");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Duplicate detection state
  const [duplicateCheckLoading, setDuplicateCheckLoading] = useState(false);
  const [duplicateResult, setDuplicateResult] = useState<{ isDuplicate: boolean; parentTicketId?: string; matches?: DuplicateMatch[] } | null>(null);
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false);


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
        setQR({
          name: data.name,
          locationId: data.locationId,
          organizationId: data.organizationId,
          department: (data as any).department,
        });
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
      setPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setPhotoError("File is too large. Maximum size is 5 MB.");
      setPhotoFile(null);
      setPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
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
    setDuplicateResult(null);
    setDuplicateAcknowledged(false);

    try {
      const imagePayload = photoFile ? { data: await fileToBase64(photoFile), mimeType: photoFile.type } : undefined;
      const result = await analyzeIssue({
        description: description.trim(),
        organization: organizationName || qr.name,
        location: locationName || "",
        childLocations: childLocations.map((loc) => ({ id: loc.id, name: loc.name })),
        image: imagePayload,
      });

      // Apply transparent priority rules — override AI if rule-based priority is higher
      const rulePriority = applyPriorityRules(description);
      if (rulePriority) {
        // Only escalate, never downgrade based on rules
        const priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
        const rulePriorityNum = priorityOrder[rulePriority.priority];
        const aiPriorityNum = priorityOrder[result.priority];
        if (rulePriorityNum < aiPriorityNum) {
          result.priority = rulePriority.priority;
          result.severity = rulePriority.severity;
        }
      }

      setAiResult(result);

      // Flag low confidence for admin review
      if (result.confidence < AI_CONFIDENCE_THRESHOLD) {
        setLowConfidenceWarning(true);
      } else {
        setLowConfidenceWarning(false);
        setUseManual(false);
      }
    } catch {
      setAiError("AI analysis is temporarily unavailable. Please fill in the details manually.");
      setUseManual(true);
    } finally {
      setAiLoading(false);
    }

    // Run duplicate check in parallel (non-blocking)
    if (qr && description.trim()) {
      setDuplicateCheckLoading(true);
      try {
        const response = await fetch("/api/detect-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            qrId,
            description: description.trim(),
            organizationId: qr.organizationId,
          }),
        });
        if (response.ok) {
          const data = await response.json();
          setDuplicateResult(data);
        }
      } catch {
        // Duplicate check failure is non-critical
        console.warn("[Duplicate Check] Failed");
      } finally {
        setDuplicateCheckLoading(false);
      }
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
    let needsAdminReview = false;

    if (!useManual && aiResult) {
      finalCategory = aiResult.category;
      finalArea = aiResult.reportedArea || manualArea;
      finalSeverity = aiResult.severity;
      finalSummary = aiResult.summary || description.trim();
      finalSuggestedAction = aiResult.suggestedAction;
      finalConfidence = aiResult.confidence || 0;
      finalTitle = aiResult.title || description.trim().slice(0, 80);
      needsAdminReview = finalConfidence < AI_CONFIDENCE_THRESHOLD;
    }

    setSubmitting(true);
    setUploadError(null);

    try {
      const newTicketId = generateTicketId();
      const newTrackingToken = generateTrackingToken();
      let photoUrl: string | undefined;
      const normalizedPhone = normalizePhoneNumber(phoneNumber);

      if (photoFile) {
        try {
          photoUrl = await uploadTicketPhoto(photoFile, newTicketId);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown upload error";
          console.error("[Ticket Submit] photo upload failed", { message: msg });
          setUploadError(
            "Photo upload failed — " + msg + ". You can remove the photo and submit without it, or try again.",
          );
          setSubmitting(false);
          return;
        }
      }

      // Run anomaly detection (advisory — never blocks)
      let detectedFlags: AnomalyFlag[] = [];
      try {
        const anomalyResult = await detectAnomalies({
          qrId: qrId || "",
          organizationId: qr.organizationId,
          description: description.trim(),
          phoneNumber: normalizedPhone || undefined,
        });
        detectedFlags = anomalyResult.flags;
      } catch {
        // Anomaly detection failure never blocks submission
      }

      const finalPriority: string =
        finalSeverity === "CRITICAL" ? "P1" :
        finalSeverity === "HIGH" ? "P2" :
        finalSeverity === "MEDIUM" ? "P3" : "P4";

      const estimatedResolution = getEstimateString(
        finalPriority as import("@/types").TicketPriority,
        finalSeverity as import("@/types").TicketSeverity,
        "OPEN",
      );

      // Determine routing
      const routingDecision = finalConfidence >= AI_CONFIDENCE_THRESHOLD && qr.department
        ? "AUTO"
        : "MANUAL_REVIEW";
      const routingReason = routingDecision === "AUTO"
        ? `Auto-routed: AI confidence ${Math.round(finalConfidence * 100)}% ≥ threshold (60%), department matched`
        : `Manual review required: AI confidence ${Math.round(finalConfidence * 100)}% < threshold (60%) or no department mapping`;

      const ticketData: Record<string, unknown> = {
        qrId: qrId || "",
        organizationId: qr.organizationId,
        locationId: qr.locationId,
        category: finalCategory,
        aiCategory: aiResult?.category || finalCategory,
        title: finalTitle,
        description: description.trim(),
        severity: finalSeverity,
        priority: finalPriority,
        status: "OPEN",
        aiSummary: finalSummary,
        aiConfidence: finalConfidence,
        trackingToken: newTrackingToken,
        estimatedResolutionMins: estimatedResolution.replace(" mins", ""),
        routingDecision,
        routingReason,
        needsAdminReview,
      };

      if (finalArea) ticketData.reportedArea = finalArea;
      if (finalSuggestedAction) ticketData.aiSuggestedAction = finalSuggestedAction;
      if (photoUrl) ticketData.photoUrl = photoUrl;
      if (normalizedPhone) ticketData.phoneNumber = normalizedPhone;
      if (qr.department) ticketData.department = qr.department;
      if (detectedFlags.length > 0) ticketData.anomalyFlags = detectedFlags;

      // Check for duplicate — link instead of blocking
      if (duplicateResult?.isDuplicate && duplicateResult.parentTicketId && duplicateAcknowledged) {
        ticketData.isDuplicate = true;
        ticketData.parentTicketId = duplicateResult.parentTicketId;
        ticketData.duplicateSimilarity = duplicateResult.matches?.[0]?.similarity;
      }

      await createTicket(ticketData as any, newTicketId);

      // Link to parent ticket if duplicate
      if (duplicateResult?.isDuplicate && duplicateResult.parentTicketId && duplicateAcknowledged) {
        try {
          await linkDuplicateTicket(newTicketId, duplicateResult.parentTicketId, duplicateResult.matches?.[0]?.similarity ?? 0);
        } catch (e) {
          console.warn("[Duplicate Link] Failed:", e);
        }
      }

      const appUrl = (import.meta.env.VITE_APP_URL || "").replace(/\/$/, "");
      const trackingUrl = `${appUrl}/track/${newTicketId}/${newTrackingToken}`;

      if (normalizedPhone) {
        try {
          const response = await fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumber: normalizedPhone,
              ticketId: newTicketId,
              type: "created",
              title: finalTitle,
              category: finalCategory,
              priority: finalPriority,
              status: "OPEN",
              estimatedResolution,
              trackingUrl,
            }),
          });
          if (!response.ok) {
            const text = await response.text();
            console.error("[Ticket Submit] WhatsApp API error", { status: response.status, body: text });
          } else {
            const json = await response.json();
            console.log("[Ticket Submit] WhatsApp sent", { messageSid: json.messageSid, warning: json.warning });
          }
        } catch (whatsappError) {
          console.error("[Ticket Submit] WhatsApp notification failed", whatsappError);
        }
      }

      setTrackingToken(newTrackingToken);
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
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="w-full max-w-sm space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="text-center">
              <div className="text-5xl mb-2">❌</div>
              <CardTitle className="text-xl text-white">QR Code Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-400 text-center">
                This QR code is invalid or inactive. Please scan a valid campus QR code.
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
    const appUrl = (import.meta.env.VITE_APP_URL || "").replace(/\/$/, "");
    const trackingUrl = trackingToken
      ? `${appUrl}/track/${ticketId}/${trackingToken}`
      : `${appUrl}/track/${ticketId}`;
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="w-full max-w-sm space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardHeader className="text-center pb-2">
              <div className="text-5xl mb-2">✅</div>
              <CardTitle className="text-xl text-white">Complaint Registered!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-slate-400 text-center">
                Your complaint has been registered with ticket ID:
              </p>
              <p className="text-center font-mono text-lg font-semibold tracking-wider text-blue-400">{ticketId}</p>
              <div className="rounded-md bg-slate-800 p-3 text-xs text-center text-slate-400 space-y-1">
                <p>Track your complaint anytime using the button below.</p>
                {phoneNumber && <p>A WhatsApp confirmation has been sent to your number.</p>}
                {duplicateResult?.isDuplicate && duplicateAcknowledged && (
                  <p className="text-yellow-400">⚠️ This was reported as a duplicate and linked to an existing ticket.</p>
                )}
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                size="lg"
                onClick={() => window.location.href = trackingUrl}
              >
                🔗 Track My Complaint
              </Button>
              <Button variant="outline" className="w-full border-slate-600 text-slate-300" onClick={() => window.location.href = "/"}>
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
    <div className="flex flex-col items-center justify-center min-h-screen px-4 py-8 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <div className="w-full max-w-sm space-y-4">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight text-white">🏛️ Campus Complaint System</h1>
          <p className="text-xs text-slate-400 mt-1">AI-Powered Issue Reporting</p>
        </div>

        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-lg">Report an Issue</CardTitle>
            <CardDescription className="space-y-1 text-slate-400">
              {organizationName && <p><span className="font-medium text-slate-300">Institute:</span> {organizationName}</p>}
              {locationName && <p><span className="font-medium text-slate-300">Location:</span> {locationName}</p>}
              {qr.department && <p><span className="font-medium text-slate-300">Department:</span> {qr.department}</p>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Description */}
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium text-slate-200">
                  Describe the issue <span className="text-red-400">*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  minLength={10}
                  maxLength={2000}
                  rows={4}
                  placeholder="Describe the problem clearly. Be specific about the exact location and nature of the issue..."
                  className="flex w-full rounded-md border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-slate-500"
                />
                <p className="text-xs text-slate-500">{description.length}/2000 characters</p>
                <p className="text-xs text-slate-400">
                  💡 Examples: "Exposed wiring in Lab 3", "Leaking tap in boys' hostel bathroom", "AC not working in Room 204"
                </p>
              </div>

              {/* Photo upload */}
              <div className="space-y-2">
                <label htmlFor="photo" className="text-sm font-medium text-slate-200">
                  Add a photo <span className="text-slate-500">(optional, max 5 MB)</span>
                </label>
                <input
                  id="photo"
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(e) => { setUploadError(null); handleFileChange(e); }}
                  className="flex w-full rounded-md border border-slate-600 bg-slate-800 text-slate-300 px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium"
                />
                {photoError && <p className="text-xs text-red-400">{photoError}</p>}
                {uploadError && (
                  <div className="rounded-md border border-red-500/50 bg-red-900/20 p-3 text-xs text-red-400 space-y-1">
                    <p>{uploadError}</p>
                    <button type="button" className="underline font-medium" onClick={() => { removePhoto(); setUploadError(null); }}>
                      Remove photo and continue without it
                    </button>
                  </div>
                )}
                {photoFile && photoPreview && (
                  <div className="space-y-2 rounded-md border border-slate-600 bg-slate-800/50 p-3">
                    <img src={photoPreview} alt="Preview" className="w-full h-40 object-cover rounded-md" />
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="truncate">{photoFile.name}</span>
                      <span>{formatFileSize(photoFile.size)}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" className="flex-1 border-slate-600 text-slate-300" onClick={removePhoto}>Remove</Button>
                      <Button type="button" variant="ghost" size="sm" className="flex-1 text-slate-300" onClick={() => fileInputRef.current?.click()}>Change</Button>
                    </div>
                  </div>
                )}
              </div>

              {/* WhatsApp */}
              <div className="space-y-2">
                <label htmlFor="phone" className="text-sm font-medium text-slate-200">
                  WhatsApp Number <span className="text-slate-500">(optional)</span>
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
                  className="flex w-full rounded-md border border-slate-600 bg-slate-800 text-slate-100 px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 placeholder:text-slate-500"
                />
                <div className="space-y-1 text-xs text-slate-500">
                  <p>Enter your WhatsApp number (with country code, e.g. +91XXXXXXXXXX) to receive ticket updates.</p>
                  <p>⚠️ First-time users must send <span className="font-mono font-semibold text-slate-400">join plenty-gave</span> to <span className="font-mono font-semibold text-slate-400">+1 415 523 8886</span> on WhatsApp to activate notifications.</p>
                </div>
                {phoneError && <p className="text-xs text-red-400">{phoneError}</p>}
              </div>

              {/* Analyze button */}
              {!aiResult && !useManual && (
                <Button
                  type="button"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  size="lg"
                  onClick={handleAnalyze}
                  disabled={aiLoading || !description.trim() || description.trim().length < 10}
                >
                  {aiLoading ? (
                    <><span className="animate-pulse">🤖</span> Analyzing your issue...</>
                  ) : (
                    <>🤖 Analyze & Submit</>
                  )}
                </Button>
              )}

              {aiError && (
                <div className="rounded-md border border-red-500/50 bg-red-900/20 p-3 text-xs text-red-400">
                  {aiError}
                </div>
              )}

              {/* Duplicate warning */}
              {duplicateResult?.isDuplicate && !duplicateAcknowledged && (
                <div className="rounded-md border border-yellow-500/50 bg-yellow-900/20 p-4 space-y-3">
                  <p className="text-sm font-semibold text-yellow-400">⚠️ Similar Issue Already Reported</p>
                  <p className="text-xs text-yellow-300">
                    A similar complaint has already been submitted at this location:
                  </p>
                  {duplicateResult.matches?.slice(0, 2).map((m) => (
                    <div key={m.ticketId} className="text-xs text-yellow-300 bg-yellow-900/30 rounded p-2">
                      <span className="font-mono font-bold">{m.ticketId}</span> — {m.title} ({Math.round(m.similarity * 100)}% similar)
                    </div>
                  ))}
                  <p className="text-xs text-yellow-300">Your report will be linked to the existing ticket to help prioritize it.</p>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white"
                      onClick={() => setDuplicateAcknowledged(true)}
                    >
                      ✅ Submit Anyway (Link to Existing)
                    </Button>
                  </div>
                </div>
              )}

              {/* Duplicate check loading */}
              {duplicateCheckLoading && (
                <div className="text-xs text-slate-400 text-center animate-pulse">
                  🔍 Checking for similar reports...
                </div>
              )}

              {/* AI Result */}
              {aiResult && !useManual && (duplicateResult === null || !duplicateResult.isDuplicate || duplicateAcknowledged) && (
                <div className="space-y-3 rounded-md border border-slate-600 bg-slate-800/50 p-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">🤖 AI Analysis</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${aiResult.confidence >= AI_CONFIDENCE_THRESHOLD ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                      {Math.round(aiResult.confidence * 100)}% confidence
                    </span>
                  </div>

                  {lowConfidenceWarning && (
                    <div className="rounded bg-yellow-900/20 border border-yellow-500/30 p-2 text-xs text-yellow-400">
                      ⚠️ Low confidence — this ticket will be flagged for manual admin review.
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                    <div><span className="font-medium text-slate-400">Title:</span> {aiResult.title}</div>
                    <div><span className="font-medium text-slate-400">Category:</span> {aiResult.category}</div>
                    <div><span className="font-medium text-slate-400">Severity:</span>
                      <span className={`ml-1 font-semibold ${aiResult.severity === 'HIGH' || aiResult.severity === 'CRITICAL' ? 'text-red-400' : aiResult.severity === 'MEDIUM' ? 'text-yellow-400' : 'text-green-400'}`}>
                        {aiResult.severity}
                      </span>
                    </div>
                    <div><span className="font-medium text-slate-400">Priority:</span>
                      <span className={`ml-1 font-semibold ${aiResult.priority === 'P1' || aiResult.priority === 'P2' ? 'text-red-400' : aiResult.priority === 'P3' ? 'text-yellow-400' : 'text-green-400'}`}>
                        {aiResult.priority}
                      </span>
                    </div>
                    {aiResult.reportedArea && (
                      <div className="col-span-2"><span className="font-medium text-slate-400">Area:</span> {aiResult.reportedArea}</div>
                    )}
                  </div>
                  <div className="text-xs space-y-1 text-slate-300">
                    <p><span className="font-medium text-slate-400">Summary:</span> {aiResult.summary}</p>
                    <p><span className="font-medium text-slate-400">Suggested action:</span> {aiResult.suggestedAction}</p>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="flex-1 border-slate-600 text-slate-300 text-xs" size="sm" onClick={() => { setUseManual(true); setLowConfidenceWarning(false); }}>
                      ✏️ Edit Manually
                    </Button>
                    <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700 text-xs" size="sm" disabled={submitting}>
                      {submitting ? "Submitting..." : "✅ Confirm & Submit"}
                    </Button>
                  </div>
                </div>
              )}

              {/* Manual form */}
              {useManual && (duplicateResult === null || !duplicateResult.isDuplicate || duplicateAcknowledged) && (
                <div className="space-y-3 rounded-md border border-slate-600 bg-slate-800/30 p-4">
                  <h3 className="text-sm font-semibold text-white">Manual Details</h3>
                  <div className="space-y-2">
                    <label htmlFor="manualCategory" className="text-sm font-medium text-slate-300">Category</label>
                    <select
                      id="manualCategory"
                      value={manualCategory}
                      onChange={(e) => setManualCategory(e.target.value as Category)}
                      className="flex h-9 w-full rounded-md border border-slate-600 bg-slate-800 text-slate-100 px-3 py-1 text-sm"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="manualArea" className="text-sm font-medium text-slate-300">Exact Area</label>
                    <input
                      id="manualArea"
                      value={manualArea}
                      onChange={(e) => setManualArea(e.target.value)}
                      placeholder="e.g. Room 204, Lab Block B, Boys Hostel Wing A"
                      className="flex h-9 w-full rounded-md border border-slate-600 bg-slate-800 text-slate-100 px-3 py-1 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="manualSeverity" className="text-sm font-medium text-slate-300">Severity</label>
                    <select
                      id="manualSeverity"
                      value={manualSeverity}
                      onChange={(e) => setManualSeverity(e.target.value as Severity)}
                      className="flex h-9 w-full rounded-md border border-slate-600 bg-slate-800 text-slate-100 px-3 py-1 text-sm"
                    >
                      <option value="LOW">🟢 Low (minor cosmetic/furniture issues)</option>
                      <option value="MEDIUM">🟡 Medium (broken equipment, leaks, failed lights)</option>
                      <option value="HIGH">🔴 High (exposed wiring, blocked exits, gas smell)</option>
                      <option value="CRITICAL">🚨 Critical (immediate safety hazard)</option>
                    </select>
                  </div>
                  {aiResult && (
                    <Button type="button" variant="ghost" size="sm" className="text-xs text-slate-400" onClick={() => { setUseManual(false); }}>
                      ← Use AI Result Instead
                    </Button>
                  )}
                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" size="lg" disabled={submitting || !description.trim() || description.trim().length < 10}>
                    {submitting ? "Submitting..." : "Submit Complaint"}
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-slate-600">
          Powered by AI Campus Complaint System · Your data is secure
        </p>
      </div>
    </div>
  );
}
