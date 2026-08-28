import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTickets } from "@/services/ticketService";
import { getOrganization } from "@/services/organizationService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminTickets() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<
    Array<{
      ticketId: string;
      title: string;
      category: string;
      locationId: string;
      priority: string;
      status: string;
      createdAt: Date;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const org = await getOrganization("default");
        if (!org) {
          setTickets([]);
          return;
        }
        const data = await getTickets(org.id);
        const mapped = data.map((t) => ({
          ticketId: t.ticketId,
          title: t.title,
          category: t.category,
          locationId: t.locationId,
          priority: t.priority,
          status: t.status,
          createdAt: t.createdAt,
        }));
        setTickets(mapped);
      } catch {
        setError("Failed to load tickets.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground">Manage reported issues.</p>
        </div>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>All Tickets</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive mb-4">
              {error}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : tickets.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tickets yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-2">Ticket ID</th>
                    <th className="py-3 px-2">Title</th>
                    <th className="py-3 px-2">Category</th>
                    <th className="py-3 px-2">Priority</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((ticket) => (
                    <tr key={ticket.ticketId} className="border-b last:border-0">
                      <td className="py-3 px-2 font-mono">{ticket.ticketId}</td>
                      <td className="py-3 px-2">{ticket.title}</td>
                      <td className="py-3 px-2">{ticket.category}</td>
                      <td className="py-3 px-2">{ticket.priority}</td>
                      <td className="py-3 px-2">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {ticket.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-2">{ticket.createdAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
