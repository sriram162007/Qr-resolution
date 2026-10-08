import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getOrganization, createOrganization, updateOrganization } from "@/services/organizationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import AdminNavbar from "@/components/AdminNavbar";
import type { Organization } from "@/types";
import { auth } from "@/lib/firebase";
import {
  Building2,
  Save,
  Loader2,
} from "lucide-react";

export default function AdminOrganizationPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const org = await getOrganization("default");
        if (org) {
          setOrganization(org);
          setName(org.name);
          setDescription(org.description || "");
          setContactEmail(org.contactEmail || "");
          setContactPhone(org.contactPhone || "");
          setLogoUrl(org.logoUrl || "");
          setIsActive(org.isActive);
        }
      } catch {
        setError("Failed to load organization settings.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!auth.currentUser) {
        throw new Error("No authenticated session found.");
      }
      if (organization) {
        await updateOrganization(organization.id, {
          name,
          description: description || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          logoUrl: logoUrl || undefined,
          isActive,
        });
        setSuccess("Campus settings updated successfully.");
      } else {
        const id = await createOrganization({
          name,
          description: description || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          logoUrl: logoUrl || undefined,
          isActive,
        });
        setSuccess("Campus organization created successfully.");
        setOrganization({
          id,
          name,
          description: description || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          logoUrl: logoUrl || undefined,
          isActive,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      <AdminNavbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
            Campus Settings & Profile
          </h1>
          <p className="text-xs text-[#86868B] mt-0.5">
            Configure institutional identity, contact channels, and facility management defaults.
          </p>
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <div className="p-6 space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-black/[0.06]">
                <Building2 className="w-4 h-4 text-[#0071E3]" />
                <h2 className="text-sm font-semibold text-[#1D1D1F]">
                  Institution Details
                </h2>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  University / College Name *
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. National Institute of Technology"
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Campus Description & Scope
                </label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Main Campus Facility Operations & Residential Quarters"
                  className="min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                    Helpdesk Support Email
                  </label>
                  <Input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="maintenance@campus.edu"
                    className="h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                    Emergency Helpdesk Phone
                  </label>
                  <Input
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="h-11"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="orgActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="rounded text-[#0071E3] focus:ring-[#0071E3]"
                />
                <label htmlFor="orgActive" className="text-xs text-[#1D1D1F] font-medium">
                  Campus facility reporting active and accepting public tickets
                </label>
              </div>
            </div>
          </Card>

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={saving || loading || !name.trim()}
              className="h-11 px-6 text-xs font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)] flex items-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {loading ? "Loading..." : saving ? "Saving Changes..." : "Save Institutional Settings"}
            </Button>
          </div>
        </form>
      </main>

      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Institutional Settings & Configuration
      </footer>
    </div>
  );
}
