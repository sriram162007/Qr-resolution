import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTickets } from "@/services/ticketService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { getOrganization } from "@/services/organizationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, ArrowUpDown } from "lucide-react";
import type { Ticket, TicketStatus, TicketPriority } from "@/types";

const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Furniture",
  "HVAC",
  "Network",
  "Safety",
  "Infrastructure",
  "Other",
] as const;

const STATUSES: TicketStatus[] = [
  "OPEN",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

const PRIORITIES: TicketPriority[] = ["P1", "P2", "P3", "P4"];

const priorityColors: Record<TicketPriority, "destructive" | "warning" | "secondary" | "outline"> = {
  P1: "destructive",
  P2: "warning",
  P3: "secondary",
  P4: "outline",
};

const statusColors: Record<TicketStatus, "default" | "secondary" | "success" | "warning" | "outline"> = {
  OPEN: "outline",
  TRIAGED: "secondary",
  ASSIGNED: "warning",
  IN_PROGRESS: "default",
  RESOLVED: "success",
  CLOSED: "secondary",
};

export default function AdminTickets() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [sortField, setSortField] = useState<"createdAt" | "priority" | "status">("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [locationCache, setLocationCache] = useState<Record<string, string>>({});

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
        setTickets(data);

        const cache: Record<string, string> = {};
        for (const t of data) {
          if (!cache[t.locationId]) {
            try {
              const loc = await getLocation(t.locationId);
              if (loc) cache[t.locationId] = getLocationPath([loc], loc.id);
            } catch {
              cache[t.locationId] = t.locationId;
            }
          }
        }
        setLocationCache(cache);
      } catch {
        setError("Failed to load tickets.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const filtered = useMemo(() => {
    let result = [...tickets];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((t) => {
        const haystack = [
          t.ticketId,
          t.title,
          t.description,
          t.category,
          t.reportedArea || "",
          locationCache[t.locationId] || t.locationId,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (statusFilter !== "ALL") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter !== "ALL") {
      result = result.filter((t) => t.priority === priorityFilter);
    }

    if (categoryFilter !== "ALL") {
      result = result.filter((t) => t.category === categoryFilter);
    }

    const priorityOrder: Record<TicketPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
    const statusOrder: Record<TicketStatus, number> = {
      OPEN: 0,
      TRIAGED: 1,
      ASSIGNED: 2,
      IN_PROGRESS: 3,
      RESOLVED: 4,
      CLOSED: 5,
    };

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === "createdAt") {
        cmp = a.createdAt.getTime() - b.createdAt.getTime();
      } else if (sortField === "priority") {
        cmp = priorityOrder[a.priority] - priorityOrder[b.priority];
      } else if (sortField === "status") {
        cmp = statusOrder[a.status] - statusOrder[b.status];
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [tickets, search, statusFilter, priorityFilter, categoryFilter, sortField, sortDir, locationCache]);

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "OPEN").length;
    const highCritical = tickets.filter((t) => t.priority === "P1" || t.priority === "P2").length;
    const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const resolved = tickets.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length;
    return { total, open, highCritical, inProgress, resolved };
  }, [tickets]);

  const toggleSort = (field: "createdAt" | "priority" | "status") => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

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

      <div className="grid gap-4 mt-6 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Open</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.open}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">High / Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.highCritical}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">In Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.inProgress}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Resolved / Closed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Search & Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search tickets..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full lg:w-32">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full lg:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>
            {filtered.length} {filtered.length === 1 ? "Ticket" : "Tickets"}
          </CardTitle>
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
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No tickets match your filters.</div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort("createdAt")}>
                        <div className="flex items-center gap-1">
                          Ticket ID <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="py-3 px-2">Title</th>
                      <th className="py-3 px-2">Category</th>
                      <th className="py-3 px-2">Location</th>
                      <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort("priority")}>
                        <div className="flex items-center gap-1">
                          Priority <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="py-3 px-2">Severity</th>
                      <th className="py-3 px-2 cursor-pointer" onClick={() => toggleSort("status")}>
                        <div className="flex items-center gap-1">
                          Status <ArrowUpDown className="h-3 w-3" />
                        </div>
                      </th>
                      <th className="py-3 px-2">Created</th>
                      <th className="py-3 px-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((ticket) => (
                      <tr key={ticket.id} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-3 px-2 font-mono">{ticket.ticketId}</td>
                        <td className="py-3 px-2 max-w-xs truncate">{ticket.title}</td>
                        <td className="py-3 px-2">{ticket.category}</td>
                        <td className="py-3 px-2 max-w-[150px] truncate">
                          {locationCache[ticket.locationId] || ticket.locationId}
                        </td>
                        <td className="py-3 px-2">
                          <Badge variant={priorityColors[ticket.priority]}>{ticket.priority}</Badge>
                        </td>
                        <td className="py-3 px-2">{ticket.severity}</td>
                        <td className="py-3 px-2">
                          <Badge variant={statusColors[ticket.status]} className="capitalize">
                            {ticket.status.replace(/_/g, " ")}
                          </Badge>
                        </td>
                        <td className="py-3 px-2">{ticket.createdAt.toLocaleDateString()}</td>
                        <td className="py-3 px-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                          >
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="md:hidden space-y-3">
                {filtered.map((ticket) => (
                  <Card key={ticket.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-mono text-sm font-semibold">{ticket.ticketId}</div>
                        <div className="text-sm mt-1 truncate">{ticket.title}</div>
                      </div>
                      <Badge variant={priorityColors[ticket.priority]} className="shrink-0">
                        {ticket.priority}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span>{ticket.category}</span>
                      <span>•</span>
                      <span className="truncate max-w-[120px]">
                        {locationCache[ticket.locationId] || ticket.locationId}
                      </span>
                      <span>•</span>
                      <span>{ticket.createdAt.toLocaleDateString()}</span>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <Badge variant={statusColors[ticket.status]} className="capitalize text-xs">
                        {ticket.status.replace(/_/g, " ")}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                      >
                        View
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
