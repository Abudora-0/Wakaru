# Fixtures

Sample pages used to tune the bubble detector in `packages/ocr`.

## Drop pages in `pages/`

Name them by what they are, so a failure is traceable:

```
fixtures/pages/manga-japanese-01.jpg
fixtures/pages/manhwa-korean-01.png
fixtures/pages/manhua-chinese-01.jpg
```

## These are deliberately not committed

`pages/` is in `.gitignore`. The repository is public and MIT licensed, and
scanned pages are somebody else's copyrighted work. Tuning the detector needs
them present locally, it does not need them published, so they stay out of the
history.

The tuning script writes its output to `fixtures/out/`, which is ignored for
the same reason.

## Running the tuner

```bash
npm run ocr:tune
```

It reports, per page, how many bubbles were found, how much of the page they
cover, and how many survive the confidence floor, then writes an overlay image
so the boxes can be checked by eye.
