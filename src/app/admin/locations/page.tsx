"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getLocations, createLocation, updateLocation, deleteLocation } from "@/services/locationService";
import type { Location, LocationStatus } from "@/types";
import { Plus, Power, Trash2, MapPin } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "ACTIVE", label: "ACTIVE" },
  { value: "INACTIVE", label: "INACTIVE" },
] as const;

export default function AdminLocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(false);

  const loadData = useCallback(async () => {
    try {
      const data = await getLocations();
      if (!mountedRef.current) return;
      setLocations(data);
    } catch (err) {
      console.error("Failed to load locations:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    mountedRef.current = true;

    async function load() {
      try {
        const data = await getLocations();
        if (!cancelled) {
          setLocations(data);
        }
      } catch (err) {
        console.error("Failed to load locations:", err);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
      mountedRef.current = false;
    };
  }, [loadData]);

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      const locationId = await createLocation({
        organizationId: "default",
        name: formData.get("name") as string,
        code: formData.get("code") as string,
        description: (formData.get("description") as string) || undefined,
        address: (formData.get("address") as string) || undefined,
        parentLocationId: (formData.get("parentLocationId") as string) || undefined,
        type: (formData.get("type") as string) || undefined,
        status: (formData.get("status") as LocationStatus) || "ACTIVE",
      });
      const newLocation = await getLocations().then(locs => locs.find(l => l.id === locationId));
      if (newLocation) {
        setLocations((prev) => [...prev, newLocation]);
      }
      setCreateOpen(false);
      e.currentTarget.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create location");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedLocation) return;
    setSaving(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    try {
      await updateLocation(selectedLocation.id, {
        name: formData.get("name") as string,
        code: formData.get("code") as string,
        description: (formData.get("description") as string) || undefined,
        address: (formData.get("address") as string) || undefined,
        parentLocationId: (formData.get("parentLocationId") as string) || undefined,
        type: (formData.get("type") as string) || undefined,
        status: (formData.get("status") as LocationStatus) || "ACTIVE",
      });
      setLocations((prev) => prev.map((l) => l.id === selectedLocation.id ? { ...selectedLocation, ...Object.fromEntries(formData) } : l));
      setEditOpen(false);
      setSelectedLocation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update location");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (location: Location) => {
    const newStatus = location.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await updateLocation(location.id, { status: newStatus });
    setLocations((prev) => prev.map((l) => l.id === location.id ? { ...l, status: newStatus } : l));
  };

  const handleDelete = async (location: Location) => {
    if (!confirm("Are you sure you want to delete this location?")) return;
    await deleteLocation(location.id);
    setLocations((prev) => prev.filter((l) => l.id !== location.id));
  };

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Locations</h1>
          <p className="text-muted-foreground">Manage locations for issue reporting.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Create Location
        </Button>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>All Locations</CardTitle>
          <CardDescription>{locations.length} location{locations.length !== 1 ? "s" : ""} found</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No locations yet</h3>
              <p className="text-muted-foreground">Create a location to get started.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell className="font-mono text-xs">{location.code}</TableCell>
                    <TableCell className="capitalize">{location.type?.replace("_", " ").toLowerCase() || "-"}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        location.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {location.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedLocation(location); setEditOpen(true); }}>
                          Edit
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleToggleStatus(location)} title={location.status === "ACTIVE" ? "Deactivate" : "Activate"}>
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(location)} title="Delete">
                          <Trash2 className="h-4 w-4 text-destructive" />
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

      {/* Create Location Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <form onSubmit={handleCreate}>
            <DialogHeader>
              <DialogTitle>Create Location</DialogTitle>
              <DialogDescription>Add a new physical location.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {error && (
                <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}
              <div className="grid gap-2">
                <label htmlFor="name" className="text-sm font-medium">Name</label>
                <Input id="name" name="name" required disabled={saving} placeholder="Hostel Block A" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="code" className="text-sm font-medium">Code</label>
                <Input id="code" name="code" required disabled={saving} placeholder="HBA" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <Input id="description" name="description" disabled={saving} placeholder="Second floor hostel block" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="address" className="text-sm font-medium">Address</label>
                <Input id="address" name="address" disabled={saving} placeholder="Block A, Floor 2" />
              </div>
              <div className="grid gap-2">
                <label htmlFor="parentLocationId" className="text-sm font-medium">Parent Location</label>
                <select
                  id="parentLocationId"
                  name="parentLocationId"
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <option value="">None (Top level)</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <label htmlFor="type" className="text-sm font-medium">Type</label>
                <Input id="type" name="type" disabled={saving} placeholder="building, floor, room, etc." />
              </div>
              <div className="grid gap-2">
                <label htmlFor="status" className="text-sm font-medium">Status</label>
                <select
                  id="status"
                  name="status"
                  disabled={saving}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>Cancel</Button>
              <Button type="submit" disabled={saving}>Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Location Modal */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          {selectedLocation && (
            <form onSubmit={handleUpdate}>
              <DialogHeader>
                <DialogTitle>Edit Location</DialogTitle>
                <DialogDescription>Update location details.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {error}
                  </div>
                )}
                <div className="grid gap-2">
                  <label htmlFor="edit-name" className="text-sm font-medium">Name</label>
                  <Input id="edit-name" name="name" defaultValue={selectedLocation.name} required disabled={saving} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="edit-code" className="text-sm font-medium">Code</label>
                  <Input id="edit-code" name="code" defaultValue={selectedLocation.code} required disabled={saving} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="edit-description" className="text-sm font-medium">Description</label>
                  <Input id="edit-description" name="description" defaultValue={selectedLocation.description} disabled={saving} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="edit-address" className="text-sm font-medium">Address</label>
                  <Input id="edit-address" name="address" defaultValue={selectedLocation.address} disabled={saving} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="edit-parentLocationId" className="text-sm font-medium">Parent Location</label>
                  <select
                    id="edit-parentLocationId"
                    name="parentLocationId"
                    defaultValue={selectedLocation.parentLocationId || ""}
                    disabled={saving}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="">None (Top level)</option>
                    {locations.filter((l) => l.id !== selectedLocation.id).map((loc) => (
                      <option key={loc.id} value={loc.id}>{loc.name}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label htmlFor="edit-type" className="text-sm font-medium">Type</label>
                  <Input id="edit-type" name="type" defaultValue={selectedLocation.type} disabled={saving} />
                </div>
                <div className="grid gap-2">
                  <label htmlFor="edit-status" className="text-sm font-medium">Status</label>
                  <select
                    id="edit-status"
                    name="status"
                    defaultValue={selectedLocation.status}
                    disabled={saving}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => { setEditOpen(false); setSelectedLocation(null); }} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving}>Save</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
