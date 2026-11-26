package main

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strconv"
	"testing"
	"time"
)

func signedRequest(secret string, body []byte, timestamp int64) *http.Request {
	request, _ := http.NewRequest(http.MethodPost, "/v1/match", bytes.NewReader(body))
	stamp := strconv.FormatInt(timestamp, 10)
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(stamp + "\n"))
	_, _ = mac.Write(body)
	request.Header.Set("X-MycoGold-Timestamp", stamp)
	request.Header.Set("X-MycoGold-Signature", hex.EncodeToString(mac.Sum(nil)))
	return request
}

func TestAuthenticateAcceptsValidSignature(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	body := []byte(`{"nowEpochMs":1,"orders":[]}`)
	request := signedRequest(secret, body, time.Now().Unix())
	if !authenticate(secret, request, body) { t.Fatal("expected valid HMAC request to authenticate") }
}

func TestAuthenticateRejectsTampering(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	body := []byte(`{"nowEpochMs":1}`)
	request := signedRequest(secret, body, time.Now().Unix())
	if authenticate(secret, request, []byte(`{"nowEpochMs":2}`)) { t.Fatal("modified body must fail HMAC validation") }
}

func TestAuthenticateRejectsStaleTimestamp(t *testing.T) {
	secret := "0123456789abcdef0123456789abcdef"
	body := []byte("{}")
	request := signedRequest(secret, body, time.Now().Add(-time.Minute).Unix())
	if authenticate(secret, request, body) { t.Fatal("stale request must be rejected") }
}
