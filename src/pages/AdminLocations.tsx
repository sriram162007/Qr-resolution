import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { getLocations, createLocation, updateLocation, setLocationActive, deleteLocation } from "@/services/locationService";
import { getOrganization } from "@/services/organizationService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import AdminNavbar from "@/components/AdminNavbar";
import type { Location, LocationType } from "@/types";
import {
  Building2,
  Plus,
  ChevronRight,
  ChevronDown,
  Layers,
  Edit2,
  Trash2,
  FolderTree,
} from "lucide-react";

const LOCATION_TYPES: { value: LocationType; label: string }[] = [
  { value: "ORGANIZATION", label: "Campus Organization" },
  { value: "BUILDING", label: "Building" },
  { value: "FLOOR", label: "Floor / Level" },
  { value: "ROOM", label: "Room / Classroom" },
  { value: "AREA", label: "Campus Area" },
  { value: "FACILITY", label: "Facility / Lab" },
  { value: "OTHER", label: "Other" },
];

function LocationTreeItem({
  location,
  locations,
  level,
  onEdit,
  onDelete,
  onToggleActive,
  disabledIds,
}: {
  location: Location;
  locations: Location[];
  level: number;
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
  onToggleActive: (location: Location) => void;
  disabledIds: Set<string>;
}) {
  const [expanded, setExpanded] = useState(true);
  const children = locations.filter((l) => l.parentLocationId === location.id);
  const hasChildren = children.length > 0;

  return (
    <div className="space-y-1">
      <div
        className="flex items-center justify-between py-2.5 px-3 hover:bg-[#F5F5F7] rounded-xl transition-colors group"
        style={{ paddingLeft: `${level * 1.5 + 0.75}rem` }}
      >
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="w-5 h-5 flex items-center justify-center rounded-md hover:bg-black/10 text-[#6E6E73] transition-colors"
            >
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </button>
          ) : (
            <div className="w-5 h-5 flex items-center justify-center text-[#86868B]">
              <span className="w-1.5 h-1.5 rounded-full bg-black/20" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-[#1D1D1F] truncate">
                {location.name}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-[#86868B] bg-black/[0.04] px-1.5 py-0.5 rounded">
                {location.type}
              </span>
              {location.department && (
                <span className="text-[10px] font-medium text-[#0071E3] bg-[#0071E3]/10 px-1.5 py-0.5 rounded">
                  {location.department}
                </span>
              )}
            </div>
            {location.description && (
              <p className="text-[11px] text-[#86868B] truncate mt-0.5">
                {location.description}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
          <Badge
            variant={location.isActive ? "success" : "secondary"}
            className="text-[10px] px-2 py-0.5 mr-1"
          >
            {location.isActive ? "Active" : "Inactive"}
          </Badge>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onEdit(location)}
            className="h-8 px-2 text-xs text-[#0071E3] rounded-lg"
          >
            <Edit2 className="w-3 h-3 mr-1" />
            Edit
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleActive(location)}
            className="h-8 px-2 text-xs text-[#6E6E73] rounded-lg"
          >
            {location.isActive ? "Deactivate" : "Activate"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => onDelete(location)}
            disabled={disabledIds.has(location.id)}
            className="h-8 px-2 text-xs text-[#D70015] hover:bg-[#FEECEC] rounded-lg disabled:opacity-30"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="space-y-1">
          {children.map((child) => (
            <LocationTreeItem
              key={child.id}
              location={child}
              locations={locations}
              level={level + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleActive={onToggleActive}
              disabledIds={disabledIds}
            />
          ))}
        </div>
      )}
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
  const [success, setSuccess] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [type, setType] = useState<LocationType>("OTHER");
  const [parentId, setParentId] = useState("");
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

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
        setLocations([]);
        return;
      }
      setOrganization({ id: org.id, name: org.name });
      const locs = await getLocations(org.id);
      setLocations(locs);
    } catch {
      setError("Failed to load campus location hierarchy.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const openCreate = () => {
    setEditingLocation(null);
    setName("");
    setType("ROOM");
    setParentId("");
    setDepartment("");
    setDescription("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (loc: Location) => {
    setEditingLocation(loc);
    setName(loc.name);
    setType(loc.type);
    setParentId(loc.parentLocationId || "");
    setDepartment(loc.department || "");
    setDescription(loc.description || "");
    setIsActive(loc.isActive);
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organization) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingLocation) {
        await updateLocation(editingLocation.id, {
          name,
          type,
          parentLocationId: parentId || null,
          department: department || undefined,
          description: description || undefined,
          isActive,
        });
        setSuccess(`Location "${name}" updated.`);
      } else {
        await createLocation({
          organizationId: organization.id,
          name,
          type,
          parentLocationId: parentId || null,
          department: department || undefined,
          description: description || undefined,
          isActive,
        });
        setSuccess(`Location "${name}" created.`);
      }
      setDialogOpen(false);
      await loadData();
    } catch {
      setError("Failed to save location.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (loc: Location) => {
    try {
      await setLocationActive(loc.id, !loc.isActive);
      await loadData();
    } catch {
      setError("Failed to update status.");
    }
  };

  const handleDelete = async (loc: Location) => {
    if (!confirm(`Are you sure you want to delete "${loc.name}"?`)) return;
    try {
      await deleteLocation(loc.id);
      await loadData();
    } catch {
      setError("Failed to delete location.");
    }
  };

  const rootLocations = locations.filter((l) => !l.parentLocationId);
  const disabledDeleteIds = new Set(
    locations.filter((l) => locations.some((child) => child.parentLocationId === l.id)).map((l) => l.id)
  );

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] flex flex-col selection:bg-[#0071E3]/15 selection:text-[#0071E3]">
      <AdminNavbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">
              Campus Hierarchy & Locations
            </h1>
            <p className="text-xs text-[#86868B] mt-0.5">
              Organize campus buildings, floors, rooms, and department coverage mappings.
            </p>
          </div>

          <Button
            onClick={openCreate}
            className="h-10 text-xs font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)] flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            Add Facility / Area
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

        <Card>
          <div className="p-5 pb-3 border-b border-black/[0.06] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-[#0071E3]" />
              <h2 className="text-sm font-semibold text-[#1D1D1F]">
                Campus Directory Tree
              </h2>
            </div>
            <span className="text-xs text-[#86868B]">
              {locations.length} total facility nodes
            </span>
          </div>

          <div className="p-4">
            {loading ? (
              <div className="py-12 text-center text-xs text-[#86868B]">
                <Layers className="w-5 h-5 animate-spin mx-auto text-[#0071E3]" />
                <p className="mt-2">Loading facility hierarchy...</p>
              </div>
            ) : rootLocations.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#86868B] space-y-3">
                <Building2 className="w-8 h-8 mx-auto text-[#86868B]" />
                <p>No locations defined yet. Click "Add Facility / Area" to start mapping campus grounds.</p>
              </div>
            ) : (
              <div className="space-y-1">
                {rootLocations.map((loc) => (
                  <LocationTreeItem
                    key={loc.id}
                    location={loc}
                    locations={locations}
                    level={0}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onToggleActive={handleToggleActive}
                    disabledIds={disabledDeleteIds}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </main>

      {/* Location Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-lg font-bold text-[#1D1D1F]">
              {editingLocation ? "Edit Facility Node" : "Create New Location"}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#86868B]">
              Configure facility identification and mapped maintenance department.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Facility Name *
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Science Block C, Room 302"
                required
                className="h-10 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Node Type
                </label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as LocationType)}
                  className="w-full h-10 rounded-xl border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#0071E3]"
                >
                  {LOCATION_TYPES.map((lt) => (
                    <option key={lt.value} value={lt.value}>{lt.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                  Responsible Dept.
                </label>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Electrical, Civil"
                  className="h-10 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Parent Location (Hierarchy)
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full h-10 rounded-xl border border-black/10 bg-white px-3 text-xs outline-none focus:border-[#0071E3]"
              >
                <option value="">None / Top Level</option>
                {locations
                  .filter((l) => l.id !== editingLocation?.id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>{l.name} ({l.type})</option>
                  ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6E6E73]">
                Description / Notes
              </label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional facility notes"
                className="h-10 text-xs"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="locActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded text-[#0071E3] focus:ring-[#0071E3]"
              />
              <label htmlFor="locActive" className="text-xs text-[#1D1D1F]">
                Facility active for complaint reporting
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="submit"
                disabled={saving || !name.trim()}
                className="w-full h-11 text-xs font-semibold rounded-xl shadow-[0_1px_3px_rgba(0,113,227,0.3)]"
              >
                {saving ? "Saving..." : "Save Location"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Footer */}
      <footer className="text-center text-xs text-[#86868B] py-6 border-t border-black/[0.06] bg-white">
        Campus Pulse • Operations Console • Location Directory
      </footer>
    </div>
  );
}
