import { useEffect, useState, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getQRCodes, createQRCode, setQRCodeActive, deleteQRCode } from "@/services/qrService";
import { getLocations } from "@/services/locationService";
import { getOrganization } from "@/services/organizationService";
import { generateQRCodeDataURL, getPublicQRUrl } from "@/lib/utils/qr";
import { getLocationPath } from "@/lib/utils/locationPath";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import AdminNavbar from "@/components/AdminNavbar";
import type { QRCode, Location } from "@/types";
import {
  QrCode,
  Plus,
  Download,
  Eye,
  Trash2,
  ExternalLink,
  Layers,
  MapPin,
  Copy,
  Check,
  Building2,
} from "lucide-react";

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
  const [success, setSuccess] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRCode | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [qrName, setQRName] = useState("");
  const [qrLocationId, setQRLocationId] = useState("");
  const [qrDescription, setQRDescription] = useState("");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

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
      setError("Failed to load campus QR codes.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const activeLocations = useMemo(() => locations.filter((l) => l.isActive), [locations]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    if (!qrLocationId) {
      setError("Please select a valid location node.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const newQRId = generateQRId();
      const loc = locations.find((l) => l.id === qrLocationId);
      await createQRCode({
        qrId: newQRId,
        organizationId: organization.id,
        locationId: qrLocationId,
        name: qrName.trim(),
        department: loc?.department || undefined,
        description: qrDescription.trim() || undefined,
        isActive: true,
      });
      setSuccess(`QR code "${newQRId}" created and bound successfully.`);
      setCreateOpen(false);
      setQRName("");
      setQRLocationId("");
      setQRDescription("");
      await loadData();
    } catch {
      setError("Failed to generate QR code.");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async (qr: QRCode) => {
    setSelectedQR(qr);
    try {
      const url = getPublicQRUrl(qr.qrId);
      const dataUrl = await generateQRCodeDataURL(url);
      setPreviewImage(dataUrl);
      setPreviewOpen(true);
    } catch {
      setError("Failed to render QR preview.");
    }
  };

  const handleToggleActive = async (qr: QRCode) => {
    try {
      await setQRCodeActive(qr.id, !qr.isActive);
      await loadData();
    } catch {
      setError("Failed to update status.");
    }
  };

  const handleDelete = async (qr: QRCode) => {
    if (!confirm(`Are you sure you want to delete QR tag "${qr.qrId}"?`)) return;
    try {
      await deleteQRCode(qr.id);
      await loadData();
    } catch {
      setError("Failed to delete QR code.");
    }
  };

  const handleCopy = (qrId: string) => {
    navigator.clipboard.writeText(qrId);
    setCopiedId(qrId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              Campus Facility QR Codes
            </h1>
            <p className="text-xs text-[#86868B] mt-0.5">
              Printable physical QR tags mapped to campus rooms and buildings.
            </p>
          </div>

          <Button
            onClick={() => {
              setQRName("");
              setQRLocationId(activeLocations[0]?.id || "");
              setQRDescription("");
              setCreateOpen(true);
            }}
            className="h-10 text-xs font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)] flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Generate New QR Tag
          </Button>
        </div>

        {error && (
          <div className="rounded-2xl border border-[#FF3B30]/20 bg-[#FEECEC] p-4 text-xs text-[#D70015]">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-2xl border border-[#34C759]/20 bg-[#EAF8EE] p-4 text-xs text-[#1B873F]">
            {success}
          </div>
        )}

        {/* QR Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="col-span-full py-16 text-center text-xs text-[#86868B]">
              <Layers className="w-6 h-6 animate-spin mx-auto text-[#0071E3]" />
              <p className="mt-2 font-medium">Loading QR library...</p>
            </div>
          ) : qrcodes.length === 0 ? (
            <div className="col-span-full py-16 text-center text-xs text-[#86868B] space-y-3 bg-white border border-black/[0.08] rounded-2xl">
              <QrCode className="w-8 h-8 mx-auto text-[#86868B]" />
              <p>No QR tags configured yet. Click "Generate New QR Tag" to bind a campus facility.</p>
            </div>
          ) : (
            qrcodes.map((qr) => {
              const loc = locations.find((l) => l.id === qr.locationId);
              const locPath = loc ? getLocationPath([loc], loc.id) : qr.locationId;

              return (
                <Card key={qr.id} className="overflow-hidden hover:border-black/20 transition-all">
                  <div className="p-5 space-y-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleCopy(qr.qrId)}
                            className="font-mono text-xs font-bold text-[#1D1D1F] hover:text-[#0071E3] flex items-center gap-1 transition-colors"
                          >
                            <span>{qr.qrId}</span>
                            {copiedId === qr.qrId ? <Check className="w-3 h-3 text-[#1B873F]" /> : <Copy className="w-3 h-3 text-[#86868B]" />}
                          </button>
                          <Badge variant={qr.isActive ? "success" : "secondary"} className="text-[10px]">
                            {qr.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </div>
                        <h3 className="text-sm font-semibold text-[#1D1D1F] mt-1 truncate">
                          {qr.name}
                        </h3>
                      </div>

                      <div className="w-9 h-9 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center shrink-0">
                        <QrCode className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="text-xs text-[#6E6E73] space-y-1">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                        <span className="truncate">{locPath}</span>
                      </div>
                      {qr.department && (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-[#86868B] shrink-0" />
                          <span>Dept: {qr.department}</span>
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-black/[0.04] flex items-center justify-between gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePreview(qr)}
                        className="h-8 px-2.5 text-xs rounded-lg border-black/10 bg-white"
                      >
                        <Eye className="w-3 h-3 mr-1 text-[#0071E3]" />
                        Print / QR
                      </Button>

                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-[#0071E3] rounded-lg"
                      >
                        <Link to={`/report/${qr.qrId}`} target="_blank" rel="noreferrer">
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Test
                        </Link>
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(qr)}
                        className="h-8 px-2 text-xs text-[#6E6E73] rounded-lg"
                      >
                        {qr.isActive ? "Disable" : "Enable"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(qr)}
                        className="h-8 px-2 text-xs text-[#D70015] hover:bg-[#FEECEC] rounded-lg"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </main>

      {/* Create QR Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-[#1D1D1F]">
              Generate Facility QR Tag
            </DialogTitle>
            <DialogDescription className="text-xs text-[#86868B]">
              Binds a physical QR identifier to a campus facility location.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Facility / Room Label *
              </label>
              <Input
                value={qrName}
                onChange={(e) => setQRName(e.target.value)}
                placeholder="e.g. Science Lab 2 - Bench 4"
                required
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Assigned Location Node *
              </label>
              <select
                value={qrLocationId}
                onChange={(e) => setQRLocationId(e.target.value)}
                required
                className="w-full h-10 rounded-xl border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#0071E3]"
              >
                <option value="">Select campus location...</option>
                {activeLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} ({l.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Placement Notes (Optional)
              </label>
              <Input
                value={qrDescription}
                onChange={(e) => setQRDescription(e.target.value)}
                placeholder="e.g. Mounted on main entry door"
                className="h-10 text-xs"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={saving || !qrName.trim() || !qrLocationId}
                className="w-full h-11 text-xs font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)]"
              >
                {saving ? "Generating QR..." : "Generate QR Code"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* QR Preview & Download Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm rounded-3xl p-6 text-center space-y-4">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-[#1D1D1F]">
              {selectedQR?.name}
            </DialogTitle>
            <DialogDescription className="font-mono text-xs text-[#0071E3]">
              {selectedQR?.qrId}
            </DialogDescription>
          </DialogHeader>

          {previewImage && (
            <div className="p-4 bg-white border border-black/10 rounded-2xl inline-block shadow-xs">
              <img src={previewImage} alt="QR Code" className="w-52 h-52 mx-auto" />
              <p className="text-[10px] text-[#86868B] mt-2 font-mono">
                Scan with any smartphone camera
              </p>
            </div>
          )}

          <div className="space-y-2">
            {previewImage && (
              <a
                href={previewImage}
                download={`${selectedQR?.qrId || "campus-qr"}.png`}
                className="w-full inline-flex items-center justify-center gap-1.5 h-11 text-xs font-semibold rounded-xl bg-[#0071E3] text-white hover:bg-[#0077ED] shadow-xs transition-colors"
              >
                <Download className="w-4 h-4" />
                Download High-Res PNG
              </a>
            )}
            <Button
              variant="outline"
              className="w-full h-10 text-xs rounded-xl"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Operations Console • QR Tag Management
      </footer>
    </div>
  );
}
