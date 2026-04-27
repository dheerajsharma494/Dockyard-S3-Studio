'use client';
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const LOCALSTACK_DEFAULT_ENDPOINT = "http://localhost:4566";
const BACKBLAZE_DEFAULT_REGION = "us-east-005";
const WASABI_DEFAULT_REGION = "us-east-1";
const DIGITALOCEAN_DEFAULT_REGION = "nyc3";
const LINODE_DEFAULT_REGION = "us-east-1";
const ORACLE_DEFAULT_REGION = "us-ashburn-1";
const IBM_COS_DEFAULT_REGION = "us-south";

const PROVIDERS = [
  { id: "localstack", label: "LocalStack" },
  { id: "aws", label: "AWS" },
  { id: "backblaze", label: "Backblaze B2" },
  { id: "cloudflare-r2", label: "Cloudflare R2" },
  { id: "wasabi", label: "Wasabi" },
  { id: "digitalocean-spaces", label: "DO Spaces" },
  { id: "minio", label: "MinIO" },
  { id: "linode-object-storage", label: "Linode Object" },
  { id: "oracle-object-storage", label: "Oracle Object" },
  { id: "ibm-cos", label: "IBM COS" },
];

const PROVIDER_LABELS = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider.label]),
);

function getBackblazeEndpoint(region) {
  return `https://s3.${region || BACKBLAZE_DEFAULT_REGION}.backblazeb2.com`;
}

function getWasabiEndpoint(region) {
  return `https://s3.${region || WASABI_DEFAULT_REGION}.wasabisys.com`;
}

function getDigitalOceanSpacesEndpoint(region) {
  return `https://${region || DIGITALOCEAN_DEFAULT_REGION}.digitaloceanspaces.com`;
}

function getLinodeObjectStorageEndpoint(region) {
  return `https://${region || LINODE_DEFAULT_REGION}.linodeobjects.com`;
}

function getCloudflareR2Endpoint() {
  return "https://<account-id>.r2.cloudflarestorage.com";
}

function getOracleObjectStorageEndpoint(region) {
  return `https://<namespace>.compat.objectstorage.${region || ORACLE_DEFAULT_REGION}.oraclecloud.com`;
}

function getIbmCosEndpoint(region) {
  return `https://s3.${region || IBM_COS_DEFAULT_REGION}.cloud-object-storage.appdomain.cloud`;
}

function getProviderDefaults(provider, previous) {
  if (provider === "aws") {
    return {
      region: previous.region,
      endpoint: "",
      forcePathStyle: Boolean(previous.forcePathStyle),
    };
  }

  if (provider === "backblaze") {
    const region =
      !previous.region || previous.region === "us-east-1"
        ? BACKBLAZE_DEFAULT_REGION
        : previous.region;

    return {
      region,
      endpoint:
        previous.provider === "backblaze" && previous.endpoint
          ? previous.endpoint
          : getBackblazeEndpoint(region),
      forcePathStyle: false,
    };
  }

  if (provider === "cloudflare-r2") {
    return {
      region: "auto",
      endpoint:
        previous.provider === "cloudflare-r2" && previous.endpoint
          ? previous.endpoint
          : getCloudflareR2Endpoint(),
      forcePathStyle: false,
    };
  }

  if (provider === "wasabi") {
    const region =
      !previous.region || previous.region === "us-east-1"
        ? WASABI_DEFAULT_REGION
        : previous.region;

    return {
      region,
      endpoint:
        previous.provider === "wasabi" && previous.endpoint
          ? previous.endpoint
          : getWasabiEndpoint(region),
      forcePathStyle: false,
    };
  }

  if (provider === "digitalocean-spaces") {
    const region =
      !previous.region || previous.region === "us-east-1"
        ? DIGITALOCEAN_DEFAULT_REGION
        : previous.region;

    return {
      region,
      endpoint:
        previous.provider === "digitalocean-spaces" && previous.endpoint
          ? previous.endpoint
          : getDigitalOceanSpacesEndpoint(region),
      forcePathStyle: false,
    };
  }

  if (provider === "minio") {
    return {
      region: previous.region || "us-east-1",
      endpoint:
        previous.provider === "minio" && previous.endpoint
          ? previous.endpoint
          : "http://localhost:9000",
      forcePathStyle: true,
    };
  }

  if (provider === "linode-object-storage") {
    const region =
      !previous.region || previous.region === "us-east-1"
        ? LINODE_DEFAULT_REGION
        : previous.region;

    return {
      region,
      endpoint:
        previous.provider === "linode-object-storage" && previous.endpoint
          ? previous.endpoint
          : getLinodeObjectStorageEndpoint(region),
      forcePathStyle: false,
    };
  }

  if (provider === "oracle-object-storage") {
    const region =
      !previous.region || previous.region === "us-east-1"
        ? ORACLE_DEFAULT_REGION
        : previous.region;

    return {
      region,
      endpoint:
        previous.provider === "oracle-object-storage" && previous.endpoint
          ? previous.endpoint
          : getOracleObjectStorageEndpoint(region),
      forcePathStyle: false,
    };
  }

  if (provider === "ibm-cos") {
    const region =
      !previous.region || previous.region === "us-east-1"
        ? IBM_COS_DEFAULT_REGION
        : previous.region;

    return {
      region,
      endpoint:
        previous.provider === "ibm-cos" && previous.endpoint
          ? previous.endpoint
          : getIbmCosEndpoint(region),
      forcePathStyle: false,
    };
  }

  return {
    region: previous.region || "us-east-1",
    endpoint: previous.endpoint || LOCALSTACK_DEFAULT_ENDPOINT,
    forcePathStyle: true,
  };
}

function normalizeEndpoint(endpoint) {
  const value = (endpoint || "").trim();

  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}

function parseAwsExports(input) {
  const values = {};
  const lines = String(input || "").split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(
      /^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s#]+))\s*$/,
    );

    if (!match) {
      continue;
    }

    const key = match[1];
    const value = match[2] ?? match[3] ?? match[4] ?? "";
    values[key] = value;
  }

  const result = {
    accessKeyId: values.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: values.AWS_SECRET_ACCESS_KEY || "",
    sessionToken: values.AWS_SESSION_TOKEN || "",
    region: values.AWS_REGION || values.AWS_DEFAULT_REGION || "",
  };

  const mappedCount = Object.values(result).filter(Boolean).length;
  return { result, mappedCount };
}

function ProviderIcon({ provider }) {
  if (provider === "aws") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#111827" stroke="#2b3c54" />
        <text x="15" y="18" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ff9900" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
          aws
        </text>
      </svg>
    );
  }

  if (provider === "backblaze") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#1a0f12" stroke="#4a2630" />
        <path d="M15 6 C18 9, 19 11, 19 14 C19 17, 17 19, 15 21 C13 19, 11 17, 11 14 C11 11, 12 9, 15 6 Z" fill="#e21b23" />
      </svg>
    );
  }

  if (provider === "cloudflare-r2") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#1a1409" stroke="#5f4c22" />
        <path d="M7 17.5 C8.5 14.5, 12 13.5, 15.5 14.2 C18.2 14.7, 20.4 16.3, 22.2 18.5 L7 18.5 Z" fill="#f59e0b" />
        <path d="M9.5 20 C10.7 18.6, 12.8 17.8, 14.8 18 C16.8 18.2, 18.5 19.1, 20 20.5 L9.5 20.5 Z" fill="#fb923c" />
      </svg>
    );
  }

  if (provider === "wasabi") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#11161d" stroke="#2f455f" />
        <text x="15" y="19" textAnchor="middle" fontSize="8" fontWeight="700" fill="#8ab6ff" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
          WASABI
        </text>
      </svg>
    );
  }

  if (provider === "digitalocean-spaces") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#0a1f3a" stroke="#1f4f87" />
        <circle cx="14" cy="15" r="5.6" fill="#1f8bff" />
        <circle cx="20.8" cy="15" r="1.8" fill="#1f8bff" />
      </svg>
    );
  }

  if (provider === "minio") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#1d0f14" stroke="#59303d" />
        <text x="15" y="19" textAnchor="middle" fontSize="10" fontWeight="700" fill="#c12a44" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
          M
        </text>
      </svg>
    );
  }

  if (provider === "linode-object-storage") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#0f2012" stroke="#2b5b33" />
        <path d="M9 20 C10.5 16.8, 12 13.8, 13.5 10.5" stroke="#78d64b" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M16.2 20 C17.3 17.8, 18.4 15.6, 19.5 13.4" stroke="#78d64b" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    );
  }

  if (provider === "oracle-object-storage") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#200f12" stroke="#5e2d36" />
        <text x="15" y="19" textAnchor="middle" fontSize="8" fontWeight="700" fill="#f44336" style={{ fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif" }}>
          OCI
        </text>
      </svg>
    );
  }

  if (provider === "ibm-cos") {
    return (
      <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
        <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#0f1a2a" stroke="#2f4f75" />
        <path d="M10 10 H20 V20 H10 Z" fill="none" stroke="#66b0ff" strokeWidth="1.7" />
        <path d="M12 12 H18 V18 H12 Z" fill="none" stroke="#66b0ff" strokeWidth="1.4" />
      </svg>
    );
  }

  return (
    <svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">
      <rect x="1.5" y="1.5" width="27" height="27" rx="7" fill="#0d1a2a" stroke="#2b4f78" />
      <rect x="7" y="8" width="16" height="4" rx="2" fill="#4fb6ff" />
      <rect x="7" y="13" width="16" height="4" rx="2" fill="#2f9eea" />
      <rect x="7" y="18" width="16" height="4" rx="2" fill="#1c7fcc" />
    </svg>
  );
}

function ProviderTiles({ provider, onSelect }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10 }}>
      {PROVIDERS.map((item) => {
        const isActive = provider === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            style={{
              border: isActive
                ? "1px solid rgba(43, 210, 201, 0.7)"
                : "1px solid rgba(146, 184, 224, 0.25)",
              background: isActive
                ? "linear-gradient(160deg, rgba(43, 210, 201, 0.2), rgba(125, 224, 255, 0.18))"
                : "rgba(10, 19, 33, 0.72)",
              borderRadius: 10,
              padding: "10px 8px",
              cursor: "pointer",
              color: "#dcecff",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
            }}
            aria-pressed={isActive}
            title={item.label}
          >
            <ProviderIcon provider={item.id} />
            <span style={{ fontSize: 12, fontWeight: 700 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ProviderHelp({ provider, region }) {
  const [copyStatus, setCopyStatus] = useState("");

  const copyTemplate = async (value) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyStatus("Template copied.");
    } catch {
      setCopyStatus("Copy failed. Please copy manually.");
    }
  };

  const renderCopyButton = (value) => (
    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        onClick={() => copyTemplate(value)}
        style={{
          border: "1px solid rgba(146, 184, 224, 0.28)",
          background: "rgba(10, 19, 33, 0.85)",
          color: "#dcecff",
          borderRadius: 8,
          padding: "5px 10px",
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        Copy Endpoint Template
      </button>
      {copyStatus && <span style={{ fontSize: 12, color: "#9db4d1" }}>{copyStatus}</span>}
    </div>
  );

  if (provider === "backblaze") {
    const template = getBackblazeEndpoint(region || BACKBLAZE_DEFAULT_REGION);
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>Backblaze B2 Tips</div>
        <div>Endpoint pattern: {template}</div>
        <div>Common regions: us-east-005, us-west-004, eu-central-003.</div>
        <div>Use Backblaze Application Key ID and Application Key as your credentials.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  if (provider === "aws") {
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>AWS Tips</div>
        <div>Endpoint is not required for AWS and will be left empty.</div>
        <div>Examples: us-east-1, eu-west-1, ap-south-1.</div>
        <div>Use IAM access keys, or add a temporary session token if needed.</div>
      </div>
    );
  }

  if (provider === "cloudflare-r2") {
    const template = getCloudflareR2Endpoint();
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>Cloudflare R2 Tips</div>
        <div>Endpoint pattern: {template}</div>
        <div>Use region auto. No data egress fees for most internet traffic.</div>
        <div>Use R2 Access Key ID and Secret Access Key.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  if (provider === "wasabi") {
    const template = getWasabiEndpoint(region || WASABI_DEFAULT_REGION);
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>Wasabi Tips</div>
        <div>Endpoint pattern: {template}</div>
        <div>Common regions: us-east-1, us-west-1, eu-central-1.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  if (provider === "digitalocean-spaces") {
    const template = getDigitalOceanSpacesEndpoint(
      region || DIGITALOCEAN_DEFAULT_REGION,
    );
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>DigitalOcean Spaces Tips</div>
        <div>Endpoint pattern: {template}</div>
        <div>Common regions: nyc3, sfo3, ams3, sgp1.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  if (provider === "minio") {
    const template = "http://localhost:9000";
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>MinIO Tips</div>
        <div>Typical local endpoint: {template}</div>
        <div>Force path style is recommended for MinIO.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  if (provider === "linode-object-storage") {
    const template = getLinodeObjectStorageEndpoint(
      region || LINODE_DEFAULT_REGION,
    );
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>Linode Object Storage Tips</div>
        <div>Endpoint pattern: {template}</div>
        <div>Common regions: us-east-1, us-southeast-1, eu-central-1.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  if (provider === "oracle-object-storage") {
    const template = getOracleObjectStorageEndpoint(region || ORACLE_DEFAULT_REGION);
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>Oracle Object Storage Tips</div>
        <div>Endpoint pattern: {template}</div>
        <div>Replace &lt;namespace&gt; with your Oracle Object Storage namespace.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  if (provider === "ibm-cos") {
    const template = getIbmCosEndpoint(region || IBM_COS_DEFAULT_REGION);
    return (
      <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
        <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>IBM Cloud Object Storage Tips</div>
        <div>Endpoint pattern: {template}</div>
        <div>Common regions: us-south, eu-de, eu-gb, au-syd.</div>
        {renderCopyButton(template)}
      </div>
    );
  }

  const localstackTemplate = LOCALSTACK_DEFAULT_ENDPOINT;
  return (
    <div style={{ marginTop: -2, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)", color: "#b7cbe4", fontSize: 12, lineHeight: 1.45 }}>
      <div style={{ color: "#dcecff", fontWeight: 700, marginBottom: 4 }}>LocalStack Tips</div>
      <div>Endpoint usually: {localstackTemplate}</div>
      <div>Recommended region: us-east-1.</div>
      <div>Defaults are typically access key test and secret key test.</div>
      {renderCopyButton(localstackTemplate)}
    </div>
  );
}

const emptyForm = {
  name: "",
  provider: "localstack",
  region: "us-east-1",
  endpoint: LOCALSTACK_DEFAULT_ENDPOINT,
  accessKeyId: "test",
  secretAccessKey: "test",
  sessionToken: "",
  roleArn: "",
  externalId: "",
  forcePathStyle: true,
};

export default function ConfigPage() {
  const [connections, setConnections] = useState([]);
  const [activeConnectionId, setActiveConnectionId] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [awsExportInput, setAwsExportInput] = useState("");
  const [awsExportStatus, setAwsExportStatus] = useState("");

  const activeConnection = useMemo(
    () => connections.find((item) => item.id === activeConnectionId),
    [connections, activeConnectionId],
  );

  const loadConnections = async () => {
    const res = await fetch("/api/connections", { cache: "no-store" });
    const data = await res.json();
    setConnections(data.connections || []);
    setActiveConnectionId(data.activeConnectionId || "");
  };

  useEffect(() => {
    loadConnections();
  }, []);

  useEffect(() => {
    setTestResult(null);
  }, [form]);

  const resetForm = () => {
    setEditingId(null);
    setForm(emptyForm);
    setTestResult(null);
    setAwsExportInput("");
    setAwsExportStatus("");
  };

  const startEdit = (connection) => {
    setEditingId(connection.id);
    setForm({
      name: connection.name,
      provider: connection.provider,
      region: connection.region,
      endpoint: connection.endpoint || "",
      accessKeyId: connection.accessKeyId || "",
      secretAccessKey: connection.secretAccessKey || "",
      sessionToken: connection.sessionToken || "",
      roleArn: connection.roleArn || "",
      externalId: connection.externalId || "",
      forcePathStyle: Boolean(connection.forcePathStyle),
    });
    setTestResult(null);
    setAwsExportInput("");
    setAwsExportStatus("");
  };

  const applyAwsExportSnippet = () => {
    const { result, mappedCount } = parseAwsExports(awsExportInput);

    if (mappedCount === 0) {
      setAwsExportStatus("No AWS export variables found.");
      return;
    }

    setForm((prev) => ({
      ...prev,
      accessKeyId: result.accessKeyId || prev.accessKeyId,
      secretAccessKey: result.secretAccessKey || prev.secretAccessKey,
      sessionToken: result.sessionToken || prev.sessionToken,
      region: result.region || prev.region,
    }));

    setAwsExportStatus(
      `Applied ${mappedCount} value${mappedCount === 1 ? "" : "s"} from snippet.`,
    );
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const payload = {
        ...form,
        endpoint:
          form.provider === "aws" ? "" : normalizeEndpoint(form.endpoint),
        forcePathStyle: form.provider === "localstack" ? true : form.forcePathStyle,
      };

      const res = await fetch("/api/connections/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      setTestResult({
        ok: Boolean(data.ok),
        warning: Boolean(data.warning),
        message: data.message || (res.ok ? "Connection successful." : "Connection test failed."),
      });
    } catch (error) {
      setTestResult({ ok: false, warning: false, message: error.message || "Connection test failed." });
    } finally {
      setTesting(false);
    }
  };

  const submitForm = async (e) => {
    e.preventDefault();

    if (!testResult?.ok) {
      setTestResult({
        ok: false,
        warning: false,
        message: "Please test the connection successfully before saving.",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        endpoint:
          form.provider === "aws" ? "" : normalizeEndpoint(form.endpoint),
        forcePathStyle: form.provider === "localstack" ? true : form.forcePathStyle,
      };

      if (editingId) {
        const res = await fetch(`/api/connections/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to update connection");
        }
      } else {
        const res = await fetch("/api/connections", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Failed to create connection");
        }
      }

      await loadConnections();
      resetForm();
      setSaving(false);
    } catch (error) {
      setSaving(false);
      setTestResult({
        ok: false,
        warning: false,
        message: error.message || "Failed to save connection.",
      });
    }
  };

  const selectActive = async (id) => {
    await fetch("/api/connections/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setActiveConnectionId(id);
  };

  const removeConnection = async (id) => {
    if (!confirm("Delete this connection?")) {
      return;
    }

    const res = await fetch(`/api/connections/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete connection");
      return;
    }

    await loadConnections();

    if (editingId === id) {
      resetForm();
    }
  };

  return (
    <div className="app-shell">
      <div className="app-panel" style={{ maxWidth: 1150, margin: "0 auto", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div className="brand-mark" style={{ marginBottom: 8 }}>
              <span className="glyph">DS</span>
              <span>
                <span className="name" style={{ display: "block" }}>Dockyard S3 Studio</span>
                <span className="tag">Connection Configuration</span>
              </span>
            </div>
            <p style={{ margin: "8px 0 0", fontSize: 14, color: "#9db4d1" }}>
              Manage S3-compatible providers, validate credentials, and switch active connection.
            </p>
          </div>
          <Link
            href="/"
            style={{
              background: "rgba(18, 30, 47, 0.78)",
              border: "1px solid rgba(146, 184, 224, 0.25)",
              borderRadius: 10,
              padding: "8px 12px",
              textDecoration: "none",
              color: "#dcecff",
              fontSize: 13,
            }}
          >
            Back to Explorer
          </Link>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
          <div style={{ background: "rgba(10, 19, 33, 0.8)", border: "1px solid rgba(146, 184, 224, 0.22)", borderRadius: 14, overflow: "hidden", backdropFilter: "blur(8px)" }}>
            <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(146, 184, 224, 0.18)", fontWeight: 700, color: "#dcecff" }}>
              Saved Connections
            </div>
            <div>
              {connections.length === 0 && (
                <div style={{ padding: 16, color: "#91aac9" }}>No saved connections yet.</div>
              )}
              {connections.map((connection) => (
                <div
                  key={connection.id}
                  style={{
                    padding: "12px 16px",
                    borderBottom: "1px solid rgba(146, 184, 224, 0.12)",
                    background: activeConnectionId === connection.id ? "rgba(43, 210, 201, 0.12)" : "transparent",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontWeight: 700, color: "#e6f2ff" }}>{connection.name}</div>
                      <div style={{ fontSize: 12, color: "#91aac9", marginTop: 2 }}>
                        {(PROVIDER_LABELS[connection.provider] || connection.provider.toUpperCase())} · {connection.region}
                        {connection.endpoint ? ` · ${connection.endpoint}` : ""}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => selectActive(connection.id)}
                        style={{
                          border: "1px solid rgba(146, 184, 224, 0.25)",
                          background: activeConnectionId === connection.id ? "linear-gradient(140deg, #2bd2c9, #7de0ff)" : "rgba(18, 30, 47, 0.72)",
                          color: activeConnectionId === connection.id ? "#041019" : "#dcecff",
                          borderRadius: 8,
                          padding: "4px 10px",
                          fontSize: 12,
                          cursor: "pointer",
                          fontWeight: 600,
                        }}
                      >
                        {activeConnectionId === connection.id ? "Active" : "Set Active"}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(connection)}
                        style={{
                          border: "1px solid rgba(146, 184, 224, 0.25)",
                          background: "rgba(18, 30, 47, 0.72)",
                          color: "#dcecff",
                          borderRadius: 8,
                          padding: "4px 10px",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeConnection(connection.id)}
                        style={{
                          border: "1px solid rgba(255, 107, 129, 0.35)",
                          background: "rgba(62, 21, 30, 0.4)",
                          color: "#ff9aaa",
                          borderRadius: 8,
                          padding: "4px 10px",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <form
            onSubmit={submitForm}
            style={{
              background: "rgba(10, 19, 33, 0.8)",
              border: "1px solid rgba(146, 184, 224, 0.22)",
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
              backdropFilter: "blur(8px)",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, color: "#dcecff" }}>
                {editingId ? "Edit Connection" : "Create New Connection"}
              </div>
              {editingId && (
                <div style={{ fontSize: 12, color: "#91aac9", marginTop: 4 }}>
                  Editing: <strong>{form.name || "Untitled"}</strong>
                </div>
              )}
            </div>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
              Name
              <input
                required
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 13, color: "#cfe4ff" }}>Provider</div>
              <ProviderTiles
                provider={form.provider}
                onSelect={(provider) =>
                  setForm((prev) => ({
                    ...prev,
                    provider,
                    ...getProviderDefaults(provider, prev),
                  }))
                }
              />
            </div>

            <ProviderHelp provider={form.provider} region={form.region} />

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
              Region
              <input
                required
                value={form.region}
                onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
                style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
            </label>

            {form.provider !== "aws" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                Endpoint
                <input
                  required
                  value={form.endpoint}
                  onChange={(e) => setForm((prev) => ({ ...prev, endpoint: e.target.value }))}
                  onBlur={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      endpoint: normalizeEndpoint(e.target.value),
                    }))
                  }
                  placeholder={
                    form.provider === "backblaze"
                      ? getBackblazeEndpoint(form.region)
                      : LOCALSTACK_DEFAULT_ENDPOINT
                  }
                  style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                />
              </label>
            )}

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
              Access Key ID
              <input
                required
                value={form.accessKeyId}
                onChange={(e) => setForm((prev) => ({ ...prev, accessKeyId: e.target.value }))}
                style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
              Secret Access Key
              <input
                required
                type="password"
                value={form.secretAccessKey}
                onChange={(e) => setForm((prev) => ({ ...prev, secretAccessKey: e.target.value }))}
                style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
            </label>

            {form.provider !== "localstack" && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cfe4ff" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.forcePathStyle)}
                    onChange={(e) => setForm((prev) => ({ ...prev, forcePathStyle: e.target.checked }))}
                  />
                  Force Path Style
                </label>

                {form.provider === "aws" && (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "10px 12px", borderRadius: 8, border: "1px solid rgba(146, 184, 224, 0.2)", background: "rgba(14, 25, 41, 0.72)" }}>
                      <div style={{ fontSize: 12, color: "#dcecff", fontWeight: 700 }}>
                        Paste AWS Export Snippet
                      </div>
                      <textarea
                        value={awsExportInput}
                        onChange={(e) => {
                          setAwsExportInput(e.target.value);
                          setAwsExportStatus("");
                        }}
                        placeholder={[
                          'export AWS_ACCESS_KEY_ID="..."',
                          'export AWS_SECRET_ACCESS_KEY="..."',
                          'export AWS_SESSION_TOKEN="..."',
                          'export AWS_REGION="us-east-1"',
                        ].join("\n")}
                        rows={4}
                        style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace", resize: "vertical", color: "#dcecff", background: "rgba(10, 19, 33, 0.9)" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={applyAwsExportSnippet}
                          style={{ border: "1px solid rgba(146, 184, 224, 0.25)", background: "rgba(10, 19, 33, 0.85)", color: "#dcecff", borderRadius: 8, padding: "6px 10px", fontSize: 12, cursor: "pointer" }}
                        >
                          Apply Snippet
                        </button>
                        {awsExportStatus && (
                          <span style={{ fontSize: 12, color: "#9db4d1" }}>{awsExportStatus}</span>
                        )}
                      </div>
                    </div>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                      Session Token
                      <input
                        type="password"
                        value={form.sessionToken || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, sessionToken: e.target.value }))}
                        placeholder="Optional - for temporary credentials"
                        style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                      Role ARN
                      <input
                        type="text"
                        value={form.roleArn || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, roleArn: e.target.value }))}
                        placeholder="Optional - arn:aws:iam::123456789012:role/RoleName"
                        style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                      />
                    </label>

                    <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                      External ID
                      <input
                        type="text"
                        value={form.externalId || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, externalId: e.target.value }))}
                        placeholder="Optional - for cross-account access"
                        style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
                      />
                    </label>
                  </>
                )}
              </>
            )}

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={testConnection}
                disabled={testing || saving}
                style={{
                  border: "1px solid rgba(146, 184, 224, 0.25)",
                  background: "rgba(10, 19, 33, 0.85)",
                  color: "#dcecff",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  cursor: testing || saving ? "not-allowed" : "pointer",
                  opacity: testing || saving ? 0.7 : 1,
                }}
              >
                {testing ? "Testing..." : "Test Connection"}
              </button>
              <button
                type="submit"
                disabled={saving || testing}
                style={{
                  border: "none",
                  background: "#2bd2c9",
                  color: "rgba(10, 19, 33, 0.85)",
                  borderRadius: 8,
                  padding: "8px 12px",
                  fontSize: 13,
                  cursor: saving || testing ? "not-allowed" : "pointer",
                  opacity: saving || testing ? 0.7 : 1,
                }}
              >
                {saving ? "Saving..." : editingId ? "Update Connection" : "Create Connection"}
              </button>
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    border: "1px solid rgba(146, 184, 224, 0.25)",
                    background: "rgba(10, 19, 33, 0.85)",
                    color: "#dcecff",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Cancel Edit
                </button>
              )}
              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  style={{
                    border: "1px solid rgba(146, 184, 224, 0.22)",
                    background: "rgba(12, 22, 37, 0.75)",
                    color: "#9db4d1",
                    borderRadius: 8,
                    padding: "8px 12px",
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  Create New
                </button>
              )}
            </div>

            {testResult && (
              <div
                style={{
                  marginTop: 6,
                  padding: "10px 12px",
                  borderRadius: 6,
                  fontSize: 12,
                  border: testResult.ok
                    ? (testResult.warning ? "1px solid rgba(255, 207, 122, 0.45)" : "1px solid rgba(49, 196, 141, 0.45)")
                    : "1px solid rgba(255, 107, 129, 0.45)",
                  background: testResult.ok
                    ? (testResult.warning ? "rgba(255, 207, 122, 0.12)" : "rgba(49, 196, 141, 0.12)")
                    : "rgba(255, 107, 129, 0.12)",
                  color: testResult.ok
                    ? (testResult.warning ? "#ffd28a" : "#7df5c8")
                    : "#ff9aaa",
                }}
              >
                {testResult.message}
              </div>
            )}

            {!testResult?.ok && (
              <div style={{ fontSize: 12, color: "#7f4c00" }}>
                Run Test Connection before creating or updating this profile.
              </div>
            )}

            <div style={{ marginTop: 8, padding: "10px 12px", background: "rgba(43, 210, 201, 0.14)", borderRadius: 6, fontSize: 12, color: "#cde9ff" }}>
              <strong>Active:</strong> {activeConnection ? `${activeConnection.name} (${PROVIDER_LABELS[activeConnection.provider] || activeConnection.provider})` : "None selected"}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
