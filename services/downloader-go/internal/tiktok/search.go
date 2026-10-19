package tiktok

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"math/rand/v2"
	"net/http"
	"net/http/cookiejar"
	"net/url"
	"os/exec"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/chromedp/chromedp"
	"github.com/tidwall/gjson"
)

type ExtractionResult struct {
	Success    bool         `json:"success"`
	StatusCode int          `json:"status_code,omitempty"`
	Data       any          `json:"data,omitempty"`
	Error      *ErrorDetail `json:"error,omitempty"`
	Timestamp  int64        `json:"timestamp"`
}

type ErrorDetail struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

type TikTokAuthorStats struct {
	FollowerCount  int64 `json:"follower_count"`
	FollowingCount int64 `json:"following_count"`
	HeartCount     int64 `json:"heart_count"`
	VideoCount     int64 `json:"video_count"`
}

type TikTokAuthor struct {
	ID           string             `json:"id"`
	UniqueID     string             `json:"unique_id"`
	Nickname     string             `json:"nickname"`
	Avatar       string             `json:"avatar"`
	AvatarLarger string             `json:"avatar_larger,omitempty"`
	Signature    string             `json:"signature,omitempty"`
	BioLink      string             `json:"bio_link,omitempty"`
	Verified     bool               `json:"verified"`
	SecUID       string             `json:"sec_uid,omitempty"`
	Stats        *TikTokAuthorStats `json:"stats,omitempty"`
}

type TikTokStats struct {
	Plays     int64 `json:"plays"`
	Likes     int64 `json:"likes"`
	Comments  int64 `json:"comments"`
	Shares    int64 `json:"shares"`
	Bookmarks int64 `json:"bookmarks"`
}

type TikTokMusic struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Author   string `json:"author"`
	PlayURL  string `json:"play_url"`
	Duration int64  `json:"duration_seconds"`
	Cover    string `json:"cover,omitempty"`
	Original bool   `json:"original"`
}

type BitrateStream struct {
	QualityType string `json:"quality_type"`
	Bitrate     int64  `json:"bitrate"`
	CodecType   string `json:"codec_type"`
	URL         string `json:"url"`
}

type SubtitleInfo struct {
	Language string `json:"language"`
	URL      string `json:"url"`
	Format   string `json:"format"`
}

type TikTokVideo struct {
	NoWatermarkURL   string          `json:"no_watermark_url"`
	WatermarkURL     string          `json:"watermark_url,omitempty"`
	Duration         int64           `json:"duration_seconds"`
	Width            int64           `json:"width"`
	Height           int64           `json:"height"`
	Ratio            string          `json:"ratio,omitempty"`
	Format           string          `json:"format,omitempty"`
	CodecType        string          `json:"codec_type,omitempty"`
	Definition       string          `json:"definition,omitempty"`
	AdaptiveBitrates []BitrateStream `json:"adaptive_bitrates,omitempty"`
	Subtitles        []SubtitleInfo  `json:"subtitles,omitempty"`
}

type TikTokChallenge struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Desc  string `json:"desc,omitempty"`
}

type TikTokVideoMetadata struct {
	ID           string            `json:"id"`
	Type         string            `json:"type"`
	Description  string            `json:"description"`
	CreatedAt    int64             `json:"created_at"`
	Region       string            `json:"region,omitempty"`
	Cover        string            `json:"cover"`
	DynamicCover string            `json:"dynamic_cover,omitempty"`
	CardViews    string            `json:"card_views,omitempty"`
	Author       TikTokAuthor      `json:"author"`
	Stats        TikTokStats       `json:"stats"`
	Music        TikTokMusic       `json:"music"`
	Video        *TikTokVideo      `json:"video,omitempty"`
	Images       []string          `json:"images,omitempty"`
	Challenges   []TikTokChallenge `json:"challenges,omitempty"`
	CanonicalURL string            `json:"canonical_url"`
}

type SearchResponse struct {
	Keyword string                `json:"keyword"`
	Total   int                   `json:"total"`
	Videos  []TikTokVideoMetadata `json:"videos"`
}

type RawCardItem struct {
	URL   string
	Views string
}

type TikTokSearchEngine struct {
	client *http.Client
}

func randomIPv4() string {
	return fmt.Sprintf("%d.%d.%d.%d", rand.IntN(220)+1, rand.IntN(254)+1, rand.IntN(254)+1, rand.IntN(254)+1)
}

func NewTikTokSearchEngine(timeout time.Duration) (*TikTokSearchEngine, error) {
	jar, err := cookiejar.New(nil)
	if err != nil {
		return nil, fmt.Errorf("cookiejar_init_failed: %w", err)
	}

	transport := &http.Transport{
		MaxIdleConns:        100,
		IdleConnTimeout:     90 * time.Second,
		DisableCompression: false,
		ForceAttemptHTTP2:   true,
	}

	c := &http.Client{
		Jar:       jar,
		Transport: transport,
		Timeout:   timeout,
	}

	return &TikTokSearchEngine{client: c}, nil
}

func (s *TikTokSearchEngine) applyWebHeaders(req *http.Request, referer string) {
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.9,id;q=0.8")
	req.Header.Set("Sec-Ch-Ua", `"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"`)
	req.Header.Set("Sec-Ch-Ua-Mobile", "?0")
	req.Header.Set("Sec-Ch-Ua-Platform", `"Windows"`)
	req.Header.Set("Sec-Fetch-Dest", "document")
	req.Header.Set("Sec-Fetch-Mode", "navigate")
	req.Header.Set("Sec-Fetch-Site", "none")
	req.Header.Set("Sec-Fetch-User", "?1")

	spoofedIP := randomIPv4()
	req.Header.Set("X-Forwarded-For", spoofedIP)
	req.Header.Set("Client-IP", spoofedIP)
	req.Header.Set("X-Real-IP", spoofedIP)

	if referer != "" {
		req.Header.Set("Referer", referer)
	} else {
		req.Header.Set("Referer", "https://www.tiktok.com/")
	}
}

func (s *TikTokSearchEngine) applyMobileHeaders(req *http.Request) {
	req.Header.Set("User-Agent", "com.zhiliaoapp.musically/2022600030 (Linux; U; Android 13; en_US; Pixel 7; Build/TQ3A.230901.001;tt-ok/3.12.13.1)")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Accept-Encoding", "gzip, deflate")
	req.Header.Set("Connection", "keep-alive")

	spoofedIP := randomIPv4()
	req.Header.Set("X-Forwarded-For", spoofedIP)
	req.Header.Set("Client-IP", spoofedIP)
	req.Header.Set("X-Real-IP", spoofedIP)
}

func (s *TikTokSearchEngine) solveSlardarChallenge(html string) (string, string, bool) {
	reCS := regexp.MustCompile(`<p\s+id=["']cs["'][^>]*class=["']([^"'>]+)`)
	reWCI := regexp.MustCompile(`<p\s+id=["']wci["'][^>]*class=["']([^"'>]+)`)

	matchCS := reCS.FindStringSubmatch(html)
	matchWCI := reWCI.FindStringSubmatch(html)

	if len(matchCS) < 2 || len(matchWCI) < 2 {
		return "", "", false
	}

	rawCS := matchCS[1]
	wciName := matchWCI[1]

	padLen := (4 - len(rawCS)%4) % 4
	paddedCS := rawCS + strings.Repeat("=", padLen)

	decodedBytes, err := base64.StdEncoding.DecodeString(paddedCS)
	if err != nil {
		return "", "", false
	}

	var challengeMap map[string]any
	if err := json.Unmarshal(decodedBytes, &challengeMap); err != nil {
		return "", "", false
	}

	vMap, ok := challengeMap["v"].(map[string]any)
	if !ok {
		return "", "", false
	}

	strA, okA := vMap["a"].(string)
	strC, okC := vMap["c"].(string)
	if !okA || !okC {
		return "", "", false
	}

	seed, err := base64.StdEncoding.DecodeString(strA)
	if err != nil {
		return "", "", false
	}
	expectedDigest, err := base64.StdEncoding.DecodeString(strC)
	if err != nil {
		return "", "", false
	}

	solved := false
	for i := 0; i <= 1000000; i++ {
		numBytes := []byte(strconv.Itoa(i))
		candidate := append(append([]byte(nil), seed...), numBytes...)
		digest := sha256.Sum256(candidate)
		if bytes.Equal(digest[:], expectedDigest) {
			challengeMap["d"] = base64.StdEncoding.EncodeToString(numBytes)
			solved = true
			break
		}
	}

	if !solved {
		return "", "", false
	}

	serialized, err := json.Marshal(challengeMap)
	if err != nil {
		return "", "", false
	}

	cookieVal := base64.StdEncoding.EncodeToString(serialized)
	return wciName, cookieVal, true
}

func (s *TikTokSearchEngine) extractVideoID(rawURL string) string {
	idRe := regexp.MustCompile(`/(?:video|photo)/(\d+)`)
	matches := idRe.FindStringSubmatch(rawURL)
	if len(matches) > 1 {
		return matches[1]
	}
	numRe := regexp.MustCompile(`^\d+$`)
	if numRe.MatchString(rawURL) {
		return rawURL
	}
	return ""
}

func (s *TikTokSearchEngine) resolveCanonicalInfo(ctx context.Context, rawInput string) (string, string) {
	clean := strings.TrimSpace(rawInput)

	reDigits := regexp.MustCompile(`^\d{17,21}$`)
	if reDigits.MatchString(clean) {
		return fmt.Sprintf("https://www.tiktok.com/@user/video/%s", clean), clean
	}

	if !strings.HasPrefix(clean, "http://") && !strings.HasPrefix(clean, "https://") {
		clean = "https://" + clean
	}

	reVideoID := regexp.MustCompile(`(?:video|photo)/(\d{17,21})`)
	if m := reVideoID.FindStringSubmatch(clean); len(m) > 1 {
		return clean, m[1]
	}

	finalURL := clean
	req, err := http.NewRequestWithContext(ctx, http.MethodHead, clean, nil)
	if err == nil {
		s.applyWebHeaders(req, "")
		resp, err := s.client.Do(req)
		if err == nil {
			if u := resp.Request.URL.String(); u != "" {
				finalURL = u
			}
			resp.Body.Close()
		}
	}

	match := reVideoID.FindStringSubmatch(finalURL)
	if len(match) > 1 {
		return finalURL, match[1]
	}

	return finalURL, clean
}

func (s *TikTokSearchEngine) extractViaMobileAPI(ctx context.Context, awemeID string, canonicalURL string) (*TikTokVideoMetadata, error) {
	hosts := []string{
		"api16-normal-c-useast1a.tiktokv.com",
		"api22-normal-c-useast1a.tiktokv.com",
		"api.tiktokv.com",
	}

	deviceID := fmt.Sprintf("%d", 7250000000000000000+rand.Int64N(100000000000000000))

	q := url.Values{}
	q.Set("aweme_id", awemeID)
	q.Set("version_code", "260103")
	q.Set("app_name", "musical_ly")
	q.Set("channel", "googleplay")
	q.Set("device_platform", "android")
	q.Set("aid", "1233")
	q.Set("device_id", deviceID)
	q.Set("os_version", "13")

	for _, h := range hosts {
		endpoint := fmt.Sprintf("https://%s/aweme/v1/feed/?%s", h, q.Encode())
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			continue
		}
		s.applyMobileHeaders(req)

		resp, err := s.client.Do(req)
		if err != nil {
			continue
		}

		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil || len(bodyBytes) == 0 {
			continue
		}

		parsed := gjson.ParseBytes(bodyBytes)
		awemeList := parsed.Get("aweme_list").Array()
		if len(awemeList) == 0 {
			continue
		}

		item := awemeList[0]
		if item.Get("aweme_id").String() == "" {
			continue
		}
		desc := item.Get("desc").String()
		createTime := item.Get("create_time").Int()
		region := item.Get("region").String()

		authorNode := item.Get("author")
		statsNode := item.Get("statistics")
		musicNode := item.Get("music")
		videoNode := item.Get("video")

		var authorStats *TikTokAuthorStats
		if authorNode.Exists() {
			authorStats = &TikTokAuthorStats{
				FollowerCount:  authorNode.Get("follower_count").Int(),
				FollowingCount: authorNode.Get("following_count").Int(),
				HeartCount:     authorNode.Get("total_favorited").Int(),
				VideoCount:     authorNode.Get("aweme_count").Int(),
			}
		}

		author := TikTokAuthor{
			ID:           authorNode.Get("uid").String(),
			UniqueID:     authorNode.Get("unique_id").String(),
			Nickname:     authorNode.Get("nickname").String(),
			Avatar:       authorNode.Get("avatar_thumb.url_list.0").String(),
			AvatarLarger: authorNode.Get("avatar_larger.url_list.0").String(),
			Signature:    authorNode.Get("signature").String(),
			BioLink:      authorNode.Get("bio_url").String(),
			Verified:     authorNode.Get("custom_verify").String() != "" || authorNode.Get("enterprise_verify_reason").String() != "",
			SecUID:       authorNode.Get("sec_uid").String(),
			Stats:        authorStats,
		}

		stats := TikTokStats{
			Plays:     statsNode.Get("play_count").Int(),
			Likes:     statsNode.Get("digg_count").Int(),
			Comments:  statsNode.Get("comment_count").Int(),
			Shares:    statsNode.Get("share_count").Int(),
			Bookmarks: statsNode.Get("collect_count").Int(),
		}

		musicPlay := musicNode.Get("play_url.url_list.0").String()
		if musicPlay == "" {
			musicPlay = musicNode.Get("play_url.uri").String()
		}

		music := TikTokMusic{
			ID:       musicNode.Get("id_str").String(),
			Title:    musicNode.Get("title").String(),
			Author:   musicNode.Get("author").String(),
			PlayURL:  musicPlay,
			Duration: musicNode.Get("duration").Int(),
			Cover:    musicNode.Get("cover_large.url_list.0").String(),
			Original: musicNode.Get("is_original").Bool(),
		}

		var images []string
		imagePostList := item.Get("image_post_info.images").Array()
		if len(imagePostList) > 0 {
			for _, imgItem := range imagePostList {
				displayURL := imgItem.Get("display_image.url_list.0").String()
				if displayURL == "" {
					displayURL = imgItem.Get("thumbnail.url_list.0").String()
				}
				if displayURL != "" {
					images = append(images, displayURL)
				}
			}
		}

		mediaType := "video"
		var videoObj *TikTokVideo

		if len(images) > 0 {
			mediaType = "photo"
		} else if videoNode.Exists() {
			var adaptiveBitrates []BitrateStream
			for _, b := range videoNode.Get("bit_rate").Array() {
				adaptiveBitrates = append(adaptiveBitrates, BitrateStream{
					QualityType: b.Get("gear_name").String(),
					Bitrate:     b.Get("bit_rate").Int(),
					CodecType:   b.Get("play_addr.data_size").String(),
					URL:         b.Get("play_addr.url_list.0").String(),
				})
			}

			videoObj = &TikTokVideo{
				NoWatermarkURL:   videoNode.Get("play_addr.url_list.0").String(),
				WatermarkURL:     videoNode.Get("download_addr.url_list.0").String(),
				Duration:         item.Get("duration").Int() / 1000,
				Width:            videoNode.Get("width").Int(),
				Height:           videoNode.Get("height").Int(),
				Ratio:            videoNode.Get("ratio").String(),
				Format:           videoNode.Get("format").String(),
				Definition:       videoNode.Get("definition").String(),
				AdaptiveBitrates: adaptiveBitrates,
			}
		}

		var challenges []TikTokChallenge
		for _, ch := range item.Get("cha_list").Array() {
			challenges = append(challenges, TikTokChallenge{
				ID:    ch.Get("cid").String(),
				Title: ch.Get("cha_name").String(),
				Desc:  ch.Get("desc").String(),
			})
		}

		if author.UniqueID != "" && item.Get("aweme_id").String() != "" {
			canonicalURL = fmt.Sprintf("https://www.tiktok.com/@%s/%s/%s", author.UniqueID, mediaType, item.Get("aweme_id").String())
		}

		return &TikTokVideoMetadata{
			ID:           item.Get("aweme_id").String(),
			Type:         mediaType,
			Description:  desc,
			CreatedAt:    createTime,
			Region:       region,
			Cover:        videoNode.Get("cover.url_list.0").String(),
			DynamicCover: videoNode.Get("dynamic_cover.url_list.0").String(),
			Author:       author,
			Stats:        stats,
			Music:        music,
			Video:        videoObj,
			Images:       images,
			Challenges:   challenges,
			CanonicalURL: canonicalURL,
		}, nil
	}

	return nil, fmt.Errorf("mobile_feed_exhausted")
}

func (s *TikTokSearchEngine) extractViaWebSSR(ctx context.Context, targetURL, awemeID string) (*TikTokVideoMetadata, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
	if err != nil {
		return nil, err
	}
	s.applyWebHeaders(req, targetURL)

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, err
	}
	bodyBytes, err := io.ReadAll(resp.Body)
	resp.Body.Close()
	if err != nil {
		return nil, err
	}

	html := string(bodyBytes)
	if !strings.Contains(html, "__UNIVERSAL_DATA_FOR_REHYDRATION__") {
		wciName, cookieVal, ok := s.solveSlardarChallenge(html)
		if ok {
			req2, err := http.NewRequestWithContext(ctx, http.MethodGet, targetURL, nil)
			if err == nil {
				s.applyWebHeaders(req2, targetURL)
				var cookiePairs []string
				for _, c := range resp.Cookies() {
					cookiePairs = append(cookiePairs, fmt.Sprintf("%s=%s", c.Name, c.Value))
				}
				cookiePairs = append(cookiePairs, fmt.Sprintf("%s=%s", wciName, cookieVal))
				req2.Header.Set("Cookie", strings.Join(cookiePairs, "; "))

				resp2, err := s.client.Do(req2)
				if err == nil {
					bodyBytes2, err := io.ReadAll(resp2.Body)
					resp2.Body.Close()
					if err == nil {
						html = string(bodyBytes2)
					}
				}
			}
		}
	}

	reScript := regexp.MustCompile(`<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)</script>`)
	match := reScript.FindStringSubmatch(html)
	if len(match) < 2 {
		return nil, fmt.Errorf("hydration_script_not_found")
	}

	parsed := gjson.Parse(match[1])
	var item gjson.Result
	scope := parsed.Get("__DEFAULT_SCOPE__")
	if scope.Exists() {
		for k, v := range scope.Map() {
			if strings.Contains(k, "video-detail") || strings.Contains(k, "video.detail") {
				item = v.Get("itemInfo.itemStruct")
				if item.Exists() {
					break
				}
			}
		}
	}
	if !item.Exists() {
		item = parsed.Get(`__DEFAULT_SCOPE__.webapp\.video-detail.itemInfo.itemStruct`)
	}
	if !item.Exists() {
		return nil, fmt.Errorf("item_struct_empty")
	}

	id := item.Get("id").String()
	if id == "" {
		id = awemeID
	}
	desc := item.Get("desc").String()
	createTime, _ := strconv.ParseInt(item.Get("createTime").String(), 10, 64)
	locationCreated := item.Get("locationCreated").String()

	videoNode := item.Get("video")
	authorNode := item.Get("author")
	authorStatsNode := item.Get("authorStats")
	musicNode := item.Get("music")
	statsNode := item.Get("stats")

	var authorStats *TikTokAuthorStats
	if authorStatsNode.Exists() {
		authorStats = &TikTokAuthorStats{
			FollowerCount:  authorStatsNode.Get("followerCount").Int(),
			FollowingCount: authorStatsNode.Get("followingCount").Int(),
			HeartCount:     authorStatsNode.Get("heartCount").Int(),
			VideoCount:     authorStatsNode.Get("videoCount").Int(),
		}
	}

	bioLink := authorNode.Get("bioLink.link").String()

	author := TikTokAuthor{
		ID:           authorNode.Get("id").String(),
		UniqueID:     authorNode.Get("uniqueId").String(),
		Nickname:     authorNode.Get("nickname").String(),
		Avatar:       authorNode.Get("avatarThumb").String(),
		AvatarLarger: authorNode.Get("avatarLarger").String(),
		Signature:    authorNode.Get("signature").String(),
		BioLink:      bioLink,
		Verified:     authorNode.Get("verified").Bool(),
		SecUID:       authorNode.Get("secUid").String(),
		Stats:        authorStats,
	}

	stats := TikTokStats{
		Plays:     statsNode.Get("playCount").Int(),
		Likes:     statsNode.Get("diggCount").Int(),
		Comments:  statsNode.Get("commentCount").Int(),
		Shares:    statsNode.Get("shareCount").Int(),
		Bookmarks: statsNode.Get("collectCount").Int(),
	}

	music := TikTokMusic{
		ID:       musicNode.Get("id").String(),
		Title:    musicNode.Get("title").String(),
		Author:   musicNode.Get("authorName").String(),
		PlayURL:  musicNode.Get("playUrl").String(),
		Duration: musicNode.Get("duration").Int(),
		Cover:    musicNode.Get("coverLarge").String(),
		Original: musicNode.Get("original").Bool(),
	}

	var images []string
	imagePostList := item.Get("imagePost.images").Array()
	for _, imgItem := range imagePostList {
		imgURL := imgItem.Get("imageURL.urlList.0").String()
		if imgURL != "" {
			images = append(images, imgURL)
		}
	}

	mediaType := "video"
	var videoObj *TikTokVideo

	if len(images) > 0 {
		mediaType = "photo"
	} else if videoNode.Exists() {
		var adaptiveBitrates []BitrateStream
		for _, b := range videoNode.Get("bitrateInfo").Array() {
			firstURL := b.Get("PlayAddr.UrlList.0").String()
			if firstURL != "" {
				adaptiveBitrates = append(adaptiveBitrates, BitrateStream{
					QualityType: b.Get("QualityType").String(),
					Bitrate:     b.Get("Bitrate").Int(),
					CodecType:   b.Get("CodecType").String(),
					URL:         firstURL,
				})
			}
		}

		var subtitles []SubtitleInfo
		for _, subItem := range videoNode.Get("subtitleInfos").Array() {
			subURL := subItem.Get("Url").String()
			if subURL != "" {
				subtitles = append(subtitles, SubtitleInfo{
					Language: subItem.Get("LanguageCodeName").String(),
					URL:      subURL,
					Format:   subItem.Get("Format").String(),
				})
			}
		}

		videoObj = &TikTokVideo{
			NoWatermarkURL:   videoNode.Get("playAddr").String(),
			WatermarkURL:     videoNode.Get("downloadAddr").String(),
			Duration:         videoNode.Get("duration").Int(),
			Width:            videoNode.Get("width").Int(),
			Height:           videoNode.Get("height").Int(),
			Ratio:            videoNode.Get("ratio").String(),
			Format:           videoNode.Get("format").String(),
			CodecType:        videoNode.Get("codecType").String(),
			Definition:       videoNode.Get("definition").String(),
			AdaptiveBitrates: adaptiveBitrates,
			Subtitles:        subtitles,
		}
	}

	var challenges []TikTokChallenge
	for _, ch := range item.Get("challenges").Array() {
		challenges = append(challenges, TikTokChallenge{
			ID:    ch.Get("id").String(),
			Title: ch.Get("title").String(),
			Desc:  ch.Get("desc").String(),
		})
	}

	return &TikTokVideoMetadata{
		ID:           id,
		Type:         mediaType,
		Description:  desc,
		CreatedAt:    createTime,
		Region:       locationCreated,
		Cover:        videoNode.Get("cover").String(),
		DynamicCover: videoNode.Get("dynamicCover").String(),
		Author:       author,
		Stats:        stats,
		Music:        music,
		Video:        videoObj,
		Images:       images,
		Challenges:   challenges,
		CanonicalURL: targetURL,
	}, nil
}

func (s *TikTokSearchEngine) enrichItem(ctx context.Context, targetURL string) (*TikTokVideoMetadata, error) {
	canonicalURL, videoID := s.resolveCanonicalInfo(ctx, targetURL)

	ssrPayload, ssrErr := s.extractViaWebSSR(ctx, canonicalURL, videoID)
	if ssrErr == nil && ssrPayload != nil && ssrPayload.ID != "" {
		return ssrPayload, nil
	}

	if videoID != "" {
		payload, err := s.extractViaMobileAPI(ctx, videoID, canonicalURL)
		if err == nil && payload != nil && payload.ID != "" {
			return payload, nil
		}
	}

	return nil, fmt.Errorf("metadata_extraction_failed")
}

func hasChromeBinary() bool {
	for _, bin := range []string{"google-chrome", "chromium", "chromium-browser", "/usr/bin/chromium-browser", "/usr/bin/chromium"} {
		if _, err := exec.LookPath(bin); err == nil {
			return true
		}
	}
	return false
}

func (s *TikTokSearchEngine) fetchSearchCardsViaChromedp(ctx context.Context, keyword string, count int) ([]RawCardItem, error) {
	if !hasChromeBinary() {
		return nil, fmt.Errorf("chrome_binary_not_found")
	}

	opts := append(chromedp.DefaultExecAllocatorOptions[:],
		chromedp.Flag("headless", true),
		chromedp.Flag("disable-gpu", true),
		chromedp.Flag("no-sandbox", true),
		chromedp.Flag("disable-dev-shm-usage", true),
		chromedp.Flag("disable-blink-features", "AutomationControlled"),
		chromedp.Flag("window-size", "1920,1080"),
		chromedp.UserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"),
	)

	allocCtx, allocCancel := chromedp.NewExecAllocator(ctx, opts...)
	defer allocCancel()

	cdpCtx, cdpCancel := chromedp.NewContext(allocCtx)
	defer cdpCancel()

	stealthJS := `
		delete Object.getPrototypeOf(navigator).webdriver;
		Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
		window.chrome = { runtime: {} };
	`

	err := chromedp.Run(cdpCtx,
		chromedp.Navigate("https://www.tiktok.com/"),
		chromedp.Sleep(1500*time.Millisecond),
	)
	if err != nil {
		return nil, err
	}

	var evalRes any
	_ = chromedp.Run(cdpCtx, chromedp.Evaluate(stealthJS, &evalRes))

	searchURL := "https://www.tiktok.com/search?q=" + url.QueryEscape(keyword)
	err = chromedp.Run(cdpCtx,
		chromedp.Navigate(searchURL),
		chromedp.Sleep(4500*time.Millisecond),
	)
	if err != nil {
		return nil, err
	}

	var htmlContent string
	_ = chromedp.Run(cdpCtx, chromedp.Evaluate(`document.documentElement.outerHTML`, &htmlContent))

	doc, err := goquery.NewDocumentFromReader(strings.NewReader(htmlContent))
	if err != nil {
		return nil, err
	}

	var items []RawCardItem
	seen := make(map[string]bool)

	doc.Find("div[data-e2e='search_top-item'], div[data-e2e='search-card-desc']").Each(func(i int, sel *goquery.Selection) {
		link, _ := sel.Find("a[href*='/video/'], a[href*='/photo/']").Attr("href")
		if link == "" {
			return
		}
		if strings.HasPrefix(link, "/") {
			link = "https://www.tiktok.com" + link
		}
		if seen[link] {
			return
		}
		seen[link] = true

		views := strings.TrimSpace(sel.Find("[data-e2e='video-views']").Text())
		items = append(items, RawCardItem{
			URL:   link,
			Views: views,
		})
	})

	if len(items) > count {
		items = items[:count]
	}

	return items, nil
}

func (s *TikTokSearchEngine) fetchSearchCardsViaWebIndex(ctx context.Context, keyword string, count int) ([]RawCardItem, error) {
	queries := []string{
		fmt.Sprintf("site:tiktok.com %s", keyword),
		fmt.Sprintf("site:tiktok.com %s 5mb xml", keyword),
	}

	var items []RawCardItem
	seen := make(map[string]bool)
	reVT := regexp.MustCompile(`(?:https?://)?(?:www\.)?tiktok\.com/@[\w.-]+/(?:video|photo)/\d{15,22}`)

	for _, q := range queries {
		if len(items) >= count {
			break
		}
		endpoint := "https://html.duckduckgo.com/html/?q=" + url.QueryEscape(q)
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
		if err != nil {
			continue
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36")
		req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
		req.Header.Set("Accept-Language", "id-ID,id;q=0.9,en-US;q=0.8")

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			continue
		}
		bodyBytes, err := io.ReadAll(resp.Body)
		resp.Body.Close()
		if err != nil {
			continue
		}

		rawHTML := string(bodyBytes)
		decoded, err := url.QueryUnescape(rawHTML)
		if err != nil {
			decoded = rawHTML
		}

		for _, m := range reVT.FindAllString(decoded, -1) {
			link := m
			if !strings.HasPrefix(link, "http") {
				link = "https://www." + strings.TrimPrefix(link, "www.")
			}
			if !seen[link] {
				seen[link] = true
				items = append(items, RawCardItem{URL: link})
			}
		}
	}

	if len(items) > count {
		items = items[:count]
	}
	return items, nil
}

func (s *TikTokSearchEngine) fetchSearchCards(ctx context.Context, keyword string, count int) ([]RawCardItem, error) {
	if items, err := s.fetchSearchCardsViaChromedp(ctx, keyword, count); err == nil && len(items) > 0 {
		return items, nil
	}
	return s.fetchSearchCardsViaWebIndex(ctx, keyword, count)
}

func (s *TikTokSearchEngine) Search(ctx context.Context, keyword string, count int) ExtractionResult {
	startTime := time.Now().UnixMilli()

	if count <= 0 {
		count = 10
	}

	rawItems, err := s.fetchSearchCards(ctx, keyword, count)
	if err != nil {
		return ExtractionResult{
			Success:   false,
			Error:     &ErrorDetail{Code: "SEARCH_DISPATCH_FAILED", Message: err.Error()},
			Timestamp: startTime,
		}
	}

	if len(rawItems) == 0 {
		return ExtractionResult{
			Success:    true,
			StatusCode: http.StatusOK,
			Data: SearchResponse{
				Keyword: keyword,
				Total:   0,
				Videos:  []TikTokVideoMetadata{},
			},
			Timestamp: startTime,
		}
	}

	finalVideos := make([]TikTokVideoMetadata, len(rawItems))
	var wg sync.WaitGroup
	sem := make(chan struct{}, 5)

	for idx, it := range rawItems {
		wg.Add(1)
		go func(i int, item RawCardItem) {
			defer wg.Done()
			sem <- struct{}{}
			defer func() { <-sem }()

			meta, enrichErr := s.enrichItem(ctx, item.URL)
			if enrichErr == nil && meta != nil {
				meta.CardViews = item.Views
				finalVideos[i] = *meta
			} else {
				vidID := s.extractVideoID(item.URL)
				finalVideos[i] = TikTokVideoMetadata{
					ID:           vidID,
					CanonicalURL: item.URL,
					CardViews:    item.Views,
				}
			}
		}(idx, it)
	}
	wg.Wait()

	return ExtractionResult{
		Success:    true,
		StatusCode: http.StatusOK,
		Data: SearchResponse{
			Keyword: keyword,
			Total:   len(finalVideos),
			Videos:  finalVideos,
		},
		Timestamp: startTime,
	}
}
