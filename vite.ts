import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // First add the Vite middleware
  app.use(vite.middlewares);
  
  // Special handling for non-API routes. This ensures API routes are not intercepted.
  app.use((req, res, next) => {
    const url = req.originalUrl;
    
    // Skip this middleware for API routes
    if (url.startsWith('/api/')) {
      return next();
    }
    
    // For all non-API routes, serve the Vite-processed HTML
    fs.promises.readFile(
      path.resolve(__dirname, "..", "client", "index.html"),
      "utf-8"
    ).then((template) => {
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      return vite.transformIndexHtml(url, template);
    }).then((page) => {
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    }).catch((e) => {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    });
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
