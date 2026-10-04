package tiktok

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

const mobileUA = "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36"

var rehydration = regexp.MustCompile(`(?s)<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>(.*?)</script>`)

type Author struct {
	ID         string `json:"id"`
	Avatar     string `json:"avatar"`
	Nickname   string `json:"nickname"`
	Username   string `json:"username"`
	Followers  int64  `json:"followers"`
	Following  int64  `json:"following"`
	Like       int64  `json:"like"`
	Verified   bool   `json:"verified"`
	VideoCount int64  `json:"videoCount"`
}

type Music struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	Author    string `json:"author"`
	Thumbnail string `json:"thumbnail"`
	Duration  string `json:"duration"`
	URL       string `json:"url"`
}

type Stats struct {
	Like    int64 `json:"like"`
	Views   int64 `json:"views"`
	Share   int64 `json:"share"`
	Comment int64 `json:"comment"`
}

type Result struct {
	ID         string   `json:"id"`
	Cover      string   `json:"cover"`
	CreateTime int64    `json:"createTime"`
	Type     string   `json:"type"`
	Title    string   `json:"title"`
	Region   string   `json:"region"`
	Duration string   `json:"duration"`
	Video    string   `json:"video"`
	Images   []string `json:"images"`
	Author   Author   `json:"author"`
	Music    Music    `json:"music"`
	Stats    Stats    `json:"stats"`
}

func IsValidURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || (parsed.Scheme != "https" && parsed.Scheme != "http") {
		return false
	}
	host := strings.ToLower(strings.TrimPrefix(parsed.Hostname(), "www."))
	return host == "tiktok.com" || strings.HasSuffix(host, ".tiktok.com")
}

var client = &http.Client{Timeout: 20 * time.Second}

func fetchHTML(ctx context.Context, target string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, target, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", mobileUA)
	req.Header.Set("sec-ch-ua-mobile", "?1")
	req.Header.Set("sec-ch-ua-platform", `"Android"`)

	res, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer res.Body.Close()
	if res.StatusCode >= 400 {
		return "", fmt.Errorf("upstream status %d", res.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(res.Body, 8<<20))
	if err != nil {
		return "", err
	}
	return string(body), nil
}

func Extract(ctx context.Context, target string) (*Result, error) {
	if !IsValidURL(target) {
		return nil, errors.New("invalid url")
	}

	html, err := fetchHTML(ctx, target)
	if err != nil {
		return nil, err
	}

	match := rehydration.FindStringSubmatch(html)
	if len(match) < 2 {
		return nil, nil
	}

	var payload struct {
		Scope map[string]json.RawMessage `json:"__DEFAULT_SCOPE__"`
	}
	if err := json.Unmarshal([]byte(match[1]), &payload); err != nil {
		return nil, nil
	}

	detail, ok := payload.Scope["webapp.reflow.video.detail"]
	if !ok {
		detail, ok = payload.Scope["webapp.video-detail"]
		if !ok {
			return nil, nil
		}
	}

	var wrapper struct {
		ItemInfo struct {
			ItemStruct itemStruct `json:"itemStruct"`
		} `json:"itemInfo"`
	}
	if err := json.Unmarshal(detail, &wrapper); err != nil {
		return nil, nil
	}

	item := wrapper.ItemInfo.ItemStruct
	if item.ID == "" {
		return nil, nil
	}
	return item.toResult(ctx), nil
}

type urlList struct {
	URLList []string `json:"urlList"`
}

type itemStruct struct {
	ID         string `json:"id"`
	Desc       string `json:"desc"`
	Loc        string `json:"locationCreated"`
	CreateTime int64  `json:"createTime"`

	ImagePost *struct {
		Images []struct {
			ImageURL     urlList `json:"imageURL"`
			DisplayImage urlList `json:"displayImage"`
		} `json:"images"`
	} `json:"imagePost"`

	Video struct {
		Duration      int64  `json:"duration"`
		PlayAddr      string `json:"playAddr"`
		DownloadAddr  string `json:"downloadAddr"`
		Cover         string `json:"cover"`
		OriginCover   string `json:"originCover"`
	} `json:"video"`

	Music struct {
		ID          string `json:"id"`
		Title       string `json:"title"`
		AuthorName  string `json:"authorName"`
		CoverLarge  string `json:"coverLarge"`
		CoverMedium string `json:"coverMedium"`
		Duration    int64  `json:"duration"`
		PlayURL     string `json:"playUrl"`
	} `json:"music"`

	Author struct {
		ID          string `json:"id"`
		UniqueID    string `json:"uniqueId"`
		Nickname    string `json:"nickname"`
		AvatarThumb string `json:"avatarThumb"`
		Verified    bool   `json:"verified"`
	} `json:"author"`

	AuthorStats struct {
		FollowerCount  int64 `json:"followerCount"`
		FollowingCount int64 `json:"followingCount"`
		HeartCount     int64 `json:"heartCount"`
		VideoCount     int64 `json:"videoCount"`
	} `json:"authorStats"`

	Stats struct {
		DiggCount    int64 `json:"diggCount"`
		PlayCount    int64 `json:"playCount"`
		ShareCount   int64 `json:"shareCount"`
		CommentCount int64 `json:"commentCount"`
	} `json:"stats"`
}

func (i itemStruct) playerAPIVideo(ctx context.Context) string {
	endpoint := "https://www.tiktok.com/player/api/v1/items?item_ids=" + url.QueryEscape(i.ID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return ""
	}
	res, err := client.Do(req)
	if err != nil {
		return ""
	}
	defer res.Body.Close()

	var body struct {
		Items []struct {
			VideoInfo struct {
				URLList []string `json:"url_list"`
			} `json:"video_info"`
		} `json:"items"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return ""
	}
	if len(body.Items) > 0 && len(body.Items[0].VideoInfo.URLList) > 0 {
		return body.Items[0].VideoInfo.URLList[0]
	}
	return ""
}

func (i itemStruct) toResult(ctx context.Context) *Result {
	result := &Result{
		ID:         i.ID,
		Cover:      firstNonEmpty(i.Video.Cover, i.Video.OriginCover),
		CreateTime: i.CreateTime,
		Type:     "video",
		Title:    i.Desc,
		Region:   i.Loc,
		Duration: fmt.Sprintf("%d detik", i.Video.Duration),
		Images:   []string{},
		Author: Author{
			ID:         i.Author.ID,
			Avatar:     i.Author.AvatarThumb,
			Nickname:   i.Author.Nickname,
			Username:   i.Author.UniqueID,
			Followers:  i.AuthorStats.FollowerCount,
			Following:  i.AuthorStats.FollowingCount,
			Like:       i.AuthorStats.HeartCount,
			Verified:   i.Author.Verified,
			VideoCount: i.AuthorStats.VideoCount,
		},
		Music: Music{
			ID:        i.Music.ID,
			Title:     i.Music.Title,
			Author:    i.Music.AuthorName,
			Thumbnail: firstNonEmpty(i.Music.CoverLarge, i.Music.CoverMedium),
			Duration:  fmt.Sprintf("%d detik", i.Music.Duration),
			URL:       i.Music.PlayURL,
		},
		Stats: Stats{
			Like:    i.Stats.DiggCount,
			Views:   i.Stats.PlayCount,
			Share:   i.Stats.ShareCount,
			Comment: i.Stats.CommentCount,
		},
	}

	if i.ImagePost != nil {
		result.Type = "photo"
		seen := map[string]bool{}
		for _, img := range i.ImagePost.Images {
			candidate := ""
			if len(img.ImageURL.URLList) > 0 {
				candidate = img.ImageURL.URLList[0]
			} else if len(img.DisplayImage.URLList) > 0 {
				candidate = img.DisplayImage.URLList[0]
			}
			if candidate != "" && !seen[candidate] {
				seen[candidate] = true
				result.Images = append(result.Images, candidate)
			}
		}
		return result
	}

	result.Video = firstNonEmpty(i.playerAPIVideo(ctx), i.Video.PlayAddr, i.Video.DownloadAddr)
	return result
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if v != "" {
			return v
		}
	}
	return ""
}
