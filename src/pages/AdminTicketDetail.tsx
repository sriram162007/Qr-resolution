import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTicket, setTicketStatus, setTicketAssignment } from "@/services/ticketService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ArrowLeft, MapPin } from "lucide-react";
import type { Ticket, TicketStatus } from "@/types";

const STATUS_FLOW: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ["TRIAGED"],
  TRIAGED: ["ASSIGNED"],
  ASSIGNED: ["IN_PROGRESS"],
  IN_PROGRESS: ["RESOLVED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [],
};

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
  const [assignee, setAssignee] = useState("");
  const [status, setStatus] = useState<TicketStatus | "">("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function load() {
      if (!ticketId) return;
      setLoading(true);
      setError(null);
      setSuccess(null);
      try {
        const data = await getTicket(ticketId);
        if (!data) {
          setError("Ticket not found");
          return;
        }
        setTicket(data);
        setStatus(data.status);
        setAssignee(data.assignedTo || "");
        const loc = await getLocation(data.locationId);
        if (loc) setLocationName(getLocationPath([loc], loc.id));
      } catch {
        setError("Failed to load ticket");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [ticketId]);

  const handleStatusChange = async (newStatus: string) => {
    if (!ticket || !newStatus) return;
    const current = ticket.status;
    const allowed = STATUS_FLOW[current] || [];
    if (!allowed.includes(newStatus as TicketStatus)) {
      setError(`Invalid status transition: ${current} → ${newStatus}`);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setTicketStatus(ticket.id, newStatus as TicketStatus);
      setSuccess("Status updated successfully");
      setTicket({ ...ticket, status: newStatus as TicketStatus, updatedAt: new Date() });
      setStatus(newStatus as TicketStatus);
    } catch {
      setError("Failed to update status");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignmentChange = async () => {
    if (!ticket) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await setTicketAssignment(ticket.id, assignee || undefined);
      setSuccess(ticket.assignedTo ? "Assignment updated" : "Assignment cleared");
      setTicket({ ...ticket, assignedTo: assignee || undefined, updatedAt: new Date() });
    } catch {
      setError("Failed to update assignment");
    } finally {
      setSaving(false);
    }
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

  const allowedNext = STATUS_FLOW[ticket.status] || [];
  const priorityColors: Record<string, string> = {
    P1: "destructive",
    P2: "warning",
    P3: "secondary",
    P4: "outline",
  };

  return (
    <div className="container mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
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

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
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
                  <span className="text-muted-foreground">
                    {locationName || ticket.locationId}
                  </span>
                </div>
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
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status & Priority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Status</label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {ticket.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Priority</label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={priorityColors[ticket.priority] as any} className="text-xs">
                    {ticket.priority}
                  </Badge>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Severity</label>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">
                    {ticket.severity}
                  </Badge>
                </div>
              </div>
              {allowedNext.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Update Status</label>
                  <Select value={status} onValueChange={handleStatusChange} disabled={saving}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select next status" />
                    </SelectTrigger>
                    <SelectContent>
                      {allowedNext.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Assigned To</label>
                <div className="flex gap-2">
                  <Input
                    value={assignee}
                    onChange={(e) => setAssignee(e.target.value)}
                    placeholder="Enter name or email"
                    disabled={saving}
                  />
                  <Button size="sm" onClick={handleAssignmentChange} disabled={saving}>
                    Save
                  </Button>
                </div>
                {!assignee && (
                  <p className="text-xs text-muted-foreground">
                    Staff management integration pending.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div>
                <span className="font-medium">Created:</span>{" "}
                {ticket.createdAt.toLocaleString()}
              </div>
              <div>
                <span className="font-medium">Updated:</span>{" "}
                {ticket.updatedAt.toLocaleString()}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
