import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getTickets } from "@/services/ticketService";
import { getOrganization } from "@/services/organizationService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Ticket, TicketPriority } from "@/types";
import {
  Clock,
  AlertTriangle,
  QrCode,
  Settings,
  LogOut,
  RefreshCw,
  Sparkles,
  ShieldCheck,
  Star,
  ArrowRight,
  TrendingUp,
  FileText,
  Building2,
  ChevronRight,
  Activity,
} from "lucide-react";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [slaCheckLoading, setSlaCheckLoading] = useState(false);
  const [slaMessage, setSlaMessage] = useState<string | null>(null);

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
      setError("Unable to load campus tickets. Please check database permissions.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, []);

  const handleRunSLACheck = async () => {
    setSlaCheckLoading(true);
    setSlaMessage(null);
    try {
      const response = await fetch("/api/check-sla", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      setSlaMessage(`SLA Scan: ${data.evaluated || 0} evaluated, ${data.escalated || 0} escalations triggered.`);
      await loadTickets();
      setTimeout(() => setSlaMessage(null), 5000);
    } catch {
      setSlaMessage("SLA check invocation failed.");
      setTimeout(() => setSlaMessage(null), 4000);
    } finally {
      setSlaCheckLoading(false);
    }
  };

  // Comprehensive analytics calculation
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

    const activeWork = open + triaged + assigned + inProgress + reopened;

    const highCritical = tickets.filter(
      (t) => (t.priority === "P1" || t.priority === "P2") && !["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status)
    ).length;

    const slaBreached = tickets.filter(
      (t) => t.slaBreached && !["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status)
    ).length;

    const needsReview = tickets.filter(
      (t) => t.needsAdminReview && !["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status)
    ).length;

    const duplicates = tickets.filter((t) => t.isDuplicate).length;
    const adminOverrides = tickets.filter((t) => !!t.adminOverrideReason).length;
    const withAnomalies = tickets.filter((t) => (t.anomalyFlags?.length ?? 0) > 0).length;

    // Average resolution time
    const resolvedWithTime = tickets.filter((t) => t.resolvedAt && t.createdAt);
    let avgResolutionMins = 0;
    if (resolvedWithTime.length > 0) {
      const totalMins = resolvedWithTime.reduce((sum, t) => {
        const resolvedDate = new Date(t.resolvedAt!);
        const createdDate = t.createdAt instanceof Date ? t.createdAt : new Date(t.createdAt);
        return sum + Math.max(0, (resolvedDate.getTime() - createdDate.getTime()) / 60000);
      }, 0);
      avgResolutionMins = Math.round(totalMins / resolvedWithTime.length);
    }

    // Average satisfaction rating
    const ratedTickets = tickets.filter((t) => typeof t.studentFeedbackRating === "number" && t.studentFeedbackRating > 0);
    const avgRating = ratedTickets.length > 0
      ? (ratedTickets.reduce((sum, t) => sum + (t.studentFeedbackRating || 0), 0) / ratedTickets.length).toFixed(1)
      : "N/A";

    // Urgent tickets queue (P1 & P2 open first)
    const urgentQueue = [...tickets]
      .filter((t) => !["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status))
      .sort((a, b) => {
        const pOrder: Record<TicketPriority, number> = { P1: 0, P2: 1, P3: 2, P4: 3 };
        const diff = pOrder[a.priority] - pOrder[b.priority];
        if (diff !== 0) return diff;
        return a.createdAt.getTime() - b.createdAt.getTime();
      })
      .slice(0, 5);

    // Department breakdown
    const byDepartment: Record<string, { total: number; pending: number }> = {};
    for (const t of tickets) {
      const dept = t.department || "Unassigned";
      if (!byDepartment[dept]) byDepartment[dept] = { total: 0, pending: 0 };
      byDepartment[dept].total++;
      if (!["RESOLVED", "VERIFIED", "CLOSED"].includes(t.status)) {
        byDepartment[dept].pending++;
      }
    }

    return {
      total,
      open,
      triaged,
      assigned,
      inProgress,
      resolved,
      verified,
      closed,
      reopened,
      activeWork,
      highCritical,
      slaBreached,
      needsReview,
      duplicates,
      adminOverrides,
      withAnomalies,
      avgResolutionMins,
      avgRating,
      ratedCount: ratedTickets.length,
      urgentQueue,
      byDepartment,
    };
  }, [tickets]);

  const formatMinsToHours = (mins: number) => {
    if (mins === 0) return "—";
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
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
                className="px-3 py-1.5 rounded-lg bg-black/[0.05] text-[#1D1D1F]"
              >
                Overview
              </Link>
              <Link
                to="/admin/tickets"
                className="px-3 py-1.5 rounded-lg text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03] transition-colors"
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
              onClick={handleRunSLACheck}
              disabled={slaCheckLoading}
              className="h-9 px-3 text-xs rounded-xl border-black/10 hidden sm:flex items-center gap-1.5 bg-white"
            >
              <Clock className={`w-3.5 h-3.5 text-[#FF9500] ${slaCheckLoading ? "animate-spin" : ""}`} />
              {slaCheckLoading ? "Scanning SLA..." : "Scan SLA"}
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadTickets}
              disabled={loading}
              className="h-9 px-3 text-xs rounded-xl border-black/10 flex items-center gap-1.5 bg-white"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#6E6E73] ${loading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
            <span className="text-[11px] text-[#86868B] hidden xl:inline">
              Updated {lastRefresh.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </span>

            <div className="h-4 w-px bg-black/10 mx-0.5 hidden sm:block" />

            <div className="flex items-center gap-2">
              <span className="text-xs text-[#86868B] hidden lg:inline truncate max-w-[150px]">
                {user?.email}
              </span>
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
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Error Notification */}
        {error && (
          <div className="rounded-2xl border border-[#FF3B30]/20 bg-[#FFF2F2] p-3.5 text-xs text-[#D70015] flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="text-xs hover:underline font-medium">
              Dismiss
            </button>
          </div>
        )}

        {/* SLA Notice Notification */}
        {slaMessage && (
          <div className="rounded-2xl border border-[#0071E3]/20 bg-[#EBF5FF] p-3.5 text-xs text-[#0071E3] flex items-center justify-between">
            <span>{slaMessage}</span>
            <button onClick={() => setSlaMessage(null)} className="text-xs hover:underline">
              Dismiss
            </button>
          </div>
        )}

        {/* ─── Critical Attention Banner (If risks exist) ─── */}
        {(stats.highCritical > 0 || stats.slaBreached > 0 || stats.needsReview > 0) && (
          <div className="bg-white border border-[#FF3B30]/20 rounded-2xl p-4 shadow-[0_2px_8px_rgba(255,59,48,0.04)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#FF3B30]/10 text-[#D70015] flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-[#D70015] uppercase tracking-wider">
                  Operational Attention Required
                </div>
                <div className="text-xs text-[#6E6E73]">
                  {stats.slaBreached > 0 && <span className="font-semibold text-[#1D1D1F] mr-2">{stats.slaBreached} SLA Breached</span>}
                  {stats.highCritical > 0 && <span className="font-semibold text-[#1D1D1F] mr-2">{stats.highCritical} Critical P1/P2</span>}
                  {stats.needsReview > 0 && <span className="font-semibold text-[#1D1D1F]">{stats.needsReview} Manual Review</span>}
                </div>
              </div>
            </div>

            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 px-3 text-xs border-[#FF3B30]/30 text-[#D70015] hover:bg-[#FEECEC] rounded-xl self-end sm:self-center"
            >
              <Link to="/admin/tickets?priority=P1,P2">
                Inspect Urgent Queue
                <ArrowRight className="w-3 h-3 ml-1" />
              </Link>
            </Button>
          </div>
        )}

        {/* ─── Executive KPI Cards (4 High-Impact Pillars) ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Link to="/admin/tickets" className="group">
            <Card className="hover:border-[#0071E3]/40 transition-all cursor-pointer">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-[#86868B]">
                  <span>Active Work Queue</span>
                  <Activity className="w-4 h-4 text-[#0071E3]" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-[#1D1D1F]">
                  {stats.activeWork}
                </div>
                <div className="text-[11px] text-[#6E6E73] flex items-center justify-between pt-1 border-t border-black/[0.04]">
                  <span>{stats.open} Unassigned</span>
                  <span className="font-medium text-[#0071E3] group-hover:translate-x-0.5 transition-transform">
                    View all →
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link to="/admin/tickets?priority=P1,P2" className="group">
            <Card className="hover:border-[#FF9500]/40 transition-all cursor-pointer">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-[#86868B]">
                  <span>SLA Overdue & Risk</span>
                  <Clock className="w-4 h-4 text-[#FF9500]" />
                </div>
                <div className="text-3xl font-bold tracking-tight text-[#1D1D1F]">
                  {stats.slaBreached}
                </div>
                <div className="text-[11px] text-[#6E6E73] flex items-center justify-between pt-1 border-t border-black/[0.04]">
                  <span>{stats.highCritical} High Priority</span>
                  <span className="font-medium text-[#FF9500] group-hover:translate-x-0.5 transition-transform">
                    Review →
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-[#86868B]">
                <span>Avg Resolution Time</span>
                <TrendingUp className="w-4 h-4 text-[#1B873F]" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-[#1D1D1F]">
                {formatMinsToHours(stats.avgResolutionMins)}
              </div>
              <div className="text-[11px] text-[#6E6E73] pt-1 border-t border-black/[0.04]">
                Across completed tickets
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-[#86868B]">
                <span>Student Satisfaction</span>
                <Star className="w-4 h-4 text-[#FF9500] fill-[#FF9500]" />
              </div>
              <div className="text-3xl font-bold tracking-tight text-[#1D1D1F] flex items-baseline gap-1">
                <span>{stats.avgRating}</span>
                <span className="text-sm font-normal text-[#86868B]">/ 5</span>
              </div>
              <div className="text-[11px] text-[#6E6E73] pt-1 border-t border-black/[0.04]">
                {stats.ratedCount} student verification ratings
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ─── Split Operational Workspace (Bento Grid) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2 spans): Urgent Queue & Department Allocation */}
          <div className="lg:col-span-2 space-y-6">
            {/* Urgent Tickets Queue */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06] flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[#1D1D1F]">
                    Priority Resolution Queue
                  </h2>
                  <p className="text-xs text-[#86868B]">
                    Critical campus issues requiring immediate operational dispatch
                  </p>
                </div>
                <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-[#0071E3]">
                  <Link to="/admin/tickets">View All</Link>
                </Button>
              </div>

              <div className="divide-y divide-black/[0.04]">
                {stats.urgentQueue.length === 0 ? (
                  <div className="p-8 text-center text-xs text-[#86868B]">
                    No urgent open complaints pending. All critical queues clear!
                  </div>
                ) : (
                  stats.urgentQueue.map((ticket) => (
                    <div
                      key={ticket.id}
                      onClick={() => navigate(`/admin/tickets/${ticket.id}`)}
                      className="p-4 hover:bg-[#F5F5F7]/80 transition-colors cursor-pointer flex items-center justify-between gap-4"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-[#1D1D1F]">
                            {ticket.ticketId}
                          </span>
                          <Badge
                            variant={
                              ticket.priority === "P1" ? "destructive" :
                              ticket.priority === "P2" ? "warning" : "secondary"
                            }
                            className="text-[10px] px-2 py-0"
                          >
                            {ticket.priority}
                          </Badge>
                          <span className="text-[11px] text-[#86868B]">
                            {ticket.department || "Operations"}
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-[#1D1D1F] truncate">
                          {ticket.title}
                        </h3>
                        <p className="text-xs text-[#6E6E73] truncate">
                          {ticket.reportedArea || ticket.qrId} • {ticket.description}
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px]">
                          {ticket.status}
                        </Badge>
                        <div className="text-[11px] text-[#86868B] mt-1">
                          {ticket.createdAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>

            {/* Department Breakdown */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06]">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Department Workload Distribution
                </h2>
                <p className="text-xs text-[#86868B]">
                  Active vs resolved allocation across campus facilities
                </p>
              </div>

              <div className="p-5 space-y-4">
                {Object.keys(stats.byDepartment).length === 0 ? (
                  <p className="text-xs text-[#86868B] text-center py-4">No departmental data available.</p>
                ) : (
                  Object.entries(stats.byDepartment).map(([dept, data]) => {
                    const resolvedCount = data.total - data.pending;
                    const percent = data.total > 0 ? Math.round((resolvedCount / data.total) * 100) : 0;
                    return (
                      <div key={dept} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-medium text-[#1D1D1F]">{dept}</span>
                          <span className="text-[#6E6E73]">
                            <span className="font-semibold text-[#1D1D1F]">{data.pending} active</span> / {data.total} total ({percent}%)
                          </span>
                        </div>
                        <div className="h-2 w-full bg-[#F5F5F7] rounded-full overflow-hidden p-0.5 border border-black/[0.04]">
                          <div
                            className="h-full bg-[#0071E3] rounded-full transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* Right Column (1 span): Pipeline Status & System Controls */}
          <div className="space-y-6">
            {/* Status Breakdown Segment */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06]">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Pipeline Status
                </h2>
                <p className="text-xs text-[#86868B]">
                  Live lifecycle state distribution
                </p>
              </div>

              <div className="p-5 space-y-2.5 text-xs">
                {[
                  { label: "Open (Unassigned)", count: stats.open, color: "bg-[#0071E3]" },
                  { label: "Triaged (Review)", count: stats.triaged, color: "bg-[#AF52DE]" },
                  { label: "Assigned (Work in queue)", count: stats.assigned, color: "bg-[#FF9500]" },
                  { label: "In Progress (Field tech active)", count: stats.inProgress, color: "bg-[#FF9500]" },
                  { label: "Resolved (Evidence uploaded)", count: stats.resolved, color: "bg-[#34C759]" },
                  { label: "Verified & Closed", count: stats.verified + stats.closed, color: "bg-[#1B873F]" },
                  { label: "Reopened by Student", count: stats.reopened, color: "bg-[#FF3B30]" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-1 border-b border-black/[0.03] last:border-0">
                    <div className="flex items-center gap-2 text-[#6E6E73]">
                      <span className={`w-2 h-2 rounded-full ${item.color}`} />
                      <span>{item.label}</span>
                    </div>
                    <span className="font-semibold text-[#1D1D1F]">{item.count}</span>
                  </div>
                ))}
              </div>
            </Card>

            {/* AI Intelligence & Quality Metrics */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06]">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Automation & Quality
                </h2>
                <p className="text-xs text-[#86868B]">
                  Gemini & deduplication performance
                </p>
              </div>

              <div className="p-5 space-y-3.5 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#6E6E73]">
                    <Sparkles className="w-4 h-4 text-[#0071E3]" />
                    <span>Duplicates Suppressed</span>
                  </div>
                  <span className="font-semibold text-[#1D1D1F]">{stats.duplicates}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#6E6E73]">
                    <ShieldCheck className="w-4 h-4 text-[#1B873F]" />
                    <span>Manual AI Overrides</span>
                  </div>
                  <span className="font-semibold text-[#1D1D1F]">{stats.adminOverrides}</span>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[#6E6E73]">
                    <AlertTriangle className="w-4 h-4 text-[#FF9500]" />
                    <span>Advisory Anomaly Flags</span>
                  </div>
                  <span className="font-semibold text-[#1D1D1F]">{stats.withAnomalies}</span>
                </div>
              </div>
            </Card>

            {/* Quick Actions Shortcuts */}
            <Card>
              <div className="p-5 pb-3 border-b border-black/[0.06]">
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Quick Management
                </h2>
              </div>
              <div className="p-3 divide-y divide-black/[0.04] text-xs font-medium">
                <Link
                  to="/admin/tickets"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F5F5F7] transition-colors text-[#1D1D1F]"
                >
                  <span className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#0071E3]" />
                    Manage All Tickets
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#86868B]" />
                </Link>

                <Link
                  to="/admin/locations"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F5F5F7] transition-colors text-[#1D1D1F]"
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-[#0071E3]" />
                    Campus Locations
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#86868B]" />
                </Link>

                <Link
                  to="/admin/qr"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F5F5F7] transition-colors text-[#1D1D1F]"
                >
                  <span className="flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-[#0071E3]" />
                    Facility QR Tags
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#86868B]" />
                </Link>

                <Link
                  to="/admin/organization"
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-[#F5F5F7] transition-colors text-[#1D1D1F]"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-[#0071E3]" />
                    Campus Organization Settings
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-[#86868B]" />
                </Link>
              </div>
            </Card>
          </div>
        </div>
      </main>

      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Operations Console • Live Monitoring Active
      </footer>
    </div>
  );
}
