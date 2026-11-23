// Package imgconv normalises every uploaded shop/listing image to AVIF before its bytes are written
// to object storage.
//
// Why server-side: the gateway is distroless/CGO-free, React Native ships no AVIF encoder, and no
// shipping browser reliably *encodes* AVIF through canvas (Chrome, Firefox and Safari all decode but
// do not encode). Without this package the "store AVIF" rule would be unimplementable on the mobile
// app and the anonymous landing page. gen2brain/avif compiles libavif+aom to WASM and runs it under
// wazero, so it is CGo-free and works inside the static image.
//
// The converter is deliberately tiny and side-effect free: decode JPEG/PNG (the two formats the
// clients produce), gamma-correct downsample to a bounded long edge, encode AVIF. It is NOT a general
// image service — no cropping, no metadata passthrough, and EXIF (including GPS) is dropped because
// only decoded pixels are re-encoded.
package imgconv

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"

	"github.com/gen2brain/avif"
)

// MimeAVIF is the only content type this package produces.
const MimeAVIF = "image/avif"

// ErrUnsupported means the bytes are not a JPEG or PNG this build can decode.
var ErrUnsupported = errors.New("imgconv: unsupported source image")

// Options bound the work one upload may cause.
type Options struct {
	// MaxLongEdge caps the long edge, in pixels. 0 means no resize.
	MaxLongEdge int
	// Quality is the AVIF quality (0–100, higher is better/larger). 0 means DefaultQuality.
	Quality int
}

// DefaultQuality is the encoding quality used when Options.Quality is unset. 55 is the knee of the
// AVIF size/quality curve for photographs at phone-screen scale.
const DefaultQuality = 55

// Encode decodes src (JPEG or PNG) and returns AVIF bytes plus the decoded pixel size.
//
// The returned size is the size of the ENCODED image (after any downscale), so callers store accurate
// width/height on the media asset row.
func Encode(src []byte, opt Options) (out []byte, width, height int, err error) {
	if opt.Quality <= 0 || opt.Quality > 100 {
		opt.Quality = DefaultQuality
	}
	img, _, err := image.Decode(bytes.NewReader(src))
	if err != nil {
		return nil, 0, 0, fmt.Errorf("%w: %v", ErrUnsupported, err)
	}
	if opt.MaxLongEdge > 0 {
		img = downscale(img, opt.MaxLongEdge)
	}
	var buf bytes.Buffer
	if encErr := avif.Encode(&buf, img, avif.Options{
		Quality:      opt.Quality,
		QualityAlpha: opt.Quality,
	}); encErr != nil {
		return nil, 0, 0, fmt.Errorf("imgconv: encode avif: %w", encErr)
	}
	b := img.Bounds()
	return buf.Bytes(), b.Dx(), b.Dy(), nil
}

// downscale area-averages img so its long edge is at most maxEdge. An image already within the bound
// is returned unchanged (and stays the original type, avoiding a needless copy).
func downscale(img image.Image, maxEdge int) image.Image {
	b := img.Bounds()
	w, h := b.Dx(), b.Dy()
	long := w
	if h > long {
		long = h
	}
	if long <= maxEdge {
		return img
	}
	ratio := float64(maxEdge) / float64(long)
	nw := int(float64(w)*ratio + 0.5)
	nh := int(float64(h)*ratio + 0.5)
	if nw < 1 {
		nw = 1
	}
	if nh < 1 {
		nh = 1
	}

	dst := image.NewRGBA(image.Rect(0, 0, nw, nh))
	// Box filter: each destination pixel averages the source rectangle it covers. Cheap, stable, and
	// good enough for a re-encode — it avoids the aliasing a nearest-neighbour scale would introduce
	// on fine shop-front detail.
	for dy := 0; dy < nh; dy++ {
		y0 := b.Min.Y + dy*h/nh
		y1 := b.Min.Y + (dy+1)*h/nh
		if y1 <= y0 {
			y1 = y0 + 1
		}
		for dx := 0; dx < nw; dx++ {
			x0 := b.Min.X + dx*w/nw
			x1 := b.Min.X + (dx+1)*w/nw
			if x1 <= x0 {
				x1 = x0 + 1
			}
			var r, g, bl, a, n uint64
			for y := y0; y < y1; y++ {
				for x := x0; x < x1; x++ {
					cr, cg, cb, ca := img.At(x, y).RGBA()
					r += uint64(cr >> 8)
					g += uint64(cg >> 8)
					bl += uint64(cb >> 8)
					a += uint64(ca >> 8)
					n++
				}
			}
			if n == 0 {
				continue
			}
			dst.SetRGBA(dx, dy, color.RGBA{uint8(r / n), uint8(g / n), uint8(bl / n), uint8(a / n)})
		}
	}
	return dst
}
