# LocalStack S3 Explorer

A modern web-based S3 file explorer for **LocalStack** and **AWS**. Browse, search, rename, delete, download, and manage S3 buckets and objects across multiple cloud storage connections from a single interface.

## Features

- 🪣 **Multi-Connection Support**: Save and switch between multiple LocalStack and AWS S3 connections (with optional session tokens for STS)
- 📁 **File Browser**: Navigate S3 buckets with intuitive folder-based interface
- 🔍 **Search**: Real-time search across files and folders in the current directory
- 📊 **List & Grid Views**: Toggle between detailed list view (with metadata) and tile grid view
- 📋 **Rich Metadata**: Display file type, size, and last modified date in list view
- 📤 **File Upload**: Upload files directly to the current S3 path with progress indicators
- 🧩 **Multipart Upload API**: Upload very large files using create/part-url/complete/abort workflow
- 🛑 **Upload Cancellation**: Cancel in-progress uploads, including multipart transfers
- 🏷️ **Metadata & Tags Management**: Edit S3 object metadata (Content-Type, Cache-Control, etc.) and manage object tags
- 📦 **Batch Operations**: Bulk delete, copy, move, and tag selected files
- 🗂️ **Folder Operations**: Create and recursively delete prefix folders
- 🧪 **Advanced Filtering & Sorting**: Filter by size/date/storage class and sort by name/size/date/storage class
- 🔐 **Signed URL Generation**: Generate time-limited download links
- 🧊 **Archive Support**: Read archive status and initiate Glacier/Deep Archive restore requests
- 🛡️ **Bucket Security Settings**: Manage bucket policy, encryption, public access block, and logging
- 🪝 **Webhook Integration**: Trigger webhook callbacks on object and folder changes
- ✅ **Webhook Testing**: Test configured webhook endpoints directly from Tools page
- 🧰 **Developer Tools**: API docs, CLI export, code snippet generation, sync planning, and DB seed SQL export
- 🛠️ **Tools Page**: Dedicated UI for bucket security settings, webhook management, and local sync operations
- 🔁 **Local Filesystem Mirror**: Mirror local directories to S3 or download S3 prefixes to local paths
- 🧪 **Sync Dry-Run Preview**: Preview local sync plans before executing changes
- ⚙️ **Right-Click Context Menu**: Quick actions including download, metadata/tags editor, rename, delete, move to bin, copy path, and share
- 🔄 **Breadcrumb Navigation**: Jump to any parent folder from the breadcrumb trail
- ⬅️ **Back Button**: Easy navigation back to parent directories
- 📖 **Pagination**: Configurable pagination with items-per-page selector (10, 20, 50, or 100 items)
- 💾 **Configuration Management**: Create, edit, view, and delete S3 connections with a dedicated settings page
- 🚀 **Built with Next.js**: Fast, server-side rendering, API routes, and modern React

## Tech Stack

- **Frontend**: React 18, Next.js 16 (with Turbopack), vanilla CSS
- **Backend**: Next.js API Routes
- **AWS SDK**: @aws-sdk/client-s3 v3
- **Storage**: LocalStack for local S3 emulation, AWS for cloud

## Installation

### Prerequisites

- Node.js 20.17+ or Node.js 22.9+ (required for npm 11.12.1)
- npm 11.12.1+
- LocalStack running (optional, for local testing)
- AWS credentials (optional, for AWS connections)

### Setup

```bash
# Clone the repository
git clone <repo-url>
cd Localstack\ S3\ Explorer

# Install dependencies
npm install

# Set up environment (optional, if not using the config page)
# Create .env.local with:
# AWS_S3_CUSTOM_ENDPOINT_URL=http://localhost:4566

# Start the development server
npm run dev
```

The app will be available at `http://localhost:3000`.

## Usage

### Creating Connections

1. Navigate to `/config` or click **"Manage connections"** in the sidebar
2. Fill in the connection form:
   - **Name**: A friendly identifier for the connection (e.g., "My LocalStack")
   - **Provider**: LocalStack or AWS
   - **Region**: AWS region (e.g., `us-east-1`)
   - **Endpoint**: LocalStack endpoint URL (only for LocalStack, e.g., `http://localhost:4566`)
   - **Access Key ID**: AWS access key or LocalStack test key
   - **Secret Access Key**: AWS secret key or LocalStack test key
   - **Session Token** _(AWS only, optional)_: STS session token for temporary credentials
   - **Role ARN** _(AWS only, optional)_: ARN of the role to assume
   - **External ID** _(AWS only, optional)_: External ID for cross-account role assumption
3. Click **Create** to save
4. Set as **Active** to use it

### Managing Buckets & Objects

1. Select a saved connection from the dropdown in the top-left sidebar
2. Click a bucket name to open it
3. Use the **Search** bar to filter files and folders
4. Toggle between **List** and **Tiles** view
5. **Upload Files**: Click the upload button to select files and upload them to the current path with progress tracking
6. **Right-click** any file for actions:
   - **Download**: Save to your computer
   - **Edit Metadata**: Modify Content-Type, caching headers, and custom metadata
   - **Edit Tags**: Add or remove S3 object tags
   - **Rename**: Change the file name
   - **Move to bin**: Archive to a `.bin/` folder
   - **Delete**: Permanently remove
   - **Share**: Copy a shareable download link
   - **Copy**: Copy the object key to clipboard
7. Use the **breadcrumb trail** or **Back** button to navigate
8. Use **items-per-page selector** at the bottom to change pagination size (10, 20, 50, or 100)

## Project Structure

```
app/
├── api/                      # Next.js API endpoints
│   ├── buckets/              # List S3 buckets
│   ├── objects/              # List objects in a prefix
│   ├── upload/               # Upload files to S3
│   ├── multipart/            # Multipart upload lifecycle and signed part URLs
│   ├── batch/                # Bulk delete/copy/move/tag operations
│   ├── folders/              # Create/delete folder prefixes
│   ├── metadata/             # Get/set file metadata (Content-Type, caching, custom metadata)
│   ├── tags/                 # Get/set S3 object tags
│   ├── signed-url/           # Generate time-limited pre-signed URLs
│   ├── archive/              # Glacier status and restore initiation
│   ├── bucket-settings/      # Bucket policy, encryption, logging, and public access block
│   ├── access-logs/          # Read configured S3 access logs
│   ├── webhooks/             # Configure outgoing webhook integrations
│   ├── codegen/              # Generate Node/Python/Go S3 snippets
│   ├── cli-export/           # Export awscli or boto3 commands
│   ├── sync/                 # Prefix mirror/sync planning and execution
│   ├── local-sync/           # Local filesystem <-> S3 mirror operations
│   ├── db-seed/              # Export object metadata as SQL seed statements
│   ├── docs/                 # Interactive API descriptor payload
│   ├── delete/               # Delete an object
│   ├── download/             # Download an object
│   ├── move/                 # Copy & delete (rename/move flow)
│   └── connections/          # Connection management (get, create, update, delete, select)
├── components/
│   ├── BucketList.jsx        # Sidebar bucket list with connection dropdown
│   ├── FileExplorer.jsx      # Main file browser with search, view modes, pagination, upload, context menu
│   ├── MetadataModal.jsx     # Modal for editing metadata and S3 object tags
│   └── TreeNode.jsx          # File/folder item renderer for list and grid views
├── lib/
│   ├── s3.js                 # Dynamic S3 client factory (uses active connection)
│   ├── connections-store.js  # Persistent connection storage
│   ├── webhooks-store.js     # Persistent webhook configuration storage
│   └── webhooks.js           # Webhook dispatch helper
├── config/
│   └── page.jsx              # Configuration/settings UI for connections
├── tools/
│   └── page.jsx              # Dedicated tools/security management UI
├── layout.js                 # Root HTML layout
└── page.jsx                  # Home (explorer main page)

public/                        # Static assets (if any)
.connections.json             # Persisted connections file (git-ignored)
next.config.js                # Next.js configuration
jsconfig.json                 # Path alias configuration (@/* → ./*)
package.json                  # Dependencies and scripts
```

## API Endpoints

All endpoints use the currently active connection.

### Connections (`/api/connections`)

- **GET** `/api/connections` – List all saved connections and get active connection ID
- **POST** `/api/connections` – Create a new connection
- **PUT** `/api/connections/[id]` – Update a connection
- **DELETE** `/api/connections/[id]` – Delete a connection
- **POST** `/api/connections/select` – Set active connection (body: `{ id }`)

### S3 Operations

- **GET** `/api/buckets` – List all buckets in the active connection
- **GET** `/api/objects?bucket=<name>&prefix=<path>` – List objects and folders in a bucket/prefix
- **POST** `/api/upload` – Upload a file to S3 (body: FormData with `file`, `bucket`, `prefix`)
- **POST** `/api/multipart` – Multipart upload (`create`, `part-url`, `complete`, `abort` actions)
- **POST** `/api/batch` – Bulk operations (body: `{ bucket, operation, keys, destinationPrefix?, tags? }`)
- **POST** `/api/folders` – Create folder/prefix (body: `{ bucket, prefix, name }`)
- **DELETE** `/api/folders` – Recursively delete folder/prefix (body: `{ bucket, prefix }`)
- **GET/PUT** `/api/metadata?bucket=<name>&key=<path>` – Get/set file metadata (Content-Type, Cache-Control, etc.)
- **GET/PUT** `/api/tags?bucket=<name>&key=<path>` – Get/set S3 object tags
- **POST** `/api/signed-url` – Generate pre-signed URL (body: `{ bucket, key, expiresIn }`)
- **GET/POST** `/api/archive` – Read archive status / initiate restore
- **GET/PUT** `/api/bucket-settings` – Read/update bucket policy, encryption, logging, and public access block
- **GET** `/api/access-logs?bucket=<name>` – List configured access logs
- **GET/POST/DELETE** `/api/webhooks` – Manage event webhooks
- **POST** `/api/codegen` – Generate S3 code snippets (Node/Python/Go)
- **POST** `/api/cli-export` – Export awscli or boto3 commands
- **POST** `/api/sync` – Plan/execute mirror sync between bucket prefixes
- **POST** `/api/local-sync` – Mirror local filesystem directory to/from S3 prefix
- **POST** `/api/webhooks/test` – Send a test event payload to a webhook
- **GET** `/api/db-seed?bucket=<name>&prefix=<path>` – Export SQL seed statements for objects
- **GET** `/api/docs` – API descriptor payload for in-app documentation
- **DELETE** `/api/delete` – Delete an object (body: `{ bucket, key }`)
- **GET** `/api/download?bucket=<name>&key=<path>` – Download an object
- **POST** `/api/move` – Move/rename an object (body: `{ bucket, sourceKey, destinationKey }`)

## Configuration

### Adding a LocalStack Connection

```json
{
  "name": "Local Dev",
  "provider": "localstack",
  "region": "us-east-1",
  "endpoint": "http://localhost:4566",
  "accessKeyId": "test",
  "secretAccessKey": "test",
  "forcePathStyle": true
}
```

### Adding an AWS Connection

```json
{
  "name": "AWS Production",
  "provider": "aws",
  "region": "us-west-2",
  "accessKeyId": "<your-access-key>",
  "secretAccessKey": "<your-secret-key>",
  "forcePathStyle": false
}
```

### Adding an AWS Connection with STS Token

```json
{
  "name": "AWS STS Session",
  "provider": "aws",
  "region": "us-east-1",
  "accessKeyId": "<your-access-key>",
  "secretAccessKey": "<your-secret-key>",
  "sessionToken": "<your-session-token>",
  "forcePathStyle": false
}
```

### Adding an AWS Cross-Account Role Connection

```json
{
  "name": "AWS Cross Account",
  "provider": "aws",
  "region": "us-west-2",
  "accessKeyId": "<your-access-key>",
  "secretAccessKey": "<your-secret-key>",
  "roleArn": "arn:aws:iam::123456789012:role/CrossAccountRole",
  "externalId": "your-external-id",
  "forcePathStyle": false
}
```

Connections are stored locally in `.connections.json` and are **never committed to git** (see `.gitignore`).

## Development

### Available Scripts

```bash
# Start dev server
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

### Building & Deployment

1. Build the project: `npm run build`
2. Deploy the `.next` folder and dependencies to your hosting platform (Vercel, AWS, etc.)
3. Ensure the `.connections.json` file is preserved across deployments (use a mounted volume or database if needed)

### Environment Variables

- `AWS_S3_CUSTOM_ENDPOINT_URL` – Optional default LocalStack endpoint for initial setup (can be overridden via config page)

## Features Roadmap

- [x] Upload files to S3
- [x] S3 object metadata and tags editing
- [x] Pagination with configurable items-per-page
- [x] Batch operations (delete, copy, move, tag)
- [x] Folder operations (create, recursive delete)
- [x] Advanced sorting and filtering
- [x] Signed URLs
- [x] Bucket security settings and access log read APIs
- [x] Multipart upload API
- [x] Archive restore API
- [x] Webhook integration API
- [x] Developer APIs (codegen, CLI export, docs, sync, DB seed)
- [ ] Encrypt stored connection credentials
- [ ] Test connection button
- [ ] Per-connection bucket caching
- [ ] File preview (images, text)
- [ ] S3 bucket statistics
- [ ] Dark mode toggle
- [ ] Keyboard shortcuts

## Troubleshooting

### Port Already in Use

If another process is using port 3000:

```bash
# Kill the process (macOS/Linux)
kill $(lsof -t -i :3000)
# Or specify a different port:
npm run dev -- -p 3001
```

### Connection Issues

- Ensure LocalStack is running on the configured endpoint
- Verify AWS credentials have proper IAM permissions
- Check network connectivity if using remote endpoints

### Missing Buckets

- Ensure the correct connection is selected in the sidebar
- Verify credentials have `s3:ListAllMyBuckets` permission

## Contributing

Pull requests are welcome! Please ensure code passes linting and testing.

## License

MIT

---

**Made with ❤️ for easier S3 exploration**
