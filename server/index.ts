import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import MemoryStore from "memorystore";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

const MemoryStoreSession = MemoryStore(session);

const cookieSecure = (process.env.SESSION_COOKIE_SECURE || "")
  .trim()
  .toLowerCase() === "true";

console.log("ENV CHECK:", {
  NODE_ENV: process.env.NODE_ENV,
  SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE,
  cookieSecure,
});

app.use(
  session({
    secret: process.env.SESSION_SECRET || "flota-control-secret-key",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: cookieSecure,
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000,
      sameSite: cookieSecure ? "none" : "lax",
    },
    store: new MemoryStoreSession({
      checkPeriod: 86400000,
    }),
  })
);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Initialize storage before registering routes
  const { storage } = await import("./storage");
  await storage.initialize();
  console.log("✅ Storage initialized successfully");

  // Check for expiring documents on startup and every 24h
  const { sendExpirationAlert } = await import("./email");
  const checkExpiring = async () => {
    try {
      const expiring = await storage.getExpiringDocuments();
      if (expiring.length > 0) {
        console.log(`\n🔔 ${expiring.length} documento(s) por vencer o vencidos:`);
        await sendExpirationAlert(expiring);
      } else {
        console.log("✅ No hay documentos por vencer.");
      }
    } catch (err) {
      console.error("❌ Error verificando documentos por vencer:", err);
    }
  };
  checkExpiring();
  setInterval(checkExpiring, 24 * 60 * 60 * 1000); // every 24h

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: false,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
