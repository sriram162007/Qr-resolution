import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { getTicketActivities, subscribeToTicket } from "@/services/ticketService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import {
  TRACKING_STEPS,
  getCustomerLabel,
  getStatusEmoji,
  getStatusActivity,
  getNextStep,
  getProgressPercent,
  getStatusHexColor,
  getStatusIndex,
} from "@/lib/trackingStatus";
import {
  getEstimateString,
  getEstimateLabel,
  formatResolvedIn,
} from "@/lib/resolutionEstimate";
import type { Ticket, TicketActivity } from "@/types";

const PRIORITY_LABELS: Record<string, string> = {
  P1: "🔴 Critical",
  P2: "🟠 High",
  P3: "🟡 Medium",
  P4: "🟢 Low",
};

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return date.toLocaleDateString();
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Star Rating Component ────────────────────────────────────────────────────
function StarRating({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(star)}
          className={`text-2xl transition-transform hover:scale-110 ${
            (hovered || value) >= star ? "text-yellow-400" : "text-slate-600"
          }`}
        >
          ★
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
  const unsubRef = useRef<(() => void) | null>(null);

  // Verification state
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyDone, setVerifyDone] = useState<"confirmed" | "reopened" | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Feedback state (shown after verification)
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackDone, setFeedbackDone] = useState(false);

  // Load activities once
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

  // Firestore realtime subscription
  useEffect(() => {
    if (!ticketId) return;
    setLoading(true);
    const unsub = subscribeToTicket(ticketId, async (data) => {
      if (!data) {
        setTicket(null);
        setLoading(false);
        return;
      }

      if (token && data.trackingToken && data.trackingToken !== token) {
        setTokenError(true);
        setLoading(false);
        return;
      }

      if (!locationName) {
        try {
          const loc = await getLocation(data.locationId);
          if (loc) setLocationName(getLocationPath([loc], loc.id));
        } catch {
          // non-critical
        }
      }

      setTicket(data);
      setLastUpdated(new Date());
      setLoading(false);
    });

    unsubRef.current = unsub;
    return () => {
      unsub();
      unsubRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, token]);

  const handleVerify = async (verified: boolean) => {
    if (!ticket || !token) return;
    setVerifyLoading(true);
    setVerifyError(null);
    try {
      const response = await fetch("/api/verify-resolution", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: ticket.id,
          trackingToken: token,
          verified,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setVerifyError(data.message || "Verification failed. Please try again.");
      } else {
        setVerifyDone(verified ? "confirmed" : "reopened");
      }
    } catch {
      setVerifyError("Network error. Please check your connection and try again.");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleFeedbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !token || feedbackRating === 0) return;
    setFeedbackSubmitting(true);
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
      setFeedbackDone(true);
    } catch {
      // Non-critical
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
        <div className="text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-500 border-t-transparent mx-auto" />
          <p className="text-slate-400 text-sm">Loading your complaint status…</p>
        </div>
      </div>
    );
  }

  // ─── Invalid token ────────────────────────────────────────────────────────
  if (tokenError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">🔒</div>
          <h1 className="text-white text-xl font-bold">Invalid Tracking Link</h1>
          <p className="text-slate-400 text-sm">
            This tracking link is invalid or has expired. Please use the link from your original WhatsApp confirmation message.
          </p>
        </div>
      </div>
    );
  }

  // ─── Not found ────────────────────────────────────────────────────────────
  if (!ticket) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 px-4">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="text-5xl">🔍</div>
          <h1 className="text-white text-xl font-bold">Complaint Not Found</h1>
          <p className="text-slate-400 text-sm">
            Ticket <span className="font-mono">{ticketId}</span> could not be found.
            Please check your tracking link.
          </p>
        </div>
      </div>
    );
  }

  // ─── Derived values ───────────────────────────────────────────────────────
  const statusIdx = getStatusIndex(ticket.status);
  const statusColor = getStatusHexColor(ticket.status);
  const statusLabel = getCustomerLabel(ticket.status);
  const statusEmoji = getStatusEmoji(ticket.status);
  const activity = getStatusActivity(ticket.status, ticket.currentActivity);
  const nextStep = getNextStep(ticket.status);
  const progress = getProgressPercent(ticket.status);
  const estimateLabel = getEstimateLabel(ticket.status);
  const isResolved = ticket.status === "RESOLVED";
  const isVerifiedOrClosed = ticket.status === "VERIFIED" || ticket.status === "CLOSED";
  const isEscalated = (ticket.escalations?.length ?? 0) > 0;

  const estimateValue = (isResolved || isVerifiedOrClosed)
    ? ticket.resolvedInMins != null
      ? `Resolved in ${formatResolvedIn(ticket.resolvedInMins)}`
      : "Resolved"
    : getEstimateString(ticket.priority, ticket.severity, ticket.status, ticket.estimatedResolutionMins);

  const activityByStatus: Record<string, TicketActivity | undefined> = {};
  for (const act of activities) {
    if (act.type === "created") activityByStatus["OPEN"] = act;
    if (act.type === "status") {
      const match = act.message.match(/Status changed to (\w+)/);
      if (match) activityByStatus[match[1]] = act;
    }
    if (act.type === "assignment") activityByStatus["ASSIGNED"] = activityByStatus["ASSIGNED"] ?? act;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* ─── Header ─── */}
      <div className="px-4 pt-8 pb-4 text-center">
        <p className="text-slate-500 text-xs uppercase tracking-widest font-semibold mb-1">
          Complaint Tracker
        </p>
        <h1 className="text-white font-mono text-2xl font-bold tracking-wider">{ticket.ticketId}</h1>
        <div className="flex items-center justify-center gap-2 mt-2 flex-wrap">
          <span className="text-slate-300 text-sm">{ticket.category}</span>
          {locationName && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-slate-400 text-xs truncate max-w-[180px]">{locationName}</span>
            </>
          )}
          <span className="text-slate-600">·</span>
          <span className="text-slate-300 text-xs">{PRIORITY_LABELS[ticket.priority] ?? ticket.priority}</span>
          {isEscalated && (
            <>
              <span className="text-slate-600">·</span>
              <span className="text-orange-400 text-xs font-semibold">⚠️ Escalated</span>
            </>
          )}
        </div>

        {/* Duplicate badge */}
        {ticket.isDuplicate && ticket.parentTicketId && (
          <div className="mt-2 text-xs text-yellow-400 bg-yellow-900/20 rounded-full px-3 py-1 inline-block">
            🔗 Linked to <span className="font-mono font-bold">{ticket.parentTicketId}</span>
          </div>
        )}
      </div>

      <div className="px-4 pb-8 max-w-md mx-auto space-y-4">
        {/* ─── Current Status Card ─── */}
        <div
          className="rounded-2xl p-5 space-y-3"
          style={{ background: `linear-gradient(135deg, ${statusColor}22 0%, ${statusColor}11 100%)`, border: `1px solid ${statusColor}44` }}
        >
          <div className="flex items-start gap-3">
            <span className="text-3xl leading-none mt-0.5">{statusEmoji}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: statusColor }}>
                Current Status
              </p>
              <h2 className="text-white font-bold text-lg leading-tight mt-0.5">{statusLabel}</h2>
            </div>
          </div>

          <p className="text-slate-300 text-sm leading-relaxed">{activity}</p>

          {estimateValue && (
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wide">{estimateLabel}</p>
                <p className="text-white font-semibold text-sm mt-0.5">{estimateValue}</p>
              </div>
              {lastUpdated && (
                <div className="text-right">
                  <p className="text-xs text-slate-500">Last updated</p>
                  <p className="text-slate-400 text-xs mt-0.5">{timeAgo(lastUpdated)}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ─── Student Verification Section ─── */}
        {isResolved && token && !verifyDone && !ticket.studentVerified && (
          <div className="rounded-2xl bg-green-900/20 border border-green-500/40 p-5 space-y-4">
            <div>
              <p className="text-green-400 font-semibold text-sm">✅ Your issue has been marked as resolved</p>
              <p className="text-slate-300 text-xs mt-1 leading-relaxed">
                Please verify: has the issue actually been resolved at your location?
              </p>
            </div>
            {ticket.resolutionSummary && (
              <div className="bg-green-900/30 rounded-xl p-3 text-xs text-slate-300">
                <p className="text-green-400 font-medium mb-1">Resolution summary:</p>
                <p>{ticket.resolutionSummary}</p>
              </div>
            )}
            {ticket.resolutionPhotoUrl && (
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Resolution evidence photo:</p>
                <img
                  src={ticket.resolutionPhotoUrl}
                  alt="Resolution evidence"
                  className="w-full rounded-xl object-cover max-h-48 border border-slate-700"
                />
              </div>
            )}
            {verifyError && (
              <p className="text-xs text-red-400">{verifyError}</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                disabled={verifyLoading}
                onClick={() => handleVerify(true)}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
              >
                {verifyLoading ? "..." : "✅ Yes, Resolved!"}
              </button>
              <button
                type="button"
                disabled={verifyLoading}
                onClick={() => handleVerify(false)}
                className="flex-1 py-3 rounded-xl bg-red-800/50 hover:bg-red-700/50 text-red-300 font-semibold text-sm border border-red-500/30 transition-colors disabled:opacity-50"
              >
                {verifyLoading ? "..." : "❌ Not Resolved"}
              </button>
            </div>
          </div>
        )}

        {/* ─── Verification Success / Reopen Confirmation ─── */}
        {verifyDone === "confirmed" && (
          <div className="rounded-2xl bg-green-900/30 border border-green-500/40 p-5 space-y-4">
            <p className="text-green-400 font-semibold text-center">🎉 Thank you for confirming!</p>
            <p className="text-slate-300 text-xs text-center">Your ticket has been marked as verified and closed.</p>

            {!feedbackDone && (
              <form onSubmit={handleFeedbackSubmit} className="space-y-3">
                <p className="text-slate-400 text-xs text-center">Help us improve — rate your experience:</p>
                <div className="flex justify-center">
                  <StarRating value={feedbackRating} onChange={setFeedbackRating} />
                </div>
                {feedbackRating > 0 && (
                  <>
                    <textarea
                      value={feedbackComment}
                      onChange={(e) => setFeedbackComment(e.target.value)}
                      placeholder="Optional: Any comments about the resolution?"
                      rows={2}
                      className="w-full rounded-xl bg-slate-800 border border-slate-600 text-slate-300 text-xs px-3 py-2 placeholder:text-slate-500"
                    />
                    <button
                      type="submit"
                      disabled={feedbackSubmitting}
                      className="w-full py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors disabled:opacity-50"
                    >
                      {feedbackSubmitting ? "Submitting..." : "Submit Feedback"}
                    </button>
                  </>
                )}
              </form>
            )}
            {feedbackDone && (
              <p className="text-center text-green-400 text-sm">⭐ Feedback submitted! Thank you.</p>
            )}
          </div>
        )}

        {verifyDone === "reopened" && (
          <div className="rounded-2xl bg-orange-900/20 border border-orange-500/30 p-5 space-y-2">
            <p className="text-orange-400 font-semibold">🔄 Ticket Reopened</p>
            <p className="text-slate-300 text-xs leading-relaxed">
              We're sorry the issue wasn't resolved. Your complaint has been reopened and our team has been notified urgently.
            </p>
          </div>
        )}

        {/* ─── Already verified ─── */}
        {isVerifiedOrClosed && (
          <div className="rounded-2xl bg-green-900/20 border border-green-500/30 p-4 space-y-2">
            <p className="text-green-400 font-semibold text-sm">🎉 Complaint Closed</p>
            <p className="text-slate-300 text-xs">
              This complaint was verified and closed.
              {ticket.studentFeedbackRating && ` You rated this ${ticket.studentFeedbackRating}/5 stars.`}
            </p>
          </div>
        )}

        {/* ─── Progress Bar ─── */}
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-5 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Progress</p>
            <p className="text-xs font-bold" style={{ color: statusColor }}>{progress}%</p>
          </div>
          <div className="h-2.5 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${statusColor}cc, ${statusColor})` }}
            />
          </div>

          <div className="flex items-center justify-between mt-3">
            {TRACKING_STEPS.map((step, idx) => {
              const done = idx < statusIdx;
              const current = idx === statusIdx;
              return (
                <div key={step.status} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      done
                        ? "bg-green-500 text-white"
                        : current
                        ? "text-white shadow-lg"
                        : "bg-slate-700 text-slate-500"
                    }`}
                    style={current ? { backgroundColor: statusColor } : {}}
                  >
                    {done ? "✓" : step.emoji}
                  </div>
                  <span
                    className="text-[9px] text-center leading-tight"
                    style={{ color: done ? "#22c55e" : current ? statusColor : "#475569" }}
                  >
                    {step.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── What Happens Next ─── */}
        {nextStep && !isResolved && !isVerifiedOrClosed && (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
              What happens next?
            </p>
            <p className="text-slate-300 text-sm leading-relaxed">{nextStep}</p>
          </div>
        )}

        {/* ─── Escalation Notice ─── */}
        {isEscalated && (
          <div className="rounded-2xl bg-orange-900/20 border border-orange-500/30 p-4">
            <p className="text-xs font-semibold text-orange-400 uppercase tracking-wide mb-1">Escalation Notice</p>
            <p className="text-slate-300 text-xs leading-relaxed">
              This complaint has been escalated to senior management for urgent attention. We apologize for the delay.
            </p>
          </div>
        )}

        {/* ─── Resolution Summary ─── */}
        {(isResolved || isVerifiedOrClosed) && ticket.resolutionSummary && (
          <div className="rounded-2xl bg-green-900/30 border border-green-500/30 p-4 space-y-1">
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wide">Resolution</p>
            <p className="text-slate-200 text-sm leading-relaxed">{ticket.resolutionSummary}</p>
          </div>
        )}

        {/* ─── Resolution Evidence Photo ─── */}
        {(isResolved || isVerifiedOrClosed) && ticket.resolutionPhotoUrl && (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Resolution Evidence</p>
            <img
              src={ticket.resolutionPhotoUrl}
              alt="Resolution evidence photo"
              className="w-full rounded-xl object-cover max-h-56 border border-slate-700"
            />
          </div>
        )}

        {/* ─── Complaint Journey Timeline ─── */}
        <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Complaint Journey
          </p>
          <div className="space-y-0">
            {TRACKING_STEPS.map((step, idx) => {
              const done = idx < statusIdx;
              const current = idx === statusIdx;
              const future = idx > statusIdx;
              const actEntry = activityByStatus[step.status];
              const timestamp = actEntry
                ? formatTime(actEntry.createdAt)
                : step.status === "OPEN" && ticket.createdAt
                ? formatTime(ticket.createdAt)
                : null;
              const isLast = idx === TRACKING_STEPS.length - 1;

              return (
                <div key={step.status} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 border-2 ${
                        done
                          ? "bg-green-500 border-green-500 text-white"
                          : current
                          ? "text-white border-transparent"
                          : "bg-slate-800 border-slate-600 text-slate-600"
                      }`}
                      style={current ? { backgroundColor: statusColor, borderColor: statusColor } : {}}
                    >
                      {done ? "✓" : future ? "" : step.emoji}
                    </div>
                    {!isLast && (
                      <div
                        className={`w-0.5 flex-1 min-h-[24px] my-1 ${done ? "bg-green-500/50" : "bg-slate-700"}`}
                      />
                    )}
                  </div>

                  <div className={`pb-5 min-w-0 flex-1 ${isLast ? "" : ""}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        className={`text-sm font-semibold ${
                          done ? "text-green-400" : current ? "text-white" : "text-slate-600"
                        }`}
                      >
                        {step.label}
                      </p>
                      {timestamp && !future && (
                        <span className="text-xs text-slate-500 flex-shrink-0">{timestamp}</span>
                      )}
                      {future && (
                        <span className="text-xs text-slate-600 flex-shrink-0">Waiting</span>
                      )}
                    </div>
                    {current && (
                      <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{activity}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ─── Issue Photo ─── */}
        {ticket.photoUrl && (
          <div className="rounded-2xl bg-slate-800/60 border border-slate-700/50 p-4 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Issue Photo</p>
            <img
              src={ticket.photoUrl}
              alt="Issue photo"
              className="w-full rounded-xl object-cover max-h-56"
            />
          </div>
        )}

        {/* ─── Footer ─── */}
        <div className="text-center pt-2 pb-4">
          <p className="text-slate-600 text-xs">
            Powered by <span className="text-slate-500 font-semibold">AI Campus Complaint System</span>
          </p>
          <p className="text-slate-700 text-[10px] mt-1 font-mono">{ticket.ticketId}</p>
        </div>
      </div>
    </div>
  );
}
