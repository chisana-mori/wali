
import express from "express";
import cors from "cors";
import { createOpencodeServer } from "@opencode-ai/sdk/server";
import { config } from "./config";
import { WorkspaceManager } from "./workspace";
import { ProxyHandler } from "./proxy";

const app = express();

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow all origins for now
        callback(null, true);
    },
    exposedHeaders: "*",
    credentials: true,
}));

app.use(express.json());
app.use(express.text());
app.use(express.raw({ type: "*/*" }));

// Start SDK Server
console.log("Starting internal OpenCode SDK server...");
// We bind to 127.0.0.1 and let it pick a random port (default behavior if port not specified? or we specify 0?)
// The SDK definitions showed `port?: number`.
const sdkServer = await createOpencodeServer({
    hostname: "127.0.0.1",
    port: 0, // Random port
});

console.log(`Internal OpenCode SDK server running at ${sdkServer.url}`);

// Update config with dynamic URL
// We need to assume config.opencodeUrl was mutable or we just override it for the proxy
const opencodeUrl = sdkServer.url;

// Important: The SDK server might need some time to be ready? 
// Usually createOpencodeServer awaits until ready.

// Override config.opencodeUrl for ProxyHandler
// We can't mutate the imported const config easily if it's a const object from zod.
// But ProxyHandler uses `config.opencodeUrl`.
// I should refactor ProxyHandler to accept the URL or config.
// For now, I'll monkey-patch it or better, Instantiate ProxyHandler with the URL.

// Refactoring ProxyHandler to accept upstreamUrl
const workspaceManager = new WorkspaceManager(config.workspaceRoot);
// We need to modify ProxyHandler to accept upstreamUrl. 
// I will rewrite ProxyHandler in next step, but here I assume I will pass it.
// Wait, I can't write this file until ProxyHandler is updated. 
// Actually, I can write this file and it will fail TS check until I fix ProxyHandler.
// Better to fix ProxyHandler first. 
// But I am in a "write_to_file" content block.
// I will assume ProxyHandler is updated to accept the URL.

const proxyHandler = new ProxyHandler(workspaceManager, opencodeUrl);

// Route mappings
app.get("/api/health", proxyHandler.health);

app.get("/api/sse", proxyHandler.sse);
app.get("/api/event", proxyHandler.sse);
app.get("/api/global/event", proxyHandler.sse);

app.use("/api/sessions", proxyHandler.sessions);
app.use("/api/session", proxyHandler.sessions);

const port = parseInt(config.addr.replace(":", "")) || 8080;

const server = app.listen(port, () => {
    console.log(`opencode-web backend listening on ${config.addr} (proxying to internal SDK ${opencodeUrl})`);
});

// Cleanup on exit
const cleanup = () => {
    console.log("Shutting down...");
    sdkServer.close();
    server.close();
    process.exit(0);
};

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
