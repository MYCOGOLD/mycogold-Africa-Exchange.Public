"use client";
import { useState } from "react";
export function useTuskStream() { const [status] = useState<"idle" | "ready">("ready"); return { status }; }
