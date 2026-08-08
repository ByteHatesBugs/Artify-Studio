# RenderFlow

RenderFlow is a full-stack batch image-to-video workspace. Upload a set of JPG, PNG, or WebP images, choose a consistent motion profile, and render every image into a production-ready MP4 or WebM video.

The interface is designed for repeatable creative work: previews before upload, predictable render settings, controlled server concurrency, per-file progress, cancellation, individual downloads, and a ZIP export for completed batches.

## Features

- Batch upload for up to 50 images with client- and server-side validation
- Duplicate detection plus drag, keyboard, and button-based source reordering
- Five motion profiles with a live first-image preview: still, zoom in, zoom out, pan left, and pan right
- Exact effect start and end timing with motion held before and after the selected window
- Up to eight ordered motion effects per video, each with independent focal placement and timing
- Independent 0–100 strength control for every motion segment
- Independent 0.25×–3× speed control for every effect, with smooth hold behavior after its timing window
- Stabilized zoom and pan rendering with adaptive supersampling and Lanczos scaling
- Eleven smooth motion choices, including vertical pans and four diagonal drifts
- Five independent professional motion curves per effect: Cinematic, Smooth, Ease In, Ease Out, and Linear
- Independent effect timing with visible overlapping lanes; earlier effects take priority wherever time ranges overlap
- Video durations from 1 to 60 seconds
- Per-image effect-stack overrides on top of reusable batch defaults
- Enforced edge-to-edge cover framing for screen-filling final output
- Draft, balanced, and high encoding profiles that change FFmpeg speed and output quality
- Optional fade-in and fade-out transitions for polished clips
- Persistent preferences and quick profiles for common campaign, social, and lightweight outputs
- Ten standard landscape, square, story, vertical, and 4:5 feed canvases from SD through 4K
- MP4/H.264 and WebM/VP9 output
- Queue concurrency controls to protect the processing server under load
- Live batch and per-video render progress
- Durable batch history with automatic recovery after server restarts
- Safe cancellation, failed-job retries, individual downloads, and batch ZIP archives
- Inline video players with seek controls for checking completed renders before download
- Professional buffered transport controls with effect markers, timecode, playback speed, and fullscreen
- Rename-only updates and safe edit-and-rerender workflows for completed videos
- Filterable render history with loading, empty, busy, confirmation, and notification states
- Responsive, keyboard-accessible interface
- Locally bundled Inter and Manrope variable typography with no external font dependency
- Searchable render history, live status counts, `/` search focus, and `Ctrl/Command + Enter` rendering
- Persistent render searches with saved filters, recent terms, and live name suggestions
- Lazy preview decoding and viewport-aware rendering for smooth large-batch editing
- Lazy-loaded review/editor panels, deduplicated polling updates, deferred preference saves, and throttled preview updates
- Automatic input cleanup and configurable output retention

## Architecture

```text
RenderFlow/
├── apps/
│   ├── api/              Express + TypeScript render service
│   │   └── src/
│   │       ├── routes.ts Upload, queue, cancel, and download endpoints
│   │       ├── queue.ts  Concurrency-controlled render queue
│   │       ├── media.ts  Safe FFmpeg command construction
│   │       └── store.ts  Durable JSON-backed batch state
│   └── web/              React + Vite studio interface
│       └── src/
│           ├── components/
│           ├── api.ts
│           └── App.tsx
├── storage/              Runtime uploads and outputs (gitignored)
└── .github/workflows/    Automated checks for dev and main
```

## Requirements

- Bun 1.3 or newer
- [FFmpeg](https://ffmpeg.org/download.html) available on your `PATH`

Verify FFmpeg before installing:

```bash
ffmpeg -version
```

## Installation

```bash
git clone https://github.com/ByteHatesBugs/RenderFlow.git
cd RenderFlow
git switch dev
bun install
```

Copy the environment template:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead.

Start both the web interface and processing API:

```bash
bun run dev
```

Open `http://localhost:5173`. The Vite development server proxies API requests to `http://localhost:8787`.

## NixOS

The repository includes a `flake.nix` development shell for x86_64 and ARM64 Linux. It supplies compatible versions of Bun, FFmpeg, and Git, and points `FFMPEG_PATH` directly at the Nix store executable.

Enable flakes in your NixOS configuration if they are not already enabled:

```nix
nix.settings.experimental-features = [ "nix-command" "flakes" ];
```

Enter the project environment and start development:

```bash
nix develop
bun install --frozen-lockfile
cp .env.example .env
bun run dev
```

Run the same verification used by development before handing a build to a NixOS client:

```bash
nix develop --command bash -lc 'bun install --frozen-lockfile && bun run check && bun run test && bun run build'
```

All runtime paths are resolved with Node's cross-platform path utilities. FFmpeg and FFprobe are read from `FFMPEG_PATH` and `FFPROBE_PATH`; the flake sets both variables to Nix store executables automatically.

For a production-like run:

```bash
nix develop --command bash -lc 'bun install --frozen-lockfile && bun run build && bun start'
```

Then open `http://localhost:8787`. The first `nix develop` creates `flake.lock` when one is not present; commit that generated lock file from a Nix machine when you want to pin the exact Nixpkgs revision.

## Development commands

| Command | Purpose |
| --- | --- |
| `bun run dev` | Start the API and web app with live reload |
| `bun run check` | Type-check both workspaces |
| `bun run test` | Run the automated test suites |
| `bun run build` | Create production API and web builds |
| `bun start` | Serve the built web app and API on one port |

For a production-like local run:

```bash
bun run build
bun start
```

Then open `http://localhost:8787`.

## Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `8787` | API and production web server port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | Allowed development web origin |
| `FFMPEG_PATH` | `ffmpeg` | FFmpeg executable path |
| `FFPROBE_PATH` | `ffprobe` | FFprobe executable used to verify every completed render |
| `STORAGE_DIR` | `./storage` | Runtime media directory |
| `MAX_FILE_SIZE_MB` | `25` | Maximum size of one source image |
| `MAX_BATCH_SIZE` | `50` | Maximum images accepted in one request |
| `QUEUE_CONCURRENCY` | `1` | Simultaneous FFmpeg processes; conservative by default to keep the UI responsive |
| `JOB_TTL_HOURS` | `24` | Retention window for render results |

Keep `QUEUE_CONCURRENCY` conservative. Full HD video encoding is CPU- and memory-intensive; increase it only after measuring the target server.

## API overview

- `GET /api/health` — service health
- `GET /api/batches` — current server-local batch history
- `POST /api/batches` — create a multipart render batch from images
- `POST /api/batches/:batchId/cancel` — cancel queued and active work
- `POST /api/batches/:batchId/retry` — retry failed or cancelled jobs with retained sources
- `GET /api/batches/:batchId/download` — download completed videos as a ZIP
- `GET /api/batches/:batchId/jobs/:jobId/download` — download one video
- `DELETE /api/batches/:batchId` — remove a terminal batch and its files

## Branch workflow

- `main` is the stable release branch.
- `dev` contains active development and is protected by the CI workflow.
- Create focused feature branches from `dev`, open pull requests back into `dev`, and promote tested releases to `main`.

## Persistence and recovery

Media files and an atomic JSON batch journal are stored under `storage/`. Completed history survives restarts, interrupted jobs are returned to the queue when their source images remain available, and failed or cancelled jobs can be retried from the interface until the retention window expires. Input images, outputs, archives, and history are removed together by the cleanup process.

The built-in journal is appropriate for one RenderFlow API instance. For a multi-instance deployment, replace it with PostgreSQL or Redis and move media to object storage such as S3/R2. The store, queue, and route boundaries are separated to make that upgrade straightforward.

## Security and operations

- Source type, file size, batch size, and settings are validated server-side.
- FFmpeg is spawned with an argument array and no shell interpolation.
- Runtime media directories are excluded from Git.
- Deploy behind TLS and an authenticated reverse proxy before exposing the service publicly.
- Add rate limiting and user-level quotas for a public or multi-tenant deployment.

## License

RenderFlow is available under the [MIT License](LICENSE). Copyright © 2026 ByteHatesBugs.
