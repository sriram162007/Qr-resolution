import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { getTicketActivities, subscribeToTicket, updateTicket } from "@/services/ticketService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import {
  getCustomerLabel,
  getStatusActivity,
  getNextStep,
  getProgressPercent,
} from "@/lib/trackingStatus";
import {
  getEstimateString,
  getEstimateLabel,
  formatResolvedIn,
} from "@/lib/resolutionEstimate";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import type { Ticket, TicketActivity } from "@/types";
import {
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  CheckCircle2,
  Clock,
  AlertCircle,
  Star,
  RotateCcw,
  ShieldCheck,
  FileText,
  X,
  Image as ImageIcon,
  Camera,
} from "lucide-react";

const PRIORITY_CONFIG: Record<string, { label: string; variant: "destructive" | "warning" | "default" | "secondary" }> = {
  P1: { label: "P1 Critical", variant: "destructive" },
  P2: { label: "P2 High", variant: "warning" },
  P3: { label: "P3 Medium", variant: "secondary" },
  P4: { label: "P4 Low", variant: "secondary" },
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1.5 items-center justify-center">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className="p-1 transition-transform hover:scale-125 focus:outline-none"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              (hovered || value) >= star
                ? "fill-[#FF9500] text-[#FF9500]"
                : "fill-none text-black/20"
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function PublicTrack() {
  const { ticketId, token } = useParams<{ ticketId: string; token?: string }>();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [activities, setActivities] = useState<TicketActivity[]>([]);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tokenError, setTokenError] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const unsubRef = useRef<(() => void) | null>(null);

  // Verification state
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyDone, setVerifyDone] = useState<"confirmed" | "reopened" | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Feedback state
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!ticketId) return;
    getTicketActivities(ticketId)
      .then((acts) => {
        const visible = acts.filter((a) =>
          ["created", "status", "assignment", "activity_update", "verification", "reopened", "escalation"].includes(a.type),
        );
        setActivities(visible.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()));
      })
      .catch(() => setActivities([]));
  }, [ticketId]);

  useEffect(() => {
    if (!ticketId) return;
    setLoading(true);

    const unsub = subscribeToTicket(
      ticketId,
      (t) => {
        if (!t) {
          setLoading(false);
          setTicket(null);
          return;
        }

        if (token && t.trackingToken && t.trackingToken !== token) {
          setTokenError(true);
          setLoading(false);
          return;
        }

        setTicket(t);
        setLastUpdated(t.updatedAt ?? t.createdAt);
        setLoading(false);

        if (t.locationId) {
          getLocation(t.locationId)
            .then((loc) => {
              if (loc) setLocationName(getLocationPath([loc], loc.id));
            })
            .catch(() => {});
        }
      },
      () => {
        setLoading(false);
      },
    );

    unsubRef.current = unsub;
    return () => unsub();
  }, [ticketId, token]);

  const handleCopyId = () => {
    if (!ticketId) return;
    navigator.clipboard.writeText(ticketId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleVerify = async (verified: boolean) => {
    if (!ticket || !token) return;
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      try {
        await fetch("/api/verify-resolution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticket.id,
            trackingToken: token,
            verified,
          }),
        });
      } catch {
        // Non-blocking fallback
      }

      await updateTicket(
        ticket.id,
        {
          status: verified ? "VERIFIED" : "IN_PROGRESS",
          studentVerified: verified,
          studentVerifiedAt: verified ? new Date() : undefined,
          closedAt: verified ? new Date() : undefined,
          currentActivity: verified
            ? "Student confirmed the issue is resolved."
            : "Student reported issue is not resolved. Reopened for investigation.",
        },
        { id: "student", name: "Student" }
      );

      setVerifyDone(verified ? "confirmed" : "reopened");
      if (!verified) {
        setTicket((prev) => (prev ? { ...prev, status: "IN_PROGRESS" } : null));
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || feedbackRating === 0) return;
    setFeedbackSubmitting(true);
    try {
      try {
        await fetch("/api/verify-resolution", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId: ticket.id,
            trackingToken: token,
            verified: true,
            rating: feedbackRating,
            comment: feedbackComment.trim() || undefined,
          }),
        });
      } catch {
        // Non-blocking
      }

      await updateTicket(
        ticket.id,
        {
          studentFeedbackRating: feedbackRating,
          studentFeedbackComment: feedbackComment.trim() || undefined,
        },
        { id: "student", name: "Student" }
      );

      setFeedbackDone(true);
    } catch {
      // Non-fatal
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-white border border-black/10 shadow-xs flex items-center justify-center">
          <RefreshCw className="w-5 h-5 animate-spin text-[#0071E3]" />
        </div>
        <p className="text-xs text-[#86868B] mt-3 font-medium">Retrieving ticket updates...</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-3xl p-8 text-center space-y-4 bg-white">
          <div className="w-14 h-14 rounded-2xl bg-[#FF3B30]/10 border border-[#FF3B30]/20 mx-auto flex items-center justify-center text-[#FF3B30]">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Access Link Expired</h1>
            <p className="text-sm text-[#6E6E73]">
              The secure token in your tracking URL is invalid or has expired.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Campus Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex items-center justify-center p-4">
        <Card className="max-w-md w-full border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-3xl p-8 text-center space-y-4 bg-white">
          <div className="w-14 h-14 rounded-2xl bg-[#F5F5F7] border border-black/[0.06] mx-auto flex items-center justify-center text-[#86868B]">
            <FileText className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Ticket Not Found</h1>
            <p className="text-sm text-[#6E6E73]">
              No active campus complaint matches the reference "{ticketId}".
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link to="/">Campus Home</Link>
          </Button>
        </Card>
      </div>
    );
  }

  const statusLabel = getCustomerLabel(ticket.status);
  const activity = getStatusActivity(ticket.status);
  const nextStep = getNextStep(ticket.status);
  const progress = getProgressPercent(ticket.status);
  const isResolved = ticket.status === "RESOLVED";
  const isVerifiedOrClosed = ticket.status === "VERIFIED" || ticket.status === "CLOSED";

  const resolvedMinutes = ticket.resolvedInMins ?? (
    ticket.resolvedAt && ticket.createdAt
      ? Math.max(1, Math.round((new Date(ticket.resolvedAt).getTime() - new Date(ticket.createdAt).getTime()) / 60000))
      : 30
  );

  const estimateValue = isResolved
    ? formatResolvedIn(resolvedMinutes)
    : getEstimateString(ticket.priority, ticket.severity, ticket.status);
  const estimateLabel = getEstimateLabel(ticket.status);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* ─── Apple Frosted Sticky Header ─── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/80 border-b border-black/[0.06]">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Campus Pulse
          </Link>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyId}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F5F5F7] hover:bg-[#EAEAEA] border border-black/[0.06] text-xs font-mono font-medium text-[#1D1D1F] transition-colors"
            >
              <span>{ticket.ticketId}</span>
              {copiedId ? <Check className="w-3 h-3 text-[#1B873F]" /> : <Copy className="w-3 h-3 text-[#86868B]" />}
            </button>
          </div>

          <button
            onClick={() => window.location.reload()}
            title="Refresh status"
            className="w-8 h-8 rounded-full bg-[#F5F5F7] hover:bg-[#EAEAEA] border border-black/[0.06] flex items-center justify-center text-[#6E6E73] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-2xl w-full mx-auto px-4 py-6 sm:py-8 space-y-6">
        {/* ─── Main Status Banner (iOS Hero Card) ─── */}
        <div className="bg-white border border-black/[0.08] rounded-3xl p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#86868B]">
                Current Status
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1D1D1F]">
                {statusLabel}
              </h1>
              <p className="text-xs sm:text-sm text-[#6E6E73] leading-relaxed max-w-md pt-0.5">
                {activity}
              </p>
            </div>

            <Badge
              variant={
                isResolved || isVerifiedOrClosed ? "success" :
                ticket.status === "IN_PROGRESS" ? "warning" :
                ticket.status === "REOPENED" ? "destructive" : "default"
              }
              className="text-xs px-3 py-1 shrink-0"
            >
              {ticket.status}
            </Badge>
          </div>

          {/* Linear Segmented Progress Bar */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between text-[11px] font-medium text-[#86868B]">
              <span>Resolution Progress</span>
              <span className="font-semibold text-[#1D1D1F]">{progress}%</span>
            </div>
            <div className="h-2 w-full bg-[#F5F5F7] rounded-full overflow-hidden p-0.5 border border-black/[0.04]">
              <div
                className="h-full bg-[#0071E3] rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>
            {nextStep && (
              <p className="text-[11px] text-[#86868B] pt-0.5">
                Next phase: <span className="font-medium text-[#1D1D1F]">{nextStep}</span>
              </p>
            )}
          </div>

          {/* Time & SLA Metadata Row */}
          <div className="pt-4 border-t border-black/[0.06] grid grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                {estimateLabel}
              </div>
              <div className="text-sm font-semibold text-[#1D1D1F] mt-0.5 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-[#0071E3]" />
                <span>{estimateValue}</span>
              </div>
            </div>

            {lastUpdated && (
              <div className="text-right">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">
                  Last Updated
                </div>
                <div className="text-sm font-medium text-[#6E6E73] mt-0.5">
                  {timeAgo(lastUpdated)}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Student Verification Section (When Resolved) ─── */}
        {isResolved && token && !verifyDone && !ticket.studentVerified && (
          <div className="bg-[#EAF8EE] border border-[#C3ECD1] rounded-3xl p-6 shadow-[0_4px_16px_rgba(52,199,89,0.08)] space-y-4">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1B873F]">
                <ShieldCheck className="w-4 h-4" />
                Student Resolution Verification
              </div>
              <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                Is the issue completely resolved?
              </h2>
              <p className="text-xs text-[#6E6E73] leading-relaxed">
                Campus maintenance marked this ticket as completed. Please review the repair evidence below and confirm whether the physical issue is completely fixed.
              </p>
            </div>

            {ticket.resolvedAt && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-[#C3ECD1] text-[11px] font-medium text-[#1B873F]">
                <Clock className="w-3.5 h-3.5" />
                <span>Marked resolved on {new Date(ticket.resolvedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</span>
              </div>
            )}

            {ticket.resolutionSummary && (
              <div className="bg-white rounded-2xl p-4 text-xs border border-[#C3ECD1] space-y-1">
                <span className="font-semibold text-[#1D1D1F]">Maintenance Summary:</span>
                <p className="text-[#6E6E73]">{ticket.resolutionSummary}</p>
              </div>
            )}

            {verifyError && (
              <p className="text-xs text-[#FF3B30]">{verifyError}</p>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-1">
              <Button
                className="flex-1 h-12 bg-[#1B873F] hover:bg-[#166C32] text-white font-semibold rounded-2xl shadow-xs flex items-center justify-center gap-2"
                disabled={verifyLoading}
                onClick={() => handleVerify(true)}
              >
                <Check className="w-4 h-4" />
                {verifyLoading ? "Confirming..." : "YES — Completely Resolved"}
              </Button>
              <Button
                variant="outline"
                className="flex-1 h-12 text-[#D70015] border-[#FF3B30]/30 hover:bg-[#FEECEC] font-semibold rounded-2xl flex items-center justify-center gap-2"
                disabled={verifyLoading}
                onClick={() => handleVerify(false)}
              >
                <RotateCcw className="w-4 h-4" />
                {verifyLoading ? "Updating..." : "NO — Reopen Ticket"}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Verification Done States ─── */}
        {verifyDone === "confirmed" && (
          <div className="bg-white border border-[#C3ECD1] rounded-3xl p-6 text-center space-y-4 shadow-xs">
            <div className="w-12 h-12 rounded-full bg-[#EAF8EE] text-[#1B873F] mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-[#1D1D1F]">Verification Confirmed</h3>
              <p className="text-xs text-[#6E6E73]">
                Your confirmation has been recorded. This ticket is now closed.
              </p>
            </div>

            {!feedbackDone ? (
              <form onSubmit={handleFeedbackSubmit} className="pt-2 space-y-4 max-w-sm mx-auto">
                <div className="space-y-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
                    Rate Campus Maintenance (1 to 5 Stars)
                  </span>
                  <StarRating value={feedbackRating} onChange={setFeedbackRating} />
                </div>

                {feedbackRating > 0 && (
                  <div className="space-y-2.5">
                    <Textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Optional remarks on speed or quality of repair..."
                      className="text-xs"
                      rows={2}
                    />
                    <Button
                      type="submit"
                      disabled={feedbackSubmitting}
                      className="w-full h-10 text-xs font-semibold rounded-xl"
                    >
                      {feedbackSubmitting ? "Submitting..." : "Submit Rating"}
                    </Button>
                  </div>
                )}
              </form>
            ) : (
              <p className="text-xs font-medium text-[#1B873F]">
                Thank you for your rating! Your feedback helps optimize campus operations.
              </p>
            )}
          </div>
        )}

        {verifyDone === "reopened" && (
          <div className="bg-[#FFF8E6] border border-[#FFE7A8] rounded-3xl p-6 space-y-2">
            <div className="flex items-center gap-2 text-[#B25E00] font-bold text-sm">
              <RotateCcw className="w-4 h-4" />
              Ticket Reopened
            </div>
            <p className="text-xs text-[#8A4800] leading-relaxed">
              We're sorry the resolution wasn't satisfactory. Your complaint has been reopened as In Progress and escalated back to the facility team.
            </p>
          </div>
        )}

        {/* ─── Visual Evidence Records (Student Reported & Staff Solved Proof) ─── */}
        {(ticket.photoUrl || ticket.resolutionPhotoUrl) && (
          <div className="bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between pb-2 border-b border-black/[0.06]">
              <div className="flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#0071E3]" />
                <h2 className="text-xs font-semibold uppercase tracking-wider text-[#1D1D1F]">
                  Visual Evidence Records
                </h2>
              </div>
              <span className="text-[11px] text-[#86868B]">
                {ticket.photoUrl && ticket.resolutionPhotoUrl ? "Both Records Available" : "1 Record Available"}
              </span>
            </div>

            <div className={`grid gap-4 ${ticket.photoUrl && ticket.resolutionPhotoUrl ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
              {/* Student Reported Evidence */}
              {ticket.photoUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wider">
                      Reported Evidence
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-2 py-0.5">
                      Original Report
                    </Badge>
                  </div>
                  <div
                    onClick={() => setLightbox(ticket.photoUrl || null)}
                    className="rounded-2xl overflow-hidden border border-black/10 bg-black/5 aspect-4/3 cursor-pointer group relative"
                  >
                    <img
                      src={ticket.photoUrl}
                      alt="Original complaint evidence"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      Tap to Enlarge
                    </div>
                  </div>
                  <p className="text-[11px] text-[#86868B]">
                    Captured at ticket submission • {ticket.createdAt ? new Date(ticket.createdAt).toLocaleDateString() : ""}
                  </p>
                </div>
              )}

              {/* Staff Solved Resolution Evidence */}
              {ticket.resolutionPhotoUrl && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-[#1B873F] uppercase tracking-wider">
                      Solved Evidence
                    </span>
                    <Badge variant="success" className="text-[10px] px-2 py-0.5">
                      Resolved Proof
                    </Badge>
                  </div>
                  <div
                    onClick={() => setLightbox(ticket.resolutionPhotoUrl || null)}
                    className="rounded-2xl overflow-hidden border border-[#C3ECD1] bg-black/5 aspect-4/3 cursor-pointer group relative"
                  >
                    <img
                      src={ticket.resolutionPhotoUrl}
                      alt="Staff resolution proof"
                      className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-semibold gap-1.5">
                      <ImageIcon className="w-4 h-4" />
                      Tap to Enlarge
                    </div>
                  </div>
                  <p className="text-[11px] text-[#86868B]">
                    Verified by maintenance staff • {ticket.resolvedAt ? new Date(ticket.resolvedAt).toLocaleDateString() : "Recently resolved"}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Ticket Facility & Details Card ─── */}
        <div className="bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
            Complaint Specifications
          </h2>

          <div className="space-y-2">
            <h3 className="text-base font-semibold text-[#1D1D1F]">
              {ticket.title}
            </h3>
            <p className="text-xs text-[#6E6E73] leading-relaxed">
              {ticket.description}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 bg-[#F5F5F7] rounded-xl border border-black/[0.04]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Location</div>
              <div className="font-semibold text-[#1D1D1F] mt-0.5 truncate">
                {locationName || ticket.reportedArea || ticket.qrId}
              </div>
            </div>

            <div className="p-3 bg-[#F5F5F7] rounded-xl border border-black/[0.04]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Category</div>
              <div className="font-semibold text-[#1D1D1F] mt-0.5">
                {ticket.category}
              </div>
            </div>

            <div className="p-3 bg-[#F5F5F7] rounded-xl border border-black/[0.04]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Priority Level</div>
              <div className="mt-0.5">
                <Badge variant={PRIORITY_CONFIG[ticket.priority]?.variant || "secondary"} className="text-[11px]">
                  {PRIORITY_CONFIG[ticket.priority]?.label || ticket.priority}
                </Badge>
              </div>
            </div>

            <div className="p-3 bg-[#F5F5F7] rounded-xl border border-black/[0.04]">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-[#86868B]">Department</div>
              <div className="font-semibold text-[#1D1D1F] mt-0.5">
                {ticket.department || "Campus Operations"}
              </div>
            </div>
          </div>
        </div>

        {/* ─── Activity Log Timeline ─── */}
        <div className="bg-white border border-black/[0.08] rounded-3xl p-6 space-y-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
            Status History & Logs
          </h2>

          <div className="space-y-4 pt-1">
            {activities.length === 0 ? (
              <p className="text-xs text-[#86868B]">No activity events logged yet.</p>
            ) : (
              activities.map((act, index) => (
                <div key={act.id || index} className="flex gap-3 text-xs items-start">
                  <div className="w-2 h-2 rounded-full bg-[#0071E3] mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[#1D1D1F]">{act.message}</span>
                      <span className="text-[11px] text-[#86868B]">{formatTime(act.createdAt)}</span>
                    </div>
                    {act.changedByName && (
                      <span className="text-[11px] text-[#86868B]">By {act.changedByName}</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Smart Facility Resolution System
      </footer>

      {/* Lightbox Modal */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 cursor-pointer"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden bg-black shadow-2xl">
            <button
              onClick={() => setLightbox(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={lightbox} alt="Enlarged evidence" className="w-full h-full object-contain max-h-[85vh]" />
          </div>
        </div>
      )}
    </div>
  );
}
