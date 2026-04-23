'use client';
import { useEffect, useRef, useState } from "react";
import BucketList from "./components/BucketList";
import FileExplorer from "./components/FileExplorer";

export default function Home() {
  const [bucket, setBucket] = useState(null);
  const [isSmallScreen, setIsSmallScreen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const collapseTimerRef = useRef(null);
  const SELECTED_BUCKET_KEY = "dockyard:selectedBucket";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedBucket = window.localStorage.getItem(SELECTED_BUCKET_KEY);
    if (savedBucket) {
      setBucket(savedBucket);
    }
  }, []);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (bucket) {
      window.localStorage.setItem(SELECTED_BUCKET_KEY, bucket);
    } else {
      window.localStorage.removeItem(SELECTED_BUCKET_KEY);
    }
  }, [bucket]);

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
