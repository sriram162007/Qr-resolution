import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTickets } from "@/services/ticketService";
import { getOrganization } from "@/services/organizationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Ticket } from "@/types";
import {
  BarChart3,
  Clock,
  AlertTriangle,
  CheckCircle,
  Users,
  TrendingUp,
  QrCode,
  MapPin,
  Settings,
  LogOut,
  RefreshCw,
  Zap,
  Shield,
  Star,
  MessageSquare,
} from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  Electrical: "#f59e0b",
  Plumbing: "#3b82f6",
  Cleaning: "#10b981",
  Civil: "#8b5cf6",
  Hostel: "#ec4899",
  Laboratory: "#06b6d4",
  Other: "#6b7280",
};

function StatCard({
  label,
  value,
  color,
  icon: Icon,
  trend,
}: {
  label: string;
  value: number | string;
  color?: string;
  icon: React.ElementType;
  trend?: string;
}) {
  return (
    <Card className="bg-slate-900 border-slate-700 hover:border-slate-600 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">{label}</p>
            <p className="text-2xl font-bold mt-1" style={{ color: color || "#ffffff" }}>
              {value}
            </p>
            {trend && <p className="text-xs text-slate-500 mt-1">{trend}</p>}
          </div>
          <div className="p-2 rounded-lg bg-slate-800">
            <Icon className="h-5 w-5" style={{ color: color || "#94a3b8" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [slaCheckLoading, setSlaCheckLoading] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  const loadTickets = async () => {
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
      setLastRefresh(new Date());
    } catch {
      setError("Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleRunSLACheck = async () => {
    setSlaCheckLoading(true);
    try {
      const response = await fetch("/api/check-sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok) {
        alert(`✅ SLA Check Complete\n\nChecked: ${data.checked} tickets\nEscalated: ${data.escalated}\n  Level 1: ${data.level1}\n  Level 2: ${data.level2}`);
        await loadTickets();
      } else {
        alert(`❌ SLA Check failed: ${data.message}`);
      }
    } catch {
      alert("SLA Check failed: Network error");
    } finally {
      setSlaCheckLoading(false);
    }
  };

  const stats = useMemo(() => {
    const total = tickets.length;
    const open = tickets.filter((t) => t.status === "OPEN").length;
    const triaged = tickets.filter((t) => t.status === "TRIAGED").length;
    const assigned = tickets.filter((t) => t.status === "ASSIGNED").length;
    const inProgress = tickets.filter((t) => t.status === "IN_PROGRESS").length;
    const resolved = tickets.filter((t) => t.status === "RESOLVED").length;
    const verified = tickets.filter((t) => t.status === "VERIFIED").length;
    const closed = tickets.filter((t) => t.status === "CLOSED").length;
    const reopened = tickets.filter((t) => t.status === "REOPENED").length;

    const highCritical = tickets.filter((t) => t.priority === "P1" || t.priority === "P2").length;
    const slaBreached = tickets.filter((t) => t.slaBreached && !["VERIFIED", "CLOSED"].includes(t.status)).length;
    const escalated = tickets.filter((t) => (t.escalations?.length ?? 0) > 0).length;
    const duplicates = tickets.filter((t) => t.isDuplicate).length;
    const needsReview = tickets.filter((t) => (t as any).needsAdminReview).length;
    const adminOverrides = tickets.filter((t) => t.adminOverride).length;
    const withAnomalies = tickets.filter((t) => (t.anomalyFlags?.length ?? 0) > 0 && !["VERIFIED", "CLOSED"].includes(t.status)).length;

    // Average resolution time (from resolved/closed tickets)
    const resolvedTickets = tickets.filter((t) => t.resolvedInMins != null);
    const avgResolutionMins = resolvedTickets.length > 0
      ? Math.round(resolvedTickets.reduce((sum, t) => sum + (t.resolvedInMins ?? 0), 0) / resolvedTickets.length)
      : null;

    // Average response time (time to ASSIGNED from OPEN) — approximate via createdAt and activities
    const withFeedback = tickets.filter((t) => t.studentFeedbackRating != null);
    const avgRating = withFeedback.length > 0
      ? (withFeedback.reduce((sum, t) => sum + (t.studentFeedbackRating ?? 0), 0) / withFeedback.length).toFixed(1)
      : null;

    // Department breakdown
    const byDepartment: Record<string, number> = {};
    for (const t of tickets) {
      const dept = t.department || "Unassigned";
      byDepartment[dept] = (byDepartment[dept] ?? 0) + 1;
    }

    // Category breakdown
    const byCategory: Record<string, number> = {};
    for (const t of tickets) {
      byCategory[t.category] = (byCategory[t.category] ?? 0) + 1;
    }

    // Priority breakdown
    const byPriority: Record<string, number> = { P1: 0, P2: 0, P3: 0, P4: 0 };
    for (const t of tickets) byPriority[t.priority] = (byPriority[t.priority] ?? 0) + 1;

    return {
      total, open, triaged, assigned, inProgress, resolved, verified, closed, reopened,
      highCritical, slaBreached, escalated, duplicates, needsReview, adminOverrides,
      withAnomalies, avgResolutionMins, avgRating, byDepartment, byCategory, byPriority,
      withFeedbackCount: withFeedback.length,
    };
  }, [tickets]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      {/* ─── Top Nav ─── */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-2xl">🏛️</div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">Campus Complaint System</h1>
                <p className="text-xs text-slate-400">Admin Dashboard · {user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleRunSLACheck}
                disabled={slaCheckLoading}
                className="border-slate-600 text-slate-300 text-xs"
              >
                <Zap className="h-3 w-3 mr-1" />
                {slaCheckLoading ? "Running..." : "Run SLA Check"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={loadTickets}
                disabled={loading}
                className="border-slate-600 text-slate-300 text-xs"
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 text-xs">
                <LogOut className="h-3 w-3 mr-1" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-900/20 p-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* ─── Quick Nav ─── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link to="/admin/tickets" className="group">
            <Card className="bg-slate-900 border-slate-700 hover:border-blue-500/50 hover:bg-slate-800/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <MessageSquare className="h-6 w-6 mx-auto text-blue-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">All Tickets</p>
                <p className="text-xs text-slate-500 mt-0.5">View & manage</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/locations" className="group">
            <Card className="bg-slate-900 border-slate-700 hover:border-purple-500/50 hover:bg-slate-800/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <MapPin className="h-6 w-6 mx-auto text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">Locations</p>
                <p className="text-xs text-slate-500 mt-0.5">Buildings & rooms</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/qr" className="group">
            <Card className="bg-slate-900 border-slate-700 hover:border-green-500/50 hover:bg-slate-800/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <QrCode className="h-6 w-6 mx-auto text-green-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">QR Codes</p>
                <p className="text-xs text-slate-500 mt-0.5">Generate & manage</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/admin/organization" className="group">
            <Card className="bg-slate-900 border-slate-700 hover:border-yellow-500/50 hover:bg-slate-800/50 transition-all cursor-pointer">
              <CardContent className="p-4 text-center">
                <Settings className="h-6 w-6 mx-auto text-yellow-400 mb-2 group-hover:scale-110 transition-transform" />
                <p className="text-sm font-medium text-white">Organization</p>
                <p className="text-xs text-slate-500 mt-0.5">Settings</p>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* ─── Alert Cards (action needed) ─── */}
        {(stats.highCritical > 0 || stats.slaBreached > 0 || stats.needsReview > 0 || stats.withAnomalies > 0) && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">⚠️ Attention Required</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {stats.highCritical > 0 && (
                <Link to="/admin/tickets?priority=P1,P2">
                  <Card className="bg-red-900/20 border-red-500/40 hover:border-red-500/60 cursor-pointer transition-colors">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertTriangle className="h-8 w-8 text-red-400 flex-shrink-0" />
                      <div>
                        <p className="text-2xl font-bold text-red-400">{stats.highCritical}</p>
                        <p className="text-xs text-red-300">High / Critical</p>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              )}
              {stats.slaBreached > 0 && (
                <Card className="bg-orange-900/20 border-orange-500/40">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Clock className="h-8 w-8 text-orange-400 flex-shrink-0" />
                    <div>
                      <p className="text-2xl font-bold text-orange-400">{stats.slaBreached}</p>
                      <p className="text-xs text-orange-300">SLA Overdue</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {stats.needsReview > 0 && (
                <Card className="bg-yellow-900/20 border-yellow-500/40">
                  <CardContent className="p-4 flex items-center gap-3">
                    <Shield className="h-8 w-8 text-yellow-400 flex-shrink-0" />
                    <div>
                      <p className="text-2xl font-bold text-yellow-400">{stats.needsReview}</p>
                      <p className="text-xs text-yellow-300">Needs Manual Review</p>
                    </div>
                  </CardContent>
                </Card>
              )}
              {stats.withAnomalies > 0 && (
                <Card className="bg-purple-900/20 border-purple-500/40">
                  <CardContent className="p-4 flex items-center gap-3">
                    <TrendingUp className="h-8 w-8 text-purple-400 flex-shrink-0" />
                    <div>
                      <p className="text-2xl font-bold text-purple-400">{stats.withAnomalies}</p>
                      <p className="text-xs text-purple-300">Anomaly Flags</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}

        {/* ─── Main Stats Grid ─── */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">📊 Ticket Overview</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            <StatCard label="Total" value={stats.total} icon={BarChart3} color="#94a3b8" />
            <StatCard label="Open" value={stats.open} icon={MessageSquare} color="#3b82f6" />
            <StatCard label="Triaged" value={stats.triaged} icon={Zap} color="#8b5cf6" />
            <StatCard label="Assigned" value={stats.assigned} icon={Users} color="#f59e0b" />
            <StatCard label="In Progress" value={stats.inProgress} icon={Clock} color="#f97316" />
            <StatCard label="Resolved" value={stats.resolved} icon={CheckCircle} color="#22c55e" />
            <StatCard label="Verified" value={stats.verified} icon={Shield} color="#10b981" />
            <StatCard label="Closed" value={stats.closed} icon={Shield} color="#6b7280" />
            <StatCard label="Reopened" value={stats.reopened} icon={RefreshCw} color="#f97316" />
            <StatCard label="Escalated" value={stats.escalated} icon={AlertTriangle} color="#ef4444" />
            <StatCard label="Duplicates" value={stats.duplicates} icon={MessageSquare} color="#6366f1" />
            <StatCard label="AI Overrides" value={stats.adminOverrides} icon={Zap} color="#ec4899" />
          </div>
        </div>

        {/* ─── Performance Metrics ─── */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">⚡ Performance Metrics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <p className="text-sm font-medium text-white">Avg. Resolution Time</p>
                </div>
                <p className="text-2xl font-bold text-blue-400">
                  {stats.avgResolutionMins != null
                    ? stats.avgResolutionMins >= 60
                      ? `${Math.floor(stats.avgResolutionMins / 60)}h ${stats.avgResolutionMins % 60}m`
                      : `${stats.avgResolutionMins} mins`
                    : "—"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Based on {tickets.filter((t) => t.resolvedInMins != null).length} resolved tickets
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Star className="h-5 w-5 text-yellow-400" />
                  <p className="text-sm font-medium text-white">Student Satisfaction</p>
                </div>
                <p className="text-2xl font-bold text-yellow-400">
                  {stats.avgRating ? `${stats.avgRating}/5` : "—"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.withFeedbackCount} feedback{stats.withFeedbackCount !== 1 ? "s" : ""} received
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-3">
                  <TrendingUp className="h-5 w-5 text-green-400" />
                  <p className="text-sm font-medium text-white">Resolution Rate</p>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {stats.total > 0
                    ? `${Math.round(((stats.resolved + stats.verified + stats.closed) / stats.total) * 100)}%`
                    : "—"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {stats.resolved + stats.verified + stats.closed} of {stats.total} tickets
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* ─── Department Breakdown ─── */}
        {Object.keys(stats.byDepartment).length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">🏢 Department Breakdown</h2>
            <Card className="bg-slate-900 border-slate-700">
              <CardContent className="p-5">
                <div className="space-y-3">
                  {Object.entries(stats.byDepartment)
                    .sort(([, a], [, b]) => b - a)
                    .map(([dept, count]) => (
                      <div key={dept} className="flex items-center gap-3">
                        <div className="w-24 text-xs text-slate-300 truncate">{dept}</div>
                        <div className="flex-1 bg-slate-800 rounded-full h-2">
                          <div
                            className="h-2 rounded-full bg-blue-500 transition-all"
                            style={{ width: `${(count / stats.total) * 100}%` }}
                          />
                        </div>
                        <div className="text-xs font-bold text-white w-8 text-right">{count}</div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ─── Category Breakdown ─── */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">📂 Category Breakdown</h2>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(stats.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([cat, count]) => (
                    <div key={cat} className="rounded-lg bg-slate-800 p-3 text-center">
                      <p className="text-xl font-bold text-white">{count}</p>
                      <p className="text-xs mt-1" style={{ color: CATEGORY_COLORS[cat] || "#94a3b8" }}>{cat}</p>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Priority Breakdown ─── */}
        <div className="space-y-2">
          <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">🔴 Priority Breakdown</h2>
          <div className="grid grid-cols-4 gap-3">
            {[
              { p: "P1", label: "Critical", color: "#ef4444" },
              { p: "P2", label: "High", color: "#f97316" },
              { p: "P3", label: "Medium", color: "#eab308" },
              { p: "P4", label: "Low", color: "#22c55e" },
            ].map(({ p, label, color }) => (
              <Card key={p} className="bg-slate-900 border-slate-700">
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold" style={{ color }}>{stats.byPriority[p] ?? 0}</p>
                  <p className="text-xs text-slate-400 mt-1">{p} — {label}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* ─── Recent Activity ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">🕐 Recent Tickets</h2>
            <Link to="/admin/tickets" className="text-xs text-blue-400 hover:text-blue-300">View all →</Link>
          </div>
          <Card className="bg-slate-900 border-slate-700">
            <CardContent className="p-0">
              {loading ? (
                <div className="p-8 text-center">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent mx-auto" />
                </div>
              ) : tickets.length === 0 ? (
                <p className="p-6 text-center text-slate-500 text-sm">No tickets yet.</p>
              ) : (
                <div className="divide-y divide-slate-800">
                  {tickets.slice(0, 8).map((ticket) => (
                    <Link key={ticket.id} to={`/admin/tickets/${ticket.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 transition-colors">
                      <div className="flex-shrink-0">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          ticket.priority === "P1" ? "bg-red-400" :
                          ticket.priority === "P2" ? "bg-orange-400" :
                          ticket.priority === "P3" ? "bg-yellow-400" : "bg-green-400"
                        }`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">{ticket.title}</p>
                        <p className="text-xs text-slate-500 truncate">{ticket.ticketId} · {ticket.category}</p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          ticket.status === "OPEN" ? "bg-blue-900/50 text-blue-400" :
                          ticket.status === "RESOLVED" || ticket.status === "VERIFIED" ? "bg-green-900/50 text-green-400" :
                          ticket.status === "CLOSED" ? "bg-slate-800 text-slate-500" :
                          "bg-slate-800 text-slate-300"
                        }`}>
                          {ticket.status.replace(/_/g, " ")}
                        </span>
                        {ticket.slaBreached && (
                          <p className="text-[10px] text-orange-400 mt-0.5">SLA ⚠️</p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <p className="text-xs text-center text-slate-700 pb-4">
          Last refreshed: {lastRefresh.toLocaleTimeString()}
        </p>
      </div>
    </div>
  );
}
