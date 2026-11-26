package engine

/*
#cgo CFLAGS: -I${SRCDIR}/../../../engine/cpp/include
#cgo LDFLAGS: -L${SRCDIR}/../../../build/engine -lmycogold_market_engine -lcrypto -lstdc++ -Wl,-rpath,${SRCDIR}/../../../build/engine
#include <stdlib.h>
#include <string.h>
#include "mycogold/c_api.h"
*/
import "C"

import (
	"errors"
	"fmt"
	"unsafe"
)

const (
	maxOrders = 50_000
	maxFieldBytes = 128
	maxArenaBytes = 32 << 20
)

type Order struct {
	OrderID       string `json:"orderId"`
	TraderID      string `json:"traderId"`
	CommodityCode string `json:"commodityCode"`
	GradeCode     string `json:"gradeCode"`
	MarketCode    string `json:"marketCode"`
	Side          string `json:"side"`
	Price         int64  `json:"limitPriceKesCentsPerKg"`
	Quantity      int64  `json:"quantityGrams"`
	Priority      uint64 `json:"prioritySequence"`
	ExpiresAt     int64  `json:"expiresAtEpochMs"`
	Version       uint64 `json:"version"`
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
	if len(orders) == 0 || len(orders) > maxOrders {
		return Result{}, errors.New("order count must be between 1 and 50000")
	}

	fields := make([][5]string, len(orders))
	arenaBytes := 0
	for i, order := range orders {
		if order.Side != "BUY" && order.Side != "SELL" {
			return Result{}, fmt.Errorf("orders[%d].side must be BUY or SELL", i)
		}
		fields[i] = [5]string{order.OrderID, order.TraderID, order.CommodityCode, order.GradeCode, order.MarketCode}
		for _, value := range fields[i] {
			if len(value) == 0 || len(value) > maxFieldBytes {
				return Result{}, fmt.Errorf("orders[%d] contains an empty or oversized identity field", i)
			}
			arenaBytes += len(value) + 1
		}
	}
	if arenaBytes > maxArenaBytes {
		return Result{}, errors.New("native string arena exceeds configured limit")
	}

	inputMemory := C.malloc(C.size_t(len(orders)) * C.size_t(unsafe.Sizeof(C.mycogold_order_input{})))
	stringMemory := C.malloc(C.size_t(arenaBytes))
	if inputMemory == nil || stringMemory == nil {
		if inputMemory != nil { C.free(inputMemory) }
		if stringMemory != nil { C.free(stringMemory) }
		return Result{}, errors.New("unable to allocate native input buffers")
	}
	defer C.free(inputMemory)
	defer C.free(stringMemory)

	input := unsafe.Slice((*C.mycogold_order_input)(inputMemory), len(orders))
	offset := uintptr(0)
	for i, order := range orders {
		pointers := [5]*C.char{}
		for j, value := range fields[i] {
			destination := unsafe.Add(stringMemory, offset)
			C.memcpy(destination, unsafe.Pointer(unsafe.StringData(value)), C.size_t(len(value)))
			*(*byte)(unsafe.Add(destination, uintptr(len(value)))) = 0
			pointers[j] = (*C.char)(destination)
			offset += uintptr(len(value) + 1)
		}
		side := C.int32_t(0)
		if order.Side == "SELL" { side = 1 }
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
	defer C.free(fillMemory)
	defer C.free(preventMemory)
	defer C.free(errorMemory)

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
	for i, fill := range nativeFills {
		result.Fills[i] = Fill{
			BuyIndex: uint64(fill.buy_order_index), SellIndex: uint64(fill.sell_order_index),
			Price: int64(fill.execution_price_kes_cents_per_kg), Quantity: int64(fill.quantity_grams),
			MakerSeq: uint64(fill.maker_priority_sequence),
			BuyVersion: uint64(fill.buy_order_version), SellVersion: uint64(fill.sell_order_version),
		}
	}
	for i, prevented := range nativePrevented {
		result.Prevented[i] = uint64(prevented.order_index)
	}
	return result, nil
}
