"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLocations, getLocation, createLocation } from "@/services/locationService";
import { getQRCodes, getQRCode, createQRCode, updateQRCodeStatus } from "@/services/qrService";
import { generateQRCodeDataURL } from "@/lib/utils/qr";
import type { Location, QRCode } from "@/types";
import { Plus, QrCode, Download, ExternalLink, Power, MapPin } from "lucide-react";

const PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function generateQRId(): string {
  return `QR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}

function CreateLocationModal({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: (location: Location) => void }) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const locationId = await createLocation({
        organizationId: "default",
        name,
        code,
        description: description || undefined,
        address: address || undefined,
        status: "ACTIVE",
      });
      const location = await getLocation(locationId);
      if (!location) throw new Error("Failed to load created location");
      onCreated(location);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create location");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={open ? "open" : "closed"}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create Location</DialogTitle>
            <DialogDescription>Add a new physical location for QR code installation.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <label htmlFor="name" className="text-sm font-medium">Location Name</label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required disabled={loading} placeholder="Hostel Block A - Room 204" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="code" className="text-sm font-medium">Location Code</label>
              <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} required disabled={loading} placeholder="HBA-204" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="description" className="text-sm font-medium">Description</label>
              <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={loading} placeholder="Second floor hostel room" />
            </div>
            <div className="grid gap-2">
              <label htmlFor="address" className="text-sm font-medium">Address</label>
              <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} disabled={loading} placeholder="Block A" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading}>Create Location</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateQRModal({ open, onOpenChange, locations, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; locations: Location[]; onCreated: (qr: QRCode) => void }) {
  const [selectedLocationId, setSelectedLocationId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const qrId = generateQRId();
      const publicUrl = `${PUBLIC_BASE_URL}/q/${qrId}`;
      const location = locations.find((l) => l.id === selectedLocationId);
      if (!location) throw new Error("Location not found");
      
      const qrCodeId = await createQRCode({
        organizationId: location.organizationId,
        locationId: location.id,
        qrCode: qrId,
        publicUrl,
        status: "ACTIVE",
      });
      const qr = await getQRCode(qrCodeId);
      if (!qr) throw new Error("Failed to load created QR code");
      onCreated(qr);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create QR code");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={open ? "open" : "closed"}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create QR Code</DialogTitle>
            <DialogDescription>Select a location to generate a QR code.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="grid gap-2">
              <label htmlFor="location" className="text-sm font-medium">Location</label>
              <select
                id="location"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                required
                disabled={loading}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="">Select a location</option>
                {locations.map((location) => (
                  <option key={location.id} value={location.id}>
                    {location.name} ({location.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>Cancel</Button>
            <Button type="submit" disabled={loading || !selectedLocationId}>Create QR</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function QRPreviewModal({ open, onOpenChange, qr, location }: { open: boolean; onOpenChange: (open: boolean) => void; qr: QRCode; location: Location | null }) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copyText, setCopyText] = useState("Copy URL");

  useEffect(() => {
    if (!open || !qr.publicUrl) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    generateQRCodeDataURL(qr.publicUrl, 600)
      .then((url) => { if (!cancelled) setQrDataUrl(url); })
      .catch(() => { if (!cancelled) setQrDataUrl(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, qr.publicUrl]);

  const handleDownload = async () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = `${location?.code || qr.qrCode}-QR.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(qr.publicUrl);
    setCopyText("Copied!");
    setTimeout(() => setCopyText("Copy URL"), 2000);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange} key={open ? "preview-open" : "preview-closed"}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>QR Code Preview</DialogTitle>
          <DialogDescription>Preview and download the QR code for {location?.name || qr.locationId}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col items-center space-y-4 py-4">
          {loading ? (
            <div className="h-64 w-64 animate-pulse rounded-md bg-muted" />
          ) : qrDataUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt={`QR code for ${qr.qrCode}`} className="h-64 w-64 rounded-md border" />
          ) : (
            <div className="h-64 w-64 flex items-center justify-center rounded-md border text-muted-foreground">Failed to load QR</div>
          )}
          <div className="w-full space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">QR ID:</span><span className="font-mono">{qr.qrCode}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Location:</span><span>{location?.name || qr.locationId}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Location Code:</span><span>{location?.code || "-"}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Status:</span><span className={qr.status === "ACTIVE" ? "text-green-600" : "text-red-600"}>{qr.status}</span></div>
            <div className="flex flex-col space-y-1">
              <span className="text-muted-foreground">Public URL:</span>
              <span className="break-all font-mono text-xs">{qr.publicUrl}</span>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleCopy}>{copyText}</Button>
          <Button onClick={handleDownload} disabled={!qrDataUrl}><Download className="mr-2 h-4 w-4" /> Download QR</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminQRPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [qrCodes, setQRCodes] = useState<QRCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [createLocationOpen, setCreateLocationOpen] = useState(false);
  const [createQROpen, setCreateQROpen] = useState(false);
  const [previewQR, setPreviewQR] = useState<QRCode | null>(null);
  const [previewLocation, setPreviewLocation] = useState<Location | null>(null);
  const [togglingQR, setTogglingQR] = useState<string | null>(null);
  const mountedRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const [locs, qrs] = await Promise.all([getLocations(), getQRCodes()]);
      if (!mountedRef.current) return;
      setLocations(locs);
      setQRCodes(qrs);
    } catch (err) {
      console.error("Failed to load data:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadData]);

  const handleCreateLocation = async (location: Location) => {
    setLocations((prev) => [...prev, location]);
  };

  const handleCreateQR = async (qr: QRCode) => {
    setQRCodes((prev) => [...prev, qr]);
  };

  const handleToggleStatus = async (qr: QRCode) => {
    setTogglingQR(qr.id);
    try {
      const newStatus = qr.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateQRCodeStatus(qr.id, newStatus);
      setQRCodes((prev) => prev.map((q) => q.id === qr.id ? { ...q, status: newStatus } : q));
    } catch (err) {
      console.error("Failed to update QR status:", err);
    } finally {
      setTogglingQR(null);
    }
  };

  const handleViewQR = async (qr: QRCode) => {
    const location = locations.find((l) => l.id === qr.locationId) || null;
    setPreviewLocation(location);
    setPreviewQR(qr);
  };

  const getLocationName = (locationId: string) => {
    return locations.find((l) => l.id === locationId)?.name || locationId;
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">QR Management</h1>
          <p className="text-muted-foreground">Create and manage QR codes for your locations.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreateLocationOpen(true)}>
            <MapPin className="mr-2 h-4 w-4" /> Create Location
          </Button>
          <Button onClick={() => setCreateQROpen(true)} disabled={locations.length === 0}>
            <Plus className="mr-2 h-4 w-4" /> Create QR
          </Button>
        </div>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>QR Codes</CardTitle>
          <CardDescription>Manage your generated QR codes.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : qrCodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <QrCode className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No QR codes yet</h3>
              <p className="text-muted-foreground">Create a location first, then generate a QR code.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>QR ID</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {qrCodes.map((qr) => (
                  <TableRow key={qr.id}>
                    <TableCell className="font-mono">{qr.qrCode}</TableCell>
                    <TableCell>{getLocationName(qr.locationId)}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${qr.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {qr.status}
                      </span>
                    </TableCell>
                    <TableCell>{new Date(qr.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleViewQR(qr)} title="View">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleStatus(qr)}
                          disabled={togglingQR === qr.id}
                          title={qr.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        >
                          <Power className={`h-4 w-4 ${togglingQR === qr.id ? "animate-pulse" : ""}`} />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CreateLocationModal open={createLocationOpen} onOpenChange={setCreateLocationOpen} onCreated={handleCreateLocation} />
      <CreateQRModal open={createQROpen} onOpenChange={setCreateQROpen} locations={locations} onCreated={handleCreateQR} />
      <QRPreviewModal open={!!previewQR} onOpenChange={(open) => { if (!open) { setPreviewQR(null); setPreviewLocation(null); } }} qr={previewQR!} location={previewLocation} />
    </div>
  );
}
