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
  const [armedBucket, setArmedBucket] = useState(null);
  const [pinnedBuckets, setPinnedBuckets] = useState([]);
  const [showOtherBuckets, setShowOtherBuckets] = useState(false);

  const PINNED_BUCKETS_KEY = "dockyard:pinnedBuckets";

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(PINNED_BUCKETS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setPinnedBuckets(parsed.filter((name) => typeof name === "string"));
      }
    } catch {
      setPinnedBuckets([]);
    }
  }, []);

  const persistPinnedBuckets = (nextBuckets) => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PINNED_BUCKETS_KEY, JSON.stringify(nextBuckets));
  };

  const togglePinnedBucket = (bucketName) => {
    setPinnedBuckets((prev) => {
      const exists = prev.includes(bucketName);
      const next = exists ? prev.filter((name) => name !== bucketName) : [...prev, bucketName];
      persistPinnedBuckets(next);
      return next;
    });
  };

  const openBucket = (bucketName) => {
    setArmedBucket(null);
    onSelect(bucketName);
  };

  const handleConnectionChange = async (id) => {
    setActiveConnectionId(id);
    await fetch("/api/connections/select", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    onConnectionChange?.();
    setArmedBucket(null);
    await loadBuckets();
  };

  const pinnedBucketItems = buckets.filter((bucketItem) => pinnedBuckets.includes(bucketItem.Name));
  const otherBucketItems = buckets.filter((bucketItem) => !pinnedBuckets.includes(bucketItem.Name));

  const renderBucketRow = (b) => {
    const isPinned = pinnedBuckets.includes(b.Name);

    return (
      <div
        key={b.Name}
        onClick={() => setArmedBucket(b.Name)}
        onDoubleClick={() => openBucket(b.Name)}
        title={isCollapsed ? b.Name : undefined}
        style={{
          cursor: "pointer",
          margin: "0 8px 6px",
          padding: isCollapsed ? "10px 6px" : "10px 12px",
          fontSize: 13,
          borderRadius: 10,
          background: selected === b.Name
            ? "linear-gradient(135deg, rgba(43, 210, 201, 0.18), rgba(125, 224, 255, 0.14))"
            : armedBucket === b.Name
              ? "rgba(43, 210, 201, 0.12)"
              : "rgba(10, 18, 30, 0.45)",
          border: selected === b.Name
            ? "1px solid rgba(43, 210, 201, 0.45)"
            : armedBucket === b.Name
              ? "1px solid rgba(43, 210, 201, 0.35)"
              : "1px solid rgba(146, 184, 224, 0.15)",
          color: selected === b.Name ? "#c5fffb" : "#bdd3ec",
          transition: "all 0.15s",
          wordBreak: "break-all",
          textAlign: isCollapsed ? "center" : "left",
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-start",
          gap: 8,
        }}
        onMouseEnter={(e) => {
          if (selected !== b.Name && armedBucket !== b.Name) {
            e.currentTarget.style.background = "rgba(18, 33, 53, 0.85)";
            e.currentTarget.style.borderColor = "rgba(146, 184, 224, 0.35)";
          }
        }}
        onMouseLeave={(e) => {
          if (selected !== b.Name && armedBucket !== b.Name) {
            e.currentTarget.style.background = "rgba(10, 18, 30, 0.45)";
            e.currentTarget.style.borderColor = "rgba(146, 184, 224, 0.15)";
          }
        }}
      >
        {!isCollapsed && (
          <button
            type="button"
            title={isPinned ? "Unpin bucket" : "Pin bucket"}
            onClick={(e) => {
              e.stopPropagation();
              togglePinnedBucket(b.Name);
            }}
            style={{
              border: "none",
              background: "transparent",
              padding: 0,
              width: 16,
              height: 16,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: isPinned ? "#7de0d6" : "#6e89a8",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path
                d="M5.5 1.5h5L9.8 5v2.1l2 1.6v1.1H4.2V8.7l2-1.6V5L5.5 1.5Z"
                fill={isPinned ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <path d="M8 9.8V14.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <span>{isCollapsed ? b.Name.slice(0, 1).toUpperCase() : b.Name}</span>
      </div>
    );
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
      {isCollapsed ? (
        buckets.map((b) => renderBucketRow(b))
      ) : (
        <>
          <div style={{ padding: "0 10px 8px", fontSize: 10, color: "#7da2c9", textTransform: "uppercase", letterSpacing: 0.8 }}>
            Pinned
          </div>
          {pinnedBucketItems.length === 0 && (
            <div style={{ margin: "0 8px 8px", padding: "8px 10px", color: "#6f8fb1", fontSize: 12, border: "1px dashed rgba(146, 184, 224, 0.2)", borderRadius: 8 }}>
              Pin buckets to keep them on top.
            </div>
          )}
          {pinnedBucketItems.map((b) => renderBucketRow(b))}

          <button
            type="button"
            onClick={() => setShowOtherBuckets((prev) => !prev)}
            style={{
              margin: "6px 8px 8px",
              padding: "7px 10px",
              borderRadius: 8,
              border: "1px solid rgba(146, 184, 224, 0.22)",
              background: "rgba(10, 18, 30, 0.7)",
              color: "#a9c2dc",
              fontSize: 11,
              fontWeight: 600,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            {showOtherBuckets ? "Hide other buckets" : `Show other buckets (${otherBucketItems.length})`}
          </button>

          {showOtherBuckets && otherBucketItems.map((b) => renderBucketRow(b))}
        </>
      )}
    </div>
  );
}
