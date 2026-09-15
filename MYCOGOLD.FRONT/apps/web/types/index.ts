export type ProductCategory = "fresh-produce" | "fruits" | "vegetables" | "mushrooms" | "grains" | "livestock";
export type Listing = { id: string; product: string; category: ProductCategory; location: string; quantity: number; unit: string; price: number; currency: string };
export type MarketIndex = { code: string; value: number; currency: string; unit: string; completedTrades: number; tradedVolume: number; confidence: "low" | "medium" | "high" };
