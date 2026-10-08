import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTicket, getTicketActivities, updateTicketDetail } from "@/services/ticketService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { getUsers } from "@/services/ticketService";
import { suggestResolution } from "@/services/aiResolutionService";
import { buildChangeList, normalizePhoneNumber } from "@/services/whatsappService";
import { uploadResolutionPhoto } from "@/services/supabaseService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, X, Loader2, Sparkles, Copy, Check, AlertTriangle, Upload, ExternalLink } from "lucide-react";
import { getEstimateString } from "@/lib/resolutionEstimate";
import { CAMPUS_CATEGORIES } from "@/types";
import type { Ticket, TicketStatus, TicketPriority, TicketSeverity, TicketActivity } from "@/types";

const STATUSES: TicketStatus[] = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "VERIFIED", "CLOSED", "REOPENED"];
const PRIORITIES: TicketPriority[] = ["P1", "P2", "P3", "P4"];
const SEVERITIES: TicketSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const STATUS_STEPS: TicketStatus[] = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "VERIFIED"];

function activityIcon(type: string): string {
  switch (type) {
    case "created": return "📥";
    case "status": return "🔄";
    case "assignment": return "👨‍💻";
    case "resolution": return "✅";
    case "evidence": return "📷";
    case "activity_update": return "📝";
    case "escalation": return "⚠️";
    case "duplicate": return "🔗";
    case "duplicate_link": return "🔗";
    case "ai_override": return "🤖";
    case "priority_override": return "🔴";
    case "routing": return "🗺️";
    case "verification": return "✅";
    case "reopened": return "🔄";
    default: return "📋";
  }
}

export default function AdminTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const [status, setStatus] = useState<TicketStatus | "">("");
  const [priority, setPriority] = useState<TicketPriority | "">("");
  const [severity, setSeverity] = useState<TicketSeverity | "">("");
  const [category, setCategory] = useState("");
  const [department, setDepartment] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");
  const [currentActivity, setCurrentActivity] = useState("");
  const [estimatedResolutionMins, setEstimatedResolutionMins] = useState("");
  const [adminOverrideReason, setAdminOverrideReason] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  // Resolution evidence photo
  const resolutionPhotoRef = useRef<HTMLInputElement>(null);
  const [resolutionPhotoFile, setResolutionPhotoFile] = useState<File | null>(null);
  const [resolutionPhotoPreview, setResolutionPhotoPreview] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);

  const [users, setUsers] = useState<Array<{ id: string; email: string | null }>>([]);
  const [activities, setActivities] = useState<TicketActivity[]>([]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    likelyCause: string;
    recommendedAction: string;
    requiredTeam: string;
    estimatedUrgency: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    resolutionSteps: string[];
    safetyNote: string;
  } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    async function doLoad() {
      if (!ticketId) return;
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const data = await getTicket(ticketId);
        if (!cancelled) {
          if (!data) {
            setError("Ticket not found");
            return;
          }
          setTicket(data);
          setStatus(data.status);
          setPriority(data.priority);
          setSeverity(data.severity);
          setCategory(data.category || "");
          setDepartment(data.department || "");
          setAssignedTo(data.assignedTo || "");
          setAssignedToName(data.assignedToName || "");
          setResolutionNotes(data.resolutionNotes || "");
          setResolutionSummary(data.resolutionSummary || "");
          setCurrentActivity(data.currentActivity || "");
          setEstimatedResolutionMins(data.estimatedResolutionMins || "");
          setAdminOverrideReason(data.adminOverrideReason || "");
          const loc = await getLocation(data.locationId);
          if (loc) setLocationName(getLocationPath([loc], loc.id));
        }
      } catch {
        if (!cancelled) setError("Failed to load ticket");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    doLoad();
    return () => { cancelled = true; };
  }, [ticketId]);

  useEffect(() => {
    let cancelled = false;
    async function doLoadUsers() {
      try {
        const list = await getUsers();
        if (!cancelled) setUsers(list);
      } catch {
        if (!cancelled) setUsers([]);
      }
    }
    doLoadUsers();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ticketId) return;
    let cancelled = false;
    async function doLoadActivities() {
      if (!ticketId) return;
      try {
        const list = await getTicketActivities(ticketId);
        if (!cancelled) setActivities(list);
      } catch {
        if (!cancelled) setActivities([]);
      }
    }
    doLoadActivities();
    return () => { cancelled = true; };
  }, [ticketId]);

  useEffect(() => {
    return () => {
      if (resolutionPhotoPreview) URL.revokeObjectURL(resolutionPhotoPreview);
    };
  }, [resolutionPhotoPreview]);

  const handleResolutionPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setPhotoUploadError(null);
    if (!file) { setResolutionPhotoFile(null); setResolutionPhotoPreview(null); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoUploadError("Invalid file type. JPG, PNG, or WEBP only.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoUploadError("File is too large. Maximum 5 MB.");
      return;
    }
    setResolutionPhotoFile(file);
    setResolutionPhotoPreview(URL.createObjectURL(file));
  };

  const handleUploadResolutionPhoto = async () => {
    if (!resolutionPhotoFile || !ticket || !ticketId) return;
    setPhotoUploading(true);
    setPhotoUploadError(null);
    try {
      const url = await uploadResolutionPhoto(resolutionPhotoFile, ticketId);
      const actor = { id: user?.email || undefined, name: user?.email || undefined };
      await updateTicketDetail(ticket.id, { resolutionPhotoUrl: url }, actor);
      setSuccess("Resolution photo uploaded successfully.");
      setResolutionPhotoFile(null);
      setResolutionPhotoPreview(null);
      if (resolutionPhotoRef.current) resolutionPhotoRef.current.value = "";
      const data = await getTicket(ticketId);
      if (data) setTicket(data);
      const acts = await getTicketActivities(ticketId);
      setActivities(acts);
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !ticketId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const oldTicket = { ...ticket } as Record<string, unknown>;
      const previousStatus = ticket.status;
      const actor = { id: user?.email || undefined, name: user?.email || undefined };

      const isOverride = category !== ticket.category || priority !== ticket.priority;

      await updateTicketDetail(ticket.id, {
        status: status || undefined,
        priority: priority || undefined,
        severity: severity || undefined,
        category: category || undefined,
        department: department || undefined,
        assignedTo: assignedTo || undefined,
        assignedToName: assignedToName || undefined,
        resolutionNotes: resolutionNotes || undefined,
        resolutionSummary: resolutionSummary || undefined,
        currentActivity: currentActivity || undefined,
        estimatedResolutionMins: estimatedResolutionMins || undefined,
        adminOverride: isOverride || undefined,
        adminOverrideReason: isOverride && adminOverrideReason ? adminOverrideReason : undefined,
      }, actor);

      setSuccess("Ticket updated successfully");
      const data = await getTicket(ticketId);
      if (data) {
        setTicket(data);
        setStatus(data.status);
        setPriority(data.priority);
        setSeverity(data.severity);
        setCategory(data.category || "");
        setDepartment(data.department || "");
        setAssignedTo(data.assignedTo || "");
        setAssignedToName(data.assignedToName || "");
        setResolutionNotes(data.resolutionNotes || "");
        setResolutionSummary(data.resolutionSummary || "");
        setCurrentActivity(data.currentActivity || "");
        setEstimatedResolutionMins(data.estimatedResolutionMins || "");

        const newStatus = data.status;
        const changes = buildChangeList(oldTicket, data);
        const statusChanged = previousStatus !== newStatus;
        const normalizedPhone = normalizePhoneNumber(data.phoneNumber || "");
        const appUrl = (import.meta.env.VITE_APP_URL || "").replace(/\/$/, "");
        const trackingUrl = data.trackingToken
          ? `${appUrl}/track/${data.ticketId}/${data.trackingToken}`
          : `${appUrl}/track/${data.ticketId}`;
        const estimatedResolution = getEstimateString(
          data.priority, data.severity, data.status, data.estimatedResolutionMins,
        );

        if ((statusChanged || changes.length > 0) && normalizedPhone) {
          const payload: Record<string, unknown> = {
            phoneNumber: normalizedPhone,
            ticketId: data.ticketId,
            type: statusChanged ? "status_changed" : "updated",
            status: newStatus,
            changes: changes.length > 0 ? changes : undefined,
            resolutionNotes: data.resolutionNotes,
            assignedToName: data.assignedToName,
            estimatedResolution,
            trackingUrl,
            resolvedInMins: data.resolvedInMins,
            currentActivity: data.currentActivity,
          };
          fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }).then((response) => {
            if (!response.ok) {
              response.text().then((text) => {
                console.error("[Ticket Update] WhatsApp API error", { status: response.status, body: text });
              });
            } else {
              response.json().then((json) => {
                console.log("[Ticket Update] WhatsApp sent", { messageSid: json.messageSid });
              });
            }
          }).catch((whatsappError) => {
            console.error("[Ticket Update] WhatsApp notification failed", whatsappError);
          });
        }
      }
      const acts = await getTicketActivities(ticketId);
      setActivities(acts);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!ticket) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const result = await suggestResolution({
        title: ticket.title,
        description: ticket.description,
        category: ticket.category,
        subcategory: ticket.subcategory,
        reportedArea: ticket.reportedArea,
        severity: ticket.severity,
        priority: ticket.priority,
        aiSummary: ticket.aiSummary,
        aiSuggestedAction: ticket.aiSuggestedAction,
      });
      setAiSuggestion(result);
    } catch {
      setAiError("Resolution assistant is temporarily unavailable.");
    } finally {
      setAiLoading(false);
    }
  };

  const useSuggestedAction = () => {
    if (!aiSuggestion) return;
    setResolutionSummary(aiSuggestion.recommendedAction);
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-6 text-center">
              <p className="text-sm text-slate-400">{error || "The requested ticket does not exist."}</p>
              <Button className="mt-4" variant="outline" onClick={() => navigate("/admin/tickets")}>
                Back to Tickets
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentStatusIndex = STATUS_STEPS.indexOf(ticket.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50">
        <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tickets")} className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-bold tracking-tight font-mono text-white">{ticket.ticketId}</h1>
              <p className="text-xs text-slate-400">Ticket Details</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {ticket.slaBreached && (
                <span className="text-xs bg-orange-900/50 text-orange-400 border border-orange-500/30 px-2 py-1 rounded-full">⚠️ SLA Breached</span>
              )}
              {ticket.isDuplicate && (
                <span className="text-xs bg-indigo-900/50 text-indigo-400 border border-indigo-500/30 px-2 py-1 rounded-full">🔗 Duplicate</span>
              )}
              {(ticket.anomalyFlags?.length ?? 0) > 0 && (
                <span className="text-xs bg-purple-900/50 text-purple-400 border border-purple-500/30 px-2 py-1 rounded-full">⚠️ Anomaly</span>
              )}
              {(ticket as any).needsAdminReview && !ticket.adminOverride && (
                <span className="text-xs bg-yellow-900/50 text-yellow-400 border border-yellow-500/30 px-2 py-1 rounded-full">🔍 Needs Review</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {error && (
          <div className="mb-4 rounded-md border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
        )}
        {success && (
          <div className="mb-4 rounded-md border border-green-500/30 bg-green-900/20 p-3 text-sm text-green-400">{success}</div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            {/* Issue Details */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Issue</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h3 className="font-semibold text-lg text-white">{ticket.title}</h3>
                  <p className="text-sm text-slate-400 mt-1 whitespace-pre-wrap">{ticket.description}</p>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="text-slate-300"><span className="font-medium text-slate-400">Category:</span> {ticket.category}</div>
                  {ticket.subcategory && (
                    <div className="text-slate-300"><span className="font-medium text-slate-400">Subcategory:</span> {ticket.subcategory}</div>
                  )}
                  {ticket.reportedArea && (
                    <div className="col-span-2 text-slate-300"><span className="font-medium text-slate-400">Reported Area:</span> {ticket.reportedArea}</div>
                  )}
                  {ticket.department && (
                    <div className="text-slate-300"><span className="font-medium text-slate-400">Department:</span> {ticket.department}</div>
                  )}
                  <div className="col-span-2 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-500" />
                    <span className="text-slate-400 text-xs">{locationName || ticket.locationId}</span>
                  </div>
                  {ticket.photoUrl && (
                    <div className="col-span-2">
                      <span className="font-medium text-slate-400 text-sm">Issue Photo</span>
                      <div className="mt-2">
                        <img
                          src={ticket.photoUrl}
                          alt="Issue photo"
                          className="max-h-48 w-full rounded-md border border-slate-700 object-cover cursor-pointer"
                          onClick={() => setLightbox(ticket.photoUrl!)}
                        />
                      </div>
                    </div>
                  )}
                  {ticket.resolutionPhotoUrl && (
                    <div className="col-span-2">
                      <span className="font-medium text-slate-400 text-sm">Resolution Evidence</span>
                      <div className="mt-2">
                        <img
                          src={ticket.resolutionPhotoUrl}
                          alt="Resolution evidence"
                          className="max-h-48 w-full rounded-md border border-green-500/30 object-cover cursor-pointer"
                          onClick={() => setLightbox(ticket.resolutionPhotoUrl!)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Routing & Duplicate Info */}
            {(ticket.routingDecision || ticket.isDuplicate || ticket.parentTicketId) && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">Routing & Duplicate Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {ticket.routingDecision && (
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ticket.routingDecision === 'AUTO' ? 'bg-green-900/50 text-green-400' : 'bg-yellow-900/50 text-yellow-400'}`}>
                        {ticket.routingDecision}
                      </span>
                      {ticket.routingReason && <span className="text-slate-400 text-xs">{ticket.routingReason}</span>}
                    </div>
                  )}
                  {ticket.isDuplicate && ticket.parentTicketId && (
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 text-xs">🔗 Duplicate of:</span>
                      <button
                        onClick={() => navigate(`/admin/tickets/${ticket.parentTicketId}`)}
                        className="font-mono text-blue-400 text-xs hover:text-blue-300 flex items-center gap-1"
                      >
                        {ticket.parentTicketId} <ExternalLink className="h-3 w-3" />
                      </button>
                      {ticket.duplicateSimilarity && (
                        <span className="text-slate-500 text-xs">({Math.round(ticket.duplicateSimilarity * 100)}% similar)</span>
                      )}
                    </div>
                  )}
                  {ticket.linkedTicketIds && ticket.linkedTicketIds.length > 0 && (
                    <div>
                      <p className="text-slate-400 text-xs mb-1">Linked reports ({ticket.linkedTicketIds.length}):</p>
                      <div className="flex flex-wrap gap-1">
                        {ticket.linkedTicketIds.map((lid) => (
                          <button key={lid} onClick={() => navigate(`/admin/tickets/${lid}`)} className="font-mono text-xs text-indigo-400 hover:text-indigo-300">
                            {lid}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Anomaly Flags (advisory) */}
            {(ticket.anomalyFlags?.length ?? 0) > 0 && (
              <Card className="bg-purple-900/10 border-purple-500/30">
                <CardHeader>
                  <CardTitle className="text-purple-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Anomaly Flags (Advisory Only)
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-xs text-slate-400">These are advisory flags only. The complaint should NOT be rejected solely based on these flags.</p>
                  {ticket.anomalyFlags!.map((flag, i) => (
                    <div key={i} className="rounded bg-purple-900/20 border border-purple-500/20 p-2">
                      <p className="text-xs font-semibold text-purple-300">{flag.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{flag.detail}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Escalations */}
            {(ticket.escalations?.length ?? 0) > 0 && (
              <Card className="bg-orange-900/10 border-orange-500/30">
                <CardHeader>
                  <CardTitle className="text-orange-400 text-sm">Escalation History</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {ticket.escalations!.map((esc, i) => (
                    <div key={i} className="rounded bg-orange-900/20 border border-orange-500/20 p-3">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${esc.level === 2 ? 'bg-red-900/50 text-red-400' : 'bg-orange-900/50 text-orange-400'}`}>
                          Level {esc.level}
                        </span>
                        <span className="text-xs text-slate-400">→ {esc.notifiedTo}</span>
                        <span className="text-xs text-slate-500 ml-auto">{new Date(esc.escalatedAt).toLocaleString()}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{esc.reason}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* AI Analysis */}
            {ticket.aiSummary && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <span>🤖 AI Analysis</span>
                    {ticket.adminOverride && (
                      <span className="text-xs bg-pink-900/50 text-pink-400 border border-pink-500/30 px-2 py-0.5 rounded-full">Admin Override Applied</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="text-slate-300"><span className="font-medium text-slate-400">AI Summary:</span> {ticket.aiSummary}</div>
                  {ticket.aiCategory && ticket.aiCategory !== ticket.category && (
                    <div className="text-slate-300"><span className="font-medium text-slate-400">AI Category (original):</span> <span className="line-through text-slate-500">{ticket.aiCategory}</span> → <span className="text-pink-400">{ticket.category}</span></div>
                  )}
                  {ticket.aiSuggestedAction && (
                    <div className="text-slate-300"><span className="font-medium text-slate-400">Suggested Action:</span> {ticket.aiSuggestedAction}</div>
                  )}
                  {typeof ticket.aiConfidence === "number" && (
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-400">Confidence:</span>
                      <span className={`text-sm font-bold ${ticket.aiConfidence >= 0.6 ? 'text-green-400' : 'text-yellow-400'}`}>
                        {Math.round(ticket.aiConfidence * 100)}%
                      </span>
                      {ticket.aiConfidence < 0.6 && (
                        <span className="text-xs text-yellow-400">⚠️ Low — manual review recommended</span>
                      )}
                    </div>
                  )}
                  {ticket.adminOverrideReason && (
                    <div className="text-slate-300"><span className="font-medium text-slate-400">Override Reason:</span> {ticket.adminOverrideReason}</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Student Feedback */}
            {ticket.studentFeedbackRating && (
              <Card className="bg-slate-900 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white text-sm">⭐ Student Feedback</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex">
                      {[1,2,3,4,5].map((s) => (
                        <span key={s} className={s <= ticket.studentFeedbackRating! ? "text-yellow-400" : "text-slate-600"}>★</span>
                      ))}
                    </div>
                    <span className="text-sm font-bold text-white">{ticket.studentFeedbackRating}/5</span>
                    {ticket.studentVerifiedAt && (
                      <span className="text-xs text-slate-500 ml-auto">{ticket.studentVerifiedAt?.toLocaleString()}</span>
                    )}
                  </div>
                  {ticket.studentFeedbackComment && (
                    <p className="text-sm text-slate-300 italic">"{ticket.studentFeedbackComment}"</p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Ticket Progress */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Ticket Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between overflow-x-auto">
                  {STATUS_STEPS.map((step, idx) => (
                    <div key={step} className="flex flex-1 items-center">
                      <div className="flex flex-col items-center">
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                            idx <= currentStatusIndex
                              ? "border-blue-500 bg-blue-500 text-white"
                              : "border-slate-600 text-slate-500"
                          }`}
                        >
                          {idx <= currentStatusIndex ? "✓" : idx + 1}
                        </div>
                        <span className="mt-1 text-[10px] text-slate-500 hidden sm:block text-center">{step.replace(/_/g, " ")}</span>
                      </div>
                      {idx < STATUS_STEPS.length - 1 && (
                        <div
                          className={`h-0.5 flex-1 mx-1 ${idx < currentStatusIndex ? "bg-blue-500" : "bg-slate-700"}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Activity Log */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Activity Log</CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <p className="text-sm text-slate-500">No activity yet.</p>
                ) : (
                  <div className="space-y-2">
                    {[...activities].reverse().map((a) => (
                      <div key={a.id} className="flex items-start justify-between gap-3 text-sm py-2 border-b border-slate-800 last:border-0">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className="flex-shrink-0 text-base">{activityIcon(a.type)}</span>
                          <div className="min-w-0">
                            <span className="text-slate-200 font-medium">{a.message}</span>
                            {a.changedByName && (
                              <span className="text-slate-500"> by {a.changedByName}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-xs text-slate-600 whitespace-nowrap flex-shrink-0">
                          {a.createdAt.toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Sidebar — Actions */}
          <div className="space-y-6">
            {/* Tracking Link */}
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-4">
                {ticket.trackingToken && (
                  <div className="mb-4 rounded-md border border-slate-700 bg-slate-800/50 p-3">
                    <p className="text-xs font-medium text-slate-400 mb-2">Student Tracking Link</p>
                    <div className="flex items-center gap-2">
                      <code className="text-xs flex-1 truncate text-slate-300">
                        {`${(import.meta.env.VITE_APP_URL || "").replace(/\/$/, "")}/track/${ticket.ticketId}/${ticket.trackingToken}`}
                      </code>
                      <button
                        type="button"
                        className="shrink-0 p-1 rounded hover:bg-slate-700 text-slate-400"
                        title="Copy link"
                        onClick={() => {
                          const appUrl = (import.meta.env.VITE_APP_URL || "").replace(/\/$/, "");
                          navigator.clipboard.writeText(`${appUrl}/track/${ticket.ticketId}/${ticket.trackingToken}`);
                          setCopySuccess(true);
                          setTimeout(() => setCopySuccess(false), 2000);
                        }}
                      >
                        {copySuccess ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                )}

                <form onSubmit={handleSave} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Status</label>
                    <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)} disabled={saving}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-slate-200 focus:bg-slate-700">
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Priority
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(admin override)</span>
                    </label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)} disabled={saving}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p} className="text-slate-200 focus:bg-slate-700">{p}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Severity</label>
                    <Select value={severity} onValueChange={(v) => setSeverity(v as TicketSeverity)} disabled={saving}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {SEVERITIES.map((s) => (
                          <SelectItem key={s} value={s} className="text-slate-200 focus:bg-slate-700">{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Category
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(admin override)</span>
                    </label>
                    <Select value={category} onValueChange={setCategory} disabled={saving}>
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        {CAMPUS_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c} className="text-slate-200 focus:bg-slate-700">{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Department</label>
                    <input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Electrical Department"
                      disabled={saving}
                      className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-200 px-3 py-1 text-sm"
                    />
                  </div>

                  {(category !== ticket.category || priority !== ticket.priority) && (
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-yellow-400">
                        ⚠️ Override Reason <span className="text-red-400">*</span>
                      </label>
                      <input
                        value={adminOverrideReason}
                        onChange={(e) => setAdminOverrideReason(e.target.value)}
                        placeholder="Reason for overriding AI classification..."
                        required
                        className="flex h-9 w-full rounded-md border border-yellow-500/30 bg-slate-800 text-slate-200 px-3 py-1 text-sm"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Assigned To</label>
                    <Select
                      value={assignedTo}
                      onValueChange={(v) => {
                        setAssignedTo(v);
                        const found = users.find((u) => u.id === v);
                        setAssignedToName(found?.email || "");
                      }}
                      disabled={saving}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-slate-200">
                        <SelectValue placeholder="Select staff" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700">
                        <SelectItem value="" className="text-slate-400 focus:bg-slate-700">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id} className="text-slate-200 focus:bg-slate-700">
                            {u.email || u.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Current Activity
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(shown to student)</span>
                    </label>
                    <Textarea
                      value={currentActivity}
                      onChange={(e) => setCurrentActivity(e.target.value)}
                      placeholder="e.g. Our electrician is inspecting the reported issue."
                      disabled={saving}
                      rows={2}
                      className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Estimated Resolution
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(range in mins, e.g. 20-30)</span>
                    </label>
                    <input
                      type="text"
                      value={estimatedResolutionMins}
                      onChange={(e) => setEstimatedResolutionMins(e.target.value)}
                      placeholder={ticket ? getEstimateString(ticket.priority, ticket.severity, (status || ticket.status) as TicketStatus) : "20-30"}
                      disabled={saving}
                      className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-800 text-slate-200 px-3 py-1 text-sm"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Resolution Notes
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(internal)</span>
                    </label>
                    <Textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Internal notes about resolution steps..."
                      disabled={saving}
                      rows={3}
                      className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">Resolution Summary
                      <span className="ml-1 text-[10px] font-normal text-slate-500">(shown to student)</span>
                    </label>
                    <Textarea
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Public-facing resolution summary..."
                      disabled={saving}
                      rows={3}
                      className="bg-slate-800 border-slate-700 text-slate-200 placeholder:text-slate-500"
                    />
                  </div>

                  <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700" disabled={saving}>
                    {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Changes
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Resolution Evidence Upload */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">📷 Resolution Evidence Photo</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-slate-400">Upload a photo showing the issue has been resolved. This will be shown to the student for verification.</p>
                {ticket.resolutionPhotoUrl ? (
                  <div className="space-y-2">
                    <img src={ticket.resolutionPhotoUrl} alt="Resolution evidence" className="w-full rounded-md max-h-32 object-cover border border-green-500/30" />
                    <p className="text-xs text-green-400">✅ Evidence photo uploaded</p>
                    <input
                      ref={resolutionPhotoRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleResolutionPhotoChange}
                      className="text-xs text-slate-400"
                    />
                  </div>
                ) : (
                  <input
                    ref={resolutionPhotoRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleResolutionPhotoChange}
                    className="w-full text-xs text-slate-400 border border-slate-700 rounded p-2 bg-slate-800"
                  />
                )}
                {resolutionPhotoPreview && (
                  <div className="space-y-2">
                    <img src={resolutionPhotoPreview} alt="Preview" className="w-full rounded-md max-h-32 object-cover" />
                    <Button
                      type="button"
                      className="w-full bg-green-700 hover:bg-green-600 text-xs"
                      onClick={handleUploadResolutionPhoto}
                      disabled={photoUploading}
                    >
                      {photoUploading ? <><Loader2 className="h-3 w-3 animate-spin mr-1" />Uploading...</> : <><Upload className="h-3 w-3 mr-1" />Upload Evidence</>}
                    </Button>
                  </div>
                )}
                {photoUploadError && <p className="text-xs text-red-400">{photoUploadError}</p>}
              </CardContent>
            </Card>

            {/* AI Resolution Assistant */}
            <Card className="bg-slate-900 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">🤖 AI Resolution Assistant</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300"
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                >
                  {aiLoading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing...</>
                  ) : (
                    <><Sparkles className="mr-2 h-4 w-4" />Generate Resolution Suggestion</>
                  )}
                </Button>
                {aiError && (
                  <div className="rounded-md border border-red-500/30 bg-red-900/20 p-3 text-xs text-red-400">{aiError}</div>
                )}
                {aiSuggestion && (
                  <div className="space-y-3 rounded-md border border-slate-700 bg-slate-800/50 p-4">
                    <div className="text-sm space-y-2 text-slate-300">
                      <div><span className="font-medium text-slate-400">Likely Cause:</span> {aiSuggestion.likelyCause}</div>
                      <div><span className="font-medium text-slate-400">Recommended Action:</span> {aiSuggestion.recommendedAction}</div>
                      <div><span className="font-medium text-slate-400">Required Team:</span> {aiSuggestion.requiredTeam}</div>
                      <div><span className="font-medium text-slate-400">Resolution Steps:</span>
                        <ul className="list-disc pl-4 mt-1 space-y-1 text-xs">
                          {aiSuggestion.resolutionSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                      {aiSuggestion.safetyNote && (
                        <div className="bg-yellow-900/20 border border-yellow-500/20 rounded p-2">
                          <span className="font-medium text-yellow-400">⚠️ Safety:</span> <span className="text-xs">{aiSuggestion.safetyNote}</span>
                        </div>
                      )}
                    </div>
                    <Button type="button" size="sm" className="w-full bg-blue-600 hover:bg-blue-700 text-xs" onClick={useSuggestedAction}>
                      Use Suggested Action
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Lightbox */}
        {lightbox && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setLightbox(null)}>
            <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
              <img src={lightbox} alt="Enlarged photo" className="max-h-[90vh] max-w-[90vw] rounded-md object-contain" />
              <button
                className="absolute -top-10 right-0 text-white hover:text-slate-300 p-2"
                onClick={() => setLightbox(null)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
