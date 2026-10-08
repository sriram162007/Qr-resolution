import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { pathToFileURL } from "url";

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
          const routeMap: Record<string, string> = {
            "analyze-issue": "./api/analyze-issue.ts",
            "suggest-resolution": "./api/suggest-resolution.ts",
            "send-whatsapp": "./api/send-whatsapp.ts",
            "check-sla": "./api/check-sla.ts",
            "detect-duplicate": "./api/detect-duplicate.ts",
            "verify-resolution": "./api/verify-resolution.ts",
          };

          const matchedKey = Object.keys(routeMap).find((key) => url.startsWith(`/api/${key}`));
          if (!matchedKey) {
            return next();
          }

          try {
            if (req.method === "POST") {
              (req as any).body = await parseJsonBody(req);
            }

            // Copy loaded envs to process.env if not present
            for (const [k, v] of Object.entries(loadedEnv)) {
              if (!process.env[k] && v) {
                process.env[k] = v;
              }
            }

            try {
              const filePath = path.resolve(process.cwd(), "api", `${matchedKey}.ts`);
              const handlerModule = await import(pathToFileURL(filePath).href);
              const handler = handlerModule.default;
              await handler(req, res as any);
            } catch (handlerErr) {
              console.error(`[API Proxy] Error running handler ${matchedKey}:`, handlerErr);
              res.statusCode = 500;
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify({ error: "Internal API handler error" }));
            }
          } catch (err) {
            console.error("[API Proxy] Request processing failed", err);
            res.statusCode = 500;
            res.setHeader("Content-Type", "application/json");
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
