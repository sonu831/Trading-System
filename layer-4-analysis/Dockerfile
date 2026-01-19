# Build Stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod ./
# Copy go.sum if it exists, otherwise ignore error
COPY go.sum* ./ 
RUN go mod download

COPY . .
RUN go build -o main ./cmd/main.go

# Run Stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/main .
EXPOSE 8081

# Go images might not have wget/curl by default if scratch or alpine.
# Assuming alpine or similar with package manager or binary copy.
# If base is alpine:
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8081/metrics || exit 1

CMD ["./main"]
