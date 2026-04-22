'use client';
import { useEffect, useState } from "react";
import TreeNode from "./TreeNode";

export default function FileExplorer({ bucket }) {
  const [data, setData] = useState({ folders: [], files: [] });
  const [prefix, setPrefix] = useState("");

  useEffect(() => {
    if (!bucket) return;
    fetch(`/api/objects?bucket=${bucket}&prefix=${prefix}`)
      .then(res => res.json())
      .then(setData);
  }, [bucket, prefix]);

  if (!bucket) return <div style={{ padding: 20 }}>Select a bucket</div>;

  return (
    <div style={{ flex: 1, padding: 20 }}>
      <h3>{bucket}</h3>
      <div>/{prefix}</div>

      {data.folders.map(f => (
        <TreeNode key={f.Prefix} name={f.Prefix} isFolder onClick={() => setPrefix(f.Prefix)} />
      ))}

      {data.files.map(f => (
        <TreeNode key={f.Key} name={f.Key} bucket={bucket} />
      ))}
    </div>
  );
}
