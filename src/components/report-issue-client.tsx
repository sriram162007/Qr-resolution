"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createTicket } from "@/services/ticketService";
import { uploadTicketImage } from "@/services/storageService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Upload, X, MapPin } from "lucide-react";
import type { QRCode, Location, TicketCategory } from "@/types";

interface ReportIssueClientProps {
  qr: QRCode;
  locations: Location[];
}

const CATEGORIES: { value: TicketCategory; label: string }[] = [
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "CLEANING", label: "Cleaning" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "INTERNET", label: "Internet / Wi-Fi" },
  { value: "AIR_CONDITIONING", label: "Air Conditioning" },
  { value: "SECURITY", label: "Security" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "SAFETY", label: "Safety" },
  { value: "OTHER", label: "Other" },
];

const STEPS = ["Location", "Issue", "Details", "Submit"];

export function ReportIssueClient({ qr, locations }: ReportIssueClientProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const [selectedLocationId, setSelectedLocationId] = useState(qr.locationId || "");
  const [category, setCategory] = useState<TicketCategory | "">("");
  const [exactLocation, setExactLocation] = useState("");
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [reporterName, setReporterName] = useState("");
  const [reporterPhone, setReporterPhone] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const qrLocation = qr.locationId ? locations.find((l) => l.id === qr.locationId) : null;

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return !!selectedLocationId;
      case 1:
        return !!category;
      case 2:
        return !!exactLocation.trim() && !!description.trim();
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    try {
      let imageUrl: string | undefined;
      if (photo) {
        const tempId = "temp-" + Date.now();
        imageUrl = await uploadTicketImage(tempId, photo);
      }

      const selectedLocation = locations.find((l) => l.id === selectedLocationId);
      if (!selectedLocation) {
        setError("Please select a valid location.");
        setLoading(false);
        return;
      }

      const ticketIdResult = await createTicket({
        qrId: qr.id,
        organizationId: qr.organizationId,
        qrLocationId: qr.locationId || undefined,
        issueLocationId: selectedLocation.id,
        issueLocationName: selectedLocation.name,
        category: category as TicketCategory,
        exactLocation: exactLocation.trim(),
        description: description.trim(),
        imageUrl,
        reporterName: reporterName.trim() || undefined,
        reporterPhone: reporterPhone.trim() || undefined,
        status: "NEW",
        priority: "NORMAL",
      });

      setTicketId(ticketIdResult);
      setSubmitted(true);
    } catch {
      setError("Failed to submit report. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted && ticketId) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-green-200 bg-green-50 p-6 text-center dark:border-green-800 dark:bg-green-950">
        <CheckCircle2 className="h-8 w-8 text-green-600 mb-2" />
        <p className="font-medium text-green-900 dark:text-green-100">Issue reported successfully</p>
        <p className="text-sm text-green-700 dark:text-green-300 mb-4">Your issue has been submitted.</p>
        <div className="w-full rounded-md bg-white dark:bg-green-900 p-3 mb-4">
          <p className="text-xs text-muted-foreground mb-1">Ticket ID</p>
          <p className="font-mono font-bold text-lg">{ticketId}</p>
        </div>
        <Button onClick={() => router.push(`/track/${ticketId}`)} className="w-full">
          Track Issue
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between">
        {STEPS.map((label, idx) => (
          <div key={label} className="flex flex-1 items-center">
            <div className="flex flex-col items-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                idx === step ? "bg-primary text-primary-foreground" :
                idx < step ? "bg-green-100 text-green-700" :
                "bg-muted text-muted-foreground"
              }`}>
                {idx + 1}
              </div>
              <span className="text-xs mt-1 text-muted-foreground hidden sm:inline">{label}</span>
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`mx-2 h-0.5 flex-1 ${idx < step ? "bg-green-200" : "bg-muted"}`} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 0: Location */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Where is the issue?</h3>
            <p className="text-sm text-muted-foreground">Select the actual location of the issue.</p>
          </div>
          {qrLocation && (
            <div className="flex items-center gap-2 rounded-md bg-muted p-3 text-sm">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">QR scanned near:</span>
              <span className="font-medium">{qrLocation.name}</span>
            </div>
          )}
          <div className="grid gap-2">
            <label htmlFor="location" className="text-sm font-medium">Location</label>
            <select
              id="location"
              value={selectedLocationId}
              onChange={(e) => setSelectedLocationId(e.target.value)}
              required
              className="flex h-12 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
      )}

      {/* Step 1: Category */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">What&apos;s the issue?</h3>
            <p className="text-sm text-muted-foreground">Select the category that best describes the issue.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                type="button"
                onClick={() => setCategory(cat.value)}
                className={`rounded-md border p-3 text-sm font-medium transition-colors ${
                  category === cat.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-input hover:bg-muted"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Tell us more</h3>
            <p className="text-sm text-muted-foreground">Provide details about the issue.</p>
          </div>
          <div className="space-y-2">
            <label htmlFor="exactLocation" className="text-sm font-medium">Where exactly?</label>
            <Input
              id="exactLocation"
              value={exactLocation}
              onChange={(e) => setExactLocation(e.target.value)}
              placeholder="Eg: Room 204 / bathroom / ceiling fan"
              required
              className="h-12 text-base"
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="description" className="text-sm font-medium">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue briefly..."
              required
              rows={3}
              className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Photo (optional)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoChange}
              className="hidden"
            />
            {photoPreview ? (
              <div className="relative">
                <img src={photoPreview} alt="Preview" className="w-full h-48 object-cover rounded-md" />
                <button
                  type="button"
                  onClick={removePhoto}
                  className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-md border border-dashed p-6 text-muted-foreground hover:bg-muted"
              >
                <Upload className="h-5 w-5" />
                <span>Take a photo or choose from gallery</span>
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">Name (optional)</label>
              <Input
                id="name"
                value={reporterName}
                onChange={(e) => setReporterName(e.target.value)}
                placeholder="Your name"
                className="h-12 text-base"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="phone" className="text-sm font-medium">Phone (optional)</label>
              <Input
                id="phone"
                value={reporterPhone}
                onChange={(e) => setReporterPhone(e.target.value)}
                placeholder="Your phone"
                className="h-12 text-base"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">Review & Submit</h3>
            <p className="text-sm text-muted-foreground">Please review your report before submitting.</p>
          </div>
          <div className="space-y-3 rounded-md bg-muted p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Location:</span>
              <span className="font-medium">{locations.find((l) => l.id === selectedLocationId)?.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Category:</span>
              <span className="font-medium">{category}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exact area:</span>
              <span className="font-medium">{exactLocation}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Description:</span>
              <span className="font-medium text-right max-w-[60%]">{description}</span>
            </div>
            {photoPreview && (
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Photo:</span>
                <img src={photoPreview} alt="Preview" className="h-12 w-12 object-cover rounded" />
              </div>
            )}
            {reporterName && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Name:</span>
                <span className="font-medium">{reporterName}</span>
              </div>
            )}
            {reporterPhone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Phone:</span>
                <span className="font-medium">{reporterPhone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            className="flex-1 h-12 text-base"
            onClick={() => setStep((s) => s - 1)}
            disabled={loading}
          >
            Back
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button
            type="button"
            className="flex-1 h-12 text-base"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
          >
            Next
          </Button>
        ) : (
          <Button
            type="button"
            className="flex-1 h-12 text-base"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading ? "Submitting..." : "Submit Issue"}
          </Button>
        )}
      </div>
    </div>
  );
}
