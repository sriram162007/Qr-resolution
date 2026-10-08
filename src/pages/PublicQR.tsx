import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { getQRCode } from "@/services/qrService";
import { getOrganization } from "@/services/organizationService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QrCode, MapPin, Building2, AlertCircle, ArrowRight, Loader2, ArrowLeft } from "lucide-react";

type QRStatus = "loading" | "valid" | "inactive" | "not_found";

interface QRState {
  name: string;
  locationId: string;
  organizationId: string;
  qrId: string;
}

export default function PublicQR() {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<QRStatus>("loading");
  const [qr, setQR] = useState<QRState | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!qrId) {
        setStatus("not_found");
        return;
      }
      try {
        const data = await getQRCode(qrId);
        if (!data) {
          setStatus("not_found");
          return;
        }
        if (!data.isActive) {
          setQR({ name: data.name, locationId: data.locationId, organizationId: data.organizationId, qrId: data.qrId });
          setStatus("inactive");
          return;
        }
        setQR({ name: data.name, locationId: data.locationId, organizationId: data.organizationId, qrId: data.qrId });
        try {
          const [org, loc] = await Promise.all([
            getOrganization(data.organizationId),
            getLocation(data.locationId),
          ]);
          if (org) setOrganizationName(org.name);
          if (loc) setLocationName(getLocationPath([loc], loc.id));
        } catch (contextErr) {
          console.error("[Public QR] Context load error", contextErr);
        }
        setStatus("valid");
      } catch (err) {
        console.error("[Public QR] Load error", err);
        setStatus("not_found");
      }
    }
    load();
  }, [qrId]);

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col justify-between p-4 sm:p-6 selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      {/* Top minimal bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-2">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6E73] hover:text-[#1D1D1F] transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          Campus Home
        </Link>
        <span className="text-xs font-mono text-[#86868B] bg-[#F5F5F7] px-2 py-0.5 rounded-md">
          {qrId}
        </span>
      </div>

      {/* Main content modal / card */}
      <div className="max-w-md w-full mx-auto py-8">
        <Card className="border border-black/[0.08] shadow-[0_4px_24px_rgba(0,0,0,0.04)] rounded-3xl overflow-hidden bg-white">
          <div className="p-8 text-center space-y-6">
            {/* Status indicator */}
            <div className="mx-auto w-16 h-16 rounded-2xl bg-[#F5F5F7] border border-black/[0.05] flex items-center justify-center text-[#0071E3]">
              {status === "loading" && <Loader2 className="w-7 h-7 animate-spin text-[#0071E3]" />}
              {status === "valid" && <QrCode className="w-7 h-7 text-[#0071E3]" />}
              {status === "inactive" && <AlertCircle className="w-7 h-7 text-[#FF9500]" />}
              {status === "not_found" && <AlertCircle className="w-7 h-7 text-[#FF3B30]" />}
            </div>

            {status === "loading" && (
              <div className="space-y-2">
                <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                  Identifying Campus Facility...
                </h1>
                <p className="text-sm text-[#86868B]">
                  Validating QR signature and resolving location.
                </p>
              </div>
            )}

            {status === "valid" && qr && (
              <div className="space-y-6">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#EAF8EE] border border-[#C3ECD1] text-[11px] font-semibold text-[#1B873F]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
                    Verified Facility
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F] pt-1">
                    {qr.name}
                  </h1>
                  <p className="text-sm text-[#6E6E73] flex items-center justify-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-[#0071E3]" />
                    {locationName || "Campus Facility"}
                  </p>
                  {organizationName && (
                    <p className="text-xs text-[#86868B] flex items-center justify-center gap-1 pt-0.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {organizationName}
                    </p>
                  )}
                </div>

                <div className="bg-[#F5F5F7] rounded-2xl p-4 text-xs text-[#6E6E73] text-left space-y-1.5 border border-black/[0.04]">
                  <div className="font-medium text-[#1D1D1F]">Ready to submit a report</div>
                  <p>
                    Your report will be automatically tagged with this location, analyzed with AI, and routed to the maintenance team.
                  </p>
                </div>

                <Button
                  className="w-full h-12 text-base font-semibold rounded-2xl shadow-[0_2px_8px_rgba(0,113,227,0.25)] flex items-center justify-center gap-2"
                  onClick={() => navigate(`/report/${qr.qrId}`)}
                >
                  Continue to Report Issue
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            )}

            {status === "inactive" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                    Facility Tag Inactive
                  </h1>
                  <p className="text-sm text-[#6E6E73]">
                    This QR code has been temporarily disabled by campus administration.
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                  Return to Home
                </Button>
              </div>
            )}

            {status === "not_found" && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <h1 className="text-xl font-bold tracking-tight text-[#1D1D1F]">
                    Invalid QR Code
                  </h1>
                  <p className="text-sm text-[#6E6E73]">
                    The scanned facility code does not exist in the campus database.
                  </p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
                  Return to Home
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      <div className="text-center text-xs text-[#86868B] pb-2">
        Campus Pulse • Smart Facility Resolution System
      </div>
    </div>
  );
}
