import { uploadTicketPhoto } from "@/services/supabaseService";

export async function uploadTicketImage(ticketId: string, dataUrl: string): Promise<string> {
  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Invalid image data");
  }
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: "image/jpeg" });
  const file = new File([blob], `${ticketId}.jpg`, { type: "image/jpeg" });
  return uploadTicketPhoto(file, ticketId);
}
