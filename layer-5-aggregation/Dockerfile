# Build Stage
FROM golang:1.23-alpine AS builder

WORKDIR /app

COPY go.mod ./
COPY go.sum* ./
RUN go mod download

COPY . .
RUN go build -o main ./cmd/main.go 

# Run Stage
FROM alpine:latest

RUN apk add --no-cache ca-certificates tzdata tini && adduser -D -g '' appuser

WORKDIR /app

COPY --from=builder /app/main .
EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ./main -healthcheck || exit 1

USER appuser

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["./main"]
