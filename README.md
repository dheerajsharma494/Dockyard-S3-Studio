# Dockyard S3 Studio

A modern S3 workspace for LocalStack and AWS.

Browse buckets, manage objects, preview common file formats, and run advanced S3 operations from one UI.

## Highlights

- Multi-connection support (LocalStack and AWS)
- Connection switching with persisted active connection
- Bucket sidebar with:
  - Double-click to open bucket
  - Pin/unpin buckets
  - Pinned section always visible
  - Non-pinned buckets hidden in a collapsed section by default
  - Last selected bucket restored after reload
- File explorer with list/tile layouts, search, sort, pagination
- Rich context menu actions (preview, details, download, metadata, tags, rename, move, delete, copy/share)
- Upload flows:
  - Standard upload
  - Multipart upload for large files
  - Upload progress + cancellation
- Batch operations (delete, copy, move, tag)
- Folder operations (create, recursive delete)
- Object metadata and tags editing
- Signed URL generation
- Archive restore support
- Bucket settings management (policy, encryption, logging, access block)
- Webhook configuration + webhook test
- Local sync and sync planning tools
- API docs / codegen / CLI export / DB seed utilities
- File previews:
  - Text / CSV / Excel
  - Image
  - Video (controls in modal)
  - PDF (rendered in-app via pdfjs-dist)

## Tech Stack

- Next.js 16
- React 18
- AWS SDK v3
- pdfjs-dist 3.11.174
- xlsx

## Requirements

- Node.js 20.17+ (or 22.9+)
- npm
- LocalStack (optional)
- AWS credentials (optional)

## Getting Started

```bash
git clone <your-repo-url>
cd Dockyard-S3-Studio
npm install
npm run dev
```

App URL:

- http://localhost:3000

## Scripts

```bash
npm run dev      # next dev --webpack
npm run build    # next build --webpack
npm start        # next start
```

## Configuration

Connections are managed from the UI at /config.

Stored connection data:

- Primary: ~/.dockyard-s3-studio/connections.json
- Legacy fallback (read only): .connections.json in project root

## Usage Notes

### Buckets

- Single click a bucket row to arm/focus it
- Double click a bucket row to open/select it
- Click the pin icon to pin/unpin a bucket
- Pinned buckets are shown first
- Other buckets are in a collapsed section and hidden by default

### Previews

- Right-click file -> Preview
- PDF previews are rendered in modal using pdfjs-dist
- PDF worker file is served from public/pdf.worker.min.js

## Project Structure

```text
app/
  api/
    access-logs/
    archive/
    batch/
    bucket-settings/
    buckets/
    cli-export/
    codegen/
    connections/
    db-seed/
    delete/
    docs/
    download/
    download-archive/
    folders/
    local-sync/
    metadata/
    move/
    multipart/
    objects/
    preview/
    signed-url/
    sync/
    tags/
    upload/
    webhooks/
  components/
    BucketList.jsx
    FileExplorer.jsx
    MetadataModal.jsx
    PreviewModal.jsx
    TreeNode.jsx
  globals.css
  layout.js
  page.jsx
config/
  page.jsx
tools/
  page.jsx
lib/
  connections-store.js
  s3.js
  webhooks-store.js
  webhooks.js
next.config.js
package.json
```

## API Overview

Core endpoints:

- /api/connections
- /api/connections/select
- /api/buckets
- /api/objects
- /api/upload
- /api/multipart
- /api/batch
- /api/folders
- /api/metadata
- /api/tags
- /api/signed-url
- /api/archive
- /api/bucket-settings
- /api/access-logs
- /api/webhooks
- /api/webhooks/test
- /api/codegen
- /api/cli-export
- /api/sync
- /api/local-sync
- /api/db-seed
- /api/docs
- /api/delete
- /api/download
- /api/move
- /api/preview

## Troubleshooting

### Dev server restart loop or odd reload behavior

- Ensure connection storage is not being written inside the project root repeatedly
- Preferred storage path is ~/.dockyard-s3-studio/connections.json

### PDF preview issues

- Confirm these files exist:
  - public/pdf.worker.min.js
  - app/components/PreviewModal.jsx uses GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js"
- Restart dev server after dependency/config updates

### Port already in use

```bash
kill $(lsof -t -i :3000)
npm run dev
```

## License

MIT
