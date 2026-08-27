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
  const appUrl = import.meta.env.VITE_APP_URL?.trim().replace(/\/+$/, "");

  if (appUrl) {
    console.log("[QR URL] using VITE_APP_URL", {
      appUrl,
      finalUrl: `${appUrl}/q/${encodeURIComponent(qrId)}`,
    });
    return `${appUrl}/q/${encodeURIComponent(qrId)}`;
  }

  const fallback = `${window.location.origin}/q/${encodeURIComponent(qrId)}`;
  console.log("[QR URL] VITE_APP_URL not set, using fallback", {
    fallback,
  });
  return fallback;
}
