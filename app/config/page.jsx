'use client';
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const emptyForm = {
  name: "",
  provider: "localstack",
  region: "us-east-1",
  endpoint: "http://localhost:4566",
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

  const activeConnection = useMemo(
    () => connections.find((item) => item.id === activeConnectionId),
    [connections, activeConnectionId],
  );

  const loadConnections = async () => {
    const res = await fetch("/api/connections");
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
  };

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const payload = {
        ...form,
        endpoint: form.provider === "aws" ? "" : form.endpoint,
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

    const payload = {
      ...form,
      endpoint: form.provider === "aws" ? "" : form.endpoint,
      forcePathStyle: form.provider === "localstack" ? true : form.forcePathStyle,
    };

    if (editingId) {
      await fetch(`/api/connections/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    await loadConnections();
    resetForm();
    setSaving(false);
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

    await fetch(`/api/connections/${id}`, { method: "DELETE" });
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
              Manage LocalStack and AWS profiles, validate credentials, and switch active connection.
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
                        {connection.provider.toUpperCase()} · {connection.region}
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

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
              Provider
              <select
                value={form.provider}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    provider: e.target.value,
                    endpoint: e.target.value === "aws" ? "" : prev.endpoint || "http://localhost:4566",
                    forcePathStyle: e.target.value === "localstack" ? true : prev.forcePathStyle,
                  }))
                }
                style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              >
                <option value="localstack">LocalStack</option>
                <option value="aws">AWS</option>
              </select>
            </label>

            <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
              Region
              <input
                required
                value={form.region}
                onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
                style={{ border: "1px solid rgba(146, 184, 224, 0.25)", borderRadius: 8, padding: "8px 10px", fontSize: 13 }}
              />
            </label>

            {form.provider === "localstack" && (
              <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "#cfe4ff" }}>
                Endpoint
                <input
                  required
                  value={form.endpoint}
                  onChange={(e) => setForm((prev) => ({ ...prev, endpoint: e.target.value }))}
                  placeholder="http://localhost:4566"
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

            {form.provider === "aws" && (
              <>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#cfe4ff" }}>
                  <input
                    type="checkbox"
                    checked={Boolean(form.forcePathStyle)}
                    onChange={(e) => setForm((prev) => ({ ...prev, forcePathStyle: e.target.checked }))}
                  />
                  Force Path Style
                </label>

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
              <strong>Active:</strong> {activeConnection ? `${activeConnection.name} (${activeConnection.provider})` : "None selected"}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
