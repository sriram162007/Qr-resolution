import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

const loadedEnv = loadEnv("", process.cwd(), "");

function parseJsonBody(req: any): Promise<any> {
  return new Promise((resolve, reject) => {
    if (!req.headers["content-type"]?.includes("application/json")) {
      return resolve({});
    }

    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: "api-proxy",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const url = req.url || "";
          if (
            !url.startsWith("/api/analyze-issue") &&
            !url.startsWith("/api/suggest-resolution") &&
            !url.startsWith("/api/send-whatsapp")
          ) {
            return next();
          }

          try {
            if (req.method === "POST") {
              (req as any).body = await parseJsonBody(req);
            }

            const originalGeminiKey = process.env.GEMINI_API_KEY;
            const originalTwilioSid = process.env.TWILIO_ACCOUNT_SID;
            const originalTwilioToken = process.env.TWILIO_AUTH_TOKEN;
            const originalTwilioFrom = process.env.TWILIO_WHATSAPP_FROM;
            if (!originalGeminiKey && loadedEnv.GEMINI_API_KEY) {
              process.env.GEMINI_API_KEY = loadedEnv.GEMINI_API_KEY;
            }
            if (!originalTwilioSid && loadedEnv.TWILIO_ACCOUNT_SID) {
              process.env.TWILIO_ACCOUNT_SID = loadedEnv.TWILIO_ACCOUNT_SID;
            }
            if (!originalTwilioToken && loadedEnv.TWILIO_AUTH_TOKEN) {
              process.env.TWILIO_AUTH_TOKEN = loadedEnv.TWILIO_AUTH_TOKEN;
            }
            if (!originalTwilioFrom && loadedEnv.TWILIO_WHATSAPP_FROM) {
              process.env.TWILIO_WHATSAPP_FROM = loadedEnv.TWILIO_WHATSAPP_FROM;
            }

            try {
              let handler: (req: any, res: any) => Promise<void>;
              if (url.startsWith("/api/send-whatsapp")) {
                handler = (await import("./api/send-whatsapp.ts")).default;
              } else if (url.startsWith("/api/suggest-resolution")) {
                handler = (await import("./api/suggest-resolution.ts")).default;
              } else {
                handler = (await import("./api/analyze-issue.ts")).default;
              }
              await handler(req, res as any);
            } finally {
              if (!originalGeminiKey) {
                delete process.env.GEMINI_API_KEY;
              }
              if (!originalTwilioSid) {
                delete process.env.TWILIO_ACCOUNT_SID;
              }
              if (!originalTwilioToken) {
                delete process.env.TWILIO_AUTH_TOKEN;
              }
              if (!originalTwilioFrom) {
                delete process.env.TWILIO_WHATSAPP_FROM;
              }
            }
          } catch (err) {
            console.error("[API Proxy] Failed to load handler", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ message: "Service is temporarily unavailable." }));
          }
        });
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    fs: {
      allow: [".."],
    },
  },
});
