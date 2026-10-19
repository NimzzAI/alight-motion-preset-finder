package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/tikdown/downloader-go/internal/tiktok"
)

func main() {
	query := "preset elitis"
	if len(os.Args) > 1 {
		query = strings.Join(os.Args[1:], " ")
	}

	engine, err := tiktok.NewTikTokSearchEngine(35 * time.Second)
	if err != nil {
		enc, _ := json.MarshalIndent(tiktok.ExtractionResult{
			Success:   false,
			Error:     &tiktok.ErrorDetail{Code: "INIT_FAILED", Message: err.Error()},
			Timestamp: time.Now().UnixMilli(),
		}, "", "  ")
		fmt.Println(string(enc))
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 50*time.Second)
	defer cancel()

	result := engine.Search(ctx, query, 15)

	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	enc.SetIndent("", "  ")
	_ = enc.Encode(result)

	fmt.Println(buf.String())
}
