const endpoints = [
  { method: "GET", path: "/api/buckets", description: "List buckets" },
  {
    method: "GET",
    path: "/api/objects",
    description: "List objects by bucket/prefix",
  },
  {
    method: "POST",
    path: "/api/upload",
    description: "Upload object (single-part)",
  },
  {
    method: "POST",
    path: "/api/local-sync",
    description: "Mirror local filesystem directory to/from S3 prefix",
  },
  {
    method: "POST",
    path: "/api/multipart",
    description: "Multipart upload create/part-upload/part-url/complete/abort",
  },
  {
    method: "POST",
    path: "/api/batch",
    description: "Bulk delete/copy/move/tag operations",
  },
  {
    method: "POST",
    path: "/api/folders",
    description: "Create folder (prefix)",
  },
  {
    method: "DELETE",
    path: "/api/folders",
    description: "Delete folder recursively by prefix",
  },
  {
    method: "POST",
    path: "/api/signed-url",
    description: "Generate pre-signed download URL",
  },
  {
    method: "GET",
    path: "/api/archive",
    description: "Get Glacier archive/restore status",
  },
  {
    method: "POST",
    path: "/api/archive",
    description: "Initiate Glacier restore",
  },
  {
    method: "GET",
    path: "/api/bucket-settings",
    description: "Read bucket policy/security/logging",
  },
  {
    method: "PUT",
    path: "/api/bucket-settings",
    description: "Update bucket policy/security/logging",
  },
  {
    method: "GET",
    path: "/api/access-logs",
    description: "List access logs from logging target",
  },
  {
    method: "POST",
    path: "/api/codegen",
    description: "Generate language snippets",
  },
  {
    method: "POST",
    path: "/api/cli-export",
    description: "Generate AWS CLI or boto3 commands",
  },
  {
    method: "GET",
    path: "/api/webhooks",
    description: "List configured webhooks",
  },
  { method: "POST", path: "/api/webhooks", description: "Create webhook" },
  { method: "DELETE", path: "/api/webhooks", description: "Delete webhook" },
  {
    method: "POST",
    path: "/api/webhooks/test",
    description: "Send test payload to webhook URL",
  },
];

export async function GET() {
  return Response.json({
    name: "S3 Explorer API",
    version: "1.0.0",
    endpoints,
  });
}
