# Wakaru brand

The mark is the **Ink Drop Balloon**: a brush drawn speech balloon with 分, the
first character of 分かる, "to understand", knocked out of it, and vermilion ink
falling away from the tail.

It carries both halves of the product at once. The balloon is the manga side,
the kanji is the dictionary side, and the same balloon silhouette is reused as
the tooltip shape and as the translated overlay bubble, so the logo is part of
the interface rather than decoration sitting on top of it.

## Sources

| File | Use |
|---|---|
| `mark.svg` | The full mark. Anything 64px and larger. |
| `mark-small.svg` | The small cut. Anything under 64px. |
| `lockup.svg` | Horizontal lockup with the wordmark. |
| `og.svg` | Social card, 1200 by 630. |

These four files are the only source of truth. Every raster in the repository
is generated from them:

```bash
npm run brand:build
```

That writes the extension icons, the web app icons, the favicon and the social
card. Do not hand edit anything it produces.

## Two cuts, on purpose

`mark-small.svg` is a separate drawing, not the full mark scaled down. Below
roughly 48 pixels the tail and the trailing drops collapse into noise, so the
small cut drops to a single drop, thickens the strokes and lets the balloon
fill the frame as a rounded ink tile. Scaling the full mark down to 16px
produces an unreadable smudge, which is why the build script switches drawings
rather than resolutions.

## The kanji is drawn, not set

分 is built from four stroked paths rather than a `<text>` element. A text based
mark silently falls back to whatever serif the viewer has, and on a machine
with no CJK font installed it renders as a tofu box. Paths always render.

## Colour

| Token | Value | Use |
|---|---|---|
| Sumi ink | `#14110f` | The balloon body |
| Paper | `#f4efe6` | The knockout and the ground |
| Vermilion | `#d8412f` | The drops, and nothing else |

Vermilion is the only accent in the entire system. On the mark it appears only
as falling ink.

## Clear space and minimum size

Keep clear space equal to the radius of the largest drop on every side.
Minimum size is 16px for the small cut and 64px for the full mark.

## Do not

- Recolour the balloon. It is ink, or it is reversed to paper on an ink ground.
- Add a gradient, a bevel, an outer glow or a drop shadow with blur. Shadows in
  this system are solid offsets with zero blur.
- Rotate the mark, or set the wordmark in anything other than the display face.
- Stretch the lockup. Scale it.
- Rebuild the kanji as live text.
