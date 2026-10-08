import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTickets } from "@/services/ticketService";
import { getOrganization } from "@/services/organizationService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Ticket, TicketStatus, TicketPriority } from "@/types";
import {
  Search,
  ArrowUpDown,
  RefreshCw,
  LogOut,
  Activity,
  X,
} from "lucide-react";

const STATUSES: TicketStatus[] = [
  "OPEN",
  "TRIAGED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "VERIFIED",
  "CLOSED",
  "REOPENED",
];

const PRIORITIES: TicketPriority[] = ["P1", "P2", "P3", "P4"];

const CATEGORIES = [
  "Electrical",
  "Plumbing",
  "Cleaning",
  "Civil",
  "Hostel",
  "Laboratory",
  "Other",
];

const priorityConfig: Record<TicketPriority, { label: string; variant: "destructive" | "warning" | "secondary" | "outline" }> = {
  P1: { label: "P1 Critical", variant: "destructive" },
  P2: { label: "P2 High", variant: "warning" },
  P3: { label: "P3 Medium", variant: "secondary" },
  P4: { label: "P4 Low", variant: "outline" },
};

const statusConfig: Record<TicketStatus, { variant: "default" | "secondary" | "success" | "warning" | "destructive" | "outline" }> = {
  OPEN: { variant: "default" },
  TRIAGED: { variant: "secondary" },
  ASSIGNED: { variant: "warning" },
  IN_PROGRESS: { variant: "warning" },
  RESOLVED: { variant: "success" },
  VERIFIED: { variant: "success" },
  CLOSED: { variant: "secondary" },
  REOPENED: { variant: "destructive" },
};

export default function AdminTickets() {
  const { user, authLoading, logout } = useAuth();
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

  const loadData = async () => {
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
      setError("Failed to load campus tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
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
          t.reportedArea,
          t.department,
          locationCache[t.locationId],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      });
    }

    if (statusFilter !== "ALL") {
      result = result.filter((t) => t.status === statusFilter);
    }

    if (priorityFilter !== "ALL") {
      if (priorityFilter.includes(",")) {
        const allowed = priorityFilter.split(",");
        result = result.filter((t) => allowed.includes(t.priority));
      } else {
        result = result.filter((t) => t.priority === priorityFilter);
      }
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
      VERIFIED: 5,
      CLOSED: 6,
      REOPENED: 0,
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

  const toggleSort = (field: "createdAt" | "priority" | "status") => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* ─── Apple Operations Navigation Bar ─── */}
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/85 border-b border-black/[0.06]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/admin" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-[#0071E3] flex items-center justify-center text-white shadow-xs">
                <Activity className="w-4 h-4" />
              </div>
              <span className="font-semibold text-base tracking-tight text-[#1D1D1F]">
                Campus Pulse
              </span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 text-xs font-medium">
              <Link
                to="/admin"
                className="px-3 py-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03] transition-colors"
              >
                Overview
              </Link>
              <Link
                to="/admin/tickets"
                className="px-3 py-1.5 rounded-lg bg-black/[0.05] text-[#1D1D1F]"
              >
                Tickets
              </Link>
              <Link
                to="/admin/locations"
                className="px-3 py-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03] transition-colors"
              >
                Locations
              </Link>
              <Link
                to="/admin/qr"
                className="px-3 py-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03] transition-colors"
              >
                QR Codes
              </Link>
              <Link
                to="/admin/organization"
                className="px-3 py-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03] transition-colors"
              >
                Settings
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              className="h-9 px-3 text-xs rounded-xl border-black/10 flex items-center gap-1.5 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#6E6E73] ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

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
        {/* Page Title & Stats Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              Ticket Operations
            </h1>
            <p className="text-xs text-[#86868B] mt-0.5">
              Live campus maintenance issues, assignments, and resolution audits.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#86868B]">
              Showing <span className="font-semibold text-[#1D1D1F]">{filtered.length}</span> of {tickets.length} tickets
            </span>
          </div>
        </div>

        {/* ─── Search & Filters Bar (iOS Toolbar) ─── */}
        <div className="bg-white border border-black/[0.08] rounded-2xl p-4 shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3.5 w-4 h-4 text-[#86868B]" />
              <Input
                placeholder="Search by ticket ID, title, facility, department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-11 text-xs"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3.5 top-3.5 text-[#86868B] hover:text-[#1D1D1F]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2.5">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[140px] h-11 text-xs">
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
                <SelectTrigger className="w-[120px] h-11 text-xs">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Priority</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[140px] h-11 text-xs">
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
          </div>
        </div>

        {/* ─── Ticket List Table (Desktop) & Cards (Mobile) ─── */}
        {error && (
          <div className="rounded-2xl border border-[#FF3B30]/20 bg-[#FEECEC] p-4 text-xs text-[#D70015]">
            {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white border border-black/[0.08] rounded-2xl p-12 text-center">
            <RefreshCw className="w-6 h-6 animate-spin text-[#0071E3] mx-auto" />
            <p className="text-xs text-[#86868B] mt-2 font-medium">Loading tickets...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white border border-black/[0.08] rounded-2xl p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#F5F5F7] text-[#86868B] mx-auto flex items-center justify-center">
              <Search className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-[#1D1D1F]">No Matching Tickets</h3>
              <p className="text-xs text-[#6E6E73]">
                Try adjusting your search criteria or resetting filters.
              </p>
            </div>
            {(search || statusFilter !== "ALL" || priorityFilter !== "ALL" || categoryFilter !== "ALL") && (
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-9 rounded-xl"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setPriorityFilter("ALL");
                  setCategoryFilter("ALL");
                }}
              >
                Reset All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-black/[0.08] rounded-2xl overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#FAFAFC] border-b border-black/[0.06] text-[#86868B] font-semibold uppercase tracking-wider">
                    <th className="py-3 px-4 cursor-pointer" onClick={() => toggleSort("createdAt")}>
                      <div className="flex items-center gap-1.5">
                        Ticket Ref <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Subject & Description</th>
                    <th className="py-3 px-4">Facility / Location</th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => toggleSort("priority")}>
                      <div className="flex items-center gap-1.5">
                        Priority <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4 cursor-pointer" onClick={() => toggleSort("status")}>
                      <div className="flex items-center gap-1.5">
                        Status <ArrowUpDown className="w-3 h-3" />
                      </div>
                    </th>
                    <th className="py-3 px-4">Reported</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-black/[0.04]">
                  {filtered.map((t) => (
                    <tr
                      key={t.id}
                      onClick={() => navigate(`/admin/tickets/${t.id}`)}
                      className="hover:bg-[#F5F5F7]/80 transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#1D1D1F]">
                        {t.ticketId}
                      </td>

                      <td className="py-3.5 px-4 max-w-xs">
                        <div className="font-semibold text-[#1D1D1F] truncate group-hover:text-[#0071E3] transition-colors">
                          {t.title}
                        </div>
                        <div className="text-[#86868B] truncate mt-0.5">
                          {t.description}
                        </div>
                      </td>

                      <td className="py-3.5 px-4 text-[#6E6E73] max-w-[180px]">
                        <div className="truncate font-medium text-[#1D1D1F]">
                          {locationCache[t.locationId] || t.reportedArea || t.qrId}
                        </div>
                        <div className="text-[11px] text-[#86868B] truncate">
                          {t.department || "Operations"}
                        </div>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={priorityConfig[t.priority]?.variant || "secondary"}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {priorityConfig[t.priority]?.label || t.priority}
                        </Badge>
                      </td>

                      <td className="py-3.5 px-4">
                        <Badge
                          variant={statusConfig[t.status]?.variant || "outline"}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {t.status.replace(/_/g, " ")}
                        </Badge>
                        {t.slaBreached && !["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status) && (
                          <span className="block text-[10px] text-[#D70015] font-semibold mt-0.5">
                            SLA Breached
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-[#86868B]">
                        {t.createdAt.toLocaleDateString([], { month: "short", day: "numeric" })}
                        <span className="block text-[11px] text-[#86868B]">
                          {t.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      </td>

                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2.5 text-xs text-[#0071E3] rounded-lg group-hover:bg-white transition-colors"
                        >
                          Details →
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Operations Console • Ticket Management
      </footer>
    </div>
  );
}
