# Artify Studio

Artify Studio is a full-stack batch image-to-video workspace. Upload a set of JPG, PNG, or WebP images, choose a consistent motion profile, and render every image into a production-ready MP4 or WebM video.

The interface is designed for repeatable creative work: previews before upload, predictable render settings, controlled server concurrency, per-file progress, cancellation, individual downloads, and a ZIP export for completed batches.

## Features

- Batch upload for up to 50 images with client- and server-side validation
- Duplicate detection plus drag, keyboard, and button-based source reordering
- Five motion profiles: still, zoom in, zoom out, pan left, and pan right
- Persistent preferences and quick profiles for common campaign, social, and lightweight outputs
- Landscape, square, and portrait canvases up to Full HD
- MP4/H.264 and WebM/VP9 output
- Queue concurrency controls to protect the processing server under load
- Live batch and per-video render progress
- Durable batch history with automatic recovery after server restarts
- Safe cancellation, failed-job retries, individual downloads, and batch ZIP archives
- Filterable render history with loading, empty, busy, confirmation, and notification states
- Responsive, keyboard-accessible interface
- Automatic input cleanup and configurable output retention

## Architecture

```text
Artify-Studio/
├── apps/
│   ├── api/              Express + TypeScript render service
│   │   └── src/
│   │       ├── routes.ts Upload, queue, cancel, and download endpoints
│   │       ├── queue.ts  Concurrency-controlled render queue
│   │       ├── media.ts  Safe FFmpeg command construction
│   │       └── store.ts  In-process batch state
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
git clone https://github.com/ByteHatesBugs/Artify-Studio.git
cd Artify-Studio
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
| `STORAGE_DIR` | `./storage` | Runtime media directory |
| `MAX_FILE_SIZE_MB` | `25` | Maximum size of one source image |
| `MAX_BATCH_SIZE` | `50` | Maximum images accepted in one request |
| `QUEUE_CONCURRENCY` | `2` | Simultaneous FFmpeg processes |
| `JOB_TTL_HOURS` | `24` | Retention window for render results |

Keep `QUEUE_CONCURRENCY` conservative. Full HD video encoding is CPU- and memory-intensive; increase it only after measuring the target server.

## API overview

- `GET /api/health` — service health
- `GET /api/batches` — current server-local batch history
- `POST /api/batches` — create a multipart render batch
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

The built-in journal is appropriate for one Artify API instance. For a multi-instance deployment, replace it with PostgreSQL or Redis and move media to object storage such as S3/R2. The store, queue, and route boundaries are separated to make that upgrade straightforward.

## Security and operations

- Source type, file size, batch size, and settings are validated server-side.
- FFmpeg is spawned with an argument array and no shell interpolation.
- Runtime media directories are excluded from Git.
- Deploy behind TLS and an authenticated reverse proxy before exposing the service publicly.
- Add rate limiting and user-level quotas for a public or multi-tenant deployment.

## License

Artify Studio is available under the [MIT License](LICENSE). Copyright © 2026 ByteHatesBugs.
