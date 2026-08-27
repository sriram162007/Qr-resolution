import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQRCode } from "@/services/qrService";
import { getOrganization } from "@/services/organizationService";
import { getLocation } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
        console.log("[Public QR Debug] no qrId param");
        setStatus("not_found");
        return;
      }
      console.log("[Public QR Debug] requested qrId", { qrId });
      try {
        const data = await getQRCode(qrId);
        console.log("[Public QR Debug] getQRCode result", { data });
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
          console.error("[Public QR Debug] context load error", {
            code: (contextErr as { code?: string })?.code,
            message: (contextErr as { message?: string })?.message,
            name: (contextErr as { name?: string })?.name,
          });
        }
        setStatus("valid");
      } catch (err) {
        console.error("[Public QR Debug] load error", {
          code: (err as { code?: string })?.code,
          message: (err as { message?: string })?.message,
          name: (err as { name?: string })?.name,
        });
        setStatus("not_found");
      }
    }
    load();
  }, [qrId]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
        </div>
        <Card>
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {status === "loading" && "Loading..."}
              {status === "valid" && "QR Code Valid"}
              {status === "inactive" && "QR Code Inactive"}
              {status === "not_found" && "QR Code Not Found"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {status === "valid" && qr && (
              <div className="text-center space-y-4">
                <div className="space-y-1">
                  {organizationName && (
                    <p className="text-sm font-medium">{organizationName}</p>
                  )}
                  {locationName && (
                    <p className="text-sm text-muted-foreground">{locationName}</p>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Need help with something here?
                </p>
                <Button
                  className="w-full"
                  size="lg"
                  onClick={() => navigate(`/report/${qr.qrId}`)}
                >
                  Report an Issue
                </Button>
              </div>
            )}
            {status === "inactive" && (
              <p className="text-sm text-muted-foreground text-center">
                This QR code is inactive. Please contact support.
              </p>
            )}
            {status === "not_found" && (
              <p className="text-sm text-muted-foreground text-center">
                QR code not found. Please scan a valid QR code.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
