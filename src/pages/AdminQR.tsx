import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getQRCodes, createQRCode, setQRCodeActive, deleteQRCode } from "@/services/qrService";
import { getLocations } from "@/services/locationService";
import { getOrganization } from "@/services/organizationService";
import { generateQRCodeDataURL, getPublicQRUrl } from "@/lib/utils/qr";
import { getLocationPath } from "@/lib/utils/locationPath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { QRCode, Location } from "@/types";
import { auth } from "@/lib/firebase";

function generateQRId(): string {
  return `QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

export default function AdminQRPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [qrcodes, setQRCodes] = useState<QRCode[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ code?: string; message?: string; name?: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [qrName, setQRName] = useState("");
  const [qrLocationId, setQRLocationId] = useState("");
  const [qrDescription, setQRDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const org = await getOrganization("default");
        if (cancelled) return;
        if (!org) {
          setOrganization(null);
          setQRCodes([]);
          setLocations([]);
          return;
        }
        setOrganization({ id: org.id, name: org.name });
        const [qrs, locs] = await Promise.all([getQRCodes(org.id), getLocations(org.id)]);
        if (!cancelled) {
          setQRCodes(qrs);
          setLocations(locs);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load QR codes.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, navigate]);

  const activeLocations = useMemo(() => locations.filter((l) => l.isActive), [locations]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) {
      setError("No organization found. Create an organization first.");
      return;
    }
    if (!qrLocationId) {
      setError("Please select a location.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const qrId = generateQRId();
      console.log("[QR Create] BEFORE WRITE", {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        path: `qr_codes/${qrId}`
      });
      await createQRCode({
        qrId,
        organizationId: organization.id,
        locationId: qrLocationId,
        name: qrName,
        description: qrDescription || undefined,
        isActive: true,
      });
      console.log("[QR Create] page received success");
      setSuccess("QR code created successfully.");
      setCreateOpen(false);
      setQRName("");
      setQRLocationId("");
      setQRDescription("");
      console.log("[QR Create] before loadData");
      await loadData();
      console.log("[QR Create] after loadData");
    } catch (err) {
      setError("Failed to create QR code.");
      setErrorDetails({
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
        name: (err as { name?: string })?.name,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedQR) return;
    setSaving(true);
    setError(null);
    try {
      await deleteQRCode(selectedQR.qrId);
      setSuccess("QR code deleted successfully.");
      setDeleteOpen(false);
      setSelectedQR(null);
      await loadData();
    } catch {
      setError("Failed to delete QR code.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (qr: QRCode) => {
    setError(null);
    try {
      await setQRCodeActive(qr.qrId, !qr.isActive);
      setSuccess(`QR code ${!qr.isActive ? "activated" : "deactivated"} successfully.`);
      await loadData();
    } catch {
      setError("Failed to update QR code status.");
    }
  };

  const openPreview = async (qr: QRCode) => {
    setSelectedQR(qr);
    try {
      const url = getPublicQRUrl(qr.qrId);
      const dataUrl = await generateQRCodeDataURL(url, 400);
      setPreviewImage(dataUrl);
      setPreviewOpen(true);
    } catch {
      setError("Failed to generate QR preview.");
    }
  };

  const handleDownload = async (qr: QRCode) => {
    try {
      const url = getPublicQRUrl(qr.qrId);
      const dataUrl = await generateQRCodeDataURL(url, 800);
      const link = document.createElement("a");
      link.href = dataUrl;
      const safeName = qr.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      link.download = `qr-${safeName || qr.qrId.toLowerCase()}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch {
      setError("Failed to download QR code.");
    }
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const org = await getOrganization("default");
      if (!org) {
        setOrganization(null);
        setQRCodes([]);
        setLocations([]);
        return;
      }
      setOrganization({ id: org.id, name: org.name });
      const [qrs, locs] = await Promise.all([getQRCodes(org.id), getLocations(org.id)]);
      setQRCodes(qrs);
      setLocations(locs);
    } catch {
      setError("Failed to load QR codes.");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QR Codes</h1>
          <p className="text-muted-foreground">Manage QR codes for locations.</p>
        </div>
        {organization && (
          <Button onClick={() => setCreateOpen(true)}>
            Create QR Code
          </Button>
        )}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>QR Codes</CardTitle>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="space-y-2">
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
              {errorDetails && (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 p-3 text-xs text-destructive font-mono">
                  <div>Firebase error code: {errorDetails.code}</div>
                  <div>Firebase error message: {errorDetails.message}</div>
                  <div>Firebase error name: {errorDetails.name}</div>
                </div>
              )}
            </div>
          )}
          {success && (
            <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700 mb-4">
              {success}
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : !organization ? (
            <div className="text-center py-8 text-muted-foreground">
              No organization found. Create an organization first.
            </div>
          ) : qrcodes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No QR codes yet. Click &quot;Create QR Code&quot; to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-3 px-2">Name</th>
                    <th className="py-3 px-2">Location</th>
                    <th className="py-3 px-2">QR ID</th>
                    <th className="py-3 px-2">Status</th>
                    <th className="py-3 px-2">Created</th>
                    <th className="py-3 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {qrcodes.map((qr) => (
                    <tr key={qr.id} className="border-b last:border-0">
                      <td className="py-3 px-2 font-medium">{qr.name}</td>
                      <td className="py-3 px-2">{getLocationPath(locations, qr.locationId)}</td>
                      <td className="py-3 px-2 font-mono">{qr.qrId}</td>
                      <td className="py-3 px-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${qr.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                          {qr.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-2">{qr.createdAt?.toLocaleDateString?.() ?? new Date(qr.createdAt).toLocaleDateString()}</td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openPreview(qr)}>
                            Preview
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(qr)}>
                            Download
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleToggleActive(qr)}>
                            {qr.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => { setSelectedQR(qr); setDeleteOpen(true); }}>
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create QR Code</DialogTitle>
            <DialogDescription>Create a new QR code for an active location.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="qrName" className="text-sm font-medium">
                  QR Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="qrName"
                  value={qrName}
                  onChange={(e) => setQRName(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="location" className="text-sm font-medium">
                  Location <span className="text-destructive">*</span>
                </label>
                <select
                  id="location"
                  value={qrLocationId}
                  onChange={(e) => setQRLocationId(e.target.value)}
                  required
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">Select location</option>
                  {activeLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {getLocationPath(locations, loc.id)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="qrDescription" className="text-sm font-medium">
                  Description
                </label>
                <Input
                  id="qrDescription"
                  value={qrDescription}
                  onChange={(e) => setQRDescription(e.target.value)}
                  disabled={saving}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Creating..." : "Create QR Code"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedQR?.name}</DialogTitle>
            <DialogDescription>
              Location: {selectedQR ? getLocationPath(locations, selectedQR.locationId) : ""}
            </DialogDescription>
          </DialogHeader>
          {selectedQR && (
            <div className="space-y-4 py-4">
              <div className="flex flex-col items-center justify-center">
                {previewImage && (
                  <img
                    src={previewImage}
                    alt={`QR ${selectedQR.qrId}`}
                    className="w-full max-w-xs"
                  />
                )}
              </div>
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-medium">QR ID:</span> <span className="font-mono">{selectedQR.qrId}</span>
                </p>
                <p>
                  <span className="font-medium">Public URL:</span>{" "}
                  <span className="break-all">{getPublicQRUrl(selectedQR.qrId)}</span>
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button onClick={() => selectedQR && handleDownload(selectedQR)}>
              Download QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete QR Code</DialogTitle>
            <DialogDescription>
              This QR code will no longer be available in the admin system.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={saving}>
              {saving ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
