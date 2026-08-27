import type { Location } from "@/types";

export function getLocationPath(locations: Location[], locationId: string): string {
  const segments: string[] = [];
  let current = locations.find((l) => l.id === locationId);
  while (current) {
    segments.unshift(current.name);
    const parentId = current.parentLocationId;
    current = parentId ? locations.find((l) => l.id === parentId) || undefined : undefined;
  }
  return segments.join(" / ");
}

export function getLocationDisplayName(locations: Location[], locationId: string): string {
  const path = getLocationPath(locations, locationId);
  return path || "Unknown Location";
}
