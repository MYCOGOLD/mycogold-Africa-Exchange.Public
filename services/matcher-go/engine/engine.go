package engine

/*
#cgo CFLAGS: -I${SRCDIR}/../../../engine/cpp/include
#cgo LDFLAGS: -L${SRCDIR}/../../../build/engine -lmycogold_market_engine -lcrypto -lstdc++ -Wl,-rpath,${SRCDIR}/../../../build/engine
#include <stdlib.h>
#include "mycogold/c_api.h"
*/
import "C"

import (
	"errors"
	"fmt"
	"unsafe"
)

type Order struct {
	OrderID       string
	TraderID      string
	CommodityCode string
	GradeCode     string
	MarketCode    string
	Side          string
	Price         int64
	Quantity      int64
	Priority      uint64
	ExpiresAt     int64
	Version       uint64
}

type Fill struct {
	BuyIndex    uint64 `json:"buyOrderIndex"`
	SellIndex   uint64 `json:"sellOrderIndex"`
	Price       int64  `json:"executionPriceKesCentsPerKg"`
	Quantity    int64  `json:"quantityGrams"`
	MakerSeq    uint64 `json:"makerPrioritySequence"`
	BuyVersion  uint64 `json:"buyOrderVersion"`
	SellVersion uint64 `json:"sellOrderVersion"`
}

type Result struct {
	Fills     []Fill   `json:"fills"`
	Prevented []uint64 `json:"selfTradePreventedOrderIndices"`
}

func Match(orders []Order, now int64) (Result, error) {
	if len(orders) == 0 || len(orders) > 50_000 {
		return Result{}, errors.New("order count must be between 1 and 50000")
	}
	stride := unsafe.Sizeof(C.mycogold_order_input{})
	inputMemory := C.malloc(C.size_t(len(orders)) * C.size_t(stride))
	if inputMemory == nil {
		return Result{}, errors.New("unable to allocate native input buffer")
	}
	defer C.free(inputMemory)
	input := unsafe.Slice((*C.mycogold_order_input)(inputMemory), len(orders))
	allocated := make([]*C.char, 0, len(orders)*5)
	defer func() {
		for _, value := range allocated { C.free(unsafe.Pointer(value)) }
	}()
	for i, order := range orders {
		side := C.int32_t(0)
		if order.Side == "SELL" { side = 1 } else if order.Side != "BUY" {
			return Result{}, fmt.Errorf("orders[%d].side must be BUY or SELL", i)
		}
		values := []*string{&order.OrderID, &order.TraderID, &order.CommodityCode, &order.GradeCode, &order.MarketCode}
		pointers := make([]*C.char, len(values))
		for j, value := range values {
			pointers[j] = C.CString(*value)
			allocated = append(allocated, pointers[j])
		}
		input[i] = C.mycogold_order_input{
			order_id: pointers[0], trader_id: pointers[1], commodity_code: pointers[2],
			grade_code: pointers[3], market_code: pointers[4], side: side,
			limit_price_kes_cents_per_kg: C.int64_t(order.Price),
			quantity_grams: C.int64_t(order.Quantity),
			priority_sequence: C.uint64_t(order.Priority),
			expires_at_epoch_ms: C.int64_t(order.ExpiresAt),
			version: C.uint64_t(order.Version),
		}
	}

	fillMemory := C.malloc(C.size_t(len(orders)) * C.size_t(unsafe.Sizeof(C.mycogold_fill_output{})))
	preventMemory := C.malloc(C.size_t(len(orders)) * C.size_t(unsafe.Sizeof(C.mycogold_prevented_output{})))
	errorMemory := C.malloc(512)
	if fillMemory == nil || preventMemory == nil || errorMemory == nil {
		if fillMemory != nil { C.free(fillMemory) }
		if preventMemory != nil { C.free(preventMemory) }
		if errorMemory != nil { C.free(errorMemory) }
		return Result{}, errors.New("unable to allocate native output buffers")
	}
	defer C.free(fillMemory); defer C.free(preventMemory); defer C.free(errorMemory)
	var fillCount, preventedCount C.size_t
	status := C.mycogold_match_orders(
		(*C.mycogold_order_input)(inputMemory), C.size_t(len(orders)), C.int64_t(now),
		(*C.mycogold_fill_output)(fillMemory), C.size_t(len(orders)), &fillCount,
		(*C.mycogold_prevented_output)(preventMemory), C.size_t(len(orders)), &preventedCount,
		(*C.char)(errorMemory), 512,
	)
	if status != C.MYCOGOLD_ENGINE_OK {
		return Result{}, fmt.Errorf("native matcher status %d: %s", int(status), C.GoString((*C.char)(errorMemory)))
	}
	nativeFills := unsafe.Slice((*C.mycogold_fill_output)(fillMemory), int(fillCount))
	nativePrevented := unsafe.Slice((*C.mycogold_prevented_output)(preventMemory), int(preventedCount))
	result := Result{Fills: make([]Fill, len(nativeFills)), Prevented: make([]uint64, len(nativePrevented))}
	for i, f := range nativeFills {
		result.Fills[i] = Fill{uint64(f.buy_order_index), uint64(f.sell_order_index), int64(f.execution_price_kes_cents_per_kg), int64(f.quantity_grams), uint64(f.maker_priority_sequence), uint64(f.buy_order_version), uint64(f.sell_order_version)}
	}
	for i, p := range nativePrevented { result.Prevented[i] = uint64(p.order_index) }
	return result, nil
}
