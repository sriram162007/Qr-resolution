import { Link, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Activity,
  LogOut,
  FileText,
  Building2,
  QrCode,
  Settings,
} from "lucide-react";

export default function AdminNavbar() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const navLinks = [
    { name: "Overview", path: "/admin", icon: Activity },
    { name: "Tickets", path: "/admin/tickets", icon: FileText },
    { name: "Locations", path: "/admin/locations", icon: Building2 },
    { name: "QR Codes", path: "/admin/qr", icon: QrCode },
    { name: "Settings", path: "/admin/organization", icon: Settings },
  ];

  return (
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
            {navLinks.map((link) => {
              const isActive =
                link.path === "/admin"
                  ? location.pathname === "/admin"
                  : location.pathname.startsWith(link.path);
              return (
                <Link
                  key={link.name}
                  to={link.path}
                  className={`px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-black/[0.05] text-[#1D1D1F] font-semibold"
                      : "text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-black/[0.03]"
                  }`}
                >
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-[#86868B] hidden sm:inline truncate max-w-[180px]">
            {user?.email}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={logout}
            className="h-9 px-2.5 text-xs text-[#6E6E73] hover:text-[#D70015] rounded-xl"
            title="Log out"
          >
            <LogOut className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </header>
  );
}
