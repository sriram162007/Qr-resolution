import { supabase } from "@/lib/supabase";

const BUCKET = "Tickets-photo";

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

export async function uploadTicketPhoto(file: File, ticketId: string): Promise<string> {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) {
    throw new Error("Invalid file type. Only JPG, PNG, and WEBP are allowed.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("File is too large. Maximum size is 5 MB.");
  }

  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `tickets/${ticketId}/${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(filename, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) {
    throw new Error(error.message || "Upload failed");
  }

  const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(filename);
  if (!publicData?.publicUrl) {
    throw new Error("Failed to get public URL");
  }

  return publicData.publicUrl;
}
