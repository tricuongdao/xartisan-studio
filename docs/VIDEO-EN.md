# English brand film

**Status: not mounted.** At the owner's request the film section is removed from the site. The
English cut and its source remain here for future use. `tools/i18n/apply.mjs` disables the two film
components and deletes the film media from `site/`; to bring the section back, remove those
structural patches and the media cleanup at the end of that script, then re-run it.

The origin's 66-second film had Vietnamese burned into the frames, including inside the app
mockups, so it could not be translated by editing copy. It was re-edited from scratch in English,
keeping the original soundtrack and length.

## Deliverables

| file | use | specs |
|---|---|---|
| `research/video-en/final/brand-film-16x9.mp4` | desktop film | 1920x1080, 30fps, 66.47s, AAC stereo |
| `research/video-en/final/brand-film-9x16.mp4` | mobile film | 720x1280, same cut |
| `research/video-en/final/brand-film-16x9.jpg` | poster | frame at 12s |
| `research/video-en/final/brand-film-9x16.jpg` | mobile poster | frame at 12s |

Installed into `site/uploads/ximitech/video/v1/film/` under the origin filenames. URLs are
cache-busted with `?v=en1` in the bundle, so returning visitors do not keep the old film. The
duration is still 1:06, so the page copy and `duration:"1:06"` stay correct.

## Cut list

| time | beat |
|---|---|
| 0:00 | Every website starts with an idea |
| 0:06 | XimiTech mark, "Your website is an asset" |
| 0:09 | Design: structure before pixels, live site screenshot |
| 0:16 | Work: 150+ projects, project-cover collage |
| 0:23 | Build: built to hold up, work screenshot |
| 0:30 | Control: 100% ownership, 5-year edits, 24/7 monitoring |
| 0:37 | Range: 19 industries marquee |
| 0:44 | Operations: run it like an asset, operations panel |
| 0:50 | After handover: three client outcome cards |
| 0:57 | CTA: phone, email, Zalo |
| 1:02 | End card: from idea to website |

## How it is built

The timeline is deterministic HTML: `research/video-en/film.html`. `renderAt(t)` sets every
element's opacity and transform for a given time, so frames can be rendered in order with no CSS
animation timing drift.

```bash
node tools/video/capture.mjs                 # 1920x1080 stills of the English site, dark theme
node tools/video/render.mjs 16 research/video-en/frames-16 1920 1080 66.47 30 0
node tools/video/render.mjs 9  research/video-en/frames-9  720  1280 66.47 30 0
```

Encode with the original soundtrack:

```bash
ffmpeg -framerate 30 -i research/video-en/frames-16/%05d.jpg -i research/video-en/audio.m4a \
  -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 192k -shortest \
  -movflags +faststart research/video-en/final/brand-film-16x9.mp4
```

`npm run i18n:apply` copies the files in `research/video-en/final/` into `site/` after rebuilding
the translated tree, so the film survives regeneration.

## Limits

- This is a new edit, not a frame-accurate restoration: the origin's project files are not
  available, so the compositions are rebuilt from the English site's own screens and project covers.
- Some project covers show client websites in their original languages. They are portfolio
  material, not site copy.
- Audio is the origin's soundtrack, reused as-is.
