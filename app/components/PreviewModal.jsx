'use client';
import { useEffect, useRef, useState } from 'react';

function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  return lines.map(line => {
    const cols = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        cols.push(current); current = "";
      } else {
        current += ch;
      }
    }
    cols.push(current);
    return cols;
  });
}

export default function PreviewModal({ isOpen, file, onClose, isLoading, error, content, imageUrl, videoUrl, excelData, pdfUrl, theme = "dark", bucket = "" }) {
  const isLightTheme = theme === "light";
  const [activeSheet, setActiveSheet] = useState(0);
  const [pdfPages, setPdfPages] = useState([]);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  const [videoVolume, setVideoVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setVideoDuration(0);
    setVideoCurrentTime(0);
    setVideoVolume(1);
    setIsMuted(false);
  }, [videoUrl]);

  useEffect(() => {
    let active = true;

    const renderPdfPages = async () => {
      if (!pdfUrl) {
        setPdfPages([]);
        setPdfLoading(false);
        setPdfError(null);
        return;
      }

      setPdfLoading(true);
      setPdfError(null);
      setPdfPages([]);

      try {
        const pdfjsModule = await import("pdfjs-dist/legacy/build/pdf.js");
        const pdfjs = pdfjsModule?.default || pdfjsModule;
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.js";

        const res = await fetch(pdfUrl);
        if (!res.ok) {
          throw new Error("Failed to fetch PDF content");
        }

        const buffer = await res.arrayBuffer();
        const doc = await pdfjs.getDocument({
          data: new Uint8Array(buffer),
        }).promise;

        const renderedPages = [];

        for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
          const page = await doc.getPage(pageNumber);
          const baseViewport = page.getViewport({ scale: 1 });
          const targetWidth = 980;
          const scale = Math.min(2, Math.max(1, targetWidth / baseViewport.width));
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d", { alpha: false });

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          await page.render({
            canvasContext: ctx,
            viewport,
          }).promise;

          renderedPages.push(canvas.toDataURL("image/png"));
        }

        if (active) {
          setPdfPages(renderedPages);
          setPdfLoading(false);
        }
      } catch (err) {
        if (active) {
          setPdfError(err.message || "Failed to render PDF preview");
          setPdfLoading(false);
        }
      }
    };

    renderPdfPages();

    return () => {
      active = false;
    };
  }, [pdfUrl]);

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
    const total = Math.floor(seconds);
    const mins = Math.floor(total / 60);
    const secs = total % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  };

  const formatBytes = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen || !file) return null;

  const isCSV = file.label?.toLowerCase().endsWith(".csv");
  const csvRows = isCSV && content ? parseCSV(content) : null;
  const sheetRows = excelData ? excelData.sheets[excelData.sheetNames[activeSheet]] : null;
  const isPDF = Boolean(pdfUrl);
  const isVideo = Boolean(videoUrl);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: isLightTheme ? "#f8fcff" : "#0c1625",
          borderRadius: 12,
          boxShadow: "0 20px 60px rgba(0, 0, 0, 0.3)",
          display: "flex",
          flexDirection: "column",
          width: "90%",
          maxWidth: (excelData || isPDF || isVideo) ? "1200px" : "900px",
          maxHeight: (isPDF || isVideo) ? "92vh" : "85vh",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "20px 24px",
            borderBottom: isLightTheme ? "1px solid rgba(188, 206, 226, 0.75)" : "1px solid rgba(146, 184, 224, 0.16)",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              title={file.label}
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: isLightTheme ? "#142946" : "#e6f2ff",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginBottom: 4,
              }}
            >
              {file.label}
            </div>
            <div style={{ fontSize: 12, color: isLightTheme ? "#4d6e92" : "#8fb6d8" }}>
              {formatBytes(file.sizeRaw)} • {file.type} • {new Date(file.modifiedRaw).toLocaleString()}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: isLightTheme ? "#4d6e92" : "#8fb6d8",
              fontSize: 24,
              cursor: "pointer",
              padding: "4px 8px",
              marginLeft: 16,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "auto",
            padding: (csvRows || excelData || isPDF || isVideo) ? "0" : "20px 24px",
            minHeight: 0,
            display: "flex",
            alignItems: (isLoading || error || (!csvRows && !excelData && !isPDF && !isVideo)) ? "center" : "flex-start",
            justifyContent: (isLoading || error || (!csvRows && !excelData && !isPDF && !isVideo)) ? "center" : "flex-start",
          }}
        >
          {isLoading ? (
            <div style={{ textAlign: "center", color: isLightTheme ? "#4d6e92" : "#8fb6d8" }}>
              Loading preview...
            </div>
          ) : error ? (
            <div
              style={{
                padding: "20px",
                borderRadius: 8,
                background: isLightTheme ? "rgba(220, 53, 69, 0.1)" : "rgba(220, 53, 69, 0.15)",
                border: isLightTheme ? "1px solid rgba(220, 53, 69, 0.3)" : "1px solid rgba(220, 53, 69, 0.4)",
                color: isLightTheme ? "#7d2730" : "#ff8a8a",
                maxWidth: "400px",
                textAlign: "center",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: 8 }}>⚠️ Cannot preview file</div>
              <div style={{ fontSize: 13, marginBottom: 16 }}>{error}</div>
              <button
                onClick={() => {
                  const url = `/api/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(file.key)}`;
                  window.location.href = url;
                }}
                style={{
                  background: isLightTheme ? "#2f7f63" : "rgba(43, 210, 201, 0.3)",
                  color: isLightTheme ? "#fff" : "#2bd2c9",
                  border: isLightTheme ? "none" : "1px solid rgba(43, 210, 201, 0.5)",
                  borderRadius: 6,
                  padding: "8px 16px",
                  fontSize: 12,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                📥 Download File
              </button>
            </div>
          ) : videoUrl ? (
            <div
              style={{
                width: "100%",
                height: "100%",
                minHeight: 0,
                display: "flex",
                flexDirection: "column",
                background: "#000",
              }}
            >
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                onLoadedMetadata={(e) => setVideoDuration(e.currentTarget.duration || 0)}
                onTimeUpdate={(e) => setVideoCurrentTime(e.currentTarget.currentTime || 0)}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "calc(92vh - 210px)",
                  flex: 1,
                  objectFit: "contain",
                  background: "#000",
                }}
              />

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto minmax(140px, 1fr) auto auto minmax(80px, 120px) auto",
                  gap: 10,
                  alignItems: "center",
                  padding: "10px 12px",
                  background: isLightTheme ? "rgba(20, 41, 70, 0.08)" : "rgba(9, 16, 28, 0.9)",
                  borderTop: isLightTheme ? "1px solid rgba(188, 206, 226, 0.5)" : "1px solid rgba(146, 184, 224, 0.2)",
                }}
              >
                <button
                  onClick={() => {
                    const el = videoRef.current;
                    if (!el) return;
                    if (el.paused) {
                      el.play().catch(() => {});
                    } else {
                      el.pause();
                    }
                  }}
                  style={{
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    background: isLightTheme ? "#2f7f63" : "rgba(43, 210, 201, 0.25)",
                    color: isLightTheme ? "#fff" : "#d8fffb",
                    fontWeight: 600,
                  }}
                >
                  {isPlaying ? "Pause" : "Play"}
                </button>

                <input
                  type="range"
                  min={0}
                  max={videoDuration || 0}
                  step={0.1}
                  value={Math.min(videoCurrentTime, videoDuration || 0)}
                  onChange={(e) => {
                    const el = videoRef.current;
                    if (!el) return;
                    const next = Number(e.target.value);
                    el.currentTime = next;
                    setVideoCurrentTime(next);
                  }}
                  style={{ width: "100%", cursor: "pointer" }}
                />

                <span style={{ fontSize: 12, color: isLightTheme ? "#203a5d" : "#dcecff", whiteSpace: "nowrap" }}>
                  {formatTime(videoCurrentTime)} / {formatTime(videoDuration)}
                </span>

                <button
                  onClick={() => {
                    const el = videoRef.current;
                    if (!el) return;
                    const nextMuted = !isMuted;
                    el.muted = nextMuted;
                    setIsMuted(nextMuted);
                  }}
                  style={{
                    border: "none",
                    borderRadius: 6,
                    padding: "6px 10px",
                    fontSize: 12,
                    cursor: "pointer",
                    background: isLightTheme ? "rgba(47, 127, 99, 0.15)" : "rgba(43, 210, 201, 0.18)",
                    color: isLightTheme ? "#1f5f4a" : "#cafff6",
                    fontWeight: 600,
                  }}
                >
                  {isMuted ? "Unmute" : "Mute"}
                </button>

                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={isMuted ? 0 : videoVolume}
                  onChange={(e) => {
                    const el = videoRef.current;
                    if (!el) return;
                    const next = Number(e.target.value);
                    el.volume = next;
                    el.muted = next === 0;
                    setIsMuted(next === 0);
                    setVideoVolume(next);
                  }}
                  style={{ width: "100%", cursor: "pointer" }}
                />

                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: "none",
                    color: isLightTheme ? "#1f5f4a" : "#7de0d6",
                  }}
                >
                  Open in new tab
                </a>
              </div>
            </div>
          ) : imageUrl ? (
            <img
              src={imageUrl}
              alt={file.label}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                borderRadius: 4,
              }}
            />
          ) : pdfUrl ? (
            <div
              style={{
                width: "100%",
                minHeight: "70vh",
                padding: "12px",
                boxSizing: "border-box",
              }}
            >
              {pdfLoading ? (
                <div style={{ textAlign: "center", color: isLightTheme ? "#4d6e92" : "#8fb6d8", padding: "18px" }}>
                  Rendering PDF preview...
                </div>
              ) : pdfError ? (
                <div style={{ textAlign: "center", color: isLightTheme ? "#7d2730" : "#ff8a8a", padding: "18px" }}>
                  {pdfError}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
                  {pdfPages.map((pageImage, idx) => (
                    <img
                      key={`pdf-page-${idx + 1}`}
                      src={pageImage}
                      alt={`PDF page ${idx + 1}`}
                      style={{
                        width: "100%",
                        maxWidth: 980,
                        height: "auto",
                        borderRadius: 4,
                        boxShadow: isLightTheme ? "0 4px 14px rgba(20, 41, 70, 0.15)" : "0 4px 14px rgba(0, 0, 0, 0.35)",
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : excelData ? (
            <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
              {/* Sheet tabs */}
              {excelData.sheetNames.length > 1 && (
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    padding: "8px 12px 0",
                    borderBottom: isLightTheme ? "1px solid rgba(188, 206, 226, 0.75)" : "1px solid rgba(146, 184, 224, 0.16)",
                    flexWrap: "wrap",
                  }}
                >
                  {excelData.sheetNames.map((name, i) => (
                    <button
                      key={i}
                      onClick={() => setActiveSheet(i)}
                      style={{
                        padding: "5px 12px",
                        fontSize: 12,
                        fontWeight: activeSheet === i ? 700 : 400,
                        cursor: "pointer",
                        border: "none",
                        borderRadius: "4px 4px 0 0",
                        background: activeSheet === i
                          ? (isLightTheme ? "#fff" : "#0c1625")
                          : (isLightTheme ? "rgba(188, 206, 226, 0.3)" : "rgba(146, 184, 224, 0.08)"),
                        color: activeSheet === i
                          ? (isLightTheme ? "#142946" : "#e6f2ff")
                          : (isLightTheme ? "#4d6e92" : "#8fb6d8"),
                        borderBottom: activeSheet === i
                          ? (isLightTheme ? "2px solid #2f7f63" : "2px solid #2bd2c9")
                          : "2px solid transparent",
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
              {/* Sheet table */}
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, fontFamily: '"SF Mono", Monaco, "Inconsolata", monospace' }}>
                  <thead>
                    <tr>
                      {(sheetRows[0] || []).map((cell, i) => (
                        <th
                          key={i}
                          style={{
                            padding: "8px 12px",
                            textAlign: "left",
                            fontWeight: 700,
                            color: isLightTheme ? "#142946" : "#e6f2ff",
                            background: isLightTheme ? "rgba(188, 206, 226, 0.4)" : "rgba(146, 184, 224, 0.12)",
                            borderBottom: isLightTheme ? "2px solid rgba(188, 206, 226, 0.75)" : "2px solid rgba(146, 184, 224, 0.3)",
                            borderRight: isLightTheme ? "1px solid rgba(188, 206, 226, 0.5)" : "1px solid rgba(146, 184, 224, 0.15)",
                            whiteSpace: "nowrap",
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                          }}
                        >
                          {String(cell)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(sheetRows.slice(1) || []).map((row, ri) => (
                      <tr
                        key={ri}
                        style={{
                          background: ri % 2 !== 0
                            ? (isLightTheme ? "rgba(188, 206, 226, 0.15)" : "rgba(146, 184, 224, 0.05)")
                            : "transparent",
                        }}
                      >
                        {(sheetRows[0] || []).map((_, ci) => (
                          <td
                            key={ci}
                            style={{
                              padding: "6px 12px",
                              color: isLightTheme ? "#203a5d" : "#dcecff",
                              borderBottom: isLightTheme ? "1px solid rgba(188, 206, 226, 0.3)" : "1px solid rgba(146, 184, 224, 0.08)",
                              borderRight: isLightTheme ? "1px solid rgba(188, 206, 226, 0.3)" : "1px solid rgba(146, 184, 224, 0.08)",
                              maxWidth: 200,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                            title={String(row[ci] ?? "")}
                          >
                            {String(row[ci] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : csvRows ? (
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: 12,
                fontFamily: '"SF Mono", Monaco, "Inconsolata", monospace',
              }}
            >
              <thead>
                <tr>
                  {csvRows[0].map((cell, i) => (
                    <th
                      key={i}
                      style={{
                        padding: "8px 12px",
                        textAlign: "left",
                        fontWeight: 700,
                        color: isLightTheme ? "#142946" : "#e6f2ff",
                        background: isLightTheme ? "rgba(188, 206, 226, 0.4)" : "rgba(146, 184, 224, 0.12)",
                        borderBottom: isLightTheme ? "2px solid rgba(188, 206, 226, 0.75)" : "2px solid rgba(146, 184, 224, 0.3)",
                        borderRight: isLightTheme ? "1px solid rgba(188, 206, 226, 0.5)" : "1px solid rgba(146, 184, 224, 0.15)",
                        whiteSpace: "nowrap",
                        position: "sticky",
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvRows.slice(1).map((row, ri) => (
                  <tr
                    key={ri}
                    style={{
                      background: ri % 2 === 0
                        ? (isLightTheme ? "transparent" : "transparent")
                        : (isLightTheme ? "rgba(188, 206, 226, 0.15)" : "rgba(146, 184, 224, 0.05)"),
                    }}
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        style={{
                          padding: "6px 12px",
                          color: isLightTheme ? "#203a5d" : "#dcecff",
                          borderBottom: isLightTheme ? "1px solid rgba(188, 206, 226, 0.3)" : "1px solid rgba(146, 184, 224, 0.08)",
                          borderRight: isLightTheme ? "1px solid rgba(188, 206, 226, 0.3)" : "1px solid rgba(146, 184, 224, 0.08)",
                          maxWidth: 200,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={cell}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : content ? (
            <pre
              style={{
                width: "100%",
                margin: 0,
                padding: 0,
                fontFamily: '"SF Mono", Monaco, "Inconsolata", monospace',
                fontSize: 12,
                lineHeight: 1.5,
                color: isLightTheme ? "#203a5d" : "#dcecff",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            >
              {content}
            </pre>
          ) : null}
        </div>
      </div>
    </div>
  );
}
