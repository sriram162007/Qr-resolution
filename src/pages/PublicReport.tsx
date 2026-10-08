import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
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
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import type { Location, AnomalyFlag } from "@/types";
import {
  MapPin,
  Building2,
  Camera,
  X,
  Loader2,
  Sparkles,
  CheckCircle2,
  Copy,
  Check,
  ArrowRight,
  ArrowLeft,
  AlertTriangle,
  Info,
  MessageSquare,
  SlidersHorizontal,
} from "lucide-react";

const CATEGORIES = [
  { value: "Electrical", label: "Electrical / Power" },
  { value: "Plumbing", label: "Plumbing & Water" },
  { value: "Cleaning", label: "Cleaning & Sanitation" },
  { value: "Civil", label: "Civil & Infrastructure" },
  { value: "Hostel", label: "Hostel & Residential" },
  { value: "Laboratory", label: "Laboratory & Equipment" },
  { value: "Other", label: "General Maintenance" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];
type Severity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

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
  const [manualArea, setManualArea] = useState("");
  const [manualSeverity, setManualSeverity] = useState<Severity>("MEDIUM");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState(false);

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
          department: data.department,
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
      setPhotoError("Please select a JPG, PNG, or WEBP image.");
      setPhotoFile(null);
      setPhotoPreview((prev) => { if (prev) URL.revokeObjectURL(prev); return null; });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setPhotoError("Image exceeds 5 MB. Please select a smaller photo.");
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
        const base64 = result.includes(",") ? result.split(",")[1] : result;
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

      const rulePriority = applyPriorityRules(description);
      if (rulePriority) {
        const priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
        const rulePriorityNum = priorityOrder[rulePriority.priority];
        const aiPriorityNum = priorityOrder[result.priority];
        if (rulePriorityNum < aiPriorityNum) {
          result.priority = rulePriority.priority;
          result.severity = rulePriority.severity;
        }
      }

      setAiResult(result);

      if (result.confidence < AI_CONFIDENCE_THRESHOLD) {
        setLowConfidenceWarning(true);
      } else {
        setLowConfidenceWarning(false);
        setUseManual(false);
      }
    } catch {
      setAiError("AI analysis service is momentarily busy. You can review details manually.");
      setUseManual(true);
    } finally {
      setAiLoading(false);
    }

    // Run duplicate check in background
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
        console.warn("[Duplicate Check] Non-fatal check error");
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
          const msg = err instanceof Error ? err.message : "Upload error";
          setUploadError(`Photo upload failed: ${msg}. You may submit without a photo or try again.`);
          setSubmitting(false);
          return;
        }
      }

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
        // Advisory anomaly check never blocks genuine submission
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

      const routingDecision = finalConfidence >= AI_CONFIDENCE_THRESHOLD && qr.department
        ? "AUTO"
        : "MANUAL_REVIEW";
      const routingReason = routingDecision === "AUTO"
        ? `Auto-routed: AI confidence ${Math.round(finalConfidence * 100)}% ≥ 60%, department mapped`
        : `Manual review: AI confidence ${Math.round(finalConfidence * 100)}% or department pending`;

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

      if (duplicateResult?.isDuplicate && duplicateResult.parentTicketId && duplicateAcknowledged) {
        ticketData.isDuplicate = true;
        ticketData.parentTicketId = duplicateResult.parentTicketId;
        ticketData.duplicateSimilarity = duplicateResult.matches?.[0]?.similarity;
      }

      await createTicket(ticketData as any, newTicketId);

      if (duplicateResult?.isDuplicate && duplicateResult.parentTicketId && duplicateAcknowledged) {
        try {
          await linkDuplicateTicket(newTicketId, duplicateResult.parentTicketId, duplicateResult.matches?.[0]?.similarity ?? 0);
        } catch (e) {
          console.warn("[Duplicate Link] Note:", e);
        }
      }

      setTicketId(newTicketId);
      setTrackingToken(newTrackingToken);

      if (normalizedPhone) {
        const appUrl = (import.meta.env.VITE_APP_URL || "").replace(/\/$/, "");
        const trackingUrl = `${appUrl}/track/${newTicketId}/${newTrackingToken}`;
        try {
          await fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumber: normalizedPhone,
              ticketId: newTicketId,
              type: "created",
              title: finalTitle,
              category: finalCategory,
              priority: finalPriority,
              estimatedResolution,
              trackingUrl,
            }),
          });
        } catch {
          // WhatsApp delivery non-blocking
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setAiError(`Failed to create ticket: ${message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyTicket = () => {
    if (!ticketId) return;
    navigator.clipboard.writeText(ticketId);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-black/10 shadow-xs flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#0071E3]" />
        </div>
        <p className="text-xs text-[#86868B] mt-3 font-medium">Loading facility details...</p>
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col items-center justify-center p-4">
        <Card className="max-w-md w-full border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-3xl p-8 text-center space-y-4 bg-white">
          <div className="w-14 h-14 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 mx-auto flex items-center justify-center text-[#FF3B30]">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Facility Tag Not Found</h1>
            <p className="text-sm text-[#6E6E73]">
              The facility code could not be verified in the campus database.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Return to Campus Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // ─── TICKET CREATED SUCCESS VIEW (iOS Pass Style) ───
  if (ticketId) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
        <div className="max-w-md w-full mx-auto pt-4 pb-12">
          {/* iOS Success Card */}
          <Card className="border border-black/[0.08] shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-3xl overflow-hidden bg-white">
            <div className="p-8 text-center space-y-6">
              <div className="w-16 h-16 rounded-full bg-[#EAF8EE] border border-[#C3ECD1] mx-auto flex items-center justify-center text-[#1B873F] shadow-xs">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <Badge variant="success" className="px-3 py-1 text-xs">
                  Complaint Registered
                </Badge>
                <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] pt-1">
                  Ticket Generated
                </h1>
                <p className="text-sm text-[#6E6E73]">
                  Your report has been dispatched to the campus facility operations team.
                </p>
              </div>

              {/* Ticket Pass Pill */}
              <div className="bg-[#F5F5F7] border border-black/[0.06] rounded-2xl p-4 flex items-center justify-between">
                <div className="text-left">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                    Ticket Reference
                  </div>
                  <div className="font-mono text-lg font-bold text-[#1D1D1F]">
                    {ticketId}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyTicket}
                  className="h-9 px-3 text-xs rounded-xl flex items-center gap-1.5 border-black/10 bg-white"
                >
                  {copiedToken ? <Check className="w-3.5 h-3.5 text-[#1B873F]" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedToken ? "Copied" : "Copy"}
                </Button>
              </div>

              {/* Status details */}
              <div className="text-xs text-[#6E6E73] bg-[#FBFBFD] border border-black/[0.04] rounded-xl p-3.5 text-left space-y-2">
                <div className="flex items-center gap-2 text-[#1D1D1F] font-medium">
                  <MapPin className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span>{locationName || qr.name}</span>
                </div>
                {phoneNumber && (
                  <div className="flex items-center gap-2 text-[#1B873F]">
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp updates sent to {phoneNumber}</span>
                  </div>
                )}
                {duplicateResult?.isDuplicate && duplicateAcknowledged && (
                  <div className="flex items-center gap-2 text-[#B25E00]">
                    <Info className="w-3.5 h-3.5" />
                    <span>Linked with open ticket #{duplicateResult.parentTicketId}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2.5 pt-2">
                <Button
                  className="w-full h-12 text-sm font-semibold rounded-2xl shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center justify-center gap-2"
                  onClick={() => navigate(`/track/${ticketId}${trackingToken ? `/${trackingToken}` : ""}`)}
                >
                  Track Ticket Progress
                  <ArrowRight className="w-4 h-4" />
                </Button>

                <Button
                  variant="outline"
                  className="w-full h-11 text-xs font-medium rounded-xl"
                  onClick={() => {
                    setTicketId(null);
                    setTrackingToken(null);
                    setDescription("");
                    setPhotoFile(null);
                    setPhotoPreview(null);
                    setAiResult(null);
                    setDuplicateResult(null);
                    setDuplicateAcknowledged(false);
                  }}
                >
                  Submit Another Report
                </Button>
              </div>
            </div>
          </Card>
        </div>
        <div className="text-center text-xs text-[#86868B] pb-2">
          Campus Pulse • Real-Time SLA Monitoring Active
        </div>
      </div>
    );
  }

  // ─── MAIN REPORTING FORM VIEW ───
  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-black/[0.06]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Cancel
          </Link>
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
              New Complaint
            </span>
          </div>
          <span className="text-xs font-mono font-medium text-[#0071E3] bg-[#0071E3]/10 px-2.5 py-1 rounded-full">
            {qrId}
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* Verified Facility Card */}
        <div className="bg-white border border-black/[0.08] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1D1D1F] truncate">{qr.name}</span>
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#1B873F] bg-[#EAF8EE] px-2 py-0.5 rounded-full border border-[#C3ECD1]">
                <span className="w-1 h-1 rounded-full bg-[#34C759]" />
                Verified
              </span>
            </div>
            <p className="text-xs text-[#6E6E73] truncate mt-0.5">
              {locationName || "Campus Facility Area"}
            </p>
            {qr.department && (
              <p className="text-[11px] text-[#86868B] mt-1">
                Mapped Department: <span className="font-medium text-[#1D1D1F]">{qr.department}</span>
              </p>
            )}
          </div>
        </div>

        {/* Reporting Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section: Description */}
          <div className="bg-white border border-black/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <div className="flex items-center justify-between">
              <label htmlFor="description" className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Issue Description <span className="text-[#FF3B30]">*</span>
              </label>
              <span className="text-[11px] text-[#86868B]">
                {description.length}/2000
              </span>
            </div>

            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={10}
              maxLength={2000}
              placeholder="Describe what is broken or malfunctioning with as much detail as possible..."
              className="min-h-[110px]"
            />

            {/* Quick Inspiration Pills */}
            <div className="pt-1 flex flex-wrap gap-1.5 items-center">
              <span className="text-[11px] text-[#86868B] mr-1">Suggestions:</span>
              {[
                "Water leak / Tap broken",
                "Exposed wiring / Sparking",
                "AC not cooling",
                "Ceiling light flickering",
              ].map((chip) => (
                <button
                  type="button"
                  key={chip}
                  onClick={() => setDescription((prev) => (prev ? `${prev}. ${chip}` : chip))}
                  className="text-[11px] px-2.5 py-1 rounded-lg bg-[#F5F5F7] hover:bg-[#EAEAEA] text-[#6E6E73] hover:text-[#1D1D1F] border border-black/[0.04] transition-colors"
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>

          {/* Section: Photo Attachment */}
          <div className="bg-white border border-black/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Visual Evidence <span className="text-[#86868B] font-normal">(Optional, max 5 MB)</span>
              </label>
              {photoFile && (
                <span className="text-[11px] text-[#86868B]">
                  {(photoFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
            </div>

            <input
              id="photo"
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => {
                setUploadError(null);
                handleFileChange(e);
              }}
              className="hidden"
            />

            {!photoPreview ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-6 px-4 rounded-xl border border-dashed border-black/15 hover:border-[#0071E3]/50 bg-[#FBFBFD] hover:bg-[#F5F5F7] transition-all flex flex-col items-center justify-center gap-2 group cursor-pointer"
              >
                <div className="w-10 h-10 rounded-full bg-white border border-black/[0.08] flex items-center justify-center text-[#6E6E73] group-hover:text-[#0071E3] transition-colors shadow-2xs">
                  <Camera className="w-5 h-5" />
                </div>
                <div className="text-xs font-medium text-[#1D1D1F]">
                  Take a photo or upload from library
                </div>
                <div className="text-[11px] text-[#86868B]">
                  Supports JPG, PNG, WEBP for multimodal AI analysis
                </div>
              </button>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-xl overflow-hidden border border-black/10 bg-black/5 aspect-video max-h-56">
                  <img src={photoPreview} alt="Issue preview" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={removePhoto}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center justify-between text-xs text-[#6E6E73] px-1">
                  <span className="truncate max-w-[200px]">{photoFile?.name}</span>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[#0071E3] hover:underline font-medium"
                  >
                    Replace Photo
                  </button>
                </div>
              </div>
            )}

            {photoError && (
              <p className="text-xs text-[#FF3B30] flex items-center gap-1.5 pt-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {photoError}
              </p>
            )}
            {uploadError && (
              <div className="rounded-xl border border-[#FF3B30]/20 bg-[#FEECEC] p-3 text-xs text-[#D70015]">
                {uploadError}
              </div>
            )}
          </div>

          {/* Section: WhatsApp Updates */}
          <div className="bg-white border border-black/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-2">
            <label htmlFor="phone" className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
              WhatsApp Notification <span className="text-[#86868B] font-normal">(Optional)</span>
            </label>
            <Input
              id="phone"
              type="tel"
              value={phoneNumber}
              onChange={(e) => {
                setPhoneNumber(e.target.value);
                if (phoneError) setPhoneError(null);
              }}
              placeholder="+91 98765 43210"
              className="h-11"
            />
            <p className="text-[11px] text-[#86868B] leading-relaxed">
              Receive status changes, staff resolution photos, and verification prompts directly on WhatsApp.
            </p>
            {phoneError && (
              <p className="text-xs text-[#FF3B30] flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                {phoneError}
              </p>
            )}
          </div>

          {/* ─── Duplicate Match Notice ─── */}
          {duplicateResult?.isDuplicate && !duplicateAcknowledged && (
            <div className="bg-[#FFF8E6] border border-[#FFE7A8] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#B25E00] font-semibold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Similar Active Report Found</span>
              </div>
              <p className="text-xs text-[#8A4800] leading-relaxed">
                Another student recently submitted an issue at this location. Submitting will link your report so you receive all updates and help prioritize the ticket.
              </p>
              {duplicateResult.matches?.slice(0, 2).map((m) => (
                <div key={m.ticketId} className="bg-white/80 rounded-xl p-2.5 text-xs border border-[#FFD880] flex items-center justify-between">
                  <div>
                    <span className="font-mono font-bold text-[#1D1D1F] mr-1.5">{m.ticketId}</span>
                    <span className="text-[#6E6E73]">{m.title}</span>
                  </div>
                  <span className="text-[11px] font-semibold text-[#B25E00]">
                    {Math.round(m.similarity * 100)}% match
                  </span>
                </div>
              ))}
              <Button
                type="button"
                className="w-full h-10 bg-[#B25E00] hover:bg-[#974E00] text-white text-xs font-semibold rounded-xl"
                onClick={() => setDuplicateAcknowledged(true)}
              >
                Link to Existing Ticket & Continue
              </Button>
            </div>
          )}

          {duplicateCheckLoading && (
            <div className="text-center text-xs text-[#86868B] flex items-center justify-center gap-2 py-1">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[#0071E3]" />
              Checking facility history for related reports...
            </div>
          )}

          {/* ─── AI Analysis Action & Result ─── */}
          {!aiResult && !useManual && (
            <div className="pt-2">
              <Button
                type="button"
                className="w-full h-12 text-sm font-semibold rounded-2xl shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center justify-center gap-2"
                onClick={handleAnalyze}
                disabled={aiLoading || !description.trim() || description.trim().length < 10}
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Analyzing with Multimodal AI...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Analyze & Review Issue
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] text-[#86868B] mt-2">
                Gemini will inspect your photo and text to recommend category, severity, and resolution SLA.
              </p>
            </div>
          )}

          {aiError && (
            <div className="rounded-xl border border-black/10 bg-[#F5F5F7] p-3 text-xs text-[#6E6E73] flex items-start gap-2">
              <Info className="w-4 h-4 text-[#0071E3] shrink-0 mt-0.5" />
              <span>{aiError}</span>
            </div>
          )}

          {/* ─── AI Verified Assessment Card ─── */}
          {aiResult && !useManual && (duplicateResult === null || !duplicateResult.isDuplicate || duplicateAcknowledged) && (
            <div className="bg-white border border-[#0071E3]/25 rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,113,227,0.06)] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#1D1D1F]">AI Assessment</h3>
                    <div className="text-[10px] text-[#86868B]">Google Gemini 2.5 Flash</div>
                  </div>
                </div>
                <Badge
                  variant={aiResult.confidence >= AI_CONFIDENCE_THRESHOLD ? "success" : "warning"}
                  className="text-[11px]"
                >
                  {Math.round(aiResult.confidence * 100)}% Confidence
                </Badge>
              </div>

              {lowConfidenceWarning && (
                <div className="rounded-xl bg-[#FFF8E6] border border-[#FFE7A8] p-3 text-xs text-[#B25E00] flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>Lower confidence detected. This issue will be flagged for senior administrator review.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-[#F5F5F7] p-3 rounded-xl border border-black/[0.04]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Category</div>
                  <div className="font-semibold text-[#1D1D1F] mt-0.5">{aiResult.category}</div>
                </div>

                <div className="bg-[#F5F5F7] p-3 rounded-xl border border-black/[0.04]">
                  <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Priority & SLA</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`font-bold ${
                      aiResult.priority === "P1" || aiResult.priority === "P2" ? "text-[#D70015]" :
                      aiResult.priority === "P3" ? "text-[#B25E00]" : "text-[#1B873F]"
                    }`}>
                      {aiResult.priority}
                    </span>
                    <span className="text-[#86868B]">({aiResult.severity})</span>
                  </div>
                </div>

                {aiResult.reportedArea && (
                  <div className="col-span-2 bg-[#F5F5F7] p-3 rounded-xl border border-black/[0.04]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Sub-Location</div>
                    <div className="font-medium text-[#1D1D1F] mt-0.5">{aiResult.reportedArea}</div>
                  </div>
                )}
              </div>

              <div className="text-xs text-[#6E6E73] bg-[#FBFBFD] p-3 rounded-xl border border-black/[0.04] space-y-1">
                <div><span className="font-semibold text-[#1D1D1F]">Summary:</span> {aiResult.summary}</div>
                {aiResult.suggestedAction && (
                  <div><span className="font-semibold text-[#1D1D1F]">Suggested Action:</span> {aiResult.suggestedAction}</div>
                )}
              </div>

              <div className="flex gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 h-11 text-xs rounded-xl border-black/10"
                  onClick={() => {
                    setUseManual(true);
                    setLowConfidenceWarning(false);
                  }}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
                  Modify Manually
                </Button>
                <Button
                  type="submit"
                  className="flex-1 h-11 text-xs font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)]"
                  disabled={submitting}
                >
                  {submitting ? (
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Submitting...
                    </span>
                  ) : (
                    "Confirm & Submit"
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* ─── Manual Category & Severity Selector ─── */}
          {useManual && (duplicateResult === null || !duplicateResult.isDuplicate || duplicateAcknowledged) && (
            <div className="bg-white border border-black/[0.08] rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
                <h3 className="text-sm font-semibold text-[#1D1D1F]">Manual Details</h3>
                {aiResult && (
                  <button
                    type="button"
                    onClick={() => setUseManual(false)}
                    className="text-xs text-[#0071E3] hover:underline font-medium"
                  >
                    Restore AI Assessment
                  </button>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="manualCategory" className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Category
                </label>
                <select
                  id="manualCategory"
                  value={manualCategory}
                  onChange={(e) => setManualCategory(e.target.value as Category)}
                  className="w-full h-11 rounded-xl border border-black/10 bg-white px-3.5 text-sm text-[#1D1D1F] outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="manualArea" className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Specific Area or Room
                </label>
                <Input
                  id="manualArea"
                  value={manualArea}
                  onChange={(e) => setManualArea(e.target.value)}
                  placeholder="e.g. Room 204, South Wing, 3rd Floor"
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="manualSeverity" className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Severity Rating
                </label>
                <select
                  id="manualSeverity"
                  value={manualSeverity}
                  onChange={(e) => setManualSeverity(e.target.value as Severity)}
                  className="w-full h-11 rounded-xl border border-black/10 bg-white px-3.5 text-sm text-[#1D1D1F] outline-none focus:border-[#0071E3] focus:ring-4 focus:ring-[#0071E3]/10"
                >
                  <option value="LOW">Low (Cosmetic, furniture, minor aesthetics)</option>
                  <option value="MEDIUM">Medium (Failed lights, water tap leak, fan not working)</option>
                  <option value="HIGH">High (Sparks, exposed wiring, gas smell, water near power)</option>
                  <option value="CRITICAL">Critical (Immediate safety or structural hazard)</option>
                </select>
              </div>

              <Button
                type="submit"
                className="w-full h-12 text-sm font-semibold rounded-2xl shadow-[0_2px_8px_rgba(0,113,227,0.25)] mt-2"
                disabled={submitting || !description.trim() || description.trim().length < 10}
              >
                {submitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting Complaint...
                  </span>
                ) : (
                  "Submit Complaint"
                )}
              </Button>
            </div>
          )}
        </form>
      </main>

      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Smart Facility Resolution System
      </footer>
    </div>
  );
}
