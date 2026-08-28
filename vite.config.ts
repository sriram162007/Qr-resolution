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
          if (!req.url?.startsWith("/api/analyze-issue")) {
            return next();
          }

          try {
            if (req.method === "POST") {
              (req as any).body = await parseJsonBody(req);
            }

            const originalGeminiKey = process.env.GEMINI_API_KEY;
            if (!originalGeminiKey && loadedEnv.GEMINI_API_KEY) {
              process.env.GEMINI_API_KEY = loadedEnv.GEMINI_API_KEY;
            }

            try {
              const handler = (await import("./api/analyze-issue.ts")).default;
              await handler(req, res as any);
            } finally {
              if (!originalGeminiKey) {
                delete process.env.GEMINI_API_KEY;
              }
            }
          } catch (err) {
            console.error("[API Proxy] Failed to load handler", err);
            res.statusCode = 500;
            res.end(JSON.stringify({ message: "AI analysis is temporarily unavailable." }));
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
