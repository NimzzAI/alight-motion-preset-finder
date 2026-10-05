package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/tikdown/downloader-go/internal/tiktok"
)

type extractRequest struct {
	URL string `json:"url"`
}

type extractResponse struct {
	Success bool           `json:"success"`
	Type    string         `json:"type,omitempty"`
	Data    *tiktok.Result `json:"data,omitempty"`
	Error   string         `json:"error,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, body extractResponse) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8090"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      60 * time.Second,
	}

	log.Printf("downloader listening on :%s", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
