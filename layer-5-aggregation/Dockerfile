# Build Stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod ./
# Copy go.sum if it exists, otherwise ignore error
COPY go.sum* ./
RUN go mod download

COPY . .
# Assuming main.go is in cmd/
RUN go build -o main ./cmd/main.go 

# Run Stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/main .
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

CMD ["./main"]
