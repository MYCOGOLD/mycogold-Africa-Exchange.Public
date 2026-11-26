package engine

import (
	"fmt"
	"testing"
	"time"
)

func BenchmarkMatchOneThousandOrders(b *testing.B) {
	now := time.Now().UnixMilli()
	orders := make([]Order, 1_000)
	for i := 0; i < 500; i++ {
		orders[i] = Order{
			OrderID: fmt.Sprintf("buy-%04d", i), TraderID: fmt.Sprintf("buyer-%04d", i),
			CommodityCode: "TOMATO", GradeCode: "GRADE_1", MarketCode: "NAIROBI",
			Side: "BUY", Price: 12_000, Quantity: 1_000,
			Priority: uint64(i*2 + 1), ExpiresAt: now + 3_600_000, Version: 1,
		}
		orders[500+i] = Order{
			OrderID: fmt.Sprintf("sell-%04d", i), TraderID: fmt.Sprintf("seller-%04d", i),
			CommodityCode: "TOMATO", GradeCode: "GRADE_1", MarketCode: "NAIROBI",
			Side: "SELL", Price: 10_000, Quantity: 1_000,
			Priority: uint64(i*2 + 2), ExpiresAt: now + 3_600_000, Version: 1,
		}
	}
	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		if _, err := Match(orders, now); err != nil {
			b.Fatal(err)
		}
	}
}
