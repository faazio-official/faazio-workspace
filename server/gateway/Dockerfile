# Build stage — static Go binary.
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
# -tags nodynamic keeps gen2brain/avif on its wazero/WASM encoder instead of linking
# ebitengine/purego, whose fakecgo runtime needs libc's dynamic loader — distroless/static has none,
# so an untagged build dies at boot with `exec /server: no such file or directory`.
RUN CGO_ENABLED=0 GOOS=linux go build -tags nodynamic -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

# Runtime stage — distroless, non-root, no shell/toolchain in the image.
FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=build /out/server /server
USER nonroot:nonroot
EXPOSE 8080
ENTRYPOINT ["/server"]