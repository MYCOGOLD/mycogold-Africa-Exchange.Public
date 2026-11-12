export type Order = {
  id: string; sellerId: string; product: string; quantity: number; price: number;
  freshness: number; status: "ACTIVE" | "PAST" | "MATCHED" | "RELEASED" | "DISPUTED";
  createdAt: number; photos: string[]; video: string;
};

const createdAt = Date.now();
const orders: Order[] = [
  { id: "order-1", sellerId: "seller-1", product: "Avocado", quantity: 100, price: 50, freshness: 92, status: "ACTIVE", createdAt, photos: [], video: "" },
  { id: "order-2", sellerId: "seller-2", product: "Mango", quantity: 80, price: 40, freshness: 88, status: "ACTIVE", createdAt, photos: [], video: "" },
];

export function listOrders(status: Order["status"]): Order[] {
  return orders.filter(order => order.status === status);
}

export function freshnessEstimate(order: Order) {
  return {
    freshness: order.freshness,
    label: order.freshness >= 90 ? "FRESH" : order.freshness >= 70 ? "OK" : "LOW",
    ageHours: Math.floor((Date.now() - order.createdAt) / 3600000),
  };
}