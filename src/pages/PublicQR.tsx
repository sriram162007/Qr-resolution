import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getQRCode } from "@/services/qrService";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type QRStatus = "loading" | "valid" | "inactive" | "not_found";

export default function PublicQR() {
  const { qrId } = useParams<{ qrId: string }>();
  const [status, setStatus] = useState<QRStatus>("loading");
  const [qr, setQR] = useState<{ name: string; locationId: string } | null>(null);

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
          setStatus("inactive");
          return;
        }
        setQR({ name: data.name, locationId: data.locationId });
        setStatus("valid");
      } catch {
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
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">Name:</span> {qr.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium">QR ID:</span> <span className="font-mono">{qrId}</span>
                </p>
                <p className="text-sm text-muted-foreground mt-4">
                  Reporting will be available here soon.
                </p>
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
