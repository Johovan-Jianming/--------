import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkbench } from '../store';
import { toast } from 'sonner';

export const ArchiveReader: React.FC = () => {
  const {
    catalogEntries,
    uploadedFiles,
    activeFileId,
    setActiveFileId,
    uploadArchiveFile,
    updateArchiveFileCatalog,
    imageRegions,
    activeRegionId,
    setActiveRegionId,
    addImageRegion,
    updateImageRegion,
    deleteImageRegion,
    loadSampleDossier,
  } = useWorkbench();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [selectedCatalogId, setSelectedCatalogId] = useState<string>('');
  const [pageIdx, setPageIdx] = useState<number>(1);

  // Mouse drag bounding-box state (in normalized 0-100% coordinates)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragCurrent, setDragCurrent] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const activeFile =
    uploadedFiles.find((f) => f.id === activeFileId) || null;
  const fileRegions = imageRegions.filter(
    (r) => activeFile && r.fileId === activeFile.id
  );
  const activeRegion =
    fileRegions.find((r) => r.id === activeRegionId) ||
    fileRegions[0] ||
    null;

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      toast.error('单个文件最大支持 20MB');
      return;
    }
    const stored = await uploadArchiveFile(file, selectedCatalogId);
    setActiveFileId(stored.id);
    toast.success(`已上传并打开档案：${stored.name}`);
    e.target.value = '';
  };

  const getRelativePercent = (clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(
      0,
      Math.min(100, ((clientX - rect.left) / rect.width) * 100)
    );
    const y = Math.max(
      0,
      Math.min(100, ((clientY - rect.top) / rect.height) * 100)
    );
    return { x, y };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!activeFile || !activeFile.mimeType.startsWith('image/')) return;
    e.preventDefault();
    const pt = getRelativePercent(e.clientX, e.clientY);
    setIsDragging(true);
    setDragStart(pt);
    setDragCurrent(pt);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setDragCurrent(getRelativePercent(e.clientX, e.clientY));
  };

  const handleMouseUp = () => {
    if (!isDragging || !dragStart || !dragCurrent || !activeFile) {
      setIsDragging(false);
      return;
    }
    setIsDragging(false);

    const nx = Math.min(dragStart.x, dragCurrent.x);
    const ny = Math.min(dragStart.y, dragCurrent.y);
    const nw = Math.abs(dragCurrent.x - dragStart.x);
    const nh = Math.abs(dragCurrent.y - dragStart.y);

    if (nw < 2 || nh < 2) {
      setDragStart(null);
      setDragCurrent(null);
      return;
    }

    const imgEl = imgRef.current;
    const natW = imgEl?.naturalWidth || 1000;
    const natH = imgEl?.naturalHeight || 1000;

    const px = Math.round((nx / 100) * natW);
    const py = Math.round((ny / 100) * natH);
    const pw = Math.round((nw / 100) * natW);
    const ph = Math.round((nh / 100) * natH);

    // Generate cropped image evidence preview via offscreen canvas
    let cropDataUrl: string | undefined;
    if (imgEl && pw > 0 && ph > 0) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(pw, 800);
        canvas.height = Math.round((ph / pw) * canvas.width);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(
            imgEl,
            px,
            py,
            pw,
            ph,
            0,
            0,
            canvas.width,
            canvas.height
          );
          cropDataUrl = canvas.toDataURL('image/jpeg', 0.88);
        }
      } catch {
        // ignore canvas taint if any
      }
    }

    const regionNum = fileRegions.length + 1;
    const created = addImageRegion({
      fileId: activeFile.id,
      catalogId: activeFile.catalogId || selectedCatalogId,
      page: pageIdx,
      label: `${activeFile.name} · 区域 #${regionNum}`,
      xywh: { x: px, y: py, w: pw, h: ph },
      normRect: {
        x: Number(nx.toFixed(2)),
        y: Number(ny.toFixed(2)),
        w: Number(nw.toFixed(2)),
        h: Number(nh.toFixed(2)),
      },
      cropDataUrl,
      ocrText: '',
      correctedText: '',
      translation: '',
      engineUsed: '待识读',
      status: 'draft',
      note: '',
    });

    setDragStart(null);
    setDragCurrent(null);
    toast.success(
      `已保存图像证据区域：xywh=(${created.xywh.x}, ${created.xywh.y}, ${created.xywh.w}, ${created.xywh.h})`
    );
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleUploadFile}
        className="hidden"
      />

      {/* Header Row (Matches Screenshot 2) */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-widest text-[#7a7166] uppercase">
            WESTERN COLLECTIONS · QING HISTORY
          </div>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1f1b17]">
            档案阅读器
          </h1>
          <p className="mt-1.5 text-sm text-[#4a433a]">
            在原始图像上定位证据，保留精确的像素坐标。
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/workbench')}
          className="rounded-[3px] bg-[#1f1b17] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#36302a]"
        >
          + 新建馆藏条目
        </button>
      </div>

      {/* Second Row Controls: Select File, Select Catalog, Upload PDF/JPG (Matches Screenshot 2) */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeFileId}
            onChange={(e) => setActiveFileId(e.target.value)}
            className="min-w-[180px] rounded-[3px] border border-[#dcd5c9] bg-white px-3.5 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
          >
            <option value="">选择档案文件</option>
            {uploadedFiles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({(f.size / 1024).toFixed(0)} KB)
              </option>
            ))}
          </select>

          <select
            value={activeFile ? activeFile.catalogId : selectedCatalogId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCatalogId(val);
              if (activeFile) {
                updateArchiveFileCatalog(activeFile.id, val);
              }
            }}
            className="min-w-[180px] rounded-[3px] border border-[#dcd5c9] bg-white px-3.5 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
          >
            <option value="">选择上传目录</option>
            {catalogEntries.map((c) => (
              <option key={c.id} value={c.id}>
                [{c.level}] {c.title} ({c.callNumber})
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 rounded-[3px] bg-[#1f1b17] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#36302a]"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
            />
          </svg>
          <span>上传 PDF / JPG</span>
        </button>
      </div>

      {/* Main Split Reader Workspace (Matches Screenshot 2) */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left 8 Cols: Original Image Viewer & Bounding Box Selector */}
        <div className="overflow-hidden rounded-[4px] border border-[#dcd5c9] bg-white lg:col-span-8">
          <div className="flex items-center justify-between border-b border-[#dcd5c9] px-5 py-3.5">
            <span className="text-xs font-semibold text-[#1f1b17]">
              原始图像
              {activeFile && (
                <span className="ml-2 font-mono font-normal text-[#7a7166]">
                  ({activeFile.name})
                </span>
              )}
            </span>

            <div className="flex items-center gap-3 text-xs text-[#7a7166]">
              <button
                type="button"
                disabled={pageIdx <= 1}
                onClick={() => setPageIdx((p) => Math.max(1, p - 1))}
                className="hover:text-[#1f1b17] disabled:opacity-40"
              >
                上一页
              </button>
              <span className="font-mono text-[#1f1b17]">
                {pageIdx} / {activeFile?.pageCount || 1}
              </span>
              <button
                type="button"
                disabled={pageIdx >= (activeFile?.pageCount || 1)}
                onClick={() => setPageIdx((p) => p + 1)}
                className="hover:text-[#1f1b17] disabled:opacity-40"
              >
                下一页
              </button>
            </div>
          </div>

          {!activeFile ? (
            <div className="flex min-h-[480px] flex-col items-center justify-center bg-[#e5e6e3]/75 p-8 text-center">
              <svg
                className="h-9 w-9 text-[#7a7166]"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.6}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <div className="mt-3 text-xs font-medium text-[#4a433a]">
                选择或上传一份档案
              </div>
              <div className="mt-1 text-[11px] text-[#7a7166]">
                原始文件将存入持久化文件存储，最大20MB。
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a]"
                >
                  ↑ 选择本地档案文件
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await loadSampleDossier();
                    toast.success(
                      '已载入示范实证手稿（魏源《圣武纪》多伦诺尔会盟案例）'
                    );
                  }}
                  className="rounded-[3px] border border-[var(--seal)] bg-[var(--seal-soft)] px-4 py-2 text-xs font-medium text-[var(--seal)] hover:bg-[#ebd5d2]"
                >
                  📚 一键载入示范实证手稿（圣武纪案例）
                </button>
              </div>
            </div>
          ) : activeFile.mimeType.startsWith('image/') ? (
            <div className="bg-[#e5e6e3]/60 p-4">
              <div className="mb-2 flex items-center justify-between text-[11px] text-[#4a433a]">
                <span>提示：按住鼠标左键在原图上拖动，即可框选文字证据区域并记录精确像素坐标。</span>
                <span className="font-mono">
                  已框选 {fileRegions.length} 处区域
                </span>
              </div>
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="relative mx-auto select-none overflow-hidden rounded border border-[#d5d8d2] bg-white shadow-xs"
                style={{ cursor: 'crosshair' }}
              >
                <img
                  ref={imgRef}
                  src={activeFile.dataUrl}
                  alt={activeFile.name}
                  draggable={false}
                  className="block max-h-[680px] w-full object-contain"
                />

                {/* Saved Bounding Boxes */}
                {fileRegions.map((reg, idx) => {
                  const isSelected = activeRegion?.id === reg.id;
                  return (
                    <div
                      key={reg.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveRegionId(reg.id);
                      }}
                      style={{
                        left: `${reg.normRect.x}%`,
                        top: `${reg.normRect.y}%`,
                        width: `${reg.normRect.w}%`,
                        height: `${reg.normRect.h}%`,
                      }}
                      className={`absolute border-2 transition ${
                        isSelected
                          ? 'border-[#1f1b17] bg-[#1f1b17]/15'
                          : 'border-amber-600/80 bg-amber-500/10 hover:border-[#1f1b17]'
                      }`}
                    >
                      <span className="absolute -top-5 left-0 rounded bg-[#1f1b17] px-1.5 py-0.5 font-mono text-[10px] text-white">
                        #{idx + 1} ({reg.xywh.x},{reg.xywh.y})
                      </span>
                    </div>
                  );
                })}

                {/* Active Drag Preview Box */}
                {isDragging && dragStart && dragCurrent && (
                  <div
                    style={{
                      left: `${Math.min(dragStart.x, dragCurrent.x)}%`,
                      top: `${Math.min(dragStart.y, dragCurrent.y)}%`,
                      width: `${Math.abs(dragCurrent.x - dragStart.x)}%`,
                      height: `${Math.abs(dragCurrent.y - dragStart.y)}%`,
                    }}
                    className="pointer-events-none absolute border-2 border-dashed border-[#1f1b17] bg-[#1f1b17]/15"
                  />
                )}
              </div>
            </div>
          ) : activeFile.mimeType === 'application/pdf' ? (
            <div className="bg-[#e5e6e3]/60 p-4">
              <iframe
                src={activeFile.dataUrl}
                title={activeFile.name}
                className="h-[640px] w-full rounded border border-[#d5d8d2] bg-white"
              />
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-[#4a433a]">
                  当前为 PDF 档案视图，可登记当前页码证据区域并送入 OCR 识读：
                </span>
                <button
                  type="button"
                  onClick={() => {
                    addImageRegion({
                      fileId: activeFile.id,
                      catalogId: activeFile.catalogId,
                      page: pageIdx,
                      label: `${activeFile.name} · 第 ${pageIdx} 页证据区`,
                      xywh: { x: 0, y: 0, w: 1200, h: 1600 },
                      normRect: { x: 5, y: 5, w: 90, h: 90 },
                      ocrText: '',
                      correctedText: '',
                      translation: '',
                      engineUsed: '待识读',
                      status: 'draft',
                      note: 'PDF 全页证据区域',
                    });
                    toast.success(`已登记 PDF 第 ${pageIdx} 页证据区域`);
                  }}
                  className="rounded-[3px] bg-[#1f1b17] px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[#36302a]"
                >
                  + 登记当前 PDF 页为证据区域
                </button>
              </div>
            </div>
          ) : (
            <div className="p-6">
              <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap rounded-[3px] bg-[#f6f4ef] p-4 font-mono text-xs text-[#1f1b17]">
                {activeFile.textContent || '（二进制文件，请使用图像或 PDF 格式进行框选）'}
              </pre>
            </div>
          )}
        </div>

        {/* Right 4 Cols: Image Evidence Region Inspector (Matches Screenshot 2) */}
        <div className="rounded-[4px] border border-[#dcd5c9] bg-white p-5 lg:col-span-4">
          <h2 className="font-serif text-base font-semibold text-[#1f1b17]">
            图像证据区域
          </h2>
          <p className="mt-1 text-xs text-[#7a7166]">
            拖动框选原图中的文字区域。
          </p>

          <select
            value={activeRegion?.id || ''}
            onChange={(e) => setActiveRegionId(e.target.value)}
            className="mt-4 w-full rounded-[3px] border border-[#dcd5c9] bg-white px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
          >
            <option value="">选择已保存的图像区域</option>
            {fileRegions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} [xywh: {r.xywh.x},{r.xywh.y},{r.xywh.w},{r.xywh.h}]
              </option>
            ))}
          </select>

          {activeRegion && (
            <div className="mt-4 space-y-4 border-t border-[#eeeae1] pt-4">
              {activeRegion.cropDataUrl && (
                <div>
                  <div className="text-[11px] font-medium text-[#4a433a]">
                    框选区域原图切片
                  </div>
                  <img
                    src={activeRegion.cropDataUrl}
                    alt={activeRegion.label}
                    className="mt-1.5 max-h-40 w-full rounded border border-[#dcd5c9] bg-[#f6f4ef] object-contain p-1"
                  />
                </div>
              )}

              <div className="rounded-[3px] bg-[#f6f4ef] p-3 font-mono text-[11px] text-[#4a433a]">
                <div>区域 ID: {activeRegion.id}</div>
                <div className="mt-0.5 text-[#1f1b17]">
                  像素坐标: x={activeRegion.xywh.x}, y={activeRegion.xywh.y}, w=
                  {activeRegion.xywh.w}, h={activeRegion.xywh.h}
                </div>
                <div className="mt-0.5">页码: 第 {activeRegion.page} 页</div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4a433a]">
                  证据区域标注名称
                </label>
                <input
                  type="text"
                  value={activeRegion.label}
                  onChange={(e) =>
                    updateImageRegion(activeRegion.id, {
                      label: e.target.value,
                    })
                  }
                  className="mt-1 w-full rounded-[3px] border border-[#dcd5c9] bg-white px-3 py-1.5 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#4a433a]">
                  定位备注 / 证据说明
                </label>
                <textarea
                  rows={3}
                  value={activeRegion.note}
                  onChange={(e) =>
                    updateImageRegion(activeRegion.id, {
                      note: e.target.value,
                    })
                  }
                  placeholder="记录该图像区域的文字特征、手写批注或证据用途..."
                  className="mt-1 w-full rounded-[3px] border border-[#dcd5c9] bg-white p-2.5 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
                />
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setActiveRegionId(activeRegion.id);
                    navigate('/proofread');
                  }}
                  className="w-full rounded-[3px] bg-[#1f1b17] px-4 py-2.5 text-xs font-medium text-white transition hover:bg-[#36302a]"
                >
                  送入 OCR 与人工校订 →
                </button>
                <button
                  type="button"
                  onClick={() => deleteImageRegion(activeRegion.id)}
                  className="w-full rounded-[3px] border border-[#dcd5c9] bg-white px-4 py-2 text-xs text-[#4a433a] hover:border-red-300 hover:text-red-600"
                >
                  删除该图像区域
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

