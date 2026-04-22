'use client';
import { useEffect, useState } from "react";

export default function BucketList({ onSelect }) {
  const [buckets, setBuckets] = useState([]);

  useEffect(() => {
    fetch("/api/buckets")
      .then(res => res.json())
      .then(setBuckets);
  }, []);

  return (
    <div style={{ width: "25%", background: "#111", color: "#fff", padding: 10 }}>
      <h3>Buckets</h3>
      {buckets.map(b => (
        <div key={b.Name} onClick={() => onSelect(b.Name)} style={{ cursor: "pointer", padding: 5 }}>
          {b.Name}
        </div>
      ))}
    </div>
  );
}
