package main

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"time"
	"syscall"

	"github.com/mycogold/mycogold-africa-exchange.public/services/matcher-go/engine"
)

const maxBodyBytes = 16 << 20
const maxConcurrentMatches = 32

type matchRequest struct {
	NowEpochMs int64          `json:"nowEpochMs"`
	Orders     []engine.Order `json:"orders"`
}

type apiError struct { Error string `json:"error"` }

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func main() {
	secret := os.Getenv("MYCOGOLD_MATCHER_HMAC_SECRET")
	if engine.ABIVersion() != 1 {
		log.Fatalf("unsupported native matcher ABI version: %d", engine.ABIVersion())
	}
	if len(secret) < 32 {
		log.Fatal("MYCOGOLD_MATCHER_HMAC_SECRET must contain at least 32 characters")
	}
	mux := http.NewServeMux()
	matchSlots := make(chan struct{}, maxConcurrentMatches)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "engine": "cpp20"})
	})
	mux.HandleFunc("POST /v1/match", func(w http.ResponseWriter, r *http.Request) {
		mediaType, _, mediaErr := mime.ParseMediaType(r.Header.Get("Content-Type"))
		if mediaErr != nil || mediaType != "application/json" {
			writeJSON(w, http.StatusUnsupportedMediaType, apiError{"application/json required"}); return
		}
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBodyBytes))
		if err != nil { writeJSON(w, http.StatusRequestEntityTooLarge, apiError{"request body too large"}); return }
		if !authenticate(secret, r, body) {
			writeJSON(w, http.StatusUnauthorized, apiError{"invalid internal request signature"}); return
		}
		select {
		case matchSlots <- struct{}{}:
			defer func() { <-matchSlots }()
		default:
			w.Header().Set("Retry-After", "1")
			writeJSON(w, http.StatusTooManyRequests, apiError{"matcher is at capacity"}); return
		}
		var request matchRequest
		decoder := json.NewDecoder(bytes.NewReader(body))
		decoder.DisallowUnknownFields()
		if err := decoder.Decode(&request); err != nil {
			writeJSON(w, http.StatusBadRequest, apiError{"invalid request JSON"}); return
		}
		if err := ensureEOF(decoder); err != nil {
			writeJSON(w, http.StatusBadRequest, apiError{"request must contain one JSON object"}); return
		}
		now := time.Now().UnixMilli()
		if request.NowEpochMs < now-30_000 || request.NowEpochMs > now+30_000 ||
			len(request.Orders) == 0 || len(request.Orders) > 50_000 {
			writeJSON(w, http.StatusBadRequest, apiError{"matching timestamp must be current and order count must be between 1 and 50000"}); return
		}
		result, err := engine.Match(request.Orders, request.NowEpochMs)
		if err != nil {
			writeJSON(w, http.StatusUnprocessableEntity, apiError{err.Error()}); return
		}
		writeJSON(w, http.StatusOK, result)
	})
	server := &http.Server{
		Addr: ":" + envOr("PORT", "8081"), Handler: securityHeaders(mux),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 20 * time.Second,
		WriteTimeout: 30 * time.Second, IdleTimeout: 60 * time.Second,
		MaxHeaderBytes: 16 << 10,
	}
	log.Printf("MycoGold C++ matcher gateway listening on %s", server.Addr)
	serverErrors := make(chan error, 1)
	go func() { serverErrors <- server.ListenAndServe() }()
	stop, stopSignal := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stopSignal()
	select {
	case err := <-serverErrors:
		if !errors.Is(err, http.ErrServerClosed) { log.Fatal(err) }
	case <-stop.Done():
		shutdownContext, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownContext); err != nil {
			log.Printf("graceful shutdown failed: %v", err)
			_ = server.Close()
		}
		if err := <-serverErrors; err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Printf("HTTP server stopped with error: %v", err)
		}
	}
}

func authenticate(secret string, r *http.Request, body []byte) bool {
	timestamp := r.Header.Get("X-MycoGold-Timestamp")
	signature := r.Header.Get("X-MycoGold-Signature")
	if len(signature) != 64 { return false }
	seconds, err := strconv.ParseInt(timestamp, 10, 64)
	if err != nil || time.Since(time.Unix(seconds, 0)) > 30*time.Second ||
		time.Until(time.Unix(seconds, 0)) > 30*time.Second { return false }
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(timestamp + "\n"))
	_, _ = mac.Write(body)
	expected := mac.Sum(nil)
	provided, err := hex.DecodeString(signature)
	return err == nil && hmac.Equal(expected, provided)
}

func ensureEOF(decoder *json.Decoder) error {
	var extra any
	if err := decoder.Decode(&extra); !errors.Is(err, io.EOF) { return errors.New("trailing JSON") }
	return nil
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func envOr(key, fallback string) string {
	if value := os.Getenv(key); value != "" { return value }
	return fallback
}
