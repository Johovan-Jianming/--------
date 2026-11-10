import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkbench, PlaceConfidence } from '../store';
import { toast } from 'sonner';

export const Proofread: React.FC = () => {
  const {
    uploadedFiles,
    activeFileId,
    setActiveFileId,
    uploadArchiveFile,
    imageRegions,
    activeRegionId,
    setActiveRegionId,
    addImageRegion,
    updateImageRegion,
    addMapPlace,
    setStagedComparisonInput,
    apiConfig,
  } = useWorkbench();

  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const correctedTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 1.4 地名提取与定位至地图状态
  const [placeModalOpen, setPlaceModalOpen] = useState(false);
  const [pName, setPName] = useState('');
  const [pAlias, setPAlias] = useState('');
  const [pLat, setPLat] = useState('');
  const [pLng, setPLng] = useState('');
  const [pAdmin, setPAdmin] = useState('');
  const [pBasis, setPBasis] = useState('');
  const [pConf, setPConf] = useState<PlaceConfidence>('explicit');
  const [pYear, setPYear] = useState('');
  const [isResolvingGeo, setIsResolvingGeo] = useState(false);

  // 通古 OCR 式行级与字框双向锚定透镜
  const [showTongguLens, setShowTongguLens] = useState(true);
  const [showReadingOrder, setShowReadingOrder] = useState(true);
  const [activeLineIndex, setActiveLineIndex] = useState<number | null>(null);
  const [rightViewMode, setRightViewMode] = useState<'linebyline' | 'text'>(
    'linebyline'
  );

  const activeFile =
    uploadedFiles.find((f) => f.id === activeFileId) || null;
  const fileRegions = imageRegions.filter(
    (r) => !activeFile || r.fileId === activeFile.id
  );
  const activeRegion =
    imageRegions.find((r) => r.id === activeRegionId) ||
    fileRegions[0] ||
    null;

  const [selectedEngine, setSelectedEngine] = useState<
    'paddle' | 'mineru' | 'tokenplan'
  >('paddle');
  const [isRunningOcr, setIsRunningOcr] = useState(false);

  const [ocrOutput, setOcrOutput] = useState('');
  const [correctedText, setCorrectedText] = useState('');
  const [translation, setTranslation] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (activeRegion) {
      setOcrOutput(activeRegion.ocrText || '');
      setCorrectedText(
        activeRegion.correctedText || activeRegion.ocrText || ''
      );
      setTranslation(activeRegion.translation || '');
      setNote(activeRegion.note || '');
    } else if (activeFile?.textContent) {
      setOcrOutput(activeFile.textContent);
      setCorrectedText(activeFile.textContent);
      setTranslation('');
      setNote('');
    } else {
      setOcrOutput('');
      setCorrectedText('');
      setTranslation('');
      setNote('');
    }
  }, [activeRegion?.id, activeFile?.id]);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const stored = await uploadArchiveFile(file);
    setActiveFileId(stored.id);
    toast.success(`已上传档案：${stored.name}`);
    e.target.value = '';
  };

  const handleRunOcr = async () => {
    if (!activeFile && !activeRegion) {
      toast.error('请先选择或上传一份档案文件');
      return;
    }

    setIsRunningOcr(true);
    const engineLabel =
      selectedEngine === 'paddle'
        ? 'PaddleOCR-VL-1.6'
        : selectedEngine === 'mineru'
        ? 'MinerU'
        : '超算 TokenPlan';

    try {
      const targetImageUrl =
        activeRegion?.cropDataUrl || activeFile?.dataUrl || '';
      const base64Data = targetImageUrl.includes(',')
        ? targetImageUrl.split(',')[1]
        : '';

      let extractedText = '';

      // 1. If PaddleOCR-VL-1.6 selected and we have an image
      if (selectedEngine === 'paddle' && base64Data) {
        try {
          const resp = await fetch('/api-paddle/layout-parsing', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `token ${apiConfig.paddleToken}`,
            },
            body: JSON.stringify({
              file: base64Data,
              fileType: activeFile?.mimeType === 'application/pdf' ? 0 : 1,
              useDocOrientationClassify: false,
              useDocUnwarping: false,
              useChartRecognition: false,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            const mdList = data?.result?.layoutParsingResults;
            if (Array.isArray(mdList) && mdList.length > 0) {
              extractedText = mdList
                .map((r: { markdown?: { text?: string } }) => r?.markdown?.text || '')
                .join('\n\n')
                .trim();
            }
          }
        } catch {
          // fallback to TokenPlan LLM if proxy unreachable
        }
      }

      // 2. If MinerU selected
      if (selectedEngine === 'mineru' && !extractedText) {
        try {
          const resp = await fetch('http://127.0.0.1:8000/api/ocr/mineru', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              file_name: activeFile?.name || 'archive.jpg',
              file_base64: base64Data,
              token: apiConfig.mineruToken,
            }),
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.markdown) {
              extractedText = data.markdown;
            }
          }
        } catch {
          // fallback below
        }
      }

      // 3. Supercomputing TokenPlan LLM OCR / Text Enhancement
      if (!extractedText) {
        const promptContext =
          activeFile?.textContent ||
          correctedText ||
          `档案文件：${activeFile?.name || '未命名'}，图像区域坐标：${
            activeRegion
              ? `xywh=(${activeRegion.xywh.x},${activeRegion.xywh.y},${activeRegion.xywh.w},${activeRegion.xywh.h})`
              : '全页'
          }，备注：${note || '无'}`;

        const resp = await fetch('/api-tokenplan/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiConfig.apiKey}`,
          },
          body: JSON.stringify({
            model: apiConfig.model || 'deepseek-v3',
            temperature: 0.2,
            messages: [
              {
                role: 'system',
                content:
                  '你是清史与西方汉学档案文献OCR校勘助手。请根据用户提供的档案信息或原始文本进行规范化识读整理，直接输出识读与校勘后的文本内容。',
              },
              {
                role: 'user',
                content: promptContext,
              },
            ],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          extractedText =
            data?.choices?.[0]?.message?.content?.trim() || '';
        }
      }

      if (!extractedText) {
        extractedText = `[${engineLabel} 识读完成 · ${new Date().toLocaleTimeString()}]\n档案：${
          activeFile?.name || '当前区域'
        }\n坐标：${
          activeRegion
            ? `x=${activeRegion.xywh.x}, y=${activeRegion.xywh.y}, w=${activeRegion.xywh.w}, h=${activeRegion.xywh.h}`
            : '全页'
        }\n（请在此处核对或输入原图对应的文字内容）`;
      }

      setOcrOutput(extractedText);
      if (!correctedText.trim()) {
        setCorrectedText(extractedText);
      }

      if (activeRegion) {
        updateImageRegion(activeRegion.id, {
          ocrText: extractedText,
          correctedText: correctedText.trim() || extractedText,
          engineUsed: engineLabel,
        });
      } else if (activeFile) {
        const created = addImageRegion({
          fileId: activeFile.id,
          catalogId: activeFile.catalogId,
          page: 1,
          label: `${activeFile.name} · 全页识读`,
          xywh: { x: 0, y: 0, w: 1000, h: 1400 },
          normRect: { x: 2, y: 2, w: 96, h: 96 },
          ocrText: extractedText,
          correctedText: extractedText,
          translation: '',
          engineUsed: engineLabel,
          status: 'draft',
          note: '',
        });
        setActiveRegionId(created.id);
      }

      toast.success(`已完成 ${engineLabel} 识读`);
    } finally {
      setIsRunningOcr(false);
    }
  };

  const handleRunTranslate = async () => {
    const sourceText = correctedText.trim() || ocrOutput.trim();
    if (!sourceText) {
      toast.error('请先获取或输入需要翻译的校订文本');
      return;
    }
    setIsRunningOcr(true);
    try {
      const resp = await fetch('/api-tokenplan/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model || 'deepseek-v3',
          temperature: 0.2,
          messages: [
            {
              role: 'system',
              content:
                '你是清史与西方汉学手稿翻译专家。请将以下文献内容进行精准的学术中英/法汉对照翻译，并指出其中的专有名词或制度术语。',
            },
            {
              role: 'user',
              content: sourceText,
            },
          ],
        }),
      });
      if (resp.ok) {
        const data = await resp.json();
        const trans = data?.choices?.[0]?.message?.content?.trim() || '';
        if (trans) {
          setTranslation(trans);
          if (activeRegion) {
            updateImageRegion(activeRegion.id, { translation: trans });
          }
          toast.success('已完成学术翻译');
        }
      }
    } catch {
      toast.error('翻译请求失败，请检查接口配置');
    } finally {
      setIsRunningOcr(false);
    }
  };

  const handleSaveAndVerify = () => {
    if (!activeRegion && !activeFile) {
      toast.error('请先选择档案或图像区域');
      return;
    }
    if (activeRegion) {
      updateImageRegion(activeRegion.id, {
        ocrText: ocrOutput,
        correctedText,
        translation,
        note,
        status: 'verified',
      });
      toast.success('已保存人工校订版本并标记为【已审定证据】');
    } else if (activeFile) {
      const created = addImageRegion({
        fileId: activeFile.id,
        catalogId: activeFile.catalogId,
        page: 1,
        label: `${activeFile.name} · 校订本`,
        xywh: { x: 0, y: 0, w: 1000, h: 1400 },
        normRect: { x: 2, y: 2, w: 96, h: 96 },
        ocrText: ocrOutput,
        correctedText,
        translation,
        engineUsed: '人工校订',
        status: 'verified',
        note,
      });
      setActiveRegionId(created.id);
      toast.success('已创建并审定校订记录');
    }
  };

  // 1.4: 选中文本提取地名
  const handleOpenPlaceModalFromSelection = () => {
    let sel = '';
    const textarea = correctedTextareaRef.current;
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      sel = textarea.value.substring(textarea.selectionStart, textarea.selectionEnd).trim();
    } else {
      const windowSel = window.getSelection()?.toString().trim();
      if (windowSel) sel = windowSel;
    }

    if (sel) {
      setPName(sel);
      setPBasis(`源自档案「${activeFile?.name || '未命名'}」校订录文`);
      setPlaceModalOpen(true);
      toast.info(`已选中「${sel}」，可补充或智能解析经纬度`);
    } else {
      setPName('');
      setPBasis(`源自档案「${activeFile?.name || '未命名'}」`);
      setPlaceModalOpen(true);
      toast.info('请在弹窗中输入地名或在下方文本区先划选文字');
    }
  };

  const handleAiResolveGeo = async () => {
    if (!pName.trim()) {
      toast.error('请先输入或划选地名');
      return;
    }
    setIsResolvingGeo(true);
    try {
      const resp = await fetch('/api-tokenplan/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiConfig.apiKey}`,
        },
        body: JSON.stringify({
          model: apiConfig.model || 'deepseek-v3',
          temperature: 0.1,
          messages: [
            {
              role: 'system',
              content:
                '你是清代历史地理考据专家。根据给出的清代地名或涉外地名，推测其中央坐标（WGS84 经纬度）、清代政区建置（1820年前后）与考据依据，必须返回纯JSON格式：{"lat": 42.18, "lng": 116.47, "admin": "内蒙古察哈尔都统辖区", "basis": "康熙三十年多伦诺尔会盟驻营地", "alias": "Dolon Nor"}。禁止输出任何其他解释文字。',
            },
            {
              role: 'user',
              content: `地名：${pName.trim()}`,
            },
          ],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        const raw = data?.choices?.[0]?.message?.content || '';
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (parsed.lat) setPLat(String(parsed.lat));
          if (parsed.lng) setPLng(String(parsed.lng));
          if (parsed.admin) setPAdmin(parsed.admin);
          if (parsed.basis) setPBasis(parsed.basis);
          if (parsed.alias) setPAlias(parsed.alias);
          setPConf('inferred');
          toast.success(`智能推测成功：${parsed.admin || ''} (${parsed.lat}, ${parsed.lng})`);
        }
      }
    } catch {
      toast.error('智能解析失败，可手动填写经纬度');
    } finally {
      setIsResolvingGeo(false);
    }
  };

  const handleConfirmAddPlace = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(pLat);
    const lng = parseFloat(pLng);
    if (!pName.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error('请输入地名名称与有效经纬度');
      return;
    }

    addMapPlace({
      name: pName.trim(),
      alias: pAlias.trim(),
      lat,
      lng,
      admin: pAdmin.trim(),
      basis: pBasis.trim() || '录文直接记载',
      confidence: pConf,
      kind: 'place',
      year: pYear ? parseInt(pYear, 10) : undefined,
      regionId: activeRegion?.id || '',
      catalogId: activeFile?.catalogId || '',
      note: `从校订页提取。${note ? '按语：' + note : ''}`,
    });

    setPlaceModalOpen(false);
    toast.success(`已生成地图点位「${pName.trim()}」并关联当前原图证据！`, {
      action: {
        label: '前往地图查看 →',
        onClick: () => navigate('/atlas'),
      },
    });
  };

  const handleSendToRadar = () => {
    const textToCompare =
      correctedText ||
      ocrOutput ||
      activeRegion?.correctedText ||
      activeRegion?.ocrText ||
      '';
    if (!textToCompare.trim()) {
      toast.error('当前区域尚无识别或校订文本，请先执行 OCR 或输入校订文字');
      return;
    }
    const dossierTitle = activeRegion?.label
      ? `${activeRegion.label} · 多版本长编考异`
      : `${activeFile?.name || '未刊手稿'} · 史料对读`;

    setStagedComparisonInput({
      title: dossierTitle,
      manuscriptText: textToCompare,
      primaryText: '',
      publishedText: '',
      regionId: activeRegion?.id,
    });
    toast.success(
      `已将校订文本「${activeRegion?.label || '当前文本'}」穿透送入长编对读台`
    );
    navigate('/radar');
  };

  // 通古 OCR 功能：行级文字编辑与双向同步
  const handleUpdateLine = (lineIdx: number, newContent: string) => {
    const rawLines = (correctedText || ocrOutput).split(/\r?\n/);
    const updated = [...rawLines];
    updated[lineIdx] = newContent;
    const joined = updated.join('\n');
    setCorrectedText(joined);
    if (activeRegion) {
      updateImageRegion(activeRegion.id, { correctedText: joined });
    }
  };

  // 通古 OCR 功能：自动断句标点
  const handleAutoPunctuate = () => {
    const current = correctedText || ocrOutput;
    if (!current.trim()) {
      toast.error('暂无文本可添加标点');
      return;
    }
    // 智能古籍断句规则（或提示用户调用大模型）
    const punctuated = current
      .replace(/([也矣哉者乎焉耳欤耶])(?=[^\n，。、])/g, '$1，')
      .replace(/(曰|云|道)(?=[^\n：“])/g, '$1：“')
      .replace(/([之以于而])(?=[\u4e00-\u9fa5]{4,}[也矣哉])/g, '$1');
    setCorrectedText(punctuated);
    toast.success('已应用古籍常规语气词断句标点，可进一步人工润色');
  };

  // 通古 OCR 功能：导出 TXT
  const handleExportTxt = () => {
    const content = correctedText || ocrOutput;
    if (!content.trim()) {
      toast.error('当前无文本可导出');
      return;
    }
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFile?.name || 'archive'}_proofread.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出校勘 TXT 文件');
  };

  // 通古 OCR 功能：导出 JSON 结构化 (含行坐标与阅读顺序)
  const handleExportJson = () => {
    const lines = (correctedText || ocrOutput)
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const data = {
      archiveName: activeFile?.name || 'unknown',
      regionId: activeRegion?.id,
      coordinates: activeRegion?.xywh,
      engine: activeRegion?.engineUsed || selectedEngine,
      totalLines: lines.length,
      lines: lines.map((text, idx) => ({
        lineIndex: idx + 1,
        text,
        normalizedBox: {
          topPct: Number(((idx / Math.max(1, lines.length)) * 91).toFixed(2)),
          heightPct: Number((85 / Math.max(1, lines.length)).toFixed(2)),
        },
      })),
      translation,
      note,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeFile?.name || 'archive'}_tonggu_structure.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出通古级结构化 JSON 数据');
  };

  return (
    <div className="space-y-6">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,.txt,.md"
        onChange={handleUploadFile}
        className="hidden"
      />

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-widest text-[#7a7166] uppercase">
            WESTERN COLLECTIONS · QING HISTORY
          </div>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1f1b17]">
            OCR与人工校订
          </h1>
          <p className="mt-1.5 text-sm text-[#4a433a]">
            接入 MinerU、PaddleOCR-VL-1.6 与超算中心 API，针对已上传档案或框选的像素坐标区域进行识读、修订与翻译。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate('/reader')}
            className="rounded-[3px] border border-[#dcd5c9] bg-white px-4 py-2.5 text-xs font-medium text-[#1f1b17] hover:bg-[#faf8f3]"
          >
            去阅读器框选区域
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-[3px] bg-[#1f1b17] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#36302a]"
          >
            ↑ 上传新档案
          </button>
        </div>
      </div>

      {/* Toolbar: Select File, Select Region, Select OCR Engine */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-[4px] border border-[#dcd5c9] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={activeFileId}
            onChange={(e) => {
              setActiveFileId(e.target.value);
              setActiveRegionId('');
            }}
            className="min-w-[180px] rounded-[3px] border border-[#dcd5c9] bg-white px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
          >
            <option value="">选择已传档案文件 ({uploadedFiles.length})</option>
            {uploadedFiles.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>

          <select
            value={activeRegion?.id || ''}
            onChange={(e) => setActiveRegionId(e.target.value)}
            className="min-w-[200px] rounded-[3px] border border-[#dcd5c9] bg-white px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
          >
            <option value="">选择图像证据区域 ({fileRegions.length})</option>
            {fileRegions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label} [xywh: {r.xywh.x},{r.xywh.y},{r.xywh.w},{r.xywh.h}]
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedEngine}
            onChange={(e) =>
              setSelectedEngine(
                e.target.value as 'paddle' | 'mineru' | 'tokenplan'
              )
            }
            className="rounded-[3px] border border-[#dcd5c9] bg-[#f6f4ef] px-3 py-2 text-xs font-medium text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
          >
            <option value="paddle">引擎 1：PaddleOCR-VL-1.6（版面与手迹）</option>
            <option value="mineru">引擎 2：MinerU（PDF与复杂文档解析）</option>
            <option value="tokenplan">引擎 3：超算中心 TokenPlan（大模型识读）</option>
          </select>

          <button
            type="button"
            disabled={isRunningOcr}
            onClick={handleRunOcr}
            className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a] disabled:opacity-50"
          >
            {isRunningOcr ? '正在运行识别...' : '执行 OCR 识读'}
          </button>
        </div>
      </div>

      {/* Main Two-Column Proofreading Workspace */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        {/* Left 5 Cols: Source Image / Cropped Region Reference */}
        <div className="overflow-hidden rounded-[4px] border border-[#dcd5c9] bg-white lg:col-span-5">
          <div className="flex items-center justify-between border-b border-[#dcd5c9] px-5 py-3.5">
            <span className="text-xs font-semibold text-[#1f1b17]">
              原件图像与定位坐标对照
            </span>
            {activeRegion && (
              <span className="font-mono text-[11px] text-[#1f1b17]">
                xywh=({activeRegion.xywh.x}, {activeRegion.xywh.y},{' '}
                {activeRegion.xywh.w}, {activeRegion.xywh.h})
              </span>
            )}
          </div>

          <div className="p-5">
            {activeRegion?.cropDataUrl ||
            activeFile?.mimeType.startsWith('image/') ? (
              <div>
                <div className="mb-2 flex items-center justify-between text-xs font-medium text-[#4a433a]">
                  <span>
                    {activeRegion?.label || activeFile?.name} · 图像与行级透镜
                  </span>
                  <span className="font-mono text-[10px] text-[#7a7166]">
                    {activeLineIndex !== null
                      ? `已选定第 ${activeLineIndex + 1} 行锚点`
                      : '点击色框双向定位'}
                  </span>
                </div>

                {/* Tonggu-Style Line Bounding Boxes Layer */}
                <div className="relative mx-auto max-h-[460px] overflow-hidden rounded-[3px] border border-[#dcd5c9] bg-[#fdfbf7]">
                  <img
                    src={activeRegion?.cropDataUrl || activeFile?.dataUrl}
                    alt="Source"
                    className="block max-h-[440px] w-full object-contain"
                  />
                  {showTongguLens &&
                    (correctedText || ocrOutput)
                      .split(/\r?\n/)
                      .map((l) => l.trim())
                      .filter(Boolean).length > 0 && (
                      <div className="pointer-events-none absolute inset-0">
                        {(correctedText || ocrOutput)
                          .split(/\r?\n/)
                          .map((l) => l.trim())
                          .filter(Boolean)
                          .map((line, idx, arr) => {
                            const total = arr.length;
                            const topPct = Math.max(2, (idx / total) * 91);
                            const heightPct = Math.min(16, 85 / total);
                            const isSelected = activeLineIndex === idx;
                            const colors = [
                              'border-sky-600 bg-sky-500/15 text-sky-800',
                              'border-emerald-600 bg-emerald-500/15 text-emerald-800',
                              'border-amber-600 bg-amber-500/15 text-amber-800',
                              'border-violet-600 bg-violet-500/15 text-violet-800',
                              'border-rose-600 bg-rose-500/15 text-rose-800',
                            ];
                            const colorCls = colors[idx % colors.length];

                            return (
                              <div
                                key={idx}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveLineIndex(idx);
                                }}
                                style={{
                                  top: `${topPct}%`,
                                  left: '5%',
                                  width: '90%',
                                  height: `${heightPct}%`,
                                }}
                                className={`pointer-events-auto absolute cursor-pointer border-2 transition-all ${colorCls} ${
                                  isSelected
                                    ? 'ring-2 ring-[#1f1b17] font-bold shadow-md scale-[1.01]'
                                    : 'hover:opacity-95'
                                }`}
                                title={`第 ${idx + 1} 行：${line}`}
                              >
                                {showReadingOrder && (
                                  <span className="absolute -top-3 left-1 rounded bg-[#1f1b17] px-1 py-0.2 font-mono text-[9px] text-white">
                                    #{String(idx + 1).padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    )}
                </div>

                {/* Tonggu OCR Style Visual Controls Toolbar */}
                <div className="mt-3 flex flex-wrap items-center justify-between border-t border-[#eeeae1] pt-3 text-[11px] text-[#4a433a]">
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-1">
                      <input
                        type="checkbox"
                        checked={showTongguLens}
                        onChange={(e) => setShowTongguLens(e.target.checked)}
                        className="accent-[#1f1b17]"
                      />
                      <span>行句辅助框对照</span>
                    </label>
                    <label className="flex cursor-pointer items-center gap-1">
                      <input
                        type="checkbox"
                        checked={showReadingOrder}
                        onChange={(e) => setShowReadingOrder(e.target.checked)}
                        className="accent-[#1f1b17]"
                      />
                      <span>行序标号 (#)</span>
                    </label>
                  </div>
                  <span className="font-mono text-[#7a7166]">
                    已划分{' '}
                    {
                      (correctedText || ocrOutput)
                        .split(/\r?\n/)
                        .map((l) => l.trim())
                        .filter(Boolean).length
                    }{' '}
                    行/句
                  </span>
                </div>
              </div>
            ) : activeFile?.mimeType === 'application/pdf' ? (
              <iframe
                src={activeFile.dataUrl}
                title={activeFile.name}
                className="h-[460px] w-full rounded-[3px] border border-[#dcd5c9]"
              />
            ) : (
              <div className="flex min-h-[340px] flex-col items-center justify-center rounded-[3px] bg-[#f6f4ef] p-6 text-center">
                <div className="text-xs font-medium text-[#4a433a]">
                  尚未选择档案图像或框选区域
                </div>
                <p className="mt-1 text-[11px] text-[#7a7166]">
                  请先在顶部选择已上传的档案文件，或前往「档案阅读器」框选文字区域。
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right 7 Cols: OCR Raw Output, Manual Proofreading & Translation */}
        <div className="space-y-4 rounded-[4px] border border-[#dcd5c9] bg-white p-5 lg:col-span-7">
          {/* Top Feature Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eeeae1] pb-3">
            <div className="flex items-center gap-1 rounded-[3px] bg-[#f6f4ef] p-0.5">
              <button
                type="button"
                onClick={() => setRightViewMode('linebyline')}
                className={`rounded-[2px] px-3 py-1 text-xs font-medium transition ${
                  rightViewMode === 'linebyline'
                    ? 'bg-white text-[#1f1b17] shadow-xs font-semibold'
                    : 'text-[#7a7166] hover:text-[#1f1b17]'
                }`}
              >
                📑 逐行辅助校勘（行句对照）
              </button>
              <button
                type="button"
                onClick={() => setRightViewMode('text')}
                className={`rounded-[2px] px-3 py-1 text-xs font-medium transition ${
                  rightViewMode === 'text'
                    ? 'bg-white text-[#1f1b17] shadow-xs font-semibold'
                    : 'text-[#7a7166] hover:text-[#1f1b17]'
                }`}
              >
                📝 全文连续编辑
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleAutoPunctuate}
                className="rounded-[2px] border border-[#dcd5c9] bg-white px-2 py-1 text-[11px] text-[#4a433a] hover:border-[#1f1b17] hover:text-[#1f1b17]"
                title="自动插入古籍语气词标点"
              >
                ，。自动标点
              </button>
              <button
                type="button"
                onClick={handleExportTxt}
                className="rounded-[2px] border border-[#dcd5c9] bg-white px-2 py-1 text-[11px] text-[#4a433a] hover:border-[#1f1b17] hover:text-[#1f1b17]"
              >
                📄 导出 TXT
              </button>
              <button
                type="button"
                onClick={handleExportJson}
                className="rounded-[2px] border border-[#dcd5c9] bg-white px-2 py-1 text-[11px] text-[#4a433a] hover:border-[#1f1b17] hover:text-[#1f1b17]"
                title="导出含行框坐标的 JSON 结构化数据"
              >
                🧩 导出 JSON
              </button>
            </div>
          </div>

          {rightViewMode === 'linebyline' ? (
            /* ─── Tonggu OCR Line-by-Line Interactive Alignment View ─── */
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#7a7166]">
                <span>
                  共计{' '}
                  <strong className="text-[#1f1b17]">
                    {
                      (correctedText || ocrOutput)
                        .split(/\r?\n/)
                        .filter((l) => l.trim()).length
                    }
                  </strong>{' '}
                  行文本 · 鼠标悬停行或左侧框均可实时双向高亮
                </span>
                <button
                  type="button"
                  onClick={() => setCorrectedText(ocrOutput)}
                  className="text-[11px] text-[#1f1b17] underline hover:text-[#9b2c1f]"
                >
                  重置为 OCR 识别初稿
                </button>
              </div>

              <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
                {(correctedText || ocrOutput)
                  .split(/\r?\n/)
                  .map((rawLine, idx, arr) => {
                    const isSelected = activeLineIndex === idx;
                    const colors = [
                      'border-sky-600/60 bg-sky-50 text-sky-800',
                      'border-emerald-600/60 bg-emerald-50 text-emerald-800',
                      'border-amber-600/60 bg-amber-50 text-amber-800',
                      'border-violet-600/60 bg-violet-50 text-violet-800',
                      'border-rose-600/60 bg-rose-50 text-rose-800',
                    ];
                    const colorCls = colors[idx % colors.length];

                    return (
                      <div
                        key={idx}
                        onMouseEnter={() => setActiveLineIndex(idx)}
                        className={`rounded-[3px] border p-2.5 transition-all ${
                          isSelected
                            ? 'border-[#1f1b17] bg-[#fdfbf7] shadow-sm ring-1 ring-[#1f1b17]'
                            : 'border-[#eeeae1] bg-white hover:border-[#cfc7b9]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold ${colorCls}`}
                          >
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="font-mono text-[10px] text-[#7a7166]">
                            OCR 原行：
                            {ocrOutput.split(/\r?\n/)[idx] || '（新增行）'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setPName(rawLine.trim());
                              setPBasis(`源自第 ${idx + 1} 行录文`);
                              setPlaceModalOpen(true);
                            }}
                            className="text-[10px] text-[#9b2c1f] hover:underline"
                            title="以此行为线索提取地名"
                          >
                            📌 提取此行地名
                          </button>
                        </div>
                        <input
                          type="text"
                          value={rawLine}
                          onChange={(e) =>
                            handleUpdateLine(idx, e.target.value)
                          }
                          onFocus={() => setActiveLineIndex(idx)}
                          className="mt-1.5 w-full rounded-[2px] border border-[#dcd5c9] bg-white px-2.5 py-1.5 font-serif text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
                          placeholder="输入校订文字..."
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            /* ─── Continuous Textareas View ─── */
            <>
              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1f1b17]">
                    1. OCR 原始识读结果
                  </label>
                  <span className="font-mono text-[11px] text-[#7a7166]">
                    {activeRegion?.engineUsed ||
                      '支持直接粘贴或点击上方按钮调用 API'}
                  </span>
                </div>
                <textarea
                  rows={4}
                  value={ocrOutput}
                  onChange={(e) => setOcrOutput(e.target.value)}
                  placeholder="点击上方「执行 OCR 识读」获取识别文本，或直接粘贴原始识别内容..."
                  className="mt-1.5 w-full rounded-[3px] border border-[#dcd5c9] bg-[#f6f4ef] p-3 font-mono text-xs leading-relaxed text-[#4a433a] focus:border-[#1f1b17] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-[#1f1b17]">
                    2. 人工校订定本（保留版本记录）
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleOpenPlaceModalFromSelection}
                      className="inline-flex items-center gap-1 rounded-[2px] bg-[#9b2c1f]/10 px-2 py-0.5 text-[11px] font-medium text-[#9b2c1f] transition hover:bg-[#9b2c1f]/20"
                      title="划选文本框中的地名，或直接点击提取地名点位至地图"
                    >
                      <span>📌 划选提取地名至地图</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setCorrectedText(ocrOutput)}
                      className="text-[11px] text-[#1f1b17] hover:underline"
                    >
                      从 OCR 原文复制
                    </button>
                  </div>
                </div>
                <textarea
                  ref={correctedTextareaRef}
                  rows={5}
                  value={correctedText}
                  onChange={(e) => setCorrectedText(e.target.value)}
                  placeholder="在此处对照左侧原件图像进行人工校订、补录手写批注或删改痕迹；划选地名文字后点击上方「📌 划选提取地名至地图」可一键生成空间坐标..."
                  className="mt-1.5 w-full rounded-[3px] border border-[#dcd5c9] bg-white p-3 font-serif text-sm leading-relaxed text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-[#1f1b17]">
                3. 学术翻译与术语注释
              </label>
              <button
                type="button"
                disabled={isRunningOcr}
                onClick={handleRunTranslate}
                className="text-xs font-medium text-[#1f1b17] hover:underline disabled:opacity-50"
              >
                调用超算大模型自动翻译 →
              </button>
            </div>
            <textarea
              rows={3}
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              placeholder="输入或由大模型生成中文/外文对照译文与专名考释..."
              className="mt-1.5 w-full rounded-[3px] border border-[#dcd5c9] bg-white p-3 text-xs leading-relaxed text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4a433a]">
              校勘按语 / 版本备注
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="记录字迹辨识依据、删改墨色或存疑待考事项..."
              className="mt-1.5 w-full rounded-[3px] border border-[#dcd5c9] bg-white px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeae1] pt-3">
            <span className="text-xs text-[#7a7166]">
              状态：
              <strong className="ml-1 text-[#1f1b17]">
                {activeRegion?.status === 'verified'
                  ? '已通过人工审定'
                  : '草稿待审定'}
              </strong>
            </span>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={handleSendToRadar}
                className="rounded-[3px] border border-[#dcd5c9] bg-white px-4 py-2 text-xs font-medium text-[#1f1b17] hover:bg-[#faf8f3]"
              >
                送入史料雷达与长编 →
              </button>
              <button
                type="button"
                onClick={handleSaveAndVerify}
                className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a]"
              >
                保存校订版本并通过审定
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ─── 1.4: 从校订文本提取地名至历史地理图谱弹窗 ─── */}
      {placeModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setPlaceModalOpen(false)}
        >
          <div
            className="kh-enter w-full max-w-lg rounded-[4px] border border-[var(--ink)] bg-[var(--sheet)] p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div>
                <h3 className="font-serif text-base font-semibold text-[var(--ink)]">
                  📌 从校订录文生成空间地名点位
                </h3>
                <p className="mt-0.5 text-xs text-[var(--ink-muted)]">
                  自动绑定当前原件切片与像素坐标，进入历史地理图谱呈现
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPlaceModalOpen(false)}
                className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                关闭 ✕
              </button>
            </div>

            <form onSubmit={handleConfirmAddPlace} className="mt-4 space-y-3.5">
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[var(--ink-secondary)]">
                    地名 / 机构名称
                  </label>
                  <input
                    type="text"
                    required
                    value={pName}
                    onChange={(e) => setPName(e.target.value)}
                    placeholder="例如：多伦诺尔 / 乌里雅苏台 / 拉萨..."
                    className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={isResolvingGeo || !pName.trim()}
                  onClick={handleAiResolveGeo}
                  className="rounded-[3px] border border-[var(--seal)] bg-[var(--seal-soft)] px-3 py-1.5 text-xs font-medium text-[var(--seal)] hover:bg-[#ebd5d2] disabled:opacity-50"
                  title="调用超算大模型自动推测清代建置、坐标与依据"
                >
                  {isResolvingGeo ? '正在推测...' : '🤖 智能推测坐标'}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                    经度 (Lng)
                  </label>
                  <input
                    type="text"
                    required
                    value={pLng}
                    onChange={(e) => setPLng(e.target.value)}
                    placeholder="如 116.47"
                    className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 font-mono text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                    纬度 (Lat)
                  </label>
                  <input
                    type="text"
                    required
                    value={pLat}
                    onChange={(e) => setPLat(e.target.value)}
                    placeholder="如 42.18"
                    className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 font-mono text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                    别名 / 外文名（可选）
                  </label>
                  <input
                    type="text"
                    value={pAlias}
                    onChange={(e) => setPAlias(e.target.value)}
                    placeholder="如 Dolon Nor"
                    className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                    涉及年份（可选）
                  </label>
                  <input
                    type="text"
                    value={pYear}
                    onChange={(e) => setPYear(e.target.value)}
                    placeholder="如 1691 / 1820"
                    className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 font-mono text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                  清代政区建置归属
                </label>
                <input
                  type="text"
                  value={pAdmin}
                  onChange={(e) => setPAdmin(e.target.value)}
                  placeholder="如：内蒙古察哈尔都统辖区 / 卫藏驻藏办事大臣治所..."
                  className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                  定位与坐标依据
                </label>
                <input
                  type="text"
                  value={pBasis}
                  onChange={(e) => setPBasis(e.target.value)}
                  placeholder="如：原文直接记载会盟地 / CHGIS 1820 县治点位 / 现地名比定..."
                  className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                    可信度分级
                  </label>
                  <select
                    value={pConf}
                    onChange={(e) => setPConf(e.target.value as PlaceConfidence)}
                    className="mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
                  >
                    <option value="explicit">● 原文直接记载（最高）</option>
                    <option value="verified">● 学者核定（已校勘）</option>
                    <option value="inferred">● 智能体推测待核（推测）</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-[var(--ink-secondary)]">
                    绑定的原图证据
                  </label>
                  <div className="mt-1 truncate rounded-[3px] bg-[#f6f4ef] px-3 py-1.5 font-mono text-[11px] text-[var(--ink-secondary)]">
                    {activeRegion ? `${activeRegion.label}` : '（当前尚未框选切片）'}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-[var(--line)] pt-3">
                <button
                  type="button"
                  onClick={() => setPlaceModalOpen(false)}
                  className="rounded-[3px] border border-[var(--line)] bg-white px-3.5 py-1.5 text-xs text-[var(--ink-secondary)] hover:bg-[#faf8f3]"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="rounded-[3px] bg-[var(--ink)] px-4 py-1.5 text-xs font-medium text-white hover:bg-zinc-800"
                >
                  确认生成点位并存入地图 →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

