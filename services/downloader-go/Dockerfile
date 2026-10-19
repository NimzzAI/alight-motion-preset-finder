FROM golang:1.22-alpine AS build
WORKDIR /app
COPY go.mod ./
COPY . .
RUN go mod tidy && CGO_ENABLED=0 go build -o /downloader ./cmd/server && CGO_ENABLED=0 go build -o /tiktok-search ./cmd/search

FROM alpine:3.20
RUN apk add --no-cache \
    ca-certificates \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ttf-freefont
ENV CHROME_BIN=/usr/bin/chromium-browser \
    CHROME_PATH=/usr/lib/chromium/ \
    PORT=8090
COPY --from=build /downloader /downloader
COPY --from=build /tiktok-search /tiktok-search
EXPOSE 8090
CMD ["/downloader"]
