package imgconv

import (
	"bytes"
	"image"
	"image/color"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/gen2brain/avif"
)

func gradient(w, h int) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			img.Set(x, y, color.RGBA{uint8(x % 256), uint8(y % 256), uint8((x + y) % 256), 255})
		}
	}
	return img
}

func encodeJPEG(t *testing.T, img image.Image) []byte {
	t.Helper()
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 90}); err != nil {
		t.Fatalf("jpeg: %v", err)
	}
	return buf.Bytes()
}

func TestEncodeDownscalesAndProducesAVIF(t *testing.T) {
	src := encodeJPEG(t, gradient(1600, 1200))
	out, w, h, err := Encode(src, Options{MaxLongEdge: 640, Quality: 50})
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	if w != 640 || h != 480 {
		t.Fatalf("want 640x480, got %dx%d", w, h)
	}
	if len(out) < 12 || string(out[4:12]) != "ftypavif" {
		t.Fatalf("output is not an AVIF file (len=%d)", len(out))
	}
	img, err := avif.Decode(bytes.NewReader(out))
	if err != nil {
		t.Fatalf("decode back: %v", err)
	}
	if b := img.Bounds(); b.Dx() != 640 || b.Dy() != 480 {
		t.Fatalf("decoded %v", b)
	}
}

func TestEncodeKeepsSmallImageSize(t *testing.T) {
	out, w, h, err := Encode(encodeJPEG(t, gradient(300, 200)), Options{MaxLongEdge: 1600})
	if err != nil {
		t.Fatalf("Encode: %v", err)
	}
	if w != 300 || h != 200 {
		t.Fatalf("want 300x200, got %dx%d", w, h)
	}
	if len(out) == 0 {
		t.Fatal("empty output")
	}
}

func TestEncodeAcceptsPNG(t *testing.T) {
	var buf bytes.Buffer
	if err := png.Encode(&buf, gradient(64, 64)); err != nil {
		t.Fatalf("png: %v", err)
	}
	if _, _, _, err := Encode(buf.Bytes(), Options{}); err != nil {
		t.Fatalf("Encode png: %v", err)
	}
}

func TestEncodeRejectsGarbage(t *testing.T) {
	if _, _, _, err := Encode([]byte("not an image at all"), Options{}); err == nil {
		t.Fatal("want an error for non-image bytes")
	}
}
