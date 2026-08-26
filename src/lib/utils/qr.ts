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
