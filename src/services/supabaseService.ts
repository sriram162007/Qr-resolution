import { supabase } from "@/lib/supabase";

const BUCKET = "Tickets-photo";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export async function testSupabaseConnection(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.storage.from(BUCKET).list("", { limit: 1 });
    if (error) {
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

function validateFile(file: File): void {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error("Invalid file type. Only JPG, PNG, and WEBP are allowed.");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error("File is too large. Maximum size is 5 MB.");
  }
}

/**
 * Upload a complaint photo to Supabase storage.
 * Returns the public URL.
 */
export async function uploadTicketPhoto(file: File, ticketId: string): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase is not initialised. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.",
    );
  }

  validateFile(file);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `tickets/${ticketId}/complaint-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filename, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    console.error("[Storage] Supabase upload error", { ticketId, message: error.message });
    throw new Error(error.message || "Upload failed");
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  if (!publicData?.publicUrl) {
    throw new Error("Failed to get public URL after upload");
  }

  return publicData.publicUrl;
}

/**
 * Upload a resolution evidence photo to Supabase storage.
 * Returns the public URL.
 */
export async function uploadResolutionPhoto(file: File, ticketId: string): Promise<string> {
  if (!supabase) {
    throw new Error(
      "Supabase is not initialised. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY environment variables.",
    );
  }

  validateFile(file);

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `tickets/${ticketId}/resolution-${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filename, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });

  if (error) {
    console.error("[Storage] Resolution photo upload error", { ticketId, message: error.message });
    throw new Error(error.message || "Resolution photo upload failed");
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  if (!publicData?.publicUrl) {
    throw new Error("Failed to get public URL for resolution photo");
  }

  return publicData.publicUrl;
}
