# Artify Studio

Artify Studio is a full-stack batch image-to-video workspace. Upload a set of JPG, PNG, or WebP images, choose a consistent motion profile, and render every image into a production-ready MP4 or WebM video.

The interface is designed for repeatable creative work: previews before upload, predictable render settings, controlled server concurrency, per-file progress, cancellation, individual downloads, and a ZIP export for completed batches.

## Features

- Batch upload for up to 50 images with client- and server-side validation
- Five motion profiles: still, zoom in, zoom out, pan left, and pan right
- Landscape, square, and portrait canvases up to Full HD
- MP4/H.264 and WebM/VP9 output
- Queue concurrency controls to protect the processing server under load
- Live batch and per-video render progress
- Safe cancellation, individual downloads, and batch ZIP archives
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

- Node.js 20 or newer
- npm 10 or newer
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
npm install
```

Copy the environment template:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env` instead.

Start both the web interface and processing API:

```bash
npm run dev
```

Open `http://localhost:5173`. The Vite development server proxies API requests to `http://localhost:8787`.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and web app with live reload |
| `npm run check` | Type-check both workspaces |
| `npm test` | Run the automated test suites |
| `npm run build` | Create production API and web builds |
| `npm start` | Serve the built web app and API on one port |

For a production-like local run:

```bash
npm run build
npm start
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
- `GET /api/batches/:batchId/download` — download completed videos as a ZIP
- `GET /api/batches/:batchId/jobs/:jobId/download` — download one video
- `DELETE /api/batches/:batchId` — remove a terminal batch and its files

## Branch workflow

- `main` is the stable release branch.
- `dev` contains active development and is protected by the CI workflow.
- Create focused feature branches from `dev`, open pull requests back into `dev`, and promote tested releases to `main`.

## Current persistence model

Media files are stored on disk while job metadata lives in the API process. Restarting the API clears the visible queue, although output files remain until the configured or external cleanup process removes them. For multi-instance or restart-safe production deployment, replace the in-memory store with PostgreSQL or Redis and move media to object storage such as S3/R2. The queue and route boundaries are separated to make that upgrade straightforward.

## Security and operations

- Source type, file size, batch size, and settings are validated server-side.
- FFmpeg is spawned with an argument array and no shell interpolation.
- Runtime media directories are excluded from Git.
- Deploy behind TLS and an authenticated reverse proxy before exposing the service publicly.
- Add rate limiting and user-level quotas for a public or multi-tenant deployment.

## License

No license has been selected yet. Add one before distributing the project publicly.
