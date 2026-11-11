# App Store Product-Page Header — Image Brief & Prompt

**This replaces the earlier street-level direction.** The header is a finished,
studio-made piece of brand artwork — not a street photograph, not a billboard or
physical-cutout mockup, and not a UI mockup. Apple adds the app icon, title,
subtitle and buttons itself, so the image carries **no text, no logo, no UI and
no call to action**.

Use this in ChatGPT (image generation) with the reference images listed below.

---

## Direction (five lines)

- **Product.** One app for a Karaikal household's groceries, meals and pharmacy.
- **Character.** Grounded, warm, exact.
- **World.** A shop counter — paper, kraft board, ceramic, daylight. Not a street.
- **Moments.** The three essentials sitting together like a commissioned still life.
- **Signature.** One narrow Faazio Blue band, used exactly once — never a wash.

---

## Primary prompt (copy everything in the fence)

```text
Use the attached reference images only to identify (a) the exact Faazio Blue and
(b) the three product categories. Do not copy their pastel seamless backgrounds,
their centred flat-lay arrangement, their soft studio shadows or their colour
grade. Do not reproduce any wordmark, lettering, logo or label from them.

Create a wide App Store product-page header image for Faazio, a neighbourhood
superapp for groceries, meals and pharmacy. This is finished promotional artwork:
a real editorial still-life photograph, not a street scene, not a billboard or
physical-cutout mockup, not a UI mockup, not a 3D render. Apple's own app icon,
title and buttons are added separately, so the image contains absolutely no text,
no logos, no lettering, no UI and no call to action.

SCENE
A quiet still life on a real honed limestone counter against a warm off-white
plaster wall with subtle trowel texture. Three everyday essentials are clustered
in the right two-thirds of the frame, like a commissioned photograph for a small
neighbourhood shop:
- back right: a creased natural canvas tote standing open, holding leafy greens,
  a few tomatoes, small onions and a lemon;
- centre: a stacked steel tiffin and a shallow ceramic bowl of rice and curry,
  with a small bowl of raita and a few fresh curry leaves;
- front right: a plain white pharmacy carton, a silver blister strip and a small
  amber glass bottle, all completely label-free.
One narrow matte Faazio Blue (#1627E9) paper band wraps the tote handle. That is
the only brand colour in the frame.

COMPOSITION
Wide horizontal composition, camera straight-on at counter height. Keep the LEFT
THIRD quiet — calm warm wall and empty counter — so the product-page title lockup
can sit there without colliding with the still life. Place all essential objects
inside the central 76% of the width and height; the outer 12% on every edge is
background bleed only, because the asset must crop cleanly to both 16:9 and 21:9.
Keep the top 10% and bottom 10% free of essential detail. Slight natural
asymmetry; nothing perfectly centred; no decorative frame or border.

LIGHT AND CAMERA
One soft directional daylight source from camera-left, like a large north-facing
window; soft contact shadows with real falloff; no hard black shadows, no second
light, no glow. 50–70mm lens at f/8, straight-on product-photography perspective,
natural depth of field with everything essential in focus. Matte, neutral colour
grade, gentle film grain, true-to-life contrast. It should read as a real
photograph shot for an editorial feature about a local shop.

MATERIALS AND REALISM
Real, tactile materials with honest imperfections: uncoated paper, kraft board,
cotton canvas with a soft crease, matte ceramic with a thin glaze line, brushed
steel, condensation on the bottle, a few crumbs, one slightly uneven tomato.
Physically plausible contact shadows and weight. Nothing floating, nothing
pristine-perfect, nothing plastic.

PALETTE
Warm paper (#E7DFD2), kraft (#C9B79B), off-white (#F4F1EA), natural produce greens,
tomato red and turmeric ochre, with one small matte Faazio Blue (#1627E9) accent.
Natural colour only. No gradients, no colour wash, no neon, no teal-and-orange
grade, no HDR.

OUTPUT
A single wide 16:9 landscape photograph at the highest resolution available, sRGB,
sharp, full-bleed, no alpha, no border, no text, no watermark. Compose so the same
image survives a 21:9 centre crop without losing any essential object.

AVOID
AI-looking pastel seamless backgrounds, perfect flat-lay grids, soft-focus bokeh
balls, glossy 3D renders, plastic sheen, floating objects, glow, gradients,
sparkles, geometric blobs, holographic or iridescent surfaces, purple, neon, fake
motion blur, oversaturation, extreme symmetry, stock-photo smiles, people, hands,
faces, phones, device frames, app UI, buttons, badges, arrows, price tags, any
lettering at all.
```

---

## Variant B — Faazio Blue wall (brand-led)

Keep the same prompt and subject, then swap these two lines:

- Replace `warm off-white plaster wall with subtle trowel texture` with
  `deep matte Faazio Blue (#1627E9) painted plaster wall with subtle trowel texture`.
- Replace `One narrow matte Faazio Blue (#1627E9) paper band wraps the tote handle.`
  with `No blue band on the objects; the wall carries the brand colour.`

Add: `The blue wall must be flat painted plaster with real texture, never a
gradient, glow or colour wash.`

Generate both, then choose in App Store Connect against the real title/icon
overlay. The warm variant is safer for legibility; the blue variant is stronger
brand recognition.

---

## Reference images to upload

**Minimum set (recommended):**

| File | Size | What it anchors |
|---|---|---|
| `/media/faizal-basha/Codespace/faazio-workspace/client/mobile/assets/brand/logo-rectangle.png` | 2172 × 724 | Exact Faazio Blue `#1627E9` and wordmark shape. **Colour swatch only** — do not trace or reproduce the lettering. |
| `/media/faizal-basha/Codespace/faazio-workspace/client/mobile/store-assets/app-store/customer/AppIcon-1024.png` | 1024 × 1024 | Final customer app icon; exact blue and mark. Do not place the icon inside the header. |
| `/media/faizal-basha/Codespace/faazio-workspace/client/web/landingpage/src/assets/faazio-daily.jpg` | 1920 × 1024 | Current three-sector brand image; subject-matter reference for groceries + meal + pharmacy together. |

**Optional object references** (upload only if the generator needs more detail;
these are the current pastel flat-lays, so include the "do not copy the style"
line from the prompt):

| File | Size | What it anchors |
|---|---|---|
| `/media/faizal-basha/Codespace/faazio-workspace/client/web/landingpage/src/assets/mart.jpg` | 1024 × 1024 | Groceries: canvas tote, leafy greens, tomatoes, loaf, apples, lemon. |
| `/media/faizal-basha/Codespace/faazio-workspace/client/web/landingpage/src/assets/food.jpg` | 1024 × 1024 | Meal: rice, curry, raita, herbs. |
| `/media/faizal-basha/Codespace/faazio-workspace/client/web/landingpage/src/assets/pharma.jpg` | 1024 × 1024 | Pharmacy: white cartons, blister packs, bottle. |
| `/media/faizal-basha/Codespace/faazio-workspace/client/web/landingpage/public/og-image.jpg` | 1200 × 630 | Existing social header; tone/format reference only. |
| `/media/faizal-basha/Codespace/faazio-workspace/client/mobile/assets/brand/logo-square.png` | 1536 × 1024 | `Fa` mark shape; optional. |

**Important:** the landing-page photos are exactly the pastel seamless flat-lay
look this brief is moving away from. Never upload them without the sentence:
*"Use these only as object references; do not copy their pastel background,
centred flat-lay arrangement, soft shadow or colour grade."*

---

## Sizes and export

| Asset | Size | Notes |
|---|---|---|
| Header — primary | **5244 × 2950 px** | 16:9-class. Required size. |
| Header — alternate | **3840 × 1646 px** | 21:9-class. Accepted alternate. |

- ChatGPT cannot emit 5244 × 2950 directly. Generate the widest 16:9 image the
  tool allows, then upscale (Topaz Gigapixel / Magnific / Lanczos) and crop to the
  exact pixels. Do **not** let the upscaler add fake sharpening, HDR or "detail".
- Export **PNG, sRGB, 8-bit, no alpha** (flatten first). High-quality JPEG is
  acceptable if the console enforces a file-size cap.
- Check both crops. The 21:9 version is a centre crop of the 16:9 frame, so the
  tote, tiffin and pharmacy carton must all survive it.
- Do not bake a logo or wordmark into the image. If one is required later, place
  the real `logo-rectangle.png` in Figma/Photoshop after generation.

---

## Post-generation check (anti-slop)

Zoom to 100% and reject/regenerate if you see:

- melted or invented lettering anywhere;
- duplicated objects, impossible shadows, or objects that float;
- pastel gradient background, glossy plastic, glow, sparkles, bokeh balls;
- perfect symmetry or a centred flat-lay grid;
- oversaturation, HDR, teal-orange grade, fake depth-of-field edges.

Then view at 50% width — the size it appears in the store. The story must read in
one glance: **groceries, a meal, pharmacy**, one blue accent, calm space for the
title. If it reads as a generic stock still life, regenerate with a different seed
or push the materials and imperfections harder.
