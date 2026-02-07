import React from "react";
import { useGlobalSync } from "../contexts/GlobalSync";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function PermissionOverlay() {
  const { state, respondPermission } = useGlobalSync();
  const items = Object.values(state.permission).flat();

  if (items.length === 0) return null;

  return (
    <Dialog open>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permission Required</DialogTitle>
          <DialogDescription>
            OpenCode needs your approval before continuing.
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 space-y-3">
          {items.map((permission) => (
            <div key={permission.id} className="rounded-lg border border-border p-4">
              <p className="text-xs text-muted-foreground">
                {permission.description ?? "Approval required."}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => respondPermission(permission.id, "reject")}>
                  Reject
                </Button>
                <Button size="sm" variant="secondary" onClick={() => respondPermission(permission.id, "once")}>
                  Allow Once
                </Button>
                <Button size="sm" onClick={() => respondPermission(permission.id, "always")}>
                  Always Allow
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
