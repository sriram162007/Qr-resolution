import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTicket, getTicketActivities, updateTicketDetail } from "@/services/ticketService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { getUsers } from "@/services/ticketService";
import { suggestResolution } from "@/services/aiResolutionService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, MapPin, X, Loader2, Sparkles } from "lucide-react";
import type { Ticket, TicketStatus, TicketPriority, TicketSeverity, TicketActivity } from "@/types";

const STATUSES: TicketStatus[] = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const PRIORITIES: TicketPriority[] = ["P1", "P2", "P3", "P4"];
const SEVERITIES: TicketSeverity[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const priorityColors: Record<TicketPriority, "destructive" | "warning" | "secondary" | "outline"> = {
  P1: "destructive",
  P2: "warning",
  P3: "secondary",
  P4: "outline",
};

const STATUS_STEPS: TicketStatus[] = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

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
  const [assignedTo, setAssignedTo] = useState("");
  const [assignedToName, setAssignedToName] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [resolutionSummary, setResolutionSummary] = useState("");

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
          setAssignedTo(data.assignedTo || "");
          setAssignedToName(data.assignedToName || "");
          setResolutionNotes(data.resolutionNotes || "");
          setResolutionSummary(data.resolutionSummary || "");
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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticket || !ticketId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const previousStatus = ticket.status;
      const actor = { id: user?.email || undefined, name: user?.email || undefined };
      await updateTicketDetail(ticket.id, {
        status: status || undefined,
        priority: priority || undefined,
        severity: severity || undefined,
        assignedTo: assignedTo || undefined,
        assignedToName: assignedToName || undefined,
        resolutionNotes: resolutionNotes || undefined,
        resolutionSummary: resolutionSummary || undefined,
      }, actor);
      setSuccess("Ticket updated successfully");
      const data = await getTicket(ticketId);
      if (data) {
        setTicket(data);
        setStatus(data.status);
        setPriority(data.priority);
        setSeverity(data.severity);
        setAssignedTo(data.assignedTo || "");
        setAssignedToName(data.assignedToName || "");
        setResolutionNotes(data.resolutionNotes || "");
        setResolutionSummary(data.resolutionSummary || "");
        const newStatus = data.status;
        if (newStatus !== previousStatus && data.phoneNumber) {
          fetch("/api/send-whatsapp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              phoneNumber: data.phoneNumber,
              ticketId: data.ticketId,
              title: data.title,
              status: newStatus,
              resolutionNotes: data.resolutionNotes,
            }),
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
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">Ticket Not Found</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-sm text-muted-foreground">{error || "The requested ticket does not exist."}</p>
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
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin/tickets")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">{ticket.ticketId}</h1>
          <p className="text-muted-foreground">Ticket Details</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 rounded-md border border-green-500/50 bg-green-50 p-3 text-sm text-green-800">
          {success}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Issue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <h3 className="font-semibold text-lg">{ticket.title}</h3>
                <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{ticket.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="font-medium">Category:</span> {ticket.category}
                </div>
                {ticket.subcategory && (
                  <div>
                    <span className="font-medium">Subcategory:</span> {ticket.subcategory}
                  </div>
                )}
                {ticket.reportedArea && (
                  <div className="col-span-2">
                    <span className="font-medium">Reported Area:</span> {ticket.reportedArea}
                  </div>
                )}
                <div className="col-span-2 flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <span className="text-muted-foreground">{locationName || ticket.locationId}</span>
                </div>
                {ticket.photoUrl && (
                  <div className="col-span-2">
                    <span className="font-medium">Issue Photo</span>
                    <div className="mt-2">
                      <img
                        src={ticket.photoUrl}
                        alt="Issue photo"
                        className="max-h-48 w-full rounded-md border object-cover cursor-pointer"
                        onClick={() => setLightbox(ticket.photoUrl!)}
                      />
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {ticket.aiSummary && (
            <Card>
              <CardHeader>
                <CardTitle>AI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div>
                  <span className="font-medium">Summary:</span> {ticket.aiSummary}
                </div>
                {ticket.aiSuggestedAction && (
                  <div>
                    <span className="font-medium">Suggested Action:</span> {ticket.aiSuggestedAction}
                  </div>
                )}
                {typeof ticket.aiConfidence === "number" && (
                  <div>
                    <span className="font-medium">Confidence:</span>{" "}
                    {Math.round(ticket.aiConfidence * 100)}%
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Ticket Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                {STATUS_STEPS.map((step, idx) => (
                  <div key={step} className="flex flex-1 items-center">
                    <div className="flex flex-col items-center">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold ${
                          idx <= currentStatusIndex
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30 text-muted-foreground"
                        }`}
                      >
                        {idx <= currentStatusIndex ? "✓" : idx + 1}
                      </div>
                      <span className="mt-1 text-xs text-muted-foreground hidden sm:block">{step.replace(/_/g, " ")}</span>
                    </div>
                    {idx < STATUS_STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 mx-1 ${
                          idx < currentStatusIndex ? "bg-primary" : "bg-muted-foreground/30"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((a) => (
                    <div key={a.id} className="flex items-start justify-between gap-3 text-sm">
                      <div>
                        <span className="font-medium">{a.message}</span>
                        {a.changedByName && (
                          <span className="text-muted-foreground"> by {a.changedByName}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {a.createdAt.toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Ticket Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <Select value={status} onValueChange={(v) => setStatus(v as TicketStatus)} disabled={saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Priority</label>
                  <Select value={priority} onValueChange={(v) => setPriority(v as TicketPriority)} disabled={saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select priority" />
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Severity</label>
                  <Select value={severity} onValueChange={(v) => setSeverity(v as TicketSeverity)} disabled={saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select severity" />
                    </SelectTrigger>
                    <SelectContent>
                      {SEVERITIES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Assigned To</label>
                  <Select
                    value={assignedTo}
                    onValueChange={(v) => {
                      setAssignedTo(v);
                      const found = users.find((u) => u.id === v);
                      setAssignedToName(found?.email || "");
                    }}
                    disabled={saving}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select staff" />
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

                <div className="space-y-2">
                  <label className="text-sm font-medium">Resolution Notes</label>
                  <Textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Add notes about the resolution..."
                    disabled={saving}
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Resolution Summary</label>
                  <Textarea
                    value={resolutionSummary}
                    onChange={(e) => setResolutionSummary(e.target.value)}
                    placeholder="Public-facing resolution summary..."
                    disabled={saving}
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>AI Resolution Assistant</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={handleAiSuggest}
                disabled={aiLoading}
              >
                {aiLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Resolution Suggestion
                  </>
                )}
              </Button>
              {aiError && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
                  {aiError}
                </div>
              )}
              {aiSuggestion && (
                <div className="space-y-3 rounded-md border bg-muted/50 p-4">
                  <div className="text-sm space-y-2">
                    <div>
                      <span className="font-medium">Likely Cause:</span> {aiSuggestion.likelyCause}
                    </div>
                    <div>
                      <span className="font-medium">Recommended Action:</span> {aiSuggestion.recommendedAction}
                    </div>
                    <div>
                      <span className="font-medium">Required Team:</span> {aiSuggestion.requiredTeam}
                    </div>
                    <div>
                      <span className="font-medium">Urgency:</span>{" "}
                      <Badge variant={priorityColors[aiSuggestion.estimatedUrgency as TicketPriority] || "outline"}>
                        {aiSuggestion.estimatedUrgency}
                      </Badge>
                    </div>
                    <div>
                      <span className="font-medium">Resolution Steps:</span>
                      <ul className="list-disc pl-4 mt-1 space-y-1">
                        {aiSuggestion.resolutionSteps.map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <span className="font-medium">Safety Note:</span> {aiSuggestion.safetyNote}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="w-full"
                    onClick={useSuggestedAction}
                  >
                    Use Suggested Action
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {lightbox && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="relative max-h-[90vh] max-w-[90vw]">
            <img src={lightbox} alt="Issue photo enlarged" className="max-h-[90vh] max-w-[90vw] rounded-md object-contain" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute -top-10 right-0 text-white hover:text-white"
              onClick={() => setLightbox(null)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
