import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTicket } from "@/services/ticketService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { getLocation } from "@/services/locationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const STATUS_STEPS = ["OPEN", "TRIAGED", "ASSIGNED", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function PublicTrack() {
  const { ticketId } = useParams<{ ticketId: string }>();
  const [ticket, setTicket] = useState<{
    ticketId: string;
    title: string;
    category: string;
    locationId: string;
    priority: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    assignedToName?: string;
    resolutionSummary?: string;
    photoUrl?: string;
  } | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!ticketId) return;
      setLoading(true);
      try {
        const data = await getTicket(ticketId);
        if (!data) {
          setError("Ticket not found");
          return;
        }
        setTicket({
          ticketId: data.ticketId,
          title: data.title,
          category: data.category,
          locationId: data.locationId,
          priority: data.priority,
          status: data.status,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
          assignedToName: data.assignedToName,
          resolutionSummary: data.resolutionSummary,
          photoUrl: data.photoUrl,
        });
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !ticket) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">Your Issue</h1>
          </div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-mono">{ticketId}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                {error || "Ticket not found"}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const currentStatusIndex = STATUS_STEPS.indexOf(ticket.status);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">Your Issue</h1>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-mono">{ticket.ticketId}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm space-y-2">
              <div>
                <span className="font-medium">Issue:</span> {ticket.title}
              </div>
              <div>
                <span className="font-medium">Category:</span> {ticket.category}
              </div>
              {locationName && (
                <div>
                  <span className="font-medium">Location:</span> {locationName}
                </div>
              )}
              <div>
                <span className="font-medium">Priority:</span> {ticket.priority}
              </div>
              <div>
                <span className="font-medium">Status:</span>{" "}
                <span className="font-semibold">{ticket.status.replace(/_/g, " ")}</span>
              </div>
              <div>
                <span className="font-medium">Created:</span> {ticket.createdAt.toLocaleDateString()}
              </div>
              <div>
                <span className="font-medium">Last Updated:</span> {ticket.updatedAt.toLocaleDateString()}
              </div>
              {ticket.assignedToName && (
                <div>
                  <span className="font-medium">Assigned To:</span> {ticket.assignedToName}
                </div>
              )}
              {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && ticket.resolutionSummary && (
                <div className="pt-2">
                  <span className="font-medium">Resolution:</span>
                  <p className="mt-1 text-muted-foreground">{ticket.resolutionSummary}</p>
                </div>
              )}
              {ticket.photoUrl && (
                <div className="pt-2">
                  <span className="font-medium">Issue Photo</span>
                  <div className="mt-2">
                    <img
                      src={ticket.photoUrl}
                      alt="Issue photo"
                      className="w-full rounded-md border object-cover"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2">
              <span className="font-medium text-sm">Progress</span>
              <div className="mt-3 flex items-center justify-between">
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
                      <span className="mt-1 text-[10px] text-muted-foreground hidden sm:block">{step.replace(/_/g, " ")}</span>
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
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
