# Synthex live collaboration server

A small [Hocuspocus](https://tiptap.dev/docs/hocuspocus) (Yjs) relay that lets several people edit the same map at
once: notes and links merge per item, and everyone sees each other's cursors and selections. It is free and
open source (MIT) and holds maps only in memory while someone has them open. The database stays the source of
truth, because the app keeps loading and saving maps through its own API as before.

Access is checked by the app: `/api/collab/token` signs a 10-minute token for one map after the usual project-access
check, and this server refuses any connection without a valid token for that exact map.

## Configuration

| Variable | Where | Value |
|---|---|---|
| `COLLAB_SECRET` | app **and** server | The same random string, at least 32 characters |
| `COLLAB_SERVER_URL` | app | How browsers reach this server, e.g. `wss://synthex-collab-xyz.a.run.app` |
| `PORT` | server | Set by Cloud Run; defaults to `1234` locally |

Generate a secret: `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"`

Leave `COLLAB_SERVER_URL` unset and the app works as before, with one editor per map.

## Run locally

```bash
export COLLAB_SECRET=...            # same value in .env.local, with COLLAB_SERVER_URL=ws://localhost:1234
npm run collab                      # from the repo root
```

## Deploy to Cloud Run

```bash
gcloud run deploy synthex-collab \
  --source collab-server \
  --region europe-west1 \
  --allow-unauthenticated \
  --max-instances=1 \
  --timeout=3600 \
  --session-affinity \
  --set-secrets=COLLAB_SECRET=synthex-collab-secret:latest
```

- **`--max-instances=1` is required.** Open maps live in this process's memory, so two instances would split a
  team into two rooms that never see each other. (Scaling out later means adding the Hocuspocus Redis extension.)
- `--allow-unauthenticated` lets browsers connect; the signed token is what keeps maps private.
- Cloud Run closes WebSockets after `--timeout` (max 60 minutes); the browser reconnects on its own with a fresh
  token, and edits made in between merge when it's back.
- The service scales to zero when nobody has a map open, so an idle team costs nothing. Check Cloud Run's current
  free-tier allowance for heavier use.

Then set `COLLAB_SERVER_URL=wss://<service-url>` and the same `COLLAB_SECRET` on the app (Vercel or Cloud Run).
