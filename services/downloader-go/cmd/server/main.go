package main

import (
	"bytes"
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/tikdown/downloader-go/internal/tiktok"
)

type extractRequest struct {
	URL string `json:"url"`
}

type searchRequest struct {
	Keyword string `json:"keyword"`
	Count   int    `json:"count"`
}

type extractResponse struct {
	Success bool           `json:"success"`
	Type    string         `json:"type,omitempty"`
	Data    *tiktok.Result `json:"data,omitempty"`
	Error   string         `json:"error,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	_ = enc.Encode(body)
	_, _ = w.Write(buf.Bytes())
}

func main() {
	secret := os.Getenv("API_SECRET")

	mux := http.NewServeMux()

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, http.StatusOK, extractResponse{Success: true})
	})

	mux.HandleFunc("/extract", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, extractResponse{Error: "method not allowed"})
			return
		}
		if secret != "" && r.Header.Get("X-Api-Secret") != secret {
			writeJSON(w, http.StatusUnauthorized, extractResponse{Error: "unauthorized"})
			return
		}

		var req extractRequest
		r.Body = http.MaxBytesReader(w, r.Body, 2048)
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, http.StatusBadRequest, extractResponse{Error: "invalid request"})
			return
		}
		if !tiktok.IsValidURL(req.URL) {
			writeJSON(w, http.StatusBadRequest, extractResponse{Error: "invalid url"})
			return
		}

		result, err := tiktok.Extract(r.Context(), req.URL)
		if err != nil {
			log.Printf("extract failed: %v", err)
			writeJSON(w, http.StatusBadGateway, extractResponse{Error: "extract failed"})
			return
		}
		if result == nil {
			writeJSON(w, http.StatusNotFound, extractResponse{Error: "not found"})
			return
		}
		writeJSON(w, http.StatusOK, extractResponse{Success: true, Type: result.Type, Data: result})
	})

	mux.HandleFunc("/search", func(w http.ResponseWriter, r *http.Request) {
		if secret != "" && r.Header.Get("X-Api-Secret") != secret {
			writeJSON(w, http.StatusUnauthorized, tiktok.ExtractionResult{
				Success:   false,
				Error:     &tiktok.ErrorDetail{Code: "UNAUTHORIZED", Message: "unauthorized"},
				Timestamp: time.Now().UnixMilli(),
			})
			return
		}

		var keyword string
		count := 15

		if r.Method == http.MethodGet {
			keyword = strings.TrimSpace(r.URL.Query().Get("q"))
			if keyword == "" {
				keyword = strings.TrimSpace(r.URL.Query().Get("keyword"))
			}
			if c, err := strconv.Atoi(r.URL.Query().Get("count")); err == nil && c > 0 {
				count = c
			}
		} else if r.Method == http.MethodPost {
			var req searchRequest
			r.Body = http.MaxBytesReader(w, r.Body, 2048)
			if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
				writeJSON(w, http.StatusBadRequest, tiktok.ExtractionResult{
					Success:   false,
					Error:     &tiktok.ErrorDetail{Code: "BAD_REQUEST", Message: "invalid request body"},
					Timestamp: time.Now().UnixMilli(),
				})
				return
			}
			keyword = strings.TrimSpace(req.Keyword)
			if req.Count > 0 {
				count = req.Count
			}
		} else {
			writeJSON(w, http.StatusMethodNotAllowed, tiktok.ExtractionResult{
				Success:   false,
				Error:     &tiktok.ErrorDetail{Code: "METHOD_NOT_ALLOWED", Message: "method not allowed"},
				Timestamp: time.Now().UnixMilli(),
			})
			return
		}

		if keyword == "" {
			writeJSON(w, http.StatusBadRequest, tiktok.ExtractionResult{
				Success:   false,
				Error:     &tiktok.ErrorDetail{Code: "EMPTY_KEYWORD", Message: "keyword is required"},
				Timestamp: time.Now().UnixMilli(),
			})
			return
		}

		engine, err := tiktok.NewTikTokSearchEngine(35 * time.Second)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, tiktok.ExtractionResult{
				Success:   false,
				Error:     &tiktok.ErrorDetail{Code: "INIT_FAILED", Message: err.Error()},
				Timestamp: time.Now().UnixMilli(),
			})
			return
		}

		ctx, cancel := context.WithTimeout(r.Context(), 50*time.Second)
		defer cancel()

		res := engine.Search(ctx, keyword, count)
		status := http.StatusOK
		if !res.Success {
			status = http.StatusBadGateway
		}
		writeJSON(w, status, res)
	})

	port := os.Getenv("GO_PORT")
	if port == "" {
		port = "8090"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      65 * time.Second,
	}

	log.Printf("downloader-go listening on :%s", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
