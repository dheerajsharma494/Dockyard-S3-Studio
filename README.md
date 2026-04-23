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
npm run desktop:dev    # run as desktop app in dev mode
npm run desktop:prod   # build + run as desktop app (production web build)
npm run desktop:icons  # generate desktop icon assets (.png/.icns/.ico)
npm run desktop:dist:mac      # build macOS .dmg installer in dist/
npm run desktop:dist:mac:dir  # build unpacked macOS app in dist/
npm run desktop:dist:win           # build Windows NSIS installer
npm run desktop:dist:win:portable  # build Windows portable executable
npm run desktop:dist:win:dir       # build unpacked Windows app directory
```

## Desktop App (macOS)

You can run Dockyard S3 Studio as a desktop app using Electron.

```bash
# Development desktop app
npm run desktop:dev

# Production desktop app mode (builds Next.js first)
npm run desktop:prod
```

Notes:

- The desktop window loads the local web app URL at `http://localhost:3000`.
- In desktop mode, external links open in your default browser.
- Packaged builds run an embedded Next.js server on port `3123` by default.
- Desktop icon assets are generated from `assets/app-icon.svg` into `electron/icons/`.
- DMG background assets are generated into `electron/installer/`.

### Build a macOS installer (.dmg)

```bash
npm run desktop:dist:mac
```

Output:

- DMG installer and app artifacts are generated under `dist/`.

For local testing without DMG packaging:

```bash
npm run desktop:dist:mac:dir
```

## Desktop App (Windows)

Windows desktop packaging is also configured through Electron Builder.

```bash
# Windows installer
npm run desktop:dist:win

# Windows portable app
npm run desktop:dist:win:portable

# Unpacked Windows app directory
npm run desktop:dist:win:dir
```

Notes:

- Packaged Windows builds use the same embedded Next.js server flow as macOS builds.
- Building Windows installers from macOS may require additional tooling such as Wine, depending on target type and environment.
- The most reliable way to produce final Windows artifacts is on a Windows machine or CI runner.

## Code Signing And Notarization

### macOS

For clean distribution outside your own machine, sign and notarize the app with an Apple Developer account.

Typical requirements:

- A valid `Developer ID Application` certificate installed in Keychain
- Apple Developer Team ID
- Apple ID with an app-specific password

Common environment variables used during build:

```bash
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="YOURTEAMID"
```

Notes:

- Unsigned DMGs will still build, but Gatekeeper will warn on other machines.
- Notarization is the recommended path for public macOS distribution.
- Automated notarization is wired through `electron/notarize.js` and runs automatically after signing when the required environment variables are present.

### Windows

For smoother installation and better SmartScreen reputation, sign the Windows installer and executable with an Authenticode certificate.

Common electron-builder variables:

```bash
export CSC_LINK="/path/to/certificate.p12"
export CSC_KEY_PASSWORD="your-password"
```

Notes:

- Unsigned Windows builds still work, but users may see stronger trust warnings.
- The best place to produce signed Windows artifacts is a Windows CI runner or Windows build host.

## CI Desktop Builds

GitHub Actions workflows are included for both macOS and Windows desktop builds:

- `.github/workflows/desktop-macos.yml`
- `.github/workflows/desktop-windows.yml`

They run on:

- manual trigger (`workflow_dispatch`)
- pushed version tags like `v1.0.0`

### GitHub Secrets

For signed and notarized macOS builds, configure:

- `APPLE_ID`
- `APPLE_APP_SPECIFIC_PASSWORD`
- `APPLE_TEAM_ID`
- `APPLE_CERTIFICATE_P12`
- `APPLE_CERTIFICATE_PASSWORD`
- `KEYCHAIN_PASSWORD`

For signed Windows builds, configure:

- `WIN_CSC_LINK`
- `WIN_CSC_KEY_PASSWORD`

Secret formats:

- `APPLE_CERTIFICATE_P12` should be base64-encoded `.p12` certificate content.
- `WIN_CSC_LINK` should be base64-encoded `.p12`/code-signing certificate content.

If signing secrets are omitted, the workflows still build unsigned artifacts.

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
