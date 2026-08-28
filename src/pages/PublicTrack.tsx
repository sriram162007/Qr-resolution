import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getTicket } from "@/services/ticketService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { getLocation } from "@/services/locationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
          <CardContent className="space-y-3">
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
                <span className="font-medium">Status:</span> {ticket.status.replace(/_/g, " ")}
              </div>
              <div>
                <span className="font-medium">Created:</span> {ticket.createdAt.toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
