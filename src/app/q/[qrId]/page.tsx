import { getQRCode } from "@/services/qrService";
import { getLocations } from "@/services/locationService";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, AlertCircle } from "lucide-react";
import { ReportIssueClient } from "@/components/report-issue-client";
import type { Location, QRCode } from "@/types";

interface PublicQRPageProps {
  params: Promise<{ qrId: string }>;
}

export default async function PublicQRPage({ params }: PublicQRPageProps) {
  const { qrId } = await params;
  let qr: QRCode | null = null;

  try {
    qr = await getQRCode(qrId);
  } catch {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>QR Code Not Found</CardTitle>
            <CardDescription>This QR code is invalid or no longer available.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <AlertCircle className="h-6 w-6 text-destructive" />
            </div>
            <CardTitle>QR Code Not Found</CardTitle>
            <CardDescription>This QR code is invalid or no longer available.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (qr.status === "INACTIVE") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] px-4">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
              <AlertCircle className="h-6 w-6 text-orange-600" />
            </div>
            <CardTitle>QR Code Inactive</CardTitle>
            <CardDescription>This QR code is currently unavailable. Please contact support.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  let locations: Location[] = [];
  try {
    locations = await getLocations(qr.organizationId);
  } catch {
    // Firebase unavailable
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
        </div>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <MapPin className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-2xl">Report an Issue</CardTitle>
            <CardDescription>
              {qr.locationId ? "QR scanned near a location" : "Scan a QR to report an issue"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReportIssueClient qr={qr} locations={locations} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
