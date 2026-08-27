import QRCode from "qrcode";

export async function generateQRCodeDataURL(publicUrl: string, width = 400): Promise<string> {
  return QRCode.toDataURL(publicUrl, {
    width,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

export async function generateQRCodeBuffer(publicUrl: string, width = 400): Promise<Buffer> {
  return QRCode.toBuffer(publicUrl, {
    width,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });
}

export function getPublicQRUrl(qrId: string): string {
  const baseUrl = (import.meta.env.VITE_APP_URL || window.location.origin).replace(/\/$/, "");
  return `${baseUrl}/q/${qrId}`;
}
