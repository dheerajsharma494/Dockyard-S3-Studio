'use client';
import { useEffect, useState } from 'react';

export default function MetadataModal({ isOpen, bucket, fileKey, onClose, onSave }) {
  const [activeTab, setActiveTab] = useState('metadata');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState({
    contentType: '',
    cacheControl: '',
    contentDisposition: '',
    contentEncoding: '',
    customMetadata: {}
  });
  const [tags, setTags] = useState({});
  const [newTagKey, setNewTagKey] = useState('');
  const [newTagValue, setNewTagValue] = useState('');
  const [newMetaKey, setNewMetaKey] = useState('');
  const [newMetaValue, setNewMetaValue] = useState('');

  useEffect(() => {
    if (!isOpen || !bucket || !fileKey) return;
    
    setLoading(true);
    Promise.all([
      fetch(`/api/metadata?bucket=${bucket}&key=${encodeURIComponent(fileKey)}`).then(r => r.json()),
      fetch(`/api/tags?bucket=${bucket}&key=${encodeURIComponent(fileKey)}`).then(r => r.json())
    ]).then(([metaData, tagsData]) => {
      setMetadata({
        contentType: metaData.contentType || '',
        cacheControl: metaData.cacheControl || '',
        contentDisposition: metaData.contentDisposition || '',
        contentEncoding: metaData.contentEncoding || '',
        customMetadata: metaData.metadata || {}
      });
      setTags(tagsData.tags || {});
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load metadata/tags:', err);
      setLoading(false);
    });
  }, [isOpen, bucket, fileKey]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await Promise.all([
        fetch('/api/metadata', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket,
            key: fileKey,
            contentType: metadata.contentType,
            cacheControl: metadata.cacheControl,
            contentDisposition: metadata.contentDisposition,
            contentEncoding: metadata.contentEncoding,
            customMetadata: metadata.customMetadata,
          }),
        }),
        fetch('/api/tags', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            bucket,
            key: fileKey,
            tags,
          }),
        }),
      ]);
      
      alert('Metadata and tags updated successfully');
      onSave?.();
      onClose();
    } catch (error) {
      alert(`Save failed: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const addTag = () => {
    if (newTagKey.trim()) {
      setTags({ ...tags, [newTagKey]: newTagValue });
      setNewTagKey('');
      setNewTagValue('');
    }
  };

  const removeTag = (key) => {
    const newTags = { ...tags };
    delete newTags[key];
    setTags(newTags);
  };

  const addCustomMetadata = () => {
    const key = newMetaKey.trim();
    if (!key) return;

    setMetadata({
      ...metadata,
      customMetadata: { ...metadata.customMetadata, [key]: newMetaValue }
    });
    setNewMetaKey('');
    setNewMetaValue('');
  };

  const removeCustomMetadata = (key) => {
    const newCustom = { ...metadata.customMetadata };
    delete newCustom[key];
    setMetadata({ ...metadata, customMetadata: newCustom });
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(4, 10, 18, 0.72)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 2000,
    }}>
      <div style={{
        background: 'rgba(10, 19, 33, 0.92)',
        border: '1px solid rgba(146, 184, 224, 0.25)',
        borderRadius: 14,
        width: '90%',
        maxWidth: 600,
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.42)',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid rgba(146, 184, 224, 0.2)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#e6f2ff' }}>Edit Metadata & Tags</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: 20,
              cursor: 'pointer',
              color: '#ff9aaa',
              padding: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid rgba(146, 184, 224, 0.2)',
          background: 'rgba(8, 16, 28, 0.9)',
        }}>
          <button
            onClick={() => setActiveTab('metadata')}
            style={{
              flex: 1,
              border: 'none',
              background: activeTab === 'metadata' ? 'rgba(43, 210, 201, 0.14)' : 'transparent',
              padding: '12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'metadata' ? 600 : 400,
              color: activeTab === 'metadata' ? '#7de0ff' : '#9db4d1',
              borderBottom: activeTab === 'metadata' ? '2px solid #2bd2c9' : 'none',
            }}
          >
            Metadata
          </button>
          <button
            onClick={() => setActiveTab('tags')}
            style={{
              flex: 1,
              border: 'none',
              background: activeTab === 'tags' ? 'rgba(43, 210, 201, 0.14)' : 'transparent',
              padding: '12px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === 'tags' ? 600 : 400,
              color: activeTab === 'tags' ? '#7de0ff' : '#9db4d1',
              borderBottom: activeTab === 'tags' ? '2px solid #2bd2c9' : 'none',
            }}
          >
            Tags
          </button>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '20px',
        }}>
          {loading ? (
            <div style={{ color: '#9db4d1', textAlign: 'center', padding: '40px' }}>Loading...</div>
          ) : activeTab === 'metadata' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4e5872', marginBottom: 6 }}>
                  Content Type
                </label>
                <input
                  type="text"
                  value={metadata.contentType}
                  onChange={(e) => setMetadata({ ...metadata, contentType: e.target.value })}
                  placeholder="e.g., image/png"
                  style={{
                    width: '100%',
                    border: '1px solid #d0d5e8',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4e5872', marginBottom: 6 }}>
                  Cache Control
                </label>
                <input
                  type="text"
                  value={metadata.cacheControl}
                  onChange={(e) => setMetadata({ ...metadata, cacheControl: e.target.value })}
                  placeholder="e.g., max-age=3600"
                  style={{
                    width: '100%',
                    border: '1px solid #d0d5e8',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4e5872', marginBottom: 6 }}>
                  Content Disposition
                </label>
                <input
                  type="text"
                  value={metadata.contentDisposition}
                  onChange={(e) => setMetadata({ ...metadata, contentDisposition: e.target.value })}
                  placeholder="e.g., attachment; filename=file.txt"
                  style={{
                    width: '100%',
                    border: '1px solid #d0d5e8',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4e5872', marginBottom: 6 }}>
                  Content Encoding
                </label>
                <input
                  type="text"
                  value={metadata.contentEncoding}
                  onChange={(e) => setMetadata({ ...metadata, contentEncoding: e.target.value })}
                  placeholder="e.g., gzip"
                  style={{
                    width: '100%',
                    border: '1px solid #d0d5e8',
                    borderRadius: 6,
                    padding: '8px 10px',
                    fontSize: 13,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#9db4d1' }}>
                    Custom Metadata
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <input
                    type="text"
                    value={newMetaKey}
                    onChange={(e) => setNewMetaKey(e.target.value)}
                    placeholder="Metadata key"
                    style={{ width: '50%', border: '1px solid #d0d5e8', borderRadius: 6, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }}
                  />
                  <input
                    type="text"
                    value={newMetaValue}
                    onChange={(e) => setNewMetaValue(e.target.value)}
                    placeholder="Metadata value"
                    style={{ width: '50%', border: '1px solid #d0d5e8', borderRadius: 6, padding: '8px 10px', fontSize: 13, boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={addCustomMetadata}
                    style={{
                      background: 'linear-gradient(140deg, #2bd2c9, #7de0ff)',
                      color: '#041019',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 12px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Add
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {Object.entries(metadata.customMetadata).map(([key, value]) => (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: 'rgba(8, 16, 28, 0.75)',
                      padding: '8px 10px',
                      borderRadius: 4,
                      border: '1px solid rgba(146, 184, 224, 0.2)',
                    }}>
                      <div style={{ flex: 1, fontSize: 12, color: '#dcecff' }}>
                        <strong>{key}:</strong> {value}
                      </div>
                      <button
                        onClick={() => removeCustomMetadata(key)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#d43d3d',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{
                display: 'flex',
                gap: 8,
                alignItems: 'flex-end',
              }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4e5872', marginBottom: 6 }}>
                    Tag Key
                  </label>
                  <input
                    type="text"
                    value={newTagKey}
                    onChange={(e) => setNewTagKey(e.target.value)}
                    placeholder="e.g., environment"
                    style={{
                      width: '100%',
                      border: '1px solid #d0d5e8',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#4e5872', marginBottom: 6 }}>
                    Tag Value
                  </label>
                  <input
                    type="text"
                    value={newTagValue}
                    onChange={(e) => setNewTagValue(e.target.value)}
                    placeholder="e.g., production"
                    style={{
                      width: '100%',
                      border: '1px solid #d0d5e8',
                      borderRadius: 6,
                      padding: '8px 10px',
                      fontSize: 13,
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
                <button
                  onClick={addTag}
                  style={{
                    background: '#4f8ef7',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 14px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  Add Tag
                </button>
              </div>

              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}>
                {Object.entries(tags).length === 0 ? (
                  <div style={{ color: '#999', fontSize: 13, textAlign: 'center', padding: '20px' }}>
                    No tags yet
                  </div>
                ) : (
                  Object.entries(tags).map(([key, value]) => (
                    <div key={key} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#f8f9fc',
                      padding: '10px',
                      borderRadius: 6,
                      border: '1px solid #e1e7f5',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#4e5872' }}>{key}</div>
                        <div style={{ fontSize: 12, color: '#888' }}>{value}</div>
                      </div>
                      <button
                        onClick={() => removeTag(key)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#d43d3d',
                          cursor: 'pointer',
                          padding: '4px 8px',
                          fontSize: 14,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex',
          gap: 10,
          padding: '16px 20px',
          borderTop: '1px solid rgba(146, 184, 224, 0.2)',
          justifyContent: 'flex-end',
          background: 'rgba(8, 16, 28, 0.9)',
        }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              border: '1px solid #d0d5e8',
              background: '#fff',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
              color: '#333',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              background: saving ? '#e0e4ef' : '#4f8ef7',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '8px 16px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
