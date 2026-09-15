"use client";
import { useState } from "react";
export function useMarketDepth() { return useState([{ side: "offer", price: 2000, volume: 500 }]); }
