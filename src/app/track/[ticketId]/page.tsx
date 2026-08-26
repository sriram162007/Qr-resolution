import { getTicketByTicketId } from "@/services/ticketService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, MapPin, Tag } from "lucide-react";

interface TrackPageProps {
  params: Promise<{ ticketId: string }>;
}

export default async function TrackPage({ params }: TrackPageProps) {
  const { ticketId } = await params;
  let ticket;
  try {
    ticket = await getTicketByTicketId(ticketId);
  } catch {
    ticket = null;
  }

  if (!ticket) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>Ticket Not Found</CardTitle>
            <CardDescription>This ticket ID is invalid or no longer available.</CardDescription>
          </CardHeader>
        </Card>
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
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Tag className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl font-mono">{ticket.ticketId}</CardTitle>
            <CardDescription>
              <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                ticket.status === "NEW" ? "bg-blue-100 text-blue-700" :
                ticket.status === "ACKNOWLEDGED" ? "bg-yellow-100 text-yellow-700" :
                ticket.status === "ASSIGNED" ? "bg-purple-100 text-purple-700" :
                ticket.status === "IN_PROGRESS" ? "bg-orange-100 text-orange-700" :
                ticket.status === "RESOLVED" ? "bg-green-100 text-green-700" :
                "bg-gray-100 text-gray-700"
              }`}>
                {ticket.status.replace("_", " ")}
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Category</span>
                <p className="font-medium capitalize">{ticket.category.replace("_", " ").toLowerCase()}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Priority</span>
                <p className="font-medium capitalize">{ticket.priority.toLowerCase()}</p>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Location</span>
                <div className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-muted-foreground" />
                  <p className="font-medium">{ticket.issueLocationName}</p>
                </div>
              </div>
              <div className="col-span-2">
                <span className="text-muted-foreground">Exact Area</span>
                <p className="font-medium">{ticket.exactLocation}</p>
              </div>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Description</span>
              <p className="mt-1 rounded-md bg-muted p-3 text-sm">{ticket.description}</p>
            </div>
            {ticket.imageUrl && (
              <div>
                <span className="text-sm text-muted-foreground">Photo</span>
                <img src={ticket.imageUrl} alt="Issue" className="mt-1 w-full h-48 object-cover rounded-md" />
              </div>
            )}
            <div className="text-xs text-muted-foreground">
              Reported on {new Date(ticket.createdAt).toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
