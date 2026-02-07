
import type { Request, Response } from "express";
import fetch, { Headers, Response as FetchResponse } from "node-fetch";
import { config } from "./config";
import { WorkspaceManager } from "./workspace";

// Helper to clone headers
function cloneHeaders(reqHeaders: any): Headers {
    const headers = new Headers();
    Object.keys(reqHeaders).forEach((key) => {
        if (key.toLowerCase() === "host") return;
        const value = reqHeaders[key];
        if (Array.isArray(value)) {
            value.forEach((v) => headers.append(key, v));
        } else if (value) {
            headers.set(key, value as string);
        }
    });
    return headers;
}

export class ProxyHandler {
    constructor(private workspaceManager: WorkspaceManager, private upstreamUrl: string) { }

    private async getClientInfo(req: Request) {
        const userId = (req.headers["x-user-id"] as string) || (req.headers["x-user"] as string) || "anonymous";
        const workspacePath = await this.workspaceManager.getWorkspacePath(userId);
        return { userId, workspacePath };
    }

    private bindDirectory(path: string, workspacePath: string): string {
        const [pathname = "", query = ""] = path.split("?", 2);
        const params = new URLSearchParams(query);
        // Enforce per-user isolation regardless of client-supplied directory.
        params.set("directory", workspacePath);
        const qs = params.toString();
        return qs ? `${pathname}?${qs}` : pathname;
    }

    // Health Check
    health = (req: Request, res: Response) => {
        res.json({ status: "ok" });
    };

    // SSE Handler
    sse = async (req: Request, res: Response) => {
        const { userId, workspacePath } = await this.getClientInfo(req);
        const scope = req.query.scope as string;

        let upstreamPath = "/event";
        if (scope === "global" || req.path.endsWith("/global/event")) {
            upstreamPath = "/global/event";
        }

        const headers = cloneHeaders(req.headers);
        headers.set("Accept", "text/event-stream");
        headers.set("x-user-id", userId);
        headers.set("x-workspace", workspacePath);
        headers.set("x-opencode-directory", workspacePath);

        const upstreamUrl = `${this.upstreamUrl}${this.bindDirectory(upstreamPath, workspacePath)}`;

        try {
            console.log(`[SSE] Connecting to upstream ${upstreamUrl}`);
            const upstream = await fetch(upstreamUrl, {
                method: "GET",
                headers: headers,
                // Important for SSE to not buffer
                compress: false,
            });

            if (!upstream.ok) {
                console.error(`[SSE] Upstream error: ${upstream.status}`);
                upstream.headers.forEach((value, key) => {
                    res.setHeader(key, value);
                });
                res.status(upstream.status).send(await upstream.text());
                return;
            }

            console.log(`[SSE] Connected to upstream`);

            // Set headers for SSE
            res.setHeader("Content-Type", "text/event-stream");
            res.setHeader("Cache-Control", "no-cache");
            res.setHeader("Connection", "keep-alive");
            res.flushHeaders();

            if (upstream.body) {
                upstream.body.pipe(res);
            } else {
                res.end();
            }

        } catch (error) {
            console.error(`[SSE] Error connecting to upstream:`, error);
            res.status(502).json({ error: String(error) });
        }
    };


    // Sessions Proxy
    sessions = async (req: Request, res: Response) => {
        const { userId, workspacePath } = await this.getClientInfo(req);

        // Rebuild full path first because Express strips mount prefix from req.path
        let path = `${req.baseUrl}${req.path}`;
        if (path.startsWith("/api/sessions")) {
            path = path.slice("/api/sessions".length);
        } else if (path.startsWith("/api/session")) {
            path = path.slice("/api/session".length);
        }

        path = path.replace(/^\/+|\/+$/g, "");
        const segments = path ? path.split("/") : [];

        let upstreamPath: string;
        switch (true) {
            case segments.length === 0:
                upstreamPath = "/session";
                break;
            case segments.length === 1:
                upstreamPath = `/session/${segments[0]}`;
                break;
            case segments.length === 2 && segments[1] === "prompt":
                upstreamPath = `/session/${segments[0]}/prompt`;
                break;
            case segments.length === 2 && segments[1] === "message":
                upstreamPath = `/session/${segments[0]}/message`;
                break;
            case segments.length === 3 && segments[1] === "permissions":
                upstreamPath = `/session/${segments[0]}/permissions/${segments[2]}`;
                break;
            case segments.length === 3 && segments[1] === "questions":
                upstreamPath = `/session/${segments[0]}/questions/${segments[2]}`;
                break;
            default:
                res.status(404).json({ error: "route not found" });
                return;
        }

        const queryIndex = req.originalUrl.indexOf("?");
        if (queryIndex !== -1) {
            upstreamPath += req.originalUrl.slice(queryIndex);
        }

        await this.proxyRequest(req, res, this.bindDirectory(upstreamPath, workspacePath), userId, workspacePath);
    };

    private async proxyRequest(req: Request, res: Response, path: string, userId: string, workspacePath: string) {
        const headers = cloneHeaders(req.headers);
        headers.delete("content-length"); // Let fetch calculate it
        headers.set("x-user-id", userId);
        headers.set("x-workspace", workspacePath);
        headers.set("x-opencode-directory", workspacePath);
        headers.set("Content-Type", "application/json");

        const upstreamUrl = `${this.upstreamUrl}${path}`;

        // Body handling
        let body: any = undefined;
        if (req.method !== "GET" && req.method !== "HEAD") {
            body = req.body;
            // If body is empty object (Express parses JSON), keep it. 
            // If req.body is undefined/null (no body sent), Express might make it empty obj if JSON middleware used.
            // Go logic: if empty body and method is POST/PUT/PATCH, modify to "{}"
            if (!body && (req.method === "POST" || req.method === "PUT" || req.method === "PATCH")) {
                body = {};
            }
            // Stringify if it's an object, because node-fetch expects string/buffer/stream for body
            if (typeof body === 'object') {
                body = JSON.stringify(body);
            }
        }

        console.log(`[Proxy] ${req.method} ${req.originalUrl} -> ${path}`);

        try {
            const upstream = await fetch(upstreamUrl, {
                method: req.method,
                headers: headers,
                body: body
            });

            console.log(`[Proxy] Upstream status: ${upstream.status}`);

            // Copy headers
            upstream.headers.forEach((value, key) => {
                if (key.startsWith("access-control-")) return;
                res.setHeader(key, value);
            });

            res.status(upstream.status);

            if (upstream.body) {
                upstream.body.pipe(res);
                // Log error body if status >= 400? 
                // Piping directly means we can't easily read it too without buffering.
                // Go code read it all. Let's buffer for logging if error, or just pipe.
                // For simplicity and streaming speed, just pipe.
            } else {
                res.end();
            }

        } catch (error) {
            console.error(`[Proxy] Error:`, error);
            res.status(502).json({ error: String(error) });
        }
    }
}
