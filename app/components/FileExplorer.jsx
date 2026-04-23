'use client';
import { useEffect, useRef, useState } from "react";
import TreeNode from "./TreeNode";
import MetadataModal from "./MetadataModal";
import PreviewModal from "./PreviewModal";

const MULTIPART_THRESHOLD = 100 * 1024 * 1024;
const MULTIPART_PART_SIZE = 10 * 1024 * 1024;
const THEME_STORAGE_KEY = "dockyard-theme-mode";

export default function FileExplorer({ bucket }) {
  const [data, setData] = useState({ folders: [], files: [] });
  const [fetchError, setFetchError] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [refreshToken, setRefreshToken] = useState(0);
  const [menuState, setMenuState] = useState({ visible: false, x: 0, y: 0, item: null });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("");
  const [metadataModalOpen, setMetadataModalOpen] = useState(false);
  const [metadataModalKey, setMetadataModalKey] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(50);
  const [selectedKeys, setSelectedKeys] = useState([]);
  const [sortBy, setSortBy] = useState("name");
  const [sortDirection, setSortDirection] = useState("asc");
  const [actionModal, setActionModal] = useState(null);
  const [themeMode, setThemeMode] = useState("system");
  const [resolvedTheme, setResolvedTheme] = useState("dark");
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const [isPhoneLayout, setIsPhoneLayout] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(null);
  const [previewContent, setPreviewContent] = useState(null);
  const [previewImageUrl, setPreviewImageUrl] = useState(null);
  const [previewVideoUrl, setPreviewVideoUrl] = useState(null);
  const [previewExcelData, setPreviewExcelData] = useState(null);
  const [previewPdfUrl, setPreviewPdfUrl] = useState(null);
  const previewPdfObjectUrlRef = useRef(null);
  const fileInputRef = useRef(null);
  const directoryInputRef = useRef(null);
  const uploadAbortControllersRef = useRef([]);
  const uploadCancelRequestedRef = useRef(false);

  const clearPreviewPdfObjectUrl = () => {
    if (previewPdfObjectUrlRef.current) {
      URL.revokeObjectURL(previewPdfObjectUrlRef.current);
      previewPdfObjectUrlRef.current = null;
    }
  };

  const prefix = history[history.length - 1] ?? "";

  const formatBytes = (size) => {
    if (typeof size !== "number") return "-";
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
    if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const typeFromName = (name, isFolder) => {
    if (isFolder) return "Folder";
    const ext = name.split(".").pop();
    if (!ext || ext === name) return "File";
    return `${ext.toUpperCase()} file`;
  };

  const cleanLabel = (name) => name.split("/").filter(Boolean).pop() || name;

  const normalizedFolders = (data.folders || []).map((f) => ({
    key: f.Prefix,
    fullName: f.Prefix,
    label: cleanLabel(f.Prefix),
    isFolder: true,
    modifiedLabel: "-",
    type: "Folder",
    sizeLabel: "-"
  }));

  const normalizedFiles = (data.files || [])
    .filter((f) => f.Key !== prefix)
    .map((f) => ({
      key: f.Key,
      fullName: f.Key,
      label: cleanLabel(f.Key),
      isFolder: false,
      sizeRaw: Number(f.Size || 0),
      modifiedRaw: f.LastModified ? new Date(f.LastModified).getTime() : 0,
      storageClass: f.StorageClass || "STANDARD",
      modifiedLabel: f.LastModified ? new Date(f.LastModified).toLocaleString() : "-",
      type: typeFromName(cleanLabel(f.Key), false),
      sizeLabel: formatBytes(f.Size)
    }));

  const filteredFolders = normalizedFolders.filter((f) => f.label.toLowerCase().includes(searchText.toLowerCase()));
  const filteredFiles = normalizedFiles
    .filter((f) => f.label.toLowerCase().includes(searchText.toLowerCase()));

  const sortedFiles = [...filteredFiles].sort((a, b) => {
    const dir = sortDirection === "asc" ? 1 : -1;
    if (sortBy === "name") return a.label.localeCompare(b.label) * dir;
    if (sortBy === "size") return (a.sizeRaw - b.sizeRaw) * dir;
    if (sortBy === "modified") return (a.modifiedRaw - b.modifiedRaw) * dir;
    if (sortBy === "storageClass") return a.storageClass.localeCompare(b.storageClass) * dir;
    return 0;
  });

  const allItems = [...filteredFolders, ...sortedFiles];

  // Pagination logic
  const totalPages = Math.ceil(allItems.length / itemsPerPage);
  const safePage = Math.max(1, Math.min(currentPage, totalPages));
  const startIndex = (safePage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedItems = allItems.slice(startIndex, endIndex);

  const refreshListing = () => setRefreshToken((n) => n + 1);

  const closeMenu = () => {
    setMenuState({ visible: false, x: 0, y: 0, item: null });
  };

  const registerUploadController = (controller) => {
    uploadAbortControllersRef.current.push(controller);
  };

  const unregisterUploadController = (controller) => {
    uploadAbortControllersRef.current = uploadAbortControllersRef.current.filter((item) => item !== controller);
  };

  const cancelCurrentUploads = () => {
    uploadCancelRequestedRef.current = true;
    uploadAbortControllersRef.current.forEach((controller) => controller.abort());
    uploadAbortControllersRef.current = [];
    setUploadStatus("Cancelling uploads...");
  };

  useEffect(() => {
    setHistory([]);
    setSearchText("");
    setCurrentPage(1);
    setSelectedKeys([]);
  }, [bucket]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedKeys([]);
  }, [searchText, sortBy, sortDirection, prefix]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (saved === "dark" || saved === "light" || saved === "system") {
      setThemeMode(saved);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const applyTheme = () => {
      const nextTheme = themeMode === "system" ? (media.matches ? "dark" : "light") : themeMode;
      setResolvedTheme(nextTheme);
      document.documentElement.dataset.theme = nextTheme;
      document.documentElement.style.colorScheme = nextTheme;
    };

    applyTheme();
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);

    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [themeMode]);

  const openActionModal = ({ title, fields = [], submitLabel = "Submit", onSubmit, onFolderSelect, initialContent = "", initialCopyText = "" }) => {
    const values = {};
    for (const field of fields) {
      values[field.name] = field.defaultValue ?? "";
    }

    setActionModal({
      title,
      fields,
      values,
      submitLabel,
      onSubmit,
      onFolderSelect,
      busy: false,
      error: "",
      content: initialContent,
      copyText: initialCopyText,
    });
  };

  const openResultModal = ({ title, content, copyText }) => {
    setActionModal({
      title,
      fields: [],
      values: {},
      submitLabel: "Close",
      onSubmit: null,
      busy: false,
      error: "",
      content: content || "",
      copyText: copyText || "",
    });
  };

  const closeActionModal = () => setActionModal(null);

  const setModalValue = (name, value) => {
    setActionModal((prev) => ({
      ...prev,
      values: { ...prev.values, [name]: value },
    }));
  };

  const openPreview = async (file) => {
    if (file.isFolder) return;
    clearPreviewPdfObjectUrl();
    setPreviewFile(file);
    setPreviewLoading(true);
    setPreviewError(null);
    setPreviewContent(null);
    setPreviewImageUrl(null);
    setPreviewVideoUrl(null);
    setPreviewExcelData(null);
    setPreviewPdfUrl(null);

    try {
      const res = await fetch(`/api/preview?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(file.key)}`);
      const data = await res.json();
      
      if (!res.ok) {
        setPreviewError(data.error || "Failed to load preview");
        return;
      }
      
      if (data.type === "excel") {
        setPreviewExcelData({ sheets: data.sheets, sheetNames: data.sheetNames });
      } else if (data.type === "pdf") {
        const pdfRes = await fetch(
          `/api/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(file.key)}&inline=1&contentType=${encodeURIComponent("application/pdf")}`,
        );
        if (!pdfRes.ok) {
          throw new Error("Failed to load PDF content");
        }
        const pdfBlob = await pdfRes.blob();
        const objectUrl = URL.createObjectURL(pdfBlob);
        previewPdfObjectUrlRef.current = objectUrl;
        setPreviewPdfUrl(objectUrl);
      } else if (data.type === "video") {
        setPreviewVideoUrl(data.streamUrl || data.videoUrl);
      } else if (data.imageUrl) {
        setPreviewImageUrl(data.imageUrl);
      } else if (data.content) {
        setPreviewContent(data.content);
      }
    } catch (error) {
      setPreviewError(error.message || "Failed to load preview");
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    clearPreviewPdfObjectUrl();
    setPreviewFile(null);
    setPreviewLoading(false);
    setPreviewError(null);
    setPreviewContent(null);
    setPreviewImageUrl(null);
    setPreviewVideoUrl(null);
    setPreviewExcelData(null);
    setPreviewPdfUrl(null);
  };

  useEffect(() => {
    return () => {
      clearPreviewPdfObjectUrl();
    };
  }, []);

  const submitActionModal = async () => {
    if (!actionModal?.onSubmit || actionModal.busy) return;

    setActionModal((prev) => ({ ...prev, busy: true, error: "" }));
    try {
      const result = await actionModal.onSubmit(actionModal.values);
      if (result?.close) {
        closeActionModal();
        return;
      }

      if (result?.content !== undefined || result?.copyText !== undefined) {
        setActionModal((prev) => ({
          ...prev,
          busy: false,
          error: "",
          content: result.content || "",
          copyText: result.copyText || "",
        }));
        return;
      }

      setActionModal((prev) => ({ ...prev, busy: false, error: "" }));
    } catch (error) {
      setActionModal((prev) => ({
        ...prev,
        busy: false,
        error: error.message || "Action failed",
      }));
    }
  };

  useEffect(() => {
    if (!bucket) return;
    setLoading(true);
    setFetchError(null);
    fetch(`/api/objects?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(prefix)}`)
      .then(async res => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `Server error ${res.status}`);
        }
        return res.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => {
        setData({ folders: [], files: [] });
        setFetchError(err.message || "Failed to load bucket contents");
        setLoading(false);
      });
  }, [bucket, prefix, refreshToken]);

  useEffect(() => {
    const updateLayoutMode = () => {
      const width = window.innerWidth;
      setIsCompactLayout(width < 980);
      setIsPhoneLayout(width < 640);
    };

    updateLayoutMode();
    window.addEventListener("resize", updateLayoutMode);
    return () => window.removeEventListener("resize", updateLayoutMode);
  }, []);

  useEffect(() => {
    const hideMenu = () => closeMenu();
    window.addEventListener("click", hideMenu);
    return () => window.removeEventListener("click", hideMenu);
  }, []);

  const navigateTo = (folderPrefix) => {
    setHistory(h => [...h, folderPrefix]);
    setCurrentPage(1);
  };

  const navigateBack = () => {
    setHistory(h => h.slice(0, -1));
    setCurrentPage(1);
  };

  const openContextMenu = (event, item) => {
    event.preventDefault();
    setMenuState({ visible: true, x: event.clientX, y: event.clientY, item });
  };

  const handleAction = async (action) => {
    const item = menuState.item;
    closeMenu();

    if (!item) {
      return;
    }

    if (item.isFolder) {
      if (action === "open") {
        navigateTo(item.fullName);
        return;
      }

      if (action === "details") {
        openResultModal({
          title: "Folder Details",
          content: `Name: ${item.label}\nPath: ${item.fullName}\nType: Folder\nBucket: ${bucket}`,
          copyText: item.fullName,
        });
        return;
      }

      if (action === "rename") {
        openActionModal({
          title: "Rename Folder",
          fields: [
            { name: "newLabel", label: "New folder name", type: "text", defaultValue: item.label },
          ],
          submitLabel: "Rename Folder",
          onSubmit: async (values) => {
            const newLabel = (values.newLabel || "").trim().replace(/^\/+|\/+$/g, "");
            if (!newLabel || newLabel === item.label) {
              return { close: true };
            }

            const sourcePrefix = item.fullName;
            const trimmedSource = sourcePrefix.replace(/\/$/, "");
            const lastSlashIndex = trimmedSource.lastIndexOf("/");
            const parentPrefix = lastSlashIndex === -1 ? "" : `${trimmedSource.slice(0, lastSlashIndex)}/`;
            const destinationPrefix = `${parentPrefix}${newLabel}/`;

            const res = await fetch("/api/folders", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bucket, sourcePrefix, destinationPrefix }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || "Failed to rename folder");
            }

            if (prefix.startsWith(sourcePrefix)) {
              const nextPrefix = prefix.replace(sourcePrefix, destinationPrefix);
              setHistory((h) => {
                const next = [...h];
                next[next.length - 1] = nextPrefix;
                return next;
              });
            }

            refreshListing();
            return { close: true };
          },
        });
        return;
      }

      if (action === "copy") {
        openResultModal({
          title: "Folder Path",
          content: item.fullName,
          copyText: item.fullName,
        });
        return;
      }

      if (action === "delete") {
        openActionModal({
          title: "Delete Folder",
          fields: [],
          submitLabel: "Delete Folder",
          initialContent: `Delete folder and all contents?\n${item.fullName}`,
          onSubmit: async () => {
            const res = await fetch("/api/folders", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ bucket, prefix: item.fullName }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data.error || "Failed to delete folder");
            }
            refreshListing();
            return { close: true };
          },
        });
        return;
      }

      openResultModal({
        title: "Action Unavailable",
        content: "This action is not available for folders.",
      });
      return;
    }

    if (action === "download") {
      window.open(`/api/download?bucket=${bucket}&key=${encodeURIComponent(item.fullName)}`, "_blank");
      return;
    }

    if (action === "preview") {
      await openPreview(item);
      return;
    }

    if (action === "details") {
      openResultModal({
        title: "File Details",
        content: `Name: ${item.label}\nKey: ${item.fullName}\nType: ${item.type || "File"}\nSize: ${item.sizeLabel || formatBytes(item.sizeRaw || 0)}\nModified: ${item.modifiedLabel || "-"}\nStorage Class: ${item.storageClass || "STANDARD"}\nBucket: ${bucket}`,
        copyText: item.fullName,
      });
      return;
    }

    if (action === "copy") {
      openResultModal({
        title: "Object Key",
        content: item.fullName,
        copyText: item.fullName,
      });
      return;
    }

    if (action === "share") {
      const shareUrl = `${window.location.origin}/api/download?bucket=${bucket}&key=${encodeURIComponent(item.fullName)}`;
      openResultModal({
        title: "Share Link",
        content: shareUrl,
        copyText: shareUrl,
      });
      return;
    }

    if (action === "signedUrl") {
      await handleSignedUrl(item.fullName);
      return;
    }

    if (action === "archiveStatus") {
      const res = await fetch(`/api/archive?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(item.fullName)}`);
      const data = await res.json();
      if (!res.ok) {
        openResultModal({
          title: "Archive Status Error",
          content: data.error || "Failed to get archive status",
        });
        return;
      }
      openResultModal({
        title: "Archive Status",
        content: `Storage class: ${data.storageClass}\nArchive status: ${data.archiveStatus || "-"}\nRestore: ${data.restore || "Not requested"}`,
      });
      return;
    }

    if (action === "restoreArchive") {
      openActionModal({
        title: "Restore Archive",
        fields: [
          { name: "days", label: "Duration (days)", type: "number", defaultValue: "7" },
          { name: "tier", label: "Tier (Bulk|Standard|Expedited)", type: "text", defaultValue: "Standard" },
        ],
        submitLabel: "Submit Restore",
        onSubmit: async (values) => {
          const res = await fetch("/api/archive", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bucket,
              key: item.fullName,
              days: Number(values.days) || 7,
              tier: values.tier || "Standard",
            }),
          });
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || "Failed to restore archive");
          }
          return {
            content: "Restore request submitted.",
          };
        },
      });
      return;
    }

    if (action === "delete") {
      openActionModal({
        title: "Delete File",
        fields: [],
        submitLabel: "Delete",
        initialContent: `Delete \"${item.label}\"?`,
        onSubmit: async () => {
          const res = await fetch("/api/delete", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bucket, key: item.fullName }),
          });
          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || "Failed to delete file");
          }
          refreshListing();
          return { close: true };
        },
      });
      return;
    }

    if (action === "rename") {
      openActionModal({
        title: "Rename File",
        fields: [
          { name: "newLabel", label: "New file name", type: "text", defaultValue: item.label },
        ],
        submitLabel: "Rename",
        onSubmit: async (values) => {
          const newLabel = (values.newLabel || "").trim();
          if (!newLabel || newLabel === item.label) {
            return { close: true };
          }

          const parent = item.fullName.slice(0, item.fullName.length - item.label.length);
          const destinationKey = `${parent}${newLabel}`;
          await fetch("/api/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ bucket, sourceKey: item.fullName, destinationKey }),
          });
          refreshListing();
          return { close: true };
        },
      });
      return;
    }

    if (action === "bin") {
      const destinationKey = `.bin/${Date.now()}-${item.label}`;
      await fetch("/api/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bucket, sourceKey: item.fullName, destinationKey })
      });
      refreshListing();
      return;
    }

    if (action === "metadata") {
      setMetadataModalKey(item.fullName);
      setMetadataModalOpen(true);
      return;
    }

    if (action === "tags") {
      setMetadataModalKey(item.fullName);
      setMetadataModalOpen(true);
      return;
    }
  };

  const breadcrumbs = ["", ...history];

  const uploadMultipartFile = async (file, key) => {
    if (uploadCancelRequestedRef.current) {
      throw new Error("Upload cancelled");
    }

    const createRes = await fetch("/api/multipart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        bucket,
        key,
        contentType: file.type || "application/octet-stream",
      }),
    });
    const createData = await createRes.json();
    if (!createRes.ok) {
      throw new Error(createData.error || "Failed to initialize multipart upload");
    }

    const uploadId = createData.uploadId;
    const parts = [];
    let uploadedBytes = 0;

    try {
      const partCount = Math.ceil(file.size / MULTIPART_PART_SIZE);
      setUploadStatus(`Multipart: ${file.name} (${partCount} parts)`);

      for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
        if (uploadCancelRequestedRef.current) {
          throw new Error("Upload cancelled");
        }

        const start = (partNumber - 1) * MULTIPART_PART_SIZE;
        const end = Math.min(start + MULTIPART_PART_SIZE, file.size);
        const chunk = file.slice(start, end);

        const controller = new AbortController();
        registerUploadController(controller);

        const partFormData = new FormData();
        partFormData.append("action", "part-upload");
        partFormData.append("bucket", bucket);
        partFormData.append("key", key);
        partFormData.append("uploadId", uploadId);
        partFormData.append("partNumber", String(partNumber));
        partFormData.append("chunk", chunk, `${file.name}.part${partNumber}`);

        const partUploadRes = await fetch("/api/multipart", {
          method: "POST",
          body: partFormData,
          signal: controller.signal,
        }).finally(() => {
          unregisterUploadController(controller);
        });

        if (!partUploadRes.ok) {
          throw new Error(`Failed to upload part ${partNumber}`);
        }

        const partUploadData = await partUploadRes.json();
        const etag = partUploadData.etag;
        if (!etag) {
          throw new Error(`Missing ETag for uploaded part ${partNumber}`);
        }

        parts.push({ PartNumber: partNumber, ETag: etag });
        uploadedBytes += chunk.size;
        setUploadProgress(Math.min(100, Math.round((uploadedBytes / file.size) * 100)));
        setUploadStatus(`Multipart: ${file.name} (part ${partNumber}/${partCount})`);
      }

      const completeRes = await fetch("/api/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          bucket,
          key,
          uploadId,
          parts,
        }),
      });
      const completeData = await completeRes.json();
      if (!completeRes.ok) {
        throw new Error(completeData.error || "Failed to complete multipart upload");
      }
    } catch (error) {
      await fetch("/api/multipart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abort", bucket, key, uploadId }),
      });
      throw error;
    }
  };

  const uploadSingleFile = async (file, key) => {
    if (uploadCancelRequestedRef.current) {
      throw new Error("Upload cancelled");
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    const index = key.lastIndexOf("/");
    const keyPrefix = index >= 0 ? key.slice(0, index + 1) : "";
    formData.append("prefix", keyPrefix);

    setUploadStatus(`Uploading: ${file.name}`);

    const controller = new AbortController();
    registerUploadController(controller);

    const response = await fetch("/api/upload", {
      method: "POST",
      body: formData,
      signal: controller.signal,
    }).finally(() => {
      unregisterUploadController(controller);
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || "Upload failed");
    }
  };

  const handleUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    uploadCancelRequestedRef.current = false;
    uploadAbortControllersRef.current = [];
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("");

    for (const file of Array.from(files)) {
      try {
        const key = prefix ? `${prefix}${file.name}` : file.name;

        if (file.size > MULTIPART_THRESHOLD) {
          await uploadMultipartFile(file, key);
        } else {
          await uploadSingleFile(file, key);
        }

        setUploadProgress(100);
        await new Promise(resolve => setTimeout(resolve, 500));
      } catch (error) {
        const isCancelled = uploadCancelRequestedRef.current || error.name === "AbortError";
        setUploading(false);
        setUploadProgress(0);
        setUploadStatus("");
        uploadAbortControllersRef.current = [];
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        if (!isCancelled) {
          openResultModal({
            title: "Upload Error",
            content: `Upload error: ${error.message}`,
          });
        }
        return;
      }
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadStatus("");
    uploadAbortControllersRef.current = [];
    refreshListing();
    
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleLocalFolderUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    uploadCancelRequestedRef.current = false;
    uploadAbortControllersRef.current = [];
    setUploading(true);
    setUploadProgress(0);
    setUploadStatus("");

    const selected = Array.from(files);
    for (let index = 0; index < selected.length; index += 1) {
      const file = selected[index];
      const relativePath = file.webkitRelativePath || file.name;
      const key = prefix ? `${prefix}${relativePath}` : relativePath;

      try {
        if (uploadCancelRequestedRef.current) {
          throw new Error("Upload cancelled");
        }

        if (file.size > MULTIPART_THRESHOLD) {
          await uploadMultipartFile(file, key);
        } else {
          await uploadSingleFile(file, key);
        }
      } catch (error) {
        const isCancelled = uploadCancelRequestedRef.current || error.name === "AbortError";
        setUploading(false);
        setUploadProgress(0);
        setUploadStatus("");
        uploadAbortControllersRef.current = [];
        if (directoryInputRef.current) {
          directoryInputRef.current.value = "";
        }
        if (!isCancelled) {
          openResultModal({
            title: "Folder Upload Error",
            content: `Local folder upload failed: ${error.message}`,
          });
        }
        return;
      }

      setUploadProgress(Math.round(((index + 1) / selected.length) * 100));
    }

    setUploading(false);
    setUploadProgress(0);
    setUploadStatus("");
    uploadAbortControllersRef.current = [];
    refreshListing();

    if (directoryInputRef.current) {
      directoryInputRef.current.value = "";
    }
  };

  const toggleSelect = (item, checked) => {
    setSelectedKeys((prev) => {
      if (checked) {
        return prev.includes(item.fullName) ? prev : [...prev, item.fullName];
      }
      return prev.filter((key) => key !== item.fullName);
    });
  };

  const currentPageKeys = paginatedItems.map((item) => item.fullName);
  const isAllCurrentPageSelected = currentPageKeys.length > 0 && currentPageKeys.every((key) => selectedKeys.includes(key));

  const toggleSelectCurrentPage = (checked) => {
    setSelectedKeys((prev) => {
      if (checked) {
        return Array.from(new Set([...prev, ...currentPageKeys]));
      }
      return prev.filter((key) => !currentPageKeys.includes(key));
    });
  };

  const downloadSingleKey = async (key) => {
    const res = await fetch(`/api/download?bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `Failed to download ${key}`);
    }

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = key.split("/").filter(Boolean).pop() || "download";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handleBatchDownload = async () => {
    if (selectedKeys.length === 0) {
      openResultModal({
        title: "Selection Required",
        content: "Select at least one file or folder first.",
      });
      return;
    }

    try {
      const hasFolderSelection = selectedKeys.some((key) => key.endsWith("/"));

      if (!hasFolderSelection) {
        let failed = 0;
        for (const key of selectedKeys) {
          try {
            await downloadSingleKey(key);
          } catch {
            failed += 1;
          }
        }

        openResultModal({
          title: "Download",
          content: `Started: ${selectedKeys.length - failed}\nFailed: ${failed}`,
        });
        return;
      }

      const res = await fetch("/api/download-archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucket,
          keys: selectedKeys,
          basePrefix: prefix || "",
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to build archive");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `s3-download-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      openResultModal({
        title: "Download",
        content: "ZIP download started.",
      });
    } catch (error) {
      openResultModal({
        title: "Download Error",
        content: error.message || "Failed to start batch download.",
      });
    }
  };

  const parseTags = (rawTags) => {
    const tags = {};
    (rawTags || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .forEach((pair) => {
        const [k, ...rest] = pair.split("=");
        if (k && rest.length > 0) tags[k.trim()] = rest.join("=").trim();
      });
    return tags;
  };

  const executeBatchAction = async (operation, extras = {}) => {
    if (selectedKeys.length === 0) {
      openResultModal({
        title: "Selection Required",
        content: "Select at least one item first.",
      });
      return false;
    }

    const payload = { bucket, operation, keys: selectedKeys, ...extras };

    const res = await fetch("/api/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      openResultModal({
        title: "Operation Error",
        content: data.error || "Batch operation failed",
      });
      return false;
    }

    const total = (data.results || []).length;
    const failed = (data.results || []).filter((r) => !r.success).length;
    openResultModal({
      title: `Batch ${operation}`,
      content: `Success: ${Math.max(total - failed, 0)}\nFailed: ${failed}`,
    });
    setSelectedKeys([]);
    refreshListing();
    return true;
  };

  const handleBatchAction = async (operation) => {
    if (operation === "copy" || operation === "move") {
      const currentPath = prefix || "/";
      openActionModal({
        title: operation === "copy" ? "Batch Copy" : "Batch Move",
        fields: [
          { name: "destinationPrefix", label: "Destination prefix", type: "text", defaultValue: currentPath },
        ],
        submitLabel: operation === "copy" ? "Copy" : "Move",
        initialContent: `Current path: ${currentPath}`,
        onSubmit: async (values) => {
          const destinationPrefix = (values.destinationPrefix || "").trim();
          const normalizedInput = destinationPrefix === "/" ? "" : destinationPrefix.replace(/^\/+/, "");
          if (!destinationPrefix) {
            throw new Error("Destination prefix is required");
          }
          await executeBatchAction(operation, {
            destinationPrefix: normalizedInput && !normalizedInput.endsWith("/")
              ? `${normalizedInput}/`
              : normalizedInput,
          });
          return { close: true };
        },
      });
      return;
    }

    if (operation === "tag") {
      openActionModal({
        title: "Tag",
        fields: [
          { name: "rawTags", label: "Tags (key=value,key2=value2)", type: "text", defaultValue: "" },
        ],
        submitLabel: "Apply Tags",
        onSubmit: async (values) => {
          await executeBatchAction(operation, { tags: parseTags(values.rawTags) });
          return { close: true };
        },
      });
      return;
    }

    if (operation === "delete") {
      openActionModal({
        title: "Delete",
        fields: [],
        submitLabel: "Delete",
        initialContent: `Delete ${selectedKeys.length} selected item(s)?`,
        onSubmit: async () => {
          await executeBatchAction(operation);
          return { close: true };
        },
      });
      return;
    }

    await executeBatchAction(operation);
  };

  const handleCreateFolder = async () => {
    openActionModal({
      title: "Create Folder",
      fields: [{ name: "name", label: "Folder name", type: "text", defaultValue: "" }],
      submitLabel: "Create",
      onSubmit: async (values) => {
        const name = (values.name || "").trim();
        if (!name) {
          throw new Error("Folder name is required");
        }

        const res = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, prefix, name }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to create folder");
        }

        refreshListing();
        return { close: true };
      },
    });
  };

  const handleSignedUrl = async (key) => {
    openActionModal({
      title: "Generate Signed URL",
      fields: [{ name: "expiresIn", label: "Expiry (seconds)", type: "number", defaultValue: "900" }],
      submitLabel: "Generate",
      onSubmit: async (values) => {
        const res = await fetch("/api/signed-url", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucket, key, expiresIn: Number(values.expiresIn) || 900 }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to generate signed URL");
        }
        return { content: data.signedUrl, copyText: data.signedUrl };
      },
    });
  };

  const handleApiDocs = async () => {
    const res = await fetch("/api/docs");
    const data = await res.json();
    openResultModal({
      title: "API Docs JSON",
      content: JSON.stringify(data, null, 2),
      copyText: JSON.stringify(data, null, 2),
    });
  };

  const handleCliExport = async () => {
    openActionModal({
      title: "CLI Export",
      fields: [{ name: "operation", label: "Operation", type: "select", options: ["list", "cp", "sync", "rm", "mb", "rb"], defaultValue: "list" }],
      submitLabel: "Generate",
      onSubmit: async (values) => {
        const operation = (values.operation || "").trim();
        if (!operation) {
          throw new Error("Operation is required");
        }

        const res = await fetch("/api/cli-export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tool: "awscli", operation, bucket }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to export CLI command");
        }

        return { content: data.command, copyText: data.command };
      },
    });
  };

  const handleCodegen = async () => {
    openActionModal({
      title: "Codegen",
      fields: [
        { name: "language", label: "Language", type: "select", options: ["node", "python", "go"], defaultValue: "node" },
        { name: "operation", label: "Operation", type: "select", options: ["listObjects", "upload", "download"], defaultValue: "listObjects" },
      ],
      submitLabel: "Generate",
      onSubmit: async (values) => {
        const language = (values.language || "").trim();
        const operation = (values.operation || "").trim();
        if (!language || !operation) {
          throw new Error("Language and operation are required");
        }

        const res = await fetch("/api/codegen", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ language, operation, bucket }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to generate snippet");
        }

        return { content: data.snippet, copyText: data.snippet };
      },
    });
  };

  const handleAccessLogs = async () => {
    const res = await fetch(`/api/access-logs?bucket=${encodeURIComponent(bucket)}&limit=20`);
    const data = await res.json();
    if (!res.ok) {
      openResultModal({
        title: "Access Logs Error",
        content: data.error || "Failed to fetch access logs",
      });
      return;
    }
    const lines = (data.logs || []).slice(0, 20).map((log) => `${log.lastModified || "-"}  ${log.key}`);
    openResultModal({
      title: "Access Logs",
      content: lines.length > 0 ? lines.join("\n") : "No access logs found or logging not enabled.",
      copyText: lines.length > 0 ? lines.join("\n") : "",
    });
  };

  const handleBucketSettings = async () => {
    const res = await fetch(`/api/bucket-settings?bucket=${encodeURIComponent(bucket)}`);
    const data = await res.json();
    if (!res.ok) {
      openResultModal({
        title: "Bucket Settings Error",
        content: data.error || "Failed to read bucket settings",
      });
      return;
    }

    const summary = [
      `Policy: ${data.policy ? "Configured" : "Not set"}`,
      `Encryption: ${data.encryption ? "Configured" : "Not set"}`,
      `Public Access Block: ${data.publicAccessBlock ? "Configured" : "Not set"}`,
      `Logging: ${data.logging ? "Enabled" : "Disabled"}`,
    ].join("\n");

    openActionModal({
      title: "Bucket Security",
      fields: [],
      submitLabel: "Enable SSE-S3",
      initialContent: summary,
      onSubmit: async () => {
        const updateRes = await fetch("/api/bucket-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bucket,
            encryption: {
              Rules: [{
                ApplyServerSideEncryptionByDefault: { SSEAlgorithm: "AES256" },
              }],
            },
          }),
        });

        const update = await updateRes.json();
        if (!updateRes.ok) {
          throw new Error(update.error || "Failed to update bucket settings");
        }

        return { content: `${summary}\n\nSSE-S3 default encryption enabled.` };
      },
    });
  };

  const handleSyncPlan = async () => {
    openActionModal({
      title: "Sync Plan",
      fields: [
        { name: "destinationBucket", label: "Destination bucket", type: "text", defaultValue: bucket },
        { name: "destinationPrefix", label: "Destination prefix", type: "text", defaultValue: prefix },
      ],
      submitLabel: "Build Plan",
      onSubmit: async (values) => {
        const destinationBucket = (values.destinationBucket || "").trim();
        if (!destinationBucket) {
          throw new Error("Destination bucket is required");
        }

        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sourceBucket: bucket,
            sourcePrefix: prefix,
            destinationBucket,
            destinationPrefix: values.destinationPrefix || "",
            dryRun: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to build sync plan");
        }
        return { content: `Sync plan created. ${data.total} object(s) would be copied.` };
      },
    });
  };

  const handleDbSeed = async () => {
    openActionModal({
      title: "DB Seed",
      fields: [{ name: "table", label: "SQL table name", type: "text", defaultValue: "s3_objects" }],
      submitLabel: "Generate SQL",
      onSubmit: async (values) => {
        const table = (values.table || "").trim();
        if (!table) {
          throw new Error("Table name is required");
        }

        const res = await fetch(`/api/db-seed?bucket=${encodeURIComponent(bucket)}&prefix=${encodeURIComponent(prefix)}&table=${encodeURIComponent(table)}`);
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "Failed to generate seed SQL");
        }

        return {
          content: data.sql || `No rows found. Count: ${data.count}`,
          copyText: data.sql || "",
        };
      },
    });
  };

  const handleOpenUploadPicker = () => {
    openActionModal({
      title: "Upload to current location",
      fields: [
        {
          name: "uploadType",
          label: "Select what to upload",
          type: "select",
          defaultValue: "Files",
          options: ["Files", "Folders"],
        },
      ],
      submitLabel: "Continue",
      onSubmit: async (values) => {
        const uploadType = (values.uploadType || "Files").toLowerCase();
        if (uploadType === "folders") {
          directoryInputRef.current?.click();
        } else {
          fileInputRef.current?.click();
        }
        return { close: true };
      },
    });
  };

  const isLightTheme = resolvedTheme === "light";

  const theme = isLightTheme
    ? {
      appBackground: "linear-gradient(180deg, #f4f9ff, #e9f1fb)",
      headerBackground: "rgba(255, 255, 255, 0.88)",
      headerBorder: "1px solid rgba(180, 199, 222, 0.75)",
      primaryText: "#173153",
      mutedText: "#4d6e92",
      softText: "#6a85a6",
      backButtonBg: "rgba(239, 246, 255, 0.95)",
      backButtonBorder: "1px solid rgba(173, 195, 220, 0.9)",
      backButtonText: "#27486f",
      searchBg: "#ffffff",
      searchBorder: "1px solid rgba(180, 199, 222, 0.9)",
      searchText: "#163257",
      controlBg: "#ffffff",
      controlText: "#1f3d61",
      controlBorder: "1px solid rgba(180, 199, 222, 0.9)",
      contentText: "#1f3d61",
      emptyText: "#6a85a6",
      listBorder: "1px solid rgba(180, 199, 222, 0.75)",
      listHeaderBg: "#eef5ff",
      listHeaderText: "#3d5f88",
      listHeaderBorder: "1px solid rgba(180, 199, 222, 0.75)",
      toolbarSurface: "#ffffff",
      toolbarText: "#1f3d61",
      toolbarBorder: "1px solid rgba(180, 199, 222, 0.9)",
      toolbarDisabledBg: "rgba(227, 236, 247, 0.9)",
      toolbarDisabledText: "#94a8bf",
      viewToggleBg: "#ffffff",
      viewToggleText: "#2a4e78",
      crumbBase: "#6383aa",
      crumbSeparator: "#9ab1cb",
      crumbCurrent: "#1e3d63",
      crumbLink: "#2d8bc0",
      paginationBg: "rgba(255, 255, 255, 0.9)",
      paginationBorder: "1px solid rgba(180, 199, 222, 0.8)",
    }
    : {
      appBackground: "linear-gradient(180deg, rgba(9, 18, 31, 0.86), rgba(6, 12, 22, 0.75))",
      headerBackground: "rgba(10, 19, 33, 0.85)",
      headerBorder: "1px solid rgba(146, 184, 224, 0.2)",
      primaryText: "#e6f2ff",
      mutedText: "#9db4d1",
      softText: "#6e85a3",
      backButtonBg: "rgba(18, 30, 47, 0.78)",
      backButtonBorder: "1px solid rgba(146, 184, 224, 0.25)",
      backButtonText: "#dcecff",
      searchBg: "rgba(9, 18, 29, 0.78)",
      searchBorder: "1px solid rgba(146, 184, 224, 0.25)",
      searchText: "#e8f2ff",
      controlBg: "rgba(9, 18, 29, 0.78)",
      controlText: "#dcecff",
      controlBorder: "1px solid rgba(146, 184, 224, 0.25)",
      contentText: "#dcecff",
      emptyText: "#9db4d1",
      listBorder: "1px solid rgba(146, 184, 224, 0.2)",
      listHeaderBg: "rgba(9, 18, 29, 0.82)",
      listHeaderText: "#9db4d1",
      listHeaderBorder: "1px solid rgba(146, 184, 224, 0.25)",
      toolbarSurface: "rgba(9, 18, 29, 0.82)",
      toolbarText: "#dcecff",
      toolbarBorder: "1px solid rgba(146, 184, 224, 0.28)",
      toolbarDisabledBg: "rgba(62, 78, 99, 0.35)",
      toolbarDisabledText: "#6f85a2",
      viewToggleBg: "rgba(9, 18, 29, 0.82)",
      viewToggleText: "#cde4ff",
      crumbBase: "#9db4d1",
      crumbSeparator: "#7f9ab8",
      crumbCurrent: "#e6f2ff",
      crumbLink: "#7de0ff",
      paginationBg: "rgba(10, 19, 33, 0.88)",
      paginationBorder: "1px solid rgba(146, 184, 224, 0.22)",
    };

  const toolbarButtonBaseStyle = {
    border: theme.toolbarBorder,
    borderRadius: 8,
    padding: isPhoneLayout ? "6px 9px" : "7px 11px",
    fontSize: isPhoneLayout ? 11 : 12,
    fontWeight: 600,
    background: theme.toolbarSurface,
    color: theme.toolbarText,
    cursor: "pointer",
    transition: "all 0.2s ease",
  };

  const toolbarButtonDisabledStyle = {
    background: theme.toolbarDisabledBg,
    color: theme.toolbarDisabledText,
    border: theme.toolbarBorder,
    cursor: "not-allowed",
  };

  if (!bucket) return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", background: theme.appBackground, color: theme.mutedText }}>
      <div style={{ textAlign: "center" }}>
        <div className="brand-mark" style={{ justifyContent: "center", marginBottom: 14 }}>
          <span className="glyph">DS</span>
          <span>
            <span className="name" style={{ display: "block" }}>Dockyard S3 Studio</span>
            <span className="tag">Select a bucket to begin</span>
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: theme.appBackground, minHeight: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: theme.headerBackground, borderBottom: theme.headerBorder, padding: isPhoneLayout ? "10px 10px" : isCompactLayout ? "12px 12px" : "14px 20px", display: "flex", alignItems: "center", gap: isPhoneLayout ? 8 : 12, flexWrap: "wrap", backdropFilter: "blur(10px)" }}>
        <div className="brand-mark" style={{ marginRight: 8 }}>
          <span className="glyph">DS</span>
          <span>
            <span className="name" style={{ display: "block" }}>Dockyard S3 Studio</span>
            <span className="tag">Bucket Explorer</span>
          </span>
        </div>
        <button
          onClick={navigateBack}
          disabled={history.length === 0}
          style={{
            background: theme.backButtonBg,
            border: theme.backButtonBorder,
            borderRadius: 10,
            padding: isPhoneLayout ? "4px 8px" : "4px 12px",
            cursor: history.length === 0 ? "not-allowed" : "pointer",
            color: history.length === 0 ? theme.softText : theme.backButtonText,
            fontSize: isPhoneLayout ? 12 : 13,
            display: "flex",
            alignItems: "center",
            gap: 4
          }}
        >
          ← Back
        </button>
        
        <button
          onClick={handleOpenUploadPicker}
          disabled={uploading}
          style={{
            background: uploading ? "#5a799f" : "linear-gradient(140deg, #2bd2c9, #7de0ff)",
            border: "none",
            borderRadius: 10,
            padding: isPhoneLayout ? "6px 10px" : "7px 12px",
            cursor: uploading ? "not-allowed" : "pointer",
            color: "#041019",
            fontSize: isPhoneLayout ? 12 : 13,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 6,
            opacity: uploading ? 0.7 : 1
          }}
        >
          {uploading ? `⏳ Uploading ${uploadProgress}%` : "⬆️ Upload"}
        </button>

        {uploading && (
          <button
            onClick={cancelCurrentUploads}
            style={{
              background: "#c94f5f",
              border: "none",
              borderRadius: 6,
              padding: isPhoneLayout ? "6px 9px" : "7px 12px",
              cursor: "pointer",
              color: "#fff",
              fontSize: isPhoneLayout ? 12 : 13,
              fontWeight: 500
            }}
          >
            Cancel Upload
          </button>
        )}

        {uploadStatus && (
          <span style={{ fontSize: 12, color: "#4f5f7f", maxWidth: isPhoneLayout ? "100%" : 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {uploadStatus}
          </span>
        )}

        <button
          onClick={handleCreateFolder}
          style={{
            background: "linear-gradient(140deg, #ff9865, #ffc07d)",
            border: "none",
            borderRadius: 10,
            padding: isPhoneLayout ? "6px 10px" : "7px 12px",
            cursor: "pointer",
            color: "#1d140b",
            fontSize: isPhoneLayout ? 12 : 13,
            fontWeight: 700
          }}
        >
          + Folder
        </button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleUpload}
          style={{ display: "none" }}
        />

        <input
          ref={directoryInputRef}
          type="file"
          onChange={handleLocalFolderUpload}
          style={{ display: "none" }}
          webkitdirectory="true"
          directory="true"
          multiple
        />

        <input
          type="text"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          placeholder="Search files and folders"
          style={{
            minWidth: isPhoneLayout ? 120 : isCompactLayout ? 160 : 220,
            flex: 1,
            maxWidth: isCompactLayout ? "100%" : 420,
            border: theme.searchBorder,
            borderRadius: 10,
            padding: "7px 10px",
            fontSize: isPhoneLayout ? 12 : 13,
            background: theme.searchBg,
            color: theme.searchText
          }}
        />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          style={{ border: theme.controlBorder, borderRadius: 10, padding: isPhoneLayout ? "6px 8px" : "7px 10px", fontSize: isPhoneLayout ? 11 : 12, background: theme.controlBg, color: theme.controlText }}
        >
          <option value="name">Sort: Name</option>
          <option value="size">Sort: Size</option>
          <option value="modified">Sort: Date Modified</option>
          <option value="storageClass">Sort: Storage Class</option>
        </select>

        <select
          value={sortDirection}
          onChange={(e) => setSortDirection(e.target.value)}
          style={{ border: theme.controlBorder, borderRadius: 10, padding: isPhoneLayout ? "6px 8px" : "7px 10px", fontSize: isPhoneLayout ? 11 : 12, background: theme.controlBg, color: theme.controlText }}
        >
          <option value="asc">Ascending</option>
          <option value="desc">Descending</option>
        </select>

        {/* View Mode Buttons (Right side) */}
        <div style={{ marginLeft: isCompactLayout ? 0 : "auto", width: isCompactLayout ? "100%" : "auto", display: "flex", gap: isPhoneLayout ? 8 : 12, alignItems: "center", justifyContent: isCompactLayout ? "flex-end" : "flex-start", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={() => handleBatchAction("delete")}
              disabled={selectedKeys.length === 0}
              style={{
                ...toolbarButtonBaseStyle,
                ...(selectedKeys.length === 0 ? toolbarButtonDisabledStyle : {})
              }}
            >
              Delete
            </button>
            <button
              type="button"
              onClick={handleBatchDownload}
              disabled={selectedKeys.length === 0}
              style={{
                ...toolbarButtonBaseStyle,
                ...(selectedKeys.length === 0 ? toolbarButtonDisabledStyle : {})
              }}
            >
              Download
            </button>
            <button
              type="button"
              onClick={() => handleBatchAction("copy")}
              disabled={selectedKeys.length === 0}
              style={{
                ...toolbarButtonBaseStyle,
                ...(selectedKeys.length === 0 ? toolbarButtonDisabledStyle : {})
              }}
            >
              Copy
            </button>
            <button
              type="button"
              onClick={() => handleBatchAction("move")}
              disabled={selectedKeys.length === 0}
              style={{
                ...toolbarButtonBaseStyle,
                ...(selectedKeys.length === 0 ? toolbarButtonDisabledStyle : {})
              }}
            >
              Move
            </button>
            <button
              type="button"
              onClick={() => handleBatchAction("tag")}
              disabled={selectedKeys.length === 0}
              style={{
                ...toolbarButtonBaseStyle,
                ...(selectedKeys.length === 0 ? toolbarButtonDisabledStyle : {})
              }}
            >
              Tag
            </button>
            <button
              type="button"
              onClick={handleCodegen}
              style={toolbarButtonBaseStyle}
            >
              Codegen
            </button>
            <button
              type="button"
              onClick={handleCliExport}
              style={toolbarButtonBaseStyle}
            >
              CLI Export
            </button>
            <button
              type="button"
              onClick={handleDbSeed}
              style={toolbarButtonBaseStyle}
            >
              DB Seed
            </button>
          </div>

          <div style={{ display: "flex", border: theme.toolbarBorder, borderRadius: 8, overflow: "hidden", background: theme.viewToggleBg }}>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              style={{
                border: "none",
                background: viewMode === "list" ? "linear-gradient(135deg, rgba(43, 210, 201, 0.75), rgba(125, 224, 255, 0.68))" : "transparent",
                color: viewMode === "list" ? "#02131d" : theme.viewToggleText,
                padding: isPhoneLayout ? "6px 10px" : "7px 12px",
                fontSize: isPhoneLayout ? 11 : 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              List
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              style={{
                border: "none",
                borderLeft: theme.controlBorder,
                background: viewMode === "grid" ? "linear-gradient(135deg, rgba(43, 210, 201, 0.75), rgba(125, 224, 255, 0.68))" : "transparent",
                color: viewMode === "grid" ? "#02131d" : theme.viewToggleText,
                padding: isPhoneLayout ? "6px 10px" : "7px 12px",
                fontSize: isPhoneLayout ? 11 : 12,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              Tiles
            </button>
          </div>

          {/* Day/Night toggle */}
          <button
            type="button"
            onClick={() => setThemeMode(resolvedTheme === "dark" ? "light" : "dark")}
            title={resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: isPhoneLayout ? "2px 4px" : "4px 6px",
              fontSize: isPhoneLayout ? 16 : 18,
              lineHeight: 1,
              color: theme.viewToggleText,
              display: "flex",
              alignItems: "center",
            }}
          >
            {resolvedTheme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>

        {/* Breadcrumbs */}
        <nav style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 13, color: theme.crumbBase, flexWrap: "wrap", width: "100%" }}>
          {breadcrumbs.map((crumb, i) => {
            const isLast = i === breadcrumbs.length - 1;
            const label = i === 0 ? bucket : crumb.replace(breadcrumbs[i - 1], "").replace(/\/$/, "");
            return (
              <span key={i} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                {i > 0 && <span style={{ color: theme.crumbSeparator }}>/</span>}
                <span
                  onClick={() => !isLast && setHistory(history.slice(0, i))}
                  style={{
                    cursor: isLast ? "default" : "pointer",
                    color: isLast ? theme.crumbCurrent : theme.crumbLink,
                    fontWeight: isLast ? 600 : 400
                  }}
                >
                  {label || bucket}
                </span>
              </span>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: isPhoneLayout ? "10px 8px" : isCompactLayout ? "14px 12px" : "20px 24px", color: theme.contentText }}>
        {/* Pagination Controls and Items Per Page (Top) */}
        {allItems.length > 0 && (
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isPhoneLayout ? "flex-start" : "flex-end",
            flexWrap: "wrap",
            gap: isPhoneLayout ? 6 : 8,
            marginBottom: 10,
            padding: "4px 0",
          }}>
            <div style={{ fontSize: 11, color: theme.mutedText, fontWeight: 500 }}>
              Items on page: {paginatedItems.length}
            </div>
            {/* Items Per Page Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <label style={{ fontSize: 11, color: theme.mutedText, fontWeight: 400 }}>Per page:</label>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                style={{
                  border: theme.controlBorder,
                  borderRadius: 5,
                  padding: "3px 6px",
                  fontSize: 11,
                  background: theme.controlBg,
                  color: theme.controlText,
                  cursor: "pointer"
                }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

            {/* Pagination Controls - Only show when multiple pages */}
            {totalPages > 1 && (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: 6
              }}>
                <button
                  onClick={() => setCurrentPage(Math.max(1, safePage - 1))}
                  disabled={safePage === 1}
                  style={{
                    border: "none",
                    background: "transparent",
                    borderRadius: 5,
                    padding: "3px 7px",
                    cursor: safePage === 1 ? "not-allowed" : "pointer",
                    fontSize: 11,
                    color: safePage === 1 ? theme.toolbarDisabledText : theme.controlText,
                    fontWeight: 500
                  }}
                >
                  ← Prev
                </button>
                <div style={{
                  fontSize: 11,
                  color: theme.mutedText,
                  fontWeight: 400,
                }}>
                  {safePage} / {totalPages}
                </div>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, safePage + 1))}
                  disabled={safePage === totalPages}
                  style={{
                    border: "none",
                    background: "transparent",
                    borderRadius: 5,
                    padding: "3px 7px",
                    cursor: safePage === totalPages ? "not-allowed" : "pointer",
                    fontSize: 11,
                    color: safePage === totalPages ? theme.toolbarDisabledText : theme.controlText,
                    fontWeight: 500
                  }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div style={{ color: theme.softText, fontSize: 14 }}>Loading...</div>
        ) : fetchError ? (
          <div style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            padding: "40px 20px",
            borderRadius: 10,
            background: isLightTheme ? "rgba(220,50,50,0.07)" : "rgba(255,80,80,0.08)",
            border: `1px solid ${isLightTheme ? "rgba(200,50,50,0.25)" : "rgba(255,100,100,0.25)"}`,
          }}>
            <div style={{ fontSize: 28 }}>⚠️</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: isLightTheme ? "#c0392b" : "#ff7070" }}>Failed to load bucket contents</div>
            <div style={{ fontSize: 12, color: theme.mutedText, maxWidth: 480, textAlign: "center" }}>{fetchError}</div>
            <button
              onClick={() => setRefreshToken(t => t + 1)}
              style={{ marginTop: 6, fontSize: 12, padding: "6px 14px", borderRadius: 6, border: "none", cursor: "pointer", background: isLightTheme ? "#c0392b" : "rgba(255,100,100,0.2)", color: isLightTheme ? "#fff" : "#ff9090", fontWeight: 600 }}
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {allItems.length === 0 && (
              <div style={{ color: theme.emptyText, fontSize: 14 }}>This folder is empty.</div>
            )}
            {allItems.length > 0 && (
              <>
                {viewMode === "list" && (
                  <div style={{ border: theme.listBorder, borderRadius: 10, overflow: "hidden" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isCompactLayout ? (isPhoneLayout ? "28px 1fr 72px" : "36px 1fr 96px") : "36px 1fr 180px 120px 120px 120px",
                        gap: 8,
                        padding: "10px 12px",
                        background: theme.listHeaderBg,
                        borderBottom: theme.listHeaderBorder,
                        color: theme.listHeaderText,
                        fontSize: isPhoneLayout ? 11 : 12,
                        fontWeight: 700,
                        textTransform: "uppercase"
                      }}
                    >
                      <span>
                        <input
                          type="checkbox"
                          checked={isAllCurrentPageSelected}
                          onChange={(e) => toggleSelectCurrentPage(e.target.checked)}
                          style={{
                            width: 16,
                            height: 16,
                            transform: "scale(1.15)",
                            transformOrigin: "left center",
                            cursor: "pointer",
                            accentColor: isLightTheme ? "#2f7f63" : "#2bd2c9",
                          }}
                        />
                      </span>
                      <span>Name</span>
                      {isCompactLayout ? (
                        <span style={{ textAlign: "right" }}>Size</span>
                      ) : (
                        <>
                          <span>Date Modified</span>
                          <span>Type</span>
                          <span>Size</span>
                          <span>Storage</span>
                        </>
                      )}
                    </div>
                    {paginatedItems.map((item) => (
                      <TreeNode
                        key={item.key}
                        item={item}
                        viewMode="list"
                        onOpen={(target) => navigateTo(target.fullName)}
                        onPreview={openPreview}
                        onContextMenu={openContextMenu}
                        selected={selectedKeys.includes(item.fullName)}
                        onToggleSelect={toggleSelect}
                        theme={resolvedTheme}
                        compact={isCompactLayout}
                        phone={isPhoneLayout}
                      />
                    ))}
                  </div>
                )}

                {viewMode === "grid" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: `repeat(auto-fill, minmax(${isPhoneLayout ? 132 : isCompactLayout ? 150 : 180}px, 1fr))`,
                      gap: isPhoneLayout ? 8 : 12
                    }}
                  >
                    {paginatedItems.map((item) => (
                      <TreeNode
                        key={item.key}
                        item={item}
                        viewMode="grid"
                        onOpen={(target) => navigateTo(target.fullName)}
                        onPreview={openPreview}
                        onContextMenu={openContextMenu}
                        selected={selectedKeys.includes(item.fullName)}
                        onToggleSelect={toggleSelect}
                        theme={resolvedTheme}
                        compact={isCompactLayout}
                        phone={isPhoneLayout}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

      </div>

      {actionModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: isLightTheme ? "rgba(0, 0, 0, 0.3)" : "rgba(14, 20, 35, 0.42)",
            zIndex: 1200,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
          onClick={closeActionModal}
        >
          <div
            style={{
              width: "min(680px, 100%)",
              maxHeight: "80vh",
              overflowY: "auto",
              background: isLightTheme ? "#f8fcff" : "#0c1625",
              borderRadius: 12,
              border: isLightTheme ? "1px solid rgba(180, 199, 222, 0.75)" : "1px solid rgba(146, 184, 224, 0.2)",
              boxShadow: isLightTheme ? "0 22px 50px rgba(14, 30, 62, 0.15)" : "0 22px 50px rgba(0, 0, 0, 0.3)",
              padding: 18,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <h3 style={{ margin: 0, fontSize: 16, color: isLightTheme ? "#142946" : "#e6f2ff" }}>{actionModal.title}</h3>
              <button
                type="button"
                onClick={closeActionModal}
                style={{ border: "none", background: "none", cursor: "pointer", fontSize: 20, color: isLightTheme ? "#dc2626" : "#ff8a8a", padding: "0", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                ✕
              </button>
            </div>

            {actionModal.fields.map((field) => (
              <label key={field.name} style={{ display: "block", marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: isLightTheme ? "#4d6e92" : "#8fb6d8", marginBottom: 4 }}>{field.label}</div>
                {field.type === "select" ? (
                  <select
                    value={actionModal.values[field.name] ?? ""}
                    onChange={(e) => setModalValue(field.name, e.target.value)}
                    style={{
                      width: "100%",
                      border: isLightTheme ? "1px solid rgba(180, 199, 222, 0.75)" : "1px solid rgba(146, 184, 224, 0.3)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 13,
                      background: isLightTheme ? "#ffffff" : "rgba(18, 32, 52, 0.8)",
                      color: isLightTheme ? "#203a5d" : "#dcecff",
                    }}
                  >
                    <option value="">{field.placeholder || "Select..."}</option>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : field.type === "folder" ? (
                  <div style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                    <input
                      type="text"
                      value={actionModal.values[field.name] ?? ""}
                      readOnly
                      placeholder="Select a folder..."
                      style={{
                        flex: 1,
                        border: isLightTheme ? "1px solid rgba(180, 199, 222, 0.75)" : "1px solid rgba(146, 184, 224, 0.3)",
                        borderRadius: 6,
                        padding: "8px 10px",
                        fontSize: 13,
                        background: isLightTheme ? "#f9fafb" : "rgba(18, 32, 52, 0.6)",
                        color: isLightTheme ? "#666" : "#8fb6d8",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => field.folderPickerRef?.current?.click()}
                      style={{
                        border: isLightTheme ? "1px solid rgba(180, 199, 222, 0.75)" : "1px solid rgba(146, 184, 224, 0.3)",
                        borderRadius: 6,
                        padding: "8px 12px",
                        fontSize: 12,
                        background: "#4f8ef7",
                        color: "#fff",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Browse
                    </button>
                    <input
                      ref={field.folderPickerRef}
                      type="file"
                      webkitdirectory="true"
                      onChange={(e) => actionModal.onFolderSelect?.(e)}
                      style={{ display: "none" }}
                    />
                  </div>
                ) : (
                  <input
                    type={field.type || "text"}
                    value={actionModal.values[field.name] ?? ""}
                    onChange={(e) => setModalValue(field.name, e.target.value)}
                    style={{
                      width: "100%",
                      border: isLightTheme ? "1px solid rgba(180, 199, 222, 0.75)" : "1px solid rgba(146, 184, 224, 0.3)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 13,
                      background: isLightTheme ? "#ffffff" : "rgba(18, 32, 52, 0.8)",
                      color: isLightTheme ? "#203a5d" : "#dcecff",
                    }}
                  />
                )}
              </label>
            ))}

            {actionModal.error && (
              <div style={{ color: isLightTheme ? "#7d2730" : "#ff8a8a", fontSize: 12, marginBottom: 10, padding: "8px 10px", background: isLightTheme ? "#fff5f5" : "rgba(220, 53, 69, 0.12)", borderRadius: 4, border: isLightTheme ? "1px solid #fdd" : "1px solid rgba(220, 53, 69, 0.3)" }}>{actionModal.error}</div>
            )}

            {actionModal.content && (
              <div style={{ marginTop: 8, marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: isLightTheme ? "#4f5f7f" : "#8fb6d8", marginBottom: 6 }}>Content</div>
                <pre
                  style={{
                    margin: 0,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    background: isLightTheme ? "#f4f7ff" : "rgba(18, 32, 52, 0.8)",
                    border: isLightTheme ? "1px solid #d7dff0" : "1px solid rgba(146, 184, 224, 0.2)",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 12,
                    color: isLightTheme ? "#1d2a45" : "#dcecff",
                    maxHeight: 260,
                    overflow: "auto",
                  }}
                >
                  {actionModal.content}
                </pre>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 12 }}>
              {actionModal.copyText && (
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(actionModal.copyText);
                  }}
                  style={{
                    border: isLightTheme ? "1px solid #2f7f63" : "1px solid rgba(43, 210, 201, 0.4)",
                    background: isLightTheme ? "#fff" : "transparent",
                    color: isLightTheme ? "#2f7f63" : "#2bd2c9",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  Copy
                </button>
              )}

              {actionModal.onSubmit && (
                <button
                  type="button"
                  disabled={actionModal.busy}
                  onClick={submitActionModal}
                  style={{
                    border: "none",
                    background: actionModal.busy ? (isLightTheme ? "#adc2ef" : "rgba(79, 142, 247, 0.5)") : "#4f8ef7",
                    color: "#fff",
                    borderRadius: 6,
                    padding: "8px 12px",
                    fontSize: 12,
                    cursor: actionModal.busy ? "not-allowed" : "pointer",
                  }}
                >
                  {actionModal.busy ? "Working..." : actionModal.submitLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {menuState.visible && (
        <div
          style={{
            position: "fixed",
            top: menuState.y,
            left: menuState.x,
            background: "#fff",
            border: "1px solid #d7dff0",
            borderRadius: 8,
            boxShadow: "0 8px 30px rgba(24, 35, 61, 0.14)",
            zIndex: 1000,
            minWidth: 170,
            overflow: "hidden"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {(
            menuState.item?.isFolder
              ? ["open", "details", "rename", "copy", "delete"]
              : ["preview", "details", "download", "signedUrl", "archiveStatus", "restoreArchive", "metadata", "tags", "rename", "bin", "delete", "share", "copy"]
          ).map((action) => (
            <button
              key={action}
              type="button"
              onClick={() => handleAction(action)}
              style={{
                width: "100%",
                border: "none",
                background: "#fff",
                padding: "10px 12px",
                textAlign: "left",
                fontSize: 13,
                color: action === "delete" ? "#d43d3d" : "#26304a",
                cursor: "pointer"
              }}
            >
              {action === "open" ? "Open Folder" : action === "preview" ? "Preview" : action === "details" ? "Details" : action === "rename" && menuState.item?.isFolder ? "Rename Folder" : action === "bin" ? "Move to bin" : action === "metadata" ? "Edit Metadata" : action === "signedUrl" ? "Copy Signed URL" : action === "archiveStatus" ? "Archive Status" : action === "restoreArchive" ? "Restore Archive" : action === "tags" ? "Edit Tags" : action.charAt(0).toUpperCase() + action.slice(1)}
            </button>
          ))}
        </div>
      )}

      <PreviewModal
        isOpen={Boolean(previewFile)}
        file={previewFile}
        onClose={closePreview}
        isLoading={previewLoading}
        error={previewError}
        content={previewContent}
        imageUrl={previewImageUrl}
        videoUrl={previewVideoUrl}
        excelData={previewExcelData}
        pdfUrl={previewPdfUrl}
        theme={resolvedTheme}
        bucket={bucket}
      />

      <MetadataModal
        isOpen={metadataModalOpen}
        bucket={bucket}
        fileKey={metadataModalKey}
        onClose={() => {
          setMetadataModalOpen(false);
          setMetadataModalKey(null);
        }}
        onSave={() => refreshListing()}
      />
    </div>
  );
}
