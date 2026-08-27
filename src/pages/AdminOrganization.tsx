import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getOrganization, createOrganization, updateOrganization, setOrganizationActive } from "@/services/organizationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Organization } from "@/types";
import { auth } from "@/lib/firebase";

export default function AdminOrganizationPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ code?: string; message?: string; name?: string } | null>(null);
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
        setError("Failed to load organization.");
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
        throw new Error("No authenticated user. Please log in again.");
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
        setSuccess("Organization updated successfully.");
      } else {
        console.log("[Organization Create] before write", {
          uid: auth.currentUser.uid,
          email: auth.currentUser.email,
          path: "organizations/default"
        });
        const id = await createOrganization({
          name,
          description: description || undefined,
          contactEmail: contactEmail || undefined,
          contactPhone: contactPhone || undefined,
          logoUrl: logoUrl || undefined,
          isActive,
        });
        console.log("[Organization Create] after write", { id });
        setSuccess("Organization created successfully.");
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
        setName(name);
        setDescription(description || "");
        setContactEmail(contactEmail || "");
        setContactPhone(contactPhone || "");
        setLogoUrl(logoUrl || "");
        setIsActive(isActive);
      }
    } catch (err) {
      console.error("[Organization Create]", {
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
        name: (err as { name?: string })?.name,
      });
      setError("Failed to save organization.");
      setErrorDetails({
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
        name: (err as { name?: string })?.name,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async () => {
    if (!organization) return;
    setSaving(true);
    setError(null);
    try {
      await setOrganizationActive(organization.id, !organization.isActive);
      setIsActive(!organization.isActive);
      setSuccess(`Organization ${!organization.isActive ? "activated" : "deactivated"} successfully.`);
    } catch {
      setError("Failed to update organization status.");
    } finally {
      setSaving(false);
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
          <h1 className="text-3xl font-bold tracking-tight">Organization</h1>
          <p className="text-muted-foreground">Manage your organization details.</p>
        </div>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{organization ? "Edit Organization" : "Create Organization"}</CardTitle>
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
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Organization Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={saving}
                  placeholder="ABC College"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Input
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={saving}
                  placeholder="Brief description"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="contactEmail" className="text-sm font-medium">
                    Contact Email
                  </label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    disabled={saving}
                    placeholder="admin@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="contactPhone" className="text-sm font-medium">
                    Contact Phone
                  </label>
                  <Input
                    id="contactPhone"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    disabled={saving}
                    placeholder="+1 234 567 890"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="logoUrl" className="text-sm font-medium">
                  Logo URL
                </label>
                <Input
                  id="logoUrl"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  disabled={saving}
                  placeholder="https://example.com/logo.png"
                />
              </div>
              {organization && (
                <div className="flex items-center justify-between rounded-md border p-4">
                  <div>
                    <p className="text-sm font-medium">Status</p>
                    <p className="text-xs text-muted-foreground">
                      {isActive ? "Organization is active" : "Organization is inactive"}
                    </p>
                  </div>
                  <Button type="button" variant="outline" onClick={handleToggleActive} disabled={saving}>
                    {isActive ? "Deactivate" : "Activate"}
                  </Button>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving..." : organization ? "Save Changes" : "Create Organization"}
                </Button>
                <Button type="button" variant="outline" onClick={() => navigate("/admin")}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
