import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getQRCode } from "@/services/qrService";
import { getOrganization } from "@/services/organizationService";
import { getLocation, getChildLocations } from "@/services/locationService";
import { getLocationPath } from "@/lib/utils/locationPath";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Location } from "@/types";

const CATEGORIES = [
  { value: "electrical", label: "Electrical" },
  { value: "plumbing", label: "Plumbing / Water" },
  { value: "cleaning", label: "Cleaning" },
  { value: "furniture", label: "Furniture" },
  { value: "network", label: "Network / Wi-Fi" },
  { value: "safety", label: "Safety" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "other", label: "Other" },
] as const;

type Category = (typeof CATEGORIES)[number]["value"];

export default function PublicReport() {
  const { qrId } = useParams<{ qrId: string }>();
  const navigate = useNavigate();
  const [qr, setQR] = useState<{ name: string; locationId: string; organizationId: string } | null>(null);
  const [organizationName, setOrganizationName] = useState<string | null>(null);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [childLocations, setChildLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [category, setCategory] = useState<Category>("other");
  const [exactArea, setExactArea] = useState<string>("");
  const [description, setDescription] = useState("");
  const [photoName, setPhotoName] = useState("");

  useEffect(() => {
    async function load() {
      if (!qrId) return;
      setLoading(true);
      try {
        const data = await getQRCode(qrId);
        if (!data || !data.isActive) {
          setQR(null);
          return;
        }
        setQR({ name: data.name, locationId: data.locationId, organizationId: data.organizationId });
        const [org, loc, children] = await Promise.all([
          getOrganization(data.organizationId),
          getLocation(data.locationId),
          getChildLocations(data.locationId),
        ]);
        if (org) setOrganizationName(org.name);
        if (loc) setLocationName(getLocationPath([loc], loc.id));
        setChildLocations(children);
      } catch {
        setQR(null);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [qrId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 600));
    setSubmitted(true);
    setSubmitting(false);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!qr) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
          </div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">QR Code Not Found</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                This QR code is invalid or inactive. Please scan a valid QR code.
              </p>
              <Button className="w-full mt-4" variant="outline" onClick={() => navigate("/")}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
          </div>
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Ready to Submit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Your issue report has been prepared. Ticket creation will be available in the next update.
              </p>
              <Button className="w-full mt-4" onClick={() => navigate("/")}>
                Go Home
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-xl font-bold tracking-tight">QR Resolution</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Report an Issue</CardTitle>
            <CardDescription className="space-y-1">
              {organizationName && <p><span className="font-medium">Organization:</span> {organizationName}</p>}
              {locationName && <p><span className="font-medium">Location:</span> {locationName}</p>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="category" className="text-sm font-medium">
                  Category <span className="text-destructive">*</span>
                </label>
                <select
                  id="category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as Category)}
                  className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="exactArea" className="text-sm font-medium">
                  Exact Area
                </label>
                {childLocations.length > 0 ? (
                  <select
                    id="exactArea"
                    value={exactArea}
                    onChange={(e) => setExactArea(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="">Select area</option>
                    {childLocations.map((loc) => (
                      <option key={loc.id} value={loc.id}>{getLocationPath([loc], loc.id)}</option>
                    ))}
                    <option value="__other__">Other / Not listed</option>
                  </select>
                ) : (
                  <select
                    id="exactArea"
                    value={exactArea}
                    onChange={(e) => setExactArea(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  >
                    <option value="">Select area</option>
                    <option value="__other__">Other / Not listed</option>
                  </select>
                )}
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description <span className="text-destructive">*</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  rows={4}
                  placeholder="Tell us what happened..."
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="photo" className="text-sm font-medium">
                  Add a photo (optional)
                </label>
                <input
                  id="photo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    setPhotoName(file ? file.name : "");
                  }}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                {photoName && (
                  <p className="text-xs text-muted-foreground">Selected: {photoName}</p>
                )}
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={submitting || !description.trim()}>
                {submitting ? "Submitting..." : "Submit Report"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
