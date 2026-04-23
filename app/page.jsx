'use client';
import { useEffect, useRef, useState } from "react";
import BucketList from "./components/BucketList";
import FileExplorer from "./components/FileExplorer";

export default function Home() {
  const [bucket, setBucket] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const collapseTimerRef = useRef(null);

  useEffect(() => {
    const onResize = () => {
      const small = window.innerWidth <= 1024;
      setIsSmallScreen(small);
      setIsSidebarCollapsed(small);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    return () => {
      if (collapseTimerRef.current) {
        clearTimeout(collapseTimerRef.current);
      }
    };
  }, []);

  const openSidebarTemporarily = () => {
    setIsSidebarCollapsed(false);
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
    collapseTimerRef.current = setTimeout(() => {
      setIsSidebarCollapsed(true);
    }, 8000);
  };

  return (
    <div className="app-shell">
      <div className="app-panel" style={{ display: "flex", height: "calc(100vh - 36px)", minHeight: 0, position: "relative" }}>
        <BucketList
          selected={bucket}
          onSelect={setBucket}
          onConnectionChange={() => setBucket(null)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapsed={setIsSidebarCollapsed}
          isSmallScreen={isSmallScreen}
          onTemporaryExpand={openSidebarTemporarily}
        />
        <FileExplorer bucket={bucket} />
      </div>
    </div>
  );
}
