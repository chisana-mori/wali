
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
    addr: z.string().default(":8080"),
    opencodeUrl: z.string().default("http://localhost:8081"),
    workspaceRoot: z.string().default("./workspaces"),
});

export type Config = z.infer<typeof configSchema>;

function loadConfig(): Config {
    return configSchema.parse({
        addr: process.env.OPENCODE_ADDR,
        opencodeUrl: process.env.OPENCODE_OPENCODE_URL,
        workspaceRoot: process.env.OPENCODE_WORKSPACE_ROOT,
    });
}

export const config = loadConfig();
