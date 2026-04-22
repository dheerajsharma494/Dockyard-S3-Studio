'use client';

export default function TreeNode({ name, isFolder, onClick, bucket }) {
  const clean = name.split("/").filter(Boolean).pop();

  const deleteFile = async () => {
    if (!confirm("Delete file?")) return;

    await fetch("/api/delete", {
      method: "DELETE",
      body: JSON.stringify({ bucket, key: name })
    });

    location.reload();
  };

  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: 5 }}>
      <div onClick={onClick} style={{ cursor: "pointer" }}>
        {isFolder ? "📁" : "📄"} {clean}
      </div>

      {!isFolder && (
        <div>
          <a href={`/api/download?bucket=${bucket}&key=${name}`}>⬇️</a>
          <button onClick={deleteFile}>❌</button>
        </div>
      )}
    </div>
  );
}
