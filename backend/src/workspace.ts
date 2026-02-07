
import fs from "fs/promises";
import path from "path";

export class WorkspaceManager {
    constructor(private workspaceRoot: string) { }

    async getWorkspacePath(userId: string): Promise<string> {
        const safeUserId = userId || "anonymous";
        const workspacePath = path.join(this.workspaceRoot, safeUserId);

        // Ensure directory exists
        // Using recursive: true to be safe, similar to os.MkdirAll in Go
        await fs.mkdir(workspacePath, { recursive: true });

        return workspacePath;
    }
}
