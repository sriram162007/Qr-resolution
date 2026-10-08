import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTicket, getTicketActivities, updateTicketDetail, getUsers } from "@/services/ticketService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { suggestResolution } from "@/services/aiResolutionService";
import { buildChangeList, normalizePhoneNumber } from "@/services/whatsappService";
import { uploadResolutionPhoto } from "@/services/supabaseService";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft,
  MapPin,
  X,
  Loader2,
  Sparkles,
  Copy,
  Check,
  AlertTriangle,
  Upload,
  ExternalLink,
  Clock,
  Star,
  LogOut,
  Camera,
  Image as ImageIcon,
  CheckCircle2,
} from "lucide-react";
import { getEstimateString } from "@/lib/resolutionEstimate";
import { CAMPUS_CATEGORIES } from "@/types";
import type { Ticket, TicketStatus, TicketPriority, TicketSeverity, TicketActivity } from "@/types";

const STATUSES: TicketStatus[] = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "VERIFIED", "CLOSED", "REOPENED"];
const PRIORITIES: TicketPriority[] = ["P1", "P2", "P3", "P4"];

const STATUS_STEPS: TicketStatus[] = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "VERIFIED"];

export default function AdminTicketDetail() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const navigate = useNavigate();
  const { user, authLoading, logout } = useAuth();
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
            setError("Ticket reference not found.");
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
        if (!cancelled) setError("Failed to load ticket details.");
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
    if (!file) {
      setResolutionPhotoFile(null);
      setResolutionPhotoPreview(null);
      return;
    }
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
      setSuccess("Resolution proof photo uploaded successfully.");
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

      setSuccess("Ticket saved and updated successfully.");
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
          }).catch((whatsappError) => {
            console.error("[Ticket Update] WhatsApp notification error", whatsappError);
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

  const handleCopyTicketId = () => {
    if (!ticket) return;
    navigator.clipboard.writeText(ticket.ticketId);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-black/10 shadow-xs flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-[#0071E3]" />
        </div>
        <p className="text-xs text-[#86868B] mt-3 font-medium">Opening ticket workspace...</p>
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-3xl p-8 text-center space-y-4 bg-white">
          <div className="w-14 h-14 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 mx-auto flex items-center justify-center text-[#FF3B30]">
            <AlertTriangle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Ticket Not Found</h1>
            <p className="text-sm text-[#6E6E73]">{error || "The requested ticket record does not exist."}</p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/admin/tickets">Back to Ticket Roster</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const currentStatusIndex = STATUS_STEPS.indexOf(ticket.status);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* ─── Apple Operations Navigation Bar ─── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/admin/tickets")}
              className="h-9 px-2 text-[#6E6E73] hover:text-[#1D1D1F] rounded-xl flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline text-xs font-medium">Tickets</span>
            </Button>

            <div className="h-4 w-px bg-black/10" />

            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-[#1D1D1F]">
                {ticket.ticketId}
              </span>
              <button
                onClick={handleCopyTicketId}
                className="text-[#86868B] hover:text-[#1D1D1F] transition-colors"
                title="Copy reference"
              >
                {copySuccess ? <Check className="w-3.5 h-3.5 text-[#1B873F]" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            <Badge
              variant={
                ticket.priority === "P1" ? "destructive" :
                ticket.priority === "P2" ? "warning" : "secondary"
              }
              className="text-[11px] px-2.5 py-0.5"
            >
              {ticket.priority}
            </Badge>

            <Badge variant="outline" className="text-[11px]">
              {ticket.status.replace(/_/g, " ")}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {ticket.trackingToken && (
              <Button asChild variant="outline" size="sm" className="h-9 text-xs rounded-xl border-black/10 bg-white">
                <Link
                  to={`/track/${ticket.ticketId}/${ticket.trackingToken}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#0071E3]" />
                  <span className="hidden md:inline">Student View</span>
                </Link>
              </Button>
            )}

            <Button
              variant="ghost"
              size="sm"
              onClick={logout}
              className="h-9 px-2.5 text-xs text-[#6E6E73] hover:text-[#D70015] rounded-xl"
            >
              <LogOut className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Status Alerts Ribbon */}
        {error && (
          <div className="rounded-2xl border border-[#FF3B30]/20 bg-[#FEECEC] p-4 text-xs text-[#D70015]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-[#34C759]/20 bg-[#EAF8EE] p-4 text-xs text-[#1B873F]">
            {success}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ─── Left Column (2 spans): Primary Workspace ─── */}
          <div className="lg:col-span-2 space-y-6">
            {/* Issue Overview Card */}
            <Card>
              <div className="p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                      {ticket.title}
                    </h1>
                    <p className="text-xs text-[#6E6E73] flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5" />
                      Reported {ticket.createdAt.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 shrink-0">
                    {ticket.slaBreached && (
                      <Badge variant="destructive" className="text-[10px]">
                        SLA Overdue
                      </Badge>
                    )}
                    {ticket.isDuplicate && (
                      <Badge variant="secondary" className="text-[10px]">
                        Duplicate Linked
                      </Badge>
                    )}
                    {(ticket.anomalyFlags?.length ?? 0) > 0 && (
                      <Badge variant="warning" className="text-[10px]">
                        Advisory Anomaly
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="bg-[#F5F5F7] p-4 rounded-2xl text-xs text-[#1D1D1F] leading-relaxed whitespace-pre-wrap border border-black/[0.04]">
                  {ticket.description}
                </div>

                {/* Facility & Location Details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1 text-xs">
                  <div className="p-3 bg-[#FBFBFD] rounded-xl border border-black/[0.05]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Facility Location</div>
                    <div className="font-semibold text-[#1D1D1F] mt-0.5 truncate flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-[#0071E3] shrink-0" />
                      <span className="truncate">{locationName || ticket.locationId}</span>
                    </div>
                  </div>

                  <div className="p-3 bg-[#FBFBFD] rounded-xl border border-black/[0.05]">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Department</div>
                    <div className="font-semibold text-[#1D1D1F] mt-0.5 truncate">
                      {ticket.department || "Operations"}
                    </div>
                  </div>

                  <div className="p-3 bg-[#FBFBFD] rounded-xl border border-black/[0.05] col-span-2 sm:col-span-1">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Contact Phone</div>
                    <div className="font-semibold text-[#1D1D1F] mt-0.5">
                      {ticket.phoneNumber || "None provided"}
                    </div>
                  </div>
                </div>

                {/* Reporter Photo Evidence */}
                {ticket.photoUrl && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                      Student Photo Attachment
                    </span>
                    <div
                      onClick={() => setLightbox(ticket.photoUrl || null)}
                      className="mt-1.5 rounded-2xl overflow-hidden border border-black/10 max-h-56 bg-black/5 cursor-pointer group relative"
                    >
                      <img src={ticket.photoUrl} alt="Complaint evidence" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                        <ImageIcon className="w-4 h-4" />
                        Click to Zoom
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Lifecycle Progress Stepper */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06]">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Lifecycle Progression
                </h2>
              </div>
              <div className="p-5">
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-xs">
                  {STATUS_STEPS.map((s, index) => {
                    const isDone = currentStatusIndex >= index;
                    const isCurrent = ticket.status === s;
                    return (
                      <div key={s} className="space-y-1.5">
                        <div
                          className={`w-8 h-8 rounded-full mx-auto flex items-center justify-center text-xs font-semibold transition-colors ${
                            isCurrent
                              ? "bg-[#0071E3] text-white ring-4 ring-[#0071E3]/20 shadow-xs"
                              : isDone
                              ? "bg-[#EAF8EE] text-[#1B873F] border border-[#C3ECD1]"
                              : "bg-[#F5F5F7] text-[#86868B] border border-black/[0.05]"
                          }`}
                        >
                          {isDone ? <Check className="w-4 h-4" /> : index + 1}
                        </div>
                        <span className={`block text-[11px] truncate ${isCurrent ? "font-bold text-[#1D1D1F]" : "text-[#86868B]"}`}>
                          {s.replace(/_/g, " ")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </Card>

            {/* Staff Resolution Evidence Photo Upload Zone */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">
                    Resolution Evidence (Work Proof)
                  </h2>
                  <p className="text-xs text-[#86868B]">
                    Upload photographic proof of completed repair before closing ticket
                  </p>
                </div>
                {ticket.resolutionPhotoUrl && (
                  <Badge variant="success" className="text-[10px]">
                    Photo Verified
                  </Badge>
                )}
              </div>

              <div className="p-5 space-y-4">
                {ticket.resolutionPhotoUrl ? (
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-[#1B873F] uppercase tracking-wider">
                      Current Resolution Photo
                    </span>
                    <div
                      onClick={() => setLightbox(ticket.resolutionPhotoUrl || null)}
                      className="rounded-2xl overflow-hidden border border-[#C3ECD1] max-h-56 bg-black/5 cursor-pointer group relative"
                    >
                      <img src={ticket.resolutionPhotoUrl} alt="Staff resolution proof" className="w-full h-full object-cover group-hover:opacity-90 transition-opacity" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                        <ImageIcon className="w-4 h-4" />
                        Click to Zoom Proof
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-black/15 p-6 text-center bg-[#FBFBFD] space-y-2">
                    <Camera className="w-6 h-6 text-[#86868B] mx-auto" />
                    <p className="text-xs font-medium text-[#1D1D1F]">No resolution photo uploaded yet</p>
                    <p className="text-[11px] text-[#86868B]">
                      Field staff should take a photo of the repaired equipment or facility
                    </p>
                  </div>
                )}

                <input
                  ref={resolutionPhotoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleResolutionPhotoChange}
                  className="hidden"
                />

                {resolutionPhotoPreview && (
                  <div className="space-y-3 p-3 bg-[#F5F5F7] rounded-2xl border border-black/[0.05]">
                    <div className="relative rounded-xl overflow-hidden aspect-video max-h-48 border border-black/10">
                      <img src={resolutionPhotoPreview} alt="Selected resolution proof" className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          setResolutionPhotoFile(null);
                          setResolutionPhotoPreview(null);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 text-white flex items-center justify-center"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <Button
                      type="button"
                      disabled={photoUploading}
                      onClick={handleUploadResolutionPhoto}
                      className="w-full h-10 text-xs font-semibold rounded-xl"
                    >
                      {photoUploading ? "Uploading to Storage..." : "Save & Attach Evidence Photo"}
                    </Button>
                  </div>
                )}

                {!resolutionPhotoPreview && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => resolutionPhotoRef.current?.click()}
                    className="w-full h-10 text-xs rounded-xl border-black/10 bg-white"
                  >
                    <Upload className="w-3.5 h-3.5 mr-1.5 text-[#0071E3]" />
                    {ticket.resolutionPhotoUrl ? "Replace Resolution Photo" : "Upload Resolution Photo"}
                  </Button>
                )}

                {photoUploadError && (
                  <p className="text-xs text-[#FF3B30]">{photoUploadError}</p>
                )}
              </div>
            </Card>

            {/* AI Technician Assistant (Gemini Suggestion) */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[#1D1D1F]">
                      AI Resolution Advisor
                    </h2>
                    <p className="text-[10px] text-[#86868B]">
                      Gemini maintenance diagnosis & recommended repair steps
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAiSuggest}
                  disabled={aiLoading}
                  className="h-8 text-xs border-black/10 rounded-xl bg-white"
                >
                  {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Run AI Diagnosis"}
                </Button>
              </div>

              <div className="p-5 space-y-3 text-xs">
                {aiError && (
                  <p className="text-[#FF3B30]">{aiError}</p>
                )}

                {aiSuggestion ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-[#F5F5F7] rounded-xl space-y-1">
                      <span className="font-semibold text-[#1D1D1F]">Likely Root Cause:</span>
                      <p className="text-[#6E6E73]">{aiSuggestion.likelyCause}</p>
                    </div>

                    <div className="p-3 bg-[#F5F5F7] rounded-xl space-y-1">
                      <span className="font-semibold text-[#1D1D1F]">Recommended Action:</span>
                      <p className="text-[#6E6E73]">{aiSuggestion.recommendedAction}</p>
                      <button
                        type="button"
                        onClick={() => setResolutionSummary(aiSuggestion.recommendedAction)}
                        className="text-[#0071E3] hover:underline font-medium text-[11px] pt-1 block"
                      >
                        Copy to Resolution Summary field ↓
                      </button>
                    </div>

                    {aiSuggestion.resolutionSteps?.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <span className="font-semibold text-[#1D1D1F]">Procedure Checklist:</span>
                        <ul className="space-y-1 list-disc list-inside text-[#6E6E73]">
                          {aiSuggestion.resolutionSteps.map((step, i) => (
                            <li key={i}>{step}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {aiSuggestion.safetyNote && (
                      <div className="p-3 bg-[#FFF8E6] border border-[#FFE7A8] rounded-xl text-[#B25E00]">
                        <span className="font-semibold">Safety Protocol:</span> {aiSuggestion.safetyNote}
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[#86868B] py-2">
                    Click "Run AI Diagnosis" to analyze complaint symptoms and generate technical steps for field technicians.
                  </p>
                )}
              </div>
            </Card>

            {/* Student Verification & Feedback */}
            {ticket.studentVerified && (
              <Card>
                <div className="p-5 pb-3 border-b border-black/[0.06]">
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">
                    Student Verification Audit
                  </h2>
                </div>
                <div className="p-5 space-y-3 text-xs">
                  <div className="flex items-center gap-2 text-[#1B873F] font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Student confirmed resolution at location</span>
                  </div>

                  {ticket.studentFeedbackRating && (
                    <div className="flex items-center gap-2">
                      <span className="text-[#86868B]">Rating given:</span>
                      <div className="flex items-center gap-0.5 text-[#FF9500]">
                        {[...Array(ticket.studentFeedbackRating)].map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-[#FF9500]" />
                        ))}
                      </div>
                    </div>
                  )}

                  {ticket.studentFeedbackComment && (
                    <div className="p-3 bg-[#F5F5F7] rounded-xl text-[#6E6E73]">
                      "{ticket.studentFeedbackComment}"
                    </div>
                  )}
                </div>
              </Card>
            )}

            {/* Activity History Log */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06]">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Audit Log & Operational History
                </h2>
              </div>
              <div className="p-5 space-y-3 text-xs">
                {activities.length === 0 ? (
                  <p className="text-[#86868B]">No activity events logged yet.</p>
                ) : (
                  activities.map((a, i) => (
                    <div key={a.id || i} className="flex gap-3 items-start py-1 border-b border-black/[0.03] last:border-0">
                      <div className="w-2 h-2 rounded-full bg-[#0071E3] mt-1.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#1D1D1F]">{a.message}</span>
                          <span className="text-[11px] text-[#86868B]">
                            {a.createdAt.toLocaleDateString([], { month: "short", day: "numeric" })}{" "}
                            {a.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        {a.changedByName && (
                          <span className="text-[11px] text-[#86868B]">Recorded by {a.changedByName}</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* ─── Right Column (1 span): Management Panel ─── */}
          <div className="space-y-6">
            <form onSubmit={handleSave} className="space-y-6">
              {/* Operations Control Panel */}
              <Card>
                <div className="p-5 pb-3 border-b border-black/[0.06]">
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">
                    Operational Actions
                  </h2>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                      Status Lifecycle
                    </label>
                    <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)}>
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((s) => (
                          <SelectItem key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                      Assigned Field Technician
                    </label>
                    <Select
                      value={assignedTo}
                      onValueChange={(val) => {
                        setAssignedTo(val);
                        const found = users.find((u) => u.id === val);
                        setAssignedToName(found?.email || val);
                      }}
                    >
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Assign technician" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Unassigned</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.email || u.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                      Resolution Summary
                    </label>
                    <Textarea
                      value={resolutionSummary}
                      onChange={(e) => setResolutionSummary(e.target.value)}
                      placeholder="Brief note on what was repaired..."
                      className="text-xs min-h-[70px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                      Internal Notes
                    </label>
                    <Textarea
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Private notes for staff..."
                      className="text-xs min-h-[70px]"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={saving}
                    className="w-full h-11 text-xs font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)]"
                  >
                    {saving ? "Saving Changes..." : "Save & Update Ticket"}
                  </Button>
                </div>
              </Card>

              {/* Administrative Override Panel */}
              <Card>
                <div className="p-5 pb-3 border-b border-black/[0.06]">
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">
                    Triage & Priority Override
                  </h2>
                  <p className="text-[10px] text-[#86868B]">
                    Adjust AI classification with audited reason
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                      Priority SLA
                    </label>
                    <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)}>
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Priority" />
                      </SelectTrigger>
                      <SelectContent>
                        {PRIORITIES.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                      Category
                    </label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="h-10 text-xs">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CAMPUS_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {(category !== ticket.category || priority !== ticket.priority) && (
                    <div className="space-y-1.5 pt-1">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-[#D70015]">
                        Override Justification Reason *
                      </label>
                      <Input
                        value={adminOverrideReason}
                        onChange={(e) => setAdminOverrideReason(e.target.value)}
                        placeholder="Why is AI classification being overridden?"
                        className="h-10 text-xs border-[#FF3B30]/30"
                      />
                    </div>
                  )}
                </div>
              </Card>
            </form>

            {/* AI Decision Intelligence */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06]">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Routing Intelligence
                </h2>
              </div>
              <div className="p-5 space-y-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#6E6E73]">Decision Mode</span>
                  <Badge variant={ticket.routingDecision === "AUTO" ? "success" : "warning"} className="text-[10px]">
                    {ticket.routingDecision || "MANUAL_REVIEW"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-[#6E6E73]">AI Confidence</span>
                  <span className="font-semibold text-[#1D1D1F]">
                    {Math.round((ticket.aiConfidence || 0) * 100)}%
                  </span>
                </div>

                {ticket.routingReason && (
                  <div className="p-3 bg-[#F5F5F7] rounded-xl text-[#6E6E73]">
                    {ticket.routingReason}
                  </div>
                )}
              </div>
            </Card>

            {/* Advisory Anomaly Flags */}
            {(ticket.anomalyFlags?.length ?? 0) > 0 && (
              <Card>
                <div className="p-5 pb-3 border-b border-black/[0.06]">
                  <h2 className="text-sm font-semibold text-[#D70015]">
                    Advisory Anomaly Indicators
                  </h2>
                </div>
                <div className="p-5 space-y-2 text-xs">
                  {ticket.anomalyFlags?.map((flag, idx) => (
                    <div key={idx} className="p-3 bg-[#FEECEC] border border-[#FF3B30]/20 rounded-xl space-y-1">
                      <span className="font-semibold text-[#D70015]">{flag.type}</span>
                      <p className="text-[#6E6E73]">{flag.detail}</p>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Lightbox Modal */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="relative max-w-3xl max-h-[85vh] rounded-2xl overflow-hidden bg-black">
            <img src={lightbox} alt="Enlarged evidence" className="w-full h-full object-contain" />
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/60 text-white flex items-center justify-center"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Operations Console • Ticket Investigation Workbench
      </footer>
    </div>
  );
}
