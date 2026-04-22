'use client';
import { useState } from "react";
import BucketList from "./components/BucketList";
import FileExplorer from "./components/FileExplorer";

export default function Home() {
  const [bucket, setBucket] = useState(null);

  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <BucketList onSelect={setBucket} />
      <FileExplorer bucket={bucket} />
    </div>
  );
}
