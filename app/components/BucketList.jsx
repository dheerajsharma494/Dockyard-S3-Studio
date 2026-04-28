'use client';
import Link from "next/link";
import { useEffect, useState } from "react";

const SUPPORT_EMAIL =
  process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "dheerajs.work@gmail.com";

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
  const [isRefreshingBuckets, setIsRefreshingBuckets] = useState(false);

  const PINNED_BUCKETS_KEY = "dockyard:pinnedBuckets";

  const loadConnections = async () => {
    const res = await fetch("/api/connections", { cache: "no-store" });
    const store = await res.json();
    setConnections(store.connections || []);
    setActiveConnectionId(store.activeConnectionId || "");
    return store.activeConnectionId || "";
  };

  const loadBuckets = async () => {
    const res = await fetch("/api/buckets", { cache: "no-store" });
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

  const handleRefreshBuckets = async () => {
    if (isRefreshingBuckets) return;

    setIsRefreshingBuckets(true);
    try {
      await loadBuckets();
    } finally {
      setIsRefreshingBuckets(false);
    }
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
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#d9fffb",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: 700,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(127, 222, 215, 0.35)",
              background: "linear-gradient(160deg, rgba(32, 77, 84, 0.55), rgba(13, 32, 44, 0.75))",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.06)",
            }}
          >
            <span>Connection Control</span>
            <span aria-hidden="true" style={{ fontSize: 11, color: "#7fded7" }}>→</span>
          </Link>
          <Link
            href="/tools"
            style={{
              marginTop: 6,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              color: "#ffe6cf",
              fontSize: 12,
              textDecoration: "none",
              fontWeight: 700,
              padding: "8px 10px",
              borderRadius: 10,
              border: "1px solid rgba(255, 209, 168, 0.34)",
              background: "linear-gradient(160deg, rgba(95, 61, 34, 0.48), rgba(28, 24, 37, 0.78))",
              boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.05)",
            }}
          >
            <span>Security + Automation</span>
            <span aria-hidden="true" style={{ fontSize: 11, color: "#ffd1a8" }}>→</span>
          </Link>
        </div>}
      </div>
      <div style={{ padding: isCollapsed ? "10px 4px 8px" : "10px 8px 12px", fontSize: 11, color: "#84a5c7", textTransform: "uppercase", letterSpacing: 1, textAlign: isCollapsed ? "center" : "left", display: "flex", alignItems: "center", justifyContent: isCollapsed ? "center" : "space-between", gap: 8 }}>
        <span>Buckets</span>
        {!isCollapsed && (
          <button
            type="button"
            title="Reload bucket list"
            aria-label="Reload bucket list"
            onClick={handleRefreshBuckets}
            disabled={isRefreshingBuckets}
            style={{
              border: "1px solid rgba(146, 184, 224, 0.25)",
              background: "rgba(10, 18, 30, 0.7)",
              color: "#bcd5ef",
              borderRadius: 8,
              width: 24,
              height: 24,
              cursor: isRefreshingBuckets ? "wait" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: isRefreshingBuckets ? 0.65 : 1,
              flexShrink: 0,
            }}
          >
            {isRefreshingBuckets ? "…" : "↻"}
          </button>
        )}
      </div>
      {!isCollapsed && (
        <div
          style={{
            margin: "0 8px 10px",
            padding: "8px 10px",
            borderRadius: 8,
            border: "1px solid rgba(146, 184, 224, 0.2)",
            background: "rgba(12, 22, 36, 0.58)",
            color: "#9bb7d8",
            fontSize: 11,
            lineHeight: 1.35,
          }}
        >
          Tip: single-click selects a bucket, double-click opens it.
        </div>
      )}
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

      {!isCollapsed && (
        <div style={{ marginTop: "auto", padding: "12px 10px 14px", borderTop: "1px solid rgba(146, 184, 224, 0.15)" }}>
          <div
            style={{
              marginBottom: 10,
              padding: "10px",
              borderRadius: 10,
              border: "1px solid rgba(146, 184, 224, 0.22)",
              background: "rgba(10, 18, 30, 0.68)",
            }}
          >
            <div style={{ fontSize: 11, color: "#84a5c7", textTransform: "uppercase", letterSpacing: 0.8, fontWeight: 700 }}>
              Help & Feedback
            </div>
            <a
              href={`mailto:${SUPPORT_EMAIL}?subject=Dockyard%20S3%20Studio%20Feedback`}
              style={{
                marginTop: 8,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                textDecoration: "none",
                color: "#d9fffb",
                fontSize: 12,
                fontWeight: 700,
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(127, 222, 215, 0.32)",
                background:
                  "linear-gradient(160deg, rgba(32, 77, 84, 0.55), rgba(13, 32, 44, 0.75))",
              }}
              title={`Send email to ${SUPPORT_EMAIL}`}
            >
              <span>Email Support</span>
              <span aria-hidden="true" style={{ fontSize: 11, color: "#7fded7" }}>
                ↗
              </span>
            </a>
          </div>

          <button
            type="button"
            onClick={() => window.open("https://ko-fi.com/dheerajsharma494", "_blank")}
            style={{
              width: "100%",
              padding: "9px 12px",
              borderRadius: 10,
              border: "none",
              background: "linear-gradient(135deg, #ff5e5b, #ff8c42)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 7,
              letterSpacing: 0.3,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682-.284-1.682-.284V7.381c1.698.67 2.146 1.918 2.146 1.918s.284 1.868-.464 2.638z"/>
            </svg>
            Support on Ko-fi
          </button>
        </div>
      )}
    </div>
  );
}
