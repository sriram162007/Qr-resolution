import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  QrCode,
  Search,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Zap,
  CheckCircle2,
  Clock,
  Building2,
  Lock,
} from "lucide-react";

export default function LandingPage() {
  const [ticketQuery, setTicketQuery] = useState("");
  const navigate = useNavigate();

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = ticketQuery.trim();
    if (!cleaned) return;
    navigate(`/track/${cleaned}`);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* ─── Apple-style Frosted Header ─── */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 border-b border-black/[0.06]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#0071E3] flex items-center justify-center text-white shadow-xs">
              <QrCode className="w-4 h-4" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-[#1D1D1F]">
                Campus Pulse
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs text-[#86868B] font-normal">
                Facility Operations
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-2 text-xs font-medium text-[#1B873F] bg-[#EAF8EE] border border-[#C3ECD1] px-2.5 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#34C759] animate-pulse" />
              Facility Operations Active
            </div>
            <Button asChild variant="outline" size="sm" className="h-9 px-3.5 text-xs font-medium rounded-xl">
              <Link to="/login" className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#6E6E73]" />
                Staff Portal
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* ─── Hero Section ─── */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-12 pb-20">
        <div className="max-w-3xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F5F5F7] border border-black/[0.06] text-xs font-medium text-[#6E6E73]">
            <Sparkles className="w-3.5 h-3.5 text-[#0071E3]" />
            AI-Driven Campus Facility Management
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1D1D1F] leading-[1.08]">
            Report and resolve campus issues in seconds.
          </h1>

          <p className="text-lg sm:text-xl text-[#6E6E73] font-normal leading-relaxed max-w-2xl mx-auto">
            Scan any facility QR code across classrooms, labs, and hostels. Our multimodal AI routes your request directly to campus maintenance with live tracking and verified resolution proof.
          </p>

          {/* ─── Quick Ticket Tracking Input ─── */}
          <div className="pt-4 max-w-md mx-auto">
            <form onSubmit={handleTrack} className="flex items-center gap-2 p-1.5 bg-white border border-black/10 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus-within:ring-4 focus-within:ring-[#0071E3]/10 focus-within:border-[#0071E3] transition-all">
              <div className="pl-3 text-[#86868B]">
                <Search className="w-4 h-4" />
              </div>
              <Input
                type="text"
                value={ticketQuery}
                onChange={(e) => setTicketQuery(e.target.value)}
                placeholder="Enter Ticket ID (e.g. TKT-B7E209)"
                className="h-10 border-0 shadow-none px-2 focus:ring-0 text-sm font-mono placeholder:font-sans placeholder:text-[#86868B]"
              />
              <Button type="submit" size="sm" className="h-10 px-4 rounded-xl font-medium shrink-0">
                Track
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </form>
            <p className="text-xs text-[#86868B] mt-2 text-center">
              Received an SMS or WhatsApp link? You can paste your ticket code above.
            </p>
          </div>
        </div>

        {/* ─── Campus Demo Facilities (Instant Test Bar) ─── */}
        <div className="mt-14 pt-8 border-t border-black/[0.06]">
          <div className="text-center space-y-1 mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[#86868B]">
              Campus QR Quick Access Demo
            </h2>
            <p className="text-sm text-[#6E6E73]">
              Select a facility below to simulate scanning a physical location QR tag:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 max-w-3xl mx-auto">
            <Link
              to="/report/LIB-204"
              className="group p-4 bg-white border border-black/[0.07] hover:border-[#0071E3]/40 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.08)] transition-all flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] group-hover:bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0 transition-colors">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-mono text-[#86868B]">QR: LIB-204</div>
                <div className="text-sm font-semibold text-[#1D1D1F] truncate group-hover:text-[#0071E3] transition-colors">
                  Central Library • 2nd Floor
                </div>
                <div className="text-xs text-[#6E6E73] mt-0.5">Reading Room 204 (Electrical/HVAC)</div>
              </div>
            </Link>

            <Link
              to="/report/ENG-LAB3"
              className="group p-4 bg-white border border-black/[0.07] hover:border-[#0071E3]/40 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.08)] transition-all flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] group-hover:bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0 transition-colors">
                <Zap className="w-5 h-5" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-mono text-[#86868B]">QR: ENG-LAB3</div>
                <div className="text-sm font-semibold text-[#1D1D1F] truncate group-hover:text-[#0071E3] transition-colors">
                  Engineering Block • Ground Fl.
                </div>
                <div className="text-xs text-[#6E6E73] mt-0.5">Robotics & IoT Lab (Hardware/Power)</div>
              </div>
            </Link>

            <Link
              to="/report/HST-B2"
              className="group p-4 bg-white border border-black/[0.07] hover:border-[#0071E3]/40 rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] hover:shadow-[0_4px_16px_rgba(0,113,227,0.08)] transition-all flex items-start gap-3.5"
            >
              <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] group-hover:bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0 transition-colors">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-xs font-mono text-[#86868B]">QR: HST-B2</div>
                <div className="text-sm font-semibold text-[#1D1D1F] truncate group-hover:text-[#0071E3] transition-colors">
                  Hostel Block B • 1st Floor
                </div>
                <div className="text-xs text-[#6E6E73] mt-0.5">Common Washroom (Plumbing/Civil)</div>
              </div>
            </Link>
          </div>
        </div>

        {/* ─── Apple-style Clean Bento Feature Pillars ─── */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 bg-white border border-black/[0.07] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] text-[#0071E3] flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
              Multimodal AI Triage
            </h3>
            <p className="text-sm text-[#6E6E73] leading-relaxed">
              Powered by Google Gemini 2.5 Flash to automatically detect severity, category, and transparent SLA priorities from photos and descriptions.
            </p>
          </div>

          <div className="p-6 bg-white border border-black/[0.07] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] text-[#0071E3] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
              Duplicate Suppression
            </h3>
            <p className="text-sm text-[#6E6E73] leading-relaxed">
              Classical TF-IDF cosine similarity groups repeated submissions at the same location, notifying all subscribers without cluttering work queues.
            </p>
          </div>

          <div className="p-6 bg-white border border-black/[0.07] rounded-2xl shadow-[0_1px_3px_rgba(0,0,0,0.02)] space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#F5F5F7] text-[#0071E3] flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="text-base font-semibold text-[#1D1D1F] tracking-tight">
              Resolution Verification
            </h3>
            <p className="text-sm text-[#6E6E73] leading-relaxed">
              Maintenance staff upload photographic proof. Tickets close only after students confirm satisfaction or auto-escalate if SLA limits expire.
            </p>
          </div>
        </div>
      </main>

      {/* ─── Footer ─── */}
      <footer className="border-t border-black/[0.06] bg-white py-8 text-center text-xs text-[#86868B]">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} Campus Pulse. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link to="/login" className="hover:text-[#1D1D1F] transition-colors">
              Staff Portal
            </Link>
            <span className="text-black/20">•</span>
            <a href="#privacy" className="hover:text-[#1D1D1F] transition-colors">
              Privacy & Data Policy
            </a>
            <span className="text-black/20">•</span>
            <a href="#help" className="hover:text-[#1D1D1F] transition-colors">
              Campus Helpdesk
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
