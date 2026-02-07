import React from "react";
import { useGlobalSync } from "../contexts/GlobalSync";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

export default function StatusBanner() {
  const { state } = useGlobalSync();
  if (state.status === "complete") return null;

  const label =
    state.status === "partial" ? "Reconnecting to server..." : "Loading sessions...";

  return (
    <Alert className="mb-4">
      <AlertTitle>Status</AlertTitle>
      <AlertDescription>{label}</AlertDescription>
    </Alert>
  );
}
