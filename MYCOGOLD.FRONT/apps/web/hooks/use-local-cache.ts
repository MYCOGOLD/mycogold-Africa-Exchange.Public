"use client";
import { useEffect, useState } from "react";
export function useLocalCache<T>(key: string, initialValue: T) { const [value, setValue] = useState<T>(initialValue); useEffect(() => { const cached = window.localStorage.getItem(key); if (cached) setValue(JSON.parse(cached) as T); }, [key]); useEffect(() => { window.localStorage.setItem(key, JSON.stringify(value)); }, [key, value]); return [value, setValue] as const; }
