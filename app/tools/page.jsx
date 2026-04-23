'use client';
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const defaultPublicBlock = {
  BlockPublicAcls: true,
  IgnorePublicAcls: true,
  BlockPublicPolicy: true,
  RestrictPublicBuckets: true,
};

export default function ToolsPage() {
  const [buckets, setBuckets] = useState([]);
  const [selectedBucket, setSelectedBucket] = useState("");
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [policyText, setPolicyText] = useState("");
  const [encryptionMode, setEncryptionMode] = useState("none");
  const [kmsKeyId, setKmsKeyId] = useState("");
  const [publicBlock, setPublicBlock] = useState(defaultPublicBlock);
  const [logTargetBucket, setLogTargetBucket] = useState("");
  const [logTargetPrefix, setLogTargetPrefix] = useState("");

  const [webhooks, setWebhooks] = useState([]);
  const [newWebhookUrl, setNewWebhookUrl] = useState("");
  const [newWebhookEvent, setNewWebhookEvent] = useState("*");

  const [localPath, setLocalPath] = useState("");
  const [syncPrefix, setSyncPrefix] = useState("");
  const [syncDryRun, setSyncDryRun] = useState(true);
  const [syncResult, setSyncResult] = useState("");

  const canSaveSettings = useMemo(() => Boolean(selectedBucket), [selectedBucket]);

  const loadBuckets = async () => {
    const res = await fetch("/api/buckets");
    if (!res.ok) {
      setBuckets([]);
      return;
    }
    const data = await res.json();
    setBuckets(data || []);
    if (!selectedBucket && data?.[0]?.Name) {
      setSelectedBucket(data[0].Name);
    }
  };

  const loadWebhooks = async () => {
    const res = await fetch("/api/webhooks");
    const data = await res.json();
    setWebhooks(data.webhooks || []);
  };

  const loadBucketSettings = async (bucket) => {
    if (!bucket) return;
    setLoadingSettings(true);
    const res = await fetch(`/api/bucket-settings?bucket=${encodeURIComponent(bucket)}`);
    const data = await res.json();
    setLoadingSettings(false);

    if (!res.ok) {
      alert(data.error || "Failed to load bucket settings");
      return;
    }

    setPolicyText(data.policy ? JSON.stringify(data.policy, null, 2) : "");

    const rule = data.encryption?.Rules?.[0]?.ApplyServerSideEncryptionByDefault;
    if (!rule) {
      setEncryptionMode("none");
      setKmsKeyId("");
    } else if (rule.SSEAlgorithm === "aws:kms") {
      setEncryptionMode("aws:kms");
      setKmsKeyId(rule.KMSMasterKeyID || "");
    } else {
      setEncryptionMode("AES256");
      setKmsKeyId("");
    }

    setPublicBlock({ ...defaultPublicBlock, ...(data.publicAccessBlock || {}) });
    setLogTargetBucket(data.logging?.TargetBucket || "");
    setLogTargetPrefix(data.logging?.TargetPrefix || "");
  };

  useEffect(() => {
    loadBuckets();
    loadWebhooks();
  }, []);

  useEffect(() => {
    if (selectedBucket) {
      loadBucketSettings(selectedBucket);
    }
  }, [selectedBucket]);

  const saveBucketSettings = async () => {
    if (!selectedBucket) return;

    let parsedPolicy = null;
    if (policyText.trim()) {
      try {
        parsedPolicy = JSON.parse(policyText);
      } catch {
        alert("Policy JSON is invalid");
        return;
      }
    }

    let encryption = null;
    let clearEncryption = false;
    if (encryptionMode === "none") {
      clearEncryption = true;
    } else {
      encryption = {
        Rules: [
          {
            ApplyServerSideEncryptionByDefault:
              encryptionMode === "aws:kms"
                ? { SSEAlgorithm: "aws:kms", KMSMasterKeyID: kmsKeyId || undefined }
                : { SSEAlgorithm: "AES256" },
          },
        ],
      };
    }

    const payload = {
      bucket: selectedBucket,
      publicAccessBlock: publicBlock,
      clearPolicy: !parsedPolicy,
      clearEncryption,
      clearLogging: !logTargetBucket,
    };

    if (parsedPolicy) payload.policy = parsedPolicy;
    if (encryption) payload.encryption = encryption;
    if (logTargetBucket) {
      payload.logging = {
        TargetBucket: logTargetBucket,
        TargetPrefix: logTargetPrefix || "",
      };
    }

    const res = await fetch("/api/bucket-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to save settings");
      return;
    }

    alert("Bucket settings saved.");
    loadBucketSettings(selectedBucket);
  };

  const addWebhook = async () => {
    if (!newWebhookUrl) return;
    const res = await fetch("/api/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: newWebhookUrl, event: newWebhookEvent, enabled: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Failed to add webhook");
      return;
    }
    setNewWebhookUrl("");
    setNewWebhookEvent("*");
    loadWebhooks();
  };

  const deleteWebhook = async (id) => {
    const res = await fetch("/api/webhooks", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      alert(data.error || "Failed to delete webhook");
      return;
    }
    loadWebhooks();
  };

  const testWebhook = async (id) => {
    const res = await fetch("/api/webhooks/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Webhook test failed");
      return;
    }
    alert(`Webhook test status: ${data.status} ${data.statusText}`);
  };

  const runLocalSync = async (action) => {
    if (!selectedBucket || !localPath) {
      alert("Select a bucket and provide local path.");
      return;
    }
    const res = await fetch("/api/local-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, bucket: selectedBucket, prefix: syncPrefix, localPath, dryRun: syncDryRun }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "Local sync failed");
      return;
    }
    setSyncResult(`${action.toUpperCase()} ${syncDryRun ? "preview" : "completed"}: ${data.count} file(s)`);
  };

  return (
    <div className="app-shell">
      <div className="app-panel" style={{ maxWidth: 1220, margin: "0 auto", display: "grid", gap: 16, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="brand-mark" style={{ marginBottom: 8 }}>
              <span className="glyph">DS</span>
              <span>
                <span className="name" style={{ display: "block" }}>Dockyard S3 Studio</span>
                <span className="tag">Tools + Security</span>
              </span>
            </div>
            <p style={{ margin: "8px 0 0", color: "#9db4d1", fontSize: 14 }}>
              Manage bucket security, webhooks, and local filesystem sync.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <Link href="/" style={{ textDecoration: "none", color: "#dcecff", background: "rgba(18, 30, 47, 0.78)", border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
              Back to Explorer
            </Link>
            <Link href="/config" style={{ textDecoration: "none", color: "#dcecff", background: "rgba(18, 30, 47, 0.78)", border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}>
              Connections
            </Link>
          </div>
        </div>

        <div style={{ background: "rgba(10, 19, 33, 0.82)", border: "1px solid rgba(146, 184, 224, 0.22)", borderRadius: 14, padding: 16 }}>
          <div style={{ marginBottom: 10, color: "#dcecff", fontWeight: 700 }}>Bucket</div>
          <select
            value={selectedBucket}
            onChange={(e) => setSelectedBucket(e.target.value)}
            style={{ width: "100%", maxWidth: 420, border: "1px solid rgba(146, 184, 224, 0.25)", background: "rgba(8, 16, 28, 0.88)", color: "#dcecff", borderRadius: 10, padding: "8px 10px", fontSize: 13 }}
          >
            <option value="">Select bucket</option>
            {buckets.map((b) => (
              <option key={b.Name} value={b.Name}>{b.Name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <section style={{ background: "rgba(10, 19, 33, 0.82)", border: "1px solid rgba(146, 184, 224, 0.22)", borderRadius: 14, padding: 16 }}>
            <h2 style={{ margin: 0, marginBottom: 12, color: "#dcecff", fontSize: 18 }}>Bucket Security Settings</h2>
            {loadingSettings ? <div style={{ color: "#91aac9", fontSize: 13 }}>Loading settings...</div> : null}

            <div style={{ display: "grid", gap: 10 }}>
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                Bucket Policy JSON
                <textarea
                  value={policyText}
                  onChange={(e) => setPolicyText(e.target.value)}
                  rows={10}
                  placeholder="Paste bucket policy JSON (leave empty to clear policy)"
                  style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: 10, fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas", fontSize: 12, background: "rgba(8, 16, 28, 0.88)", color: "#cfe4ff" }}
                />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                Encryption
                <select value={encryptionMode} onChange={(e) => setEncryptionMode(e.target.value)} style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }}>
                  <option value="none">None</option>
                  <option value="AES256">SSE-S3 (AES256)</option>
                  <option value="aws:kms">SSE-KMS</option>
                </select>
              </label>

              {encryptionMode === "aws:kms" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                  KMS Key ID (optional)
                  <input
                    value={kmsKeyId}
                    onChange={(e) => setKmsKeyId(e.target.value)}
                    style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }}
                  />
                </label>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {Object.keys(defaultPublicBlock).map((key) => (
                  <label key={key} style={{ fontSize: 13, color: "#cfe4ff", display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(publicBlock[key])}
                      onChange={(e) => setPublicBlock((prev) => ({ ...prev, [key]: e.target.checked }))}
                    />
                    {key}
                  </label>
                ))}
              </div>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                Access Logging Target Bucket (leave empty to disable)
                <input value={logTargetBucket} onChange={(e) => setLogTargetBucket(e.target.value)} style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                Access Logging Target Prefix
                <input value={logTargetPrefix} onChange={(e) => setLogTargetPrefix(e.target.value)} style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }} />
              </label>

              <button
                type="button"
                disabled={!canSaveSettings}
                onClick={saveBucketSettings}
                style={{ border: "none", background: canSaveSettings ? "linear-gradient(140deg, #2bd2c9, #7de0ff)" : "#5a799f", color: canSaveSettings ? "#041019" : "#dcecff", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: canSaveSettings ? "pointer" : "not-allowed", width: "fit-content" }}
              >
                Save Bucket Settings
              </button>
            </div>
          </section>

          <section style={{ display: "grid", gap: 16 }}>
            <div style={{ background: "rgba(10, 19, 33, 0.82)", border: "1px solid rgba(146, 184, 224, 0.22)", borderRadius: 14, padding: 16 }}>
              <h2 style={{ margin: 0, marginBottom: 12, color: "#dcecff", fontSize: 18 }}>Webhooks</h2>
              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={newWebhookUrl}
                  onChange={(e) => setNewWebhookUrl(e.target.value)}
                  placeholder="https://example.com/webhook"
                  style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }}
                />
                <select value={newWebhookEvent} onChange={(e) => setNewWebhookEvent(e.target.value)} style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }}>
                  <option value="*">All events (*)</option>
                  <option value="object.uploaded">object.uploaded</option>
                  <option value="object.deleted">object.deleted</option>
                  <option value="object.moved">object.moved</option>
                  <option value="batch.completed">batch.completed</option>
                  <option value="folder.created">folder.created</option>
                  <option value="folder.deleted">folder.deleted</option>
                </select>
                <button type="button" onClick={addWebhook} style={{ border: "none", background: "linear-gradient(140deg, #ff9865, #ffc07d)", color: "#1d140b", borderRadius: 10, padding: "8px 12px", fontSize: 13, width: "fit-content", cursor: "pointer", fontWeight: 700 }}>
                  Add Webhook
                </button>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                {webhooks.length === 0 && <div style={{ fontSize: 13, color: "#91aac9" }}>No webhooks configured.</div>}
                {webhooks.map((webhook) => (
                  <div key={webhook.id} style={{ border: "1px solid rgba(146, 184, 224, 0.22)", borderRadius: 10, background: "rgba(8, 16, 28, 0.75)", padding: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 12, color: "#dcecff", fontWeight: 600 }}>{webhook.event}</div>
                      <div style={{ fontSize: 12, color: "#91aac9", wordBreak: "break-all" }}>{webhook.url}</div>
                    </div>
                    <button type="button" onClick={() => deleteWebhook(webhook.id)} style={{ border: "1px solid rgba(255, 107, 129, 0.35)", background: "rgba(62, 21, 30, 0.4)", color: "#ff9aaa", borderRadius: 8, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>
                      Delete
                    </button>
                    <button type="button" onClick={() => testWebhook(webhook.id)} style={{ border: "1px solid rgba(146, 184, 224, 0.25)", background: "rgba(18, 30, 47, 0.72)", color: "#dcecff", borderRadius: 8, padding: "4px 8px", fontSize: 12, cursor: "pointer" }}>
                      Test
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: "rgba(10, 19, 33, 0.82)", border: "1px solid rgba(146, 184, 224, 0.22)", borderRadius: 14, padding: 16 }}>
              <h2 style={{ margin: 0, marginBottom: 12, color: "#dcecff", fontSize: 18 }}>Local Sync</h2>
              <div style={{ display: "grid", gap: 8 }}>
                <input value={localPath} onChange={(e) => setLocalPath(e.target.value)} placeholder="/absolute/local/path" style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }} />
                <input value={syncPrefix} onChange={(e) => setSyncPrefix(e.target.value)} placeholder="S3 prefix (optional)" style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 10, padding: "8px 10px", fontSize: 13, background: "rgba(8, 16, 28, 0.88)", color: "#dcecff" }} />
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cfe4ff" }}>
                  <input type="checkbox" checked={syncDryRun} onChange={(e) => setSyncDryRun(e.target.checked)} />
                  Dry run preview only
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={() => runLocalSync("upload")} style={{ border: "none", background: "linear-gradient(140deg, #2bd2c9, #7de0ff)", color: "#041019", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                    Upload Local to S3
                  </button>
                  <button type="button" onClick={() => runLocalSync("download")} style={{ border: "none", background: "linear-gradient(140deg, #ff9865, #ffc07d)", color: "#1d140b", borderRadius: 10, padding: "8px 12px", fontSize: 13, cursor: "pointer", fontWeight: 700 }}>
                    Download S3 to Local
                  </button>
                </div>
                {syncResult && <div style={{ fontSize: 12, color: "#7df5c8" }}>{syncResult}</div>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
