'use client';

function ItemIcon({ isFolder, size = "sm", isLightTheme = false }) {
  const isXL = size === "xl";
  const isLarge = size === "lg";
  const boxSize = isXL ? 88 : isLarge ? 24 : 18;
  const corner = isXL ? 18 : 5;
  const innerFolder = isXL ? 60 : isLarge ? 17 : 13;
  const innerFile = isXL ? 56 : isLarge ? 16 : 12;

  if (isFolder) {
    return (
      <span
        aria-hidden="true"
        style={{
          width: boxSize,
          height: boxSize,
          borderRadius: corner,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          background: isXL
            ? isLightTheme
              ? "linear-gradient(145deg, rgba(255, 152, 101, 0.2), rgba(255, 192, 125, 0.26))"
              : "linear-gradient(145deg, rgba(255, 152, 101, 0.28), rgba(255, 192, 125, 0.14))"
            : isLightTheme
              ? "rgba(255, 152, 101, 0.16)"
              : "rgba(255, 152, 101, 0.2)",
          border: isXL
            ? isLightTheme
              ? "1px solid rgba(182, 107, 50, 0.38)"
              : "1px solid rgba(255, 192, 125, 0.55)"
            : isLightTheme
              ? "1px solid rgba(182, 107, 50, 0.32)"
              : "1px solid rgba(255, 192, 125, 0.45)",
          flexShrink: 0,
        }}
      >
        <svg width={innerFolder} height={innerFolder} viewBox="0 0 24 24" fill="none">
          <path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h4.1a2 2 0 0 1 1.42.59l1.39 1.41h6.09A2.5 2.5 0 0 1 21 9.5v8A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5v-10Z" fill="#ffc07d" />
          <path d="M3 10.5h18" stroke="#b66b32" strokeWidth={isXL ? "1.6" : "1.4"} strokeLinecap="round" />
        </svg>
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{
        width: boxSize,
        height: boxSize,
        borderRadius: corner,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: isXL
          ? isLightTheme
            ? "linear-gradient(145deg, rgba(125, 224, 255, 0.2), rgba(94, 170, 211, 0.18))"
            : "linear-gradient(145deg, rgba(125, 224, 255, 0.24), rgba(125, 224, 255, 0.1))"
          : isLightTheme
            ? "rgba(94, 170, 211, 0.14)"
            : "rgba(125, 224, 255, 0.16)",
        border: isXL
          ? isLightTheme
            ? "1px solid rgba(46, 111, 138, 0.38)"
            : "1px solid rgba(125, 224, 255, 0.55)"
          : isLightTheme
            ? "1px solid rgba(46, 111, 138, 0.32)"
            : "1px solid rgba(125, 224, 255, 0.4)",
        flexShrink: 0,
      }}
    >
      <svg width={innerFile} height={innerFile} viewBox="0 0 24 24" fill="none">
        <path d="M7 3.8h6.7L19 9.1v10.1A1.8 1.8 0 0 1 17.2 21H7a2 2 0 0 1-2-2V5.8a2 2 0 0 1 2-2Z" fill="#7de0ff" />
        <path d="M13.7 3.8V9h5.2" stroke="#2e6f8a" strokeWidth={isXL ? "1.6" : "1.4"} strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default function TreeNode({ item, viewMode, onOpen, onPreview, onContextMenu, selected, onToggleSelect, theme = "dark", compact = false, phone = false }) {
  const isLightTheme = theme === "light";

  if (viewMode === "grid") {
    return (
      <button
        type="button"
        onClick={() => item.isFolder && onOpen(item)}
        onContextMenu={(e) => onContextMenu(e, item)}
        style={{
          border: selected
            ? (isLightTheme ? "1px solid rgba(37, 159, 179, 0.45)" : "1px solid rgba(43, 210, 201, 0.45)")
            : (isLightTheme ? "1px solid rgba(180, 199, 222, 0.75)" : "1px solid rgba(146, 184, 224, 0.2)"),
          borderRadius: 12,
          padding: compact ? (phone ? "8px" : "10px") : "12px",
          background: selected
            ? (isLightTheme
              ? "linear-gradient(135deg, rgba(43, 210, 201, 0.14), rgba(122, 193, 255, 0.18))"
              : "linear-gradient(135deg, rgba(43, 210, 201, 0.18), rgba(125, 224, 255, 0.12))")
            : (isLightTheme ? "rgba(250, 253, 255, 0.9)" : "rgba(11, 21, 36, 0.75)"),
          textAlign: "left",
          minHeight: compact ? (phone ? 140 : 170) : 220,
          display: "flex",
          flexDirection: "column",
          cursor: item.isFolder ? "pointer" : "default"
        }}
      >
        <input
          type="checkbox"
          checked={Boolean(selected)}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          style={{ marginBottom: 10, alignSelf: "flex-start" }}
        />
        <div style={{ marginBottom: compact ? 8 : 12, flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <ItemIcon isFolder={item.isFolder} size={compact ? "lg" : "xl"} isLightTheme={isLightTheme} />
        </div>
        <div
          title={item.label}
          onDoubleClick={(e) => {
            e.stopPropagation();
            if (!item.isFolder && onPreview) {
              onPreview(item);
            }
          }}
          style={{
            fontSize: compact ? (phone ? 13 : 14) : 20,
            fontWeight: 600,
            color: isLightTheme ? "#142946" : "#e6f2ff",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            cursor: !item.isFolder ? "pointer" : "default",
          }}
        >
          {item.label}
        </div>
        <div style={{ fontSize: compact ? 11 : 12, color: isLightTheme ? "#4d6e92" : "#8fb6d8", marginTop: compact ? 3 : 5 }}>
          {item.isFolder ? "Folder" : `${item.type} • ${item.storageClass || "STANDARD"}`}
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => item.isFolder && onOpen(item)}
      onContextMenu={(e) => onContextMenu(e, item)}
      style={{
        width: "100%",
        display: "grid",
        gridTemplateColumns: compact ? (phone ? "28px minmax(0, 1fr) 72px" : "36px minmax(0, 1fr) 96px") : "36px 1fr 180px 120px 120px 120px",
        gap: 8,
        alignItems: "center",
        border: "none",
        borderBottom: isLightTheme ? "1px solid rgba(188, 206, 226, 0.75)" : "1px solid rgba(146, 184, 224, 0.16)",
        background: selected
          ? (isLightTheme
            ? "linear-gradient(90deg, rgba(43, 210, 201, 0.12), rgba(230, 244, 255, 0.96))"
            : "linear-gradient(90deg, rgba(43, 210, 201, 0.14), rgba(14, 29, 47, 0.8))")
          : (isLightTheme ? "rgba(248, 252, 255, 0.95)" : "rgba(10, 18, 30, 0.62)"),
        padding: "10px 12px",
        textAlign: "left",
        cursor: item.isFolder ? "pointer" : "default"
      }}
    >
      <div>
        <input
          type="checkbox"
          checked={Boolean(selected)}
          onChange={(e) => {
            e.stopPropagation();
            onToggleSelect?.(item, e.target.checked);
          }}
          onClick={(e) => e.stopPropagation()}
          style={phone ? { transform: "scale(0.92)" } : undefined}
        />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
        <ItemIcon isFolder={item.isFolder} isLightTheme={isLightTheme} />
        <div style={{ minWidth: 0 }}>
          <span
            title={item.label}
            onDoubleClick={(e) => {
              e.stopPropagation();
              if (!item.isFolder && onPreview) {
                onPreview(item);
              }
            }}
            style={{ 
              display: "block", 
              overflow: "hidden", 
              textOverflow: "ellipsis", 
              whiteSpace: "nowrap", 
              color: isLightTheme ? "#203a5d" : "#dcecff", 
              fontSize: phone ? 12 : 13,
              cursor: !item.isFolder ? "pointer" : "default",
            }}
          >
            {item.label}
          </span>
          {compact && (
            <span style={{ display: "block", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: isLightTheme ? "#4d6e92" : "#8fb6d8", fontSize: phone ? 10 : 11 }}>
              {item.modifiedLabel}
            </span>
          )}
        </div>
      </div>
      {compact ? (
        <span style={{ textAlign: "right", color: isLightTheme ? "#4d6e92" : "#8fb6d8", fontSize: phone ? 11 : 12 }}>{item.sizeLabel}</span>
      ) : (
        <>
          <span style={{ color: isLightTheme ? "#4d6e92" : "#8fb6d8", fontSize: 12 }}>{item.modifiedLabel}</span>
          <span style={{ color: isLightTheme ? "#4d6e92" : "#8fb6d8", fontSize: 12 }}>{item.isFolder ? "Folder" : item.type}</span>
          <span style={{ color: isLightTheme ? "#4d6e92" : "#8fb6d8", fontSize: 12 }}>{item.sizeLabel}</span>
          <span style={{ color: isLightTheme ? "#4d6e92" : "#8fb6d8", fontSize: 12 }}>{item.isFolder ? "-" : (item.storageClass || "STANDARD")}</span>
        </>
      )}
    </button>
  );
}
