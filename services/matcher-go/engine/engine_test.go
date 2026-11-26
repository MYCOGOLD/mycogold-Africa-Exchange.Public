package engine

import "testing"

func TestMatchRejectsInvalidSide(t *testing.T) {
	orders := []Order{
		{OrderID:"buy-1", TraderID:"buyer", CommodityCode:"TOMATO", GradeCode:"GRADE_1", MarketCode:"NAIROBI", Side:"BID", Price:12000, Quantity:1000, Priority:1, ExpiresAt:2_000_000, Version:1},
	}
	if _, err := Match(orders, 1_000_000); err == nil { t.Fatal("invalid side must be rejected by native engine") }
}

func TestMatchReturnsMakerPriceAndVersions(t *testing.T) {
	orders := []Order{
		{OrderID:"buy-1", TraderID:"buyer", CommodityCode:"TOMATO", GradeCode:"GRADE_1", MarketCode:"NAIROBI", Side:"BUY", Price:12000, Quantity:2000, Priority:1, ExpiresAt:2_000_000, Version:7},
		{OrderID:"sell-1", TraderID:"seller", CommodityCode:"TOMATO", GradeCode:"GRADE_1", MarketCode:"NAIROBI", Side:"SELL", Price:10000, Quantity:1000, Priority:2, ExpiresAt:2_000_000, Version:11},
	}
	result, err := Match(orders, 1_000_000)
	if err != nil { t.Fatal(err) }
	if len(result.Fills) != 1 { t.Fatalf("expected one fill, got %d", len(result.Fills)) }
	fill := result.Fills[0]
	if fill.Price != 12000 || fill.Quantity != 1000 || fill.BuyVersion != 7 || fill.SellVersion != 11 {
		t.Fatalf("unexpected fill: %+v", fill)
	}
}
