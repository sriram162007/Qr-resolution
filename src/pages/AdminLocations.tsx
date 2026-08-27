import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getLocations, createLocation, updateLocation, setLocationActive, deleteLocation } from "@/services/locationService";
import { getOrganization } from "@/services/organizationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import type { Location, LocationType } from "@/types";
import { auth } from "@/lib/firebase";

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: "ORGANIZATION", label: "Organization" },
  { value: "BUILDING", label: "Building" },
  { value: "FLOOR", label: "Floor" },
  { value: "ROOM", label: "Room" },
  { value: "AREA", label: "Area" },
  { value: "FACILITY", label: "Facility" },
  { value: "OTHER", label: "Other" },
];

function LocationTree({ locations, parentId, level, onEdit, onDelete, onToggleActive, disabledIds }: { locations: Location[]; parentId: string | null; level: number; onEdit: (location: Location) => void; onDelete: (location: Location) => void; onToggleActive: (location: Location) => void; disabledIds: Set<string> }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const children = locations.filter((l) => l.parentLocationId === parentId);

  return (
    <div>
      {children.map((location) => (
        <div key={location.id}>
          <div
            className="flex items-center justify-between py-2 px-3 hover:bg-muted rounded-md"
            style={{ paddingLeft: `${level * 1.25 + 0.75}rem` }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <button
                type="button"
                onClick={() => toggle(location.id)}
                className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"
              >
                {location.id && (expanded[location.id] ? "−" : "+")}
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{location.name}</p>
                <p className="text-xs text-muted-foreground">{location.type}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <span className={`text-xs px-2 py-0.5 rounded-full ${location.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                {location.isActive ? "Active" : "Inactive"}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onEdit(location)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onToggleActive(location)}>
                {location.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(location)} disabled={disabledIds.has(location.id)}>
                Delete
              </Button>
            </div>
          </div>
          {expanded[location.id] && (
            <LocationTree
              locations={locations}
              parentId={location.id}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              disabledIds={disabledIds}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function AdminLocationsPage() {
  const { user, authLoading } = useAuth();
  const navigate = useNavigate();
  const [locations, setLocations] = useState<Location[]>([]);
  const [organization, setOrganization] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorDetails, setErrorDetails] = useState<{ code?: string; message?: string; name?: string } | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("OTHER");
  const [parentId, setParentId] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const getDescendantIds = (locationId: string): string[] => {
    const ids: string[] = [];
    const queue = [locationId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const children = locations.filter((l) => l.parentLocationId === current);
      for (const child of children) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }
    return ids;
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const org = await getOrganization("default");
      if (!org) {
        setOrganization(null);
        setLocations([]);
        return;
      }
      setOrganization({ id: org.id, name: org.name });
      const locs = await getLocations(org.id);
      setLocations(locs);
    } catch {
      setError("Failed to load locations.");
    } finally {
      setLoading(false);
    }
  };

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
          setLocations([]);
          return;
        }
        setOrganization({ id: org.id, name: org.name });
        const locs = await getLocations(org.id);
        if (!cancelled) {
          setLocations(locs);
        }
      } catch {
        if (!cancelled) {
          setError("Failed to load locations.");
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

  const openCreate = () => {
    setEditingLocation(null);
    setName("");
    setType("OTHER");
    setParentId("");
    setDescription("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (location: Location) => {
    setEditingLocation(location);
    setName(location.name);
    setType(location.type);
    setParentId(location.parentLocationId || "");
    setDescription(location.description || "");
    setIsActive(location.isActive);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) {
      setError("No organization found. Create an organization first.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingLocation && parentId) {
        const descendantIds = getDescendantIds(editingLocation.id);
        if (descendantIds.includes(parentId)) {
          setError("Cannot set a descendant location as the parent.");
          setSaving(false);
          return;
        }
      }
      if (editingLocation) {
        await updateLocation(editingLocation.id, {
          name,
          type,
          parentLocationId: parentId || null,
          description: description || undefined,
          isActive,
        });
        setSuccess("Location updated successfully.");
      } else {
        console.log("[Location Create] BEFORE WRITE", {
          uid: auth.currentUser?.uid,
          email: auth.currentUser?.email,
          path: `locations/<auto>`
        });
        const newId = await createLocation({
          organizationId: organization.id,
          name,
          type,
          parentLocationId: parentId || null,
          description: description || undefined,
          isActive,
        });
        console.log("[Location Create] page received success", { id: newId });
        setSuccess("Location created successfully.");
        setDialogOpen(false);
        await loadData();
      }
    } catch (err) {
      setError("Failed to save location.");
      setErrorDetails({
        code: (err as { code?: string })?.code,
        message: (err as { message?: string })?.message,
        name: (err as { name?: string })?.name,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (location: Location) => {
    const children = locations.filter((l) => l.parentLocationId === location.id);
    if (children.length > 0) {
      setError("This location has child locations. Move or delete them before deleting this location.");
      return;
    }
    if (!confirm(`Delete "${location.name}"? This action cannot be undone.`)) return;
    setError(null);
    try {
      await deleteLocation(location.id);
      setSuccess("Location deleted successfully.");
      await loadData();
    } catch {
      setError("Failed to delete location.");
    }
  };

  const handleToggleActive = async (location: Location) => {
    setError(null);
    try {
      await setLocationActive(location.id, !location.isActive);
      setSuccess(`Location ${!location.isActive ? "activated" : "deactivated"} successfully.`);
      await loadData();
    } catch {
      setError("Failed to update location status.");
    }
  };

  const disabledDeleteIds = new Set<string>();
  const checkDescendants = (parentId: string) => {
    const children = locations.filter((l) => l.parentLocationId === parentId);
    for (const child of children) {
      disabledDeleteIds.add(child.id);
      checkDescendants(child.id);
    }
  };
  const rootLocations = locations.filter((l) => !l.parentLocationId);
  for (const root of rootLocations) {
    checkDescendants(root.id);
  }

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
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground">
            {organization ? `Managing locations for ${organization.name}` : "No organization found"}
          </p>
        </div>
        {organization && (
          <Button onClick={openCreate}>
            Add Location
          </Button>
        )}
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Location Hierarchy</CardTitle>
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
          ) : locations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No locations yet. Click &quot;Add Location&quot; to create one.
            </div>
          ) : (
            <LocationTree
              locations={locations}
              parentId={null}
              level={0}
              onEdit={openEdit}
              onDelete={handleDelete}
              onToggleActive={handleToggleActive}
              disabledIds={disabledDeleteIds}
            />
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingLocation ? "Edit Location" : "Create Location"}</DialogTitle>
            <DialogDescription>
              {editingLocation ? "Update location details." : "Add a new location to your organization."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium">
                  Location Name <span className="text-destructive">*</span>
                </label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  disabled={saving}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="type" className="text-sm font-medium">
                  Location Type <span className="text-destructive">*</span>
                </label>
                <select
                  id="type"
                  value={type}
                  onChange={(e) => setType(e.target.value as LocationType)}
                  required
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {LOCATION_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>{lt.label}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="parent" className="text-sm font-medium">
                  Parent Location
                </label>
                <select
                  id="parent"
                  value={parentId}
                  onChange={(e) => setParentId(e.target.value)}
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None / Root</option>
                  {(() => {
                    const descendantIds = editingLocation ? getDescendantIds(editingLocation.id) : [];
                    return locations
                      .filter((l) => l.id !== editingLocation?.id && !descendantIds.includes(l.id))
                      .map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ));
                  })()}
                </select>
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
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="isActive"
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  disabled={saving}
                  className="h-4 w-4 rounded border-input"
                />
                <label htmlFor="isActive" className="text-sm font-medium">
                  Active
                </label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : editingLocation ? "Save Changes" : "Create Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
