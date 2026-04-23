'use client';
import Link from "next/link";
import { useEffect, useState } from "react";

export default function BucketList({
  selected,
  onSelect,
  onConnectionChange,
  isCollapsed = false,
  onToggleCollapsed,
  isSmallScreen = false,
  onTemporaryExpand,
}) {
  const [buckets, setBuckets] = useState([]);
  const [connections, setConnections] = useState([]);
  const [activeConnectionId, setActiveConnectionId] = useState("");

  const loadConnections = async () => {
    const res = await fetch("/api/connections");
    const store = await res.json();
    setConnections(store.connections || []);
    setActiveConnectionId(store.activeConnectionId || "");
    return store.activeConnectionId || "";
  };

  const loadBuckets = async () => {
    const res = await fetch("/api/buckets");
    if (!res.ok) {
      setBuckets([]);
      return;
    }
    const items = await res.json();
    setBuckets(items || []);
  };

  useEffect(() => {
    loadConnections().then(() => loadBuckets());
  }, []);

  const handleConnectionChange = async (id) => {
    setActiveConnectionId(id);
    await fetch("/api/connections/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onConnectionChange?.();
    await loadBuckets();
  };

  return (
    <div style={{
      width: isCollapsed ? 62 : 260,
      minWidth: isCollapsed ? 62 : 220,
      background: "linear-gradient(180deg, rgba(7, 15, 26, 0.95), rgba(7, 13, 24, 0.88))",
      color: "#d8e9ff",
      display: "flex",
      flexDirection: "column",
      borderRight: "1px solid rgba(146, 184, 224, 0.22)",
      height: "100%",
      overflowY: "auto",
      transition: "width 0.2s ease, min-width 0.2s ease"
    }}>
      <div style={{ padding: isCollapsed ? "14px 8px 12px" : "16px 14px 12px", borderBottom: "1px solid rgba(146, 184, 224, 0.2)" }}>
        <div
          style={{
            display: "flex",
            alignItems: isCollapsed ? "center" : "center",
            justifyContent: isCollapsed ? "center" : "space-between",
            flexDirection: isCollapsed ? "column" : "row",
            gap: 8,
            marginBottom: 10,
          }}
        >
          <div className="brand-mark" style={{ marginBottom: 0 }}>
            <span className="glyph">DS</span>
            {!isCollapsed && (
              <span>
                <span className="name" style={{ display: "block" }}>Dockyard S3 Studio</span>
                <span className="tag">Object Workspace</span>
              </span>
            )}
          </div>
          <button
            type="button"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => {
              if (isCollapsed && isSmallScreen) {
                onTemporaryExpand?.();
                return;
              }
              onToggleCollapsed?.((prev) => !prev);
            }}
            style={{
              border: "1px solid rgba(146, 184, 224, 0.25)",
              background: "rgba(10, 18, 30, 0.8)",
              color: "#dceeff",
              borderRadius: 8,
              width: 28,
              height: 28,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {isCollapsed ? "◀" : "▶"}
          </button>
        </div>
        {!isCollapsed && <div style={{ marginTop: 12 }}>
          <select
            value={activeConnectionId}
            onChange={(e) => handleConnectionChange(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(10, 18, 30, 0.9)",
              color: "#dceeff",
              border: "1px solid rgba(146, 184, 224, 0.25)",
              borderRadius: 10,
              fontSize: 12,
              padding: "8px 10px"
            }}
          >
            {connections.map((connection) => (
              <option key={connection.id} value={connection.id}>
                {connection.name}
              </option>
            ))}
          </select>
          <Link
            href="/config"
            style={{
              marginTop: 10,
              display: "block",
              color: "#7fded7",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Connection Control
          </Link>
          <Link
            href="/tools"
            style={{
              marginTop: 6,
              display: "block",
              color: "#ffd1a8",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: 600,
            }}
          >
            Security + Automation
          </Link>
        </div>}
      </div>
      <div style={{ padding: isCollapsed ? "10px 4px 8px" : "10px 8px 12px", fontSize: 11, color: "#84a5c7", textTransform: "uppercase", letterSpacing: 1, textAlign: isCollapsed ? "center" : "left" }}>
        Buckets
      </div>
      {buckets.map((b) => (
        <div
          key={b.Name}
          onClick={() => onSelect(b.Name)}
          title={isCollapsed ? b.Name : undefined}
          style={{
            cursor: "pointer",
            margin: "0 8px 6px",
            padding: isCollapsed ? "10px 6px" : "10px 12px",
            fontSize: 13,
            borderRadius: 10,
            background: selected === b.Name ? "linear-gradient(135deg, rgba(43, 210, 201, 0.18), rgba(125, 224, 255, 0.14))" : "rgba(10, 18, 30, 0.45)",
            border: selected === b.Name ? "1px solid rgba(43, 210, 201, 0.45)" : "1px solid rgba(146, 184, 224, 0.15)",
            color: selected === b.Name ? "#c5fffb" : "#bdd3ec",
            transition: "all 0.15s",
            wordBreak: "break-all",
            textAlign: isCollapsed ? "center" : "left"
          }}
          onMouseEnter={(e) => {
            if (selected !== b.Name) {
              e.currentTarget.style.background = "rgba(18, 33, 53, 0.85)";
              e.currentTarget.style.borderColor = "rgba(146, 184, 224, 0.35)";
            }
          }}
          onMouseLeave={(e) => {
            if (selected !== b.Name) {
              e.currentTarget.style.background = "rgba(10, 18, 30, 0.45)";
              e.currentTarget.style.borderColor = "rgba(146, 184, 224, 0.15)";
            }
          }}
        >
          {isCollapsed ? b.Name.slice(0, 1).toUpperCase() : b.Name}
        </div>
      ))}
    </div>
  );
}
