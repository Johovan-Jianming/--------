import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkbench, WikiArticle } from '../store';
import { toast } from 'sonner';

export const Wiki: React.FC = () => {
  const {
    imageRegions,
    setActiveRegionId,
    setActiveFileId,
    comparisons,
    wikiArticles,
    upsertWikiArticle,
    deleteWikiArticle,
    mapPlaces,
    mapEvents,
    apiConfig,
  } = useWorkbench();

  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] =
    useState<WikiArticle['category']>('source');
  const [content, setContent] = useState('');
  const [queryText, setQueryText] = useState('');
  const [isCompiling, setIsCompiling] = useState(false);

  const activeArticle =
    wikiArticles.find((w) => w.id === selectedId) || null;

  const linkedRegions = imageRegions.filter(
    (r) =>
      activeArticle?.linkedRegionIds?.includes(r.id) ||
      (activeArticle &&
        (activeArticle.content.includes(r.id) ||
          activeArticle.content.includes(r.label)))
  );

  const linkedPlaces = mapPlaces.filter(
    (p) =>
      activeArticle &&
      (activeArticle.content.includes(p.name) ||
        (p.alias && activeArticle.content.includes(p.alias)) ||
        linkedRegions.some((r) => r.id === p.regionId))
  );

  const handleSelectArticle = (w: WikiArticle) => {
    setSelectedId(w.id);
    setTitle(w.title);
    setSlug(w.slug);
    setCategory(w.category);
    setContent(w.content);
  };

  const handleNewBlank = () => {
    setSelectedId('');
    setTitle('');
    setSlug('');
    setCategory('source');
    setContent('');
  };

  const handleSaveManual = () => {
    if (!title.trim()) {
      toast.error('请输入 Wiki 条目名称');
      return;
    }
    const saved = upsertWikiArticle({
      id: selectedId || undefined,
      title: title.trim(),
      slug:
        slug.trim() ||
        title
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-'),
      category,
      content,
      linkedRegionIds: [],
    });
    setSelectedId(saved.id);
    toast.success(`已保存 Wiki 知识页：${saved.title}`);
  };

  const handleIngestFromWorkspace = async () => {
    if (imageRegions.length === 0 && comparisons.length === 0) {
      toast.error('当前尚无已校订图像区域或比对记录，请先上传校订材料或手动新建条目');
      return;
    }

    setIsCompiling(true);
    try {
      const sourceSummary = [
        ...imageRegions.map(
          (r) =>
            `[图像证据 ${r.id}] ${r.label} (坐标: ${r.xywh.x},${r.xywh.y},${r.xywh.w},${r.xywh.h}):\n${
              r.correctedText || r.ocrText
            }`
        ),
        ...comparisons.map(
          (c) => `[多版本比对 ${c.id}] ${c.title}:\n${c.changbian}\n${c.radarNotes}`
        ),
      ].join('\n\n');

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
                '你是 LLM Wiki 知识编译器。请根据用户工作区中已校订的档案证据与比对记录，编译生成一篇结构清晰的 Markdown 知识库条目（含标题、核心概念演变、证据坐标引用、知识生产链条分析）。',
            },
            {
              role: 'user',
              content: sourceSummary,
            },
          ],
        }),
      });

      let mdText = '';
      if (resp.ok) {
        const data = await resp.json();
        mdText = data?.choices?.[0]?.message?.content?.trim() || '';
      }

      if (!mdText) {
        mdText = `# 工作区增量编译综述\n\n## 1. 已收录证据区域 (${imageRegions.length} 处)\n\n${sourceSummary}`;
      }

      const created = upsertWikiArticle({
        title: `知识编译综述 · ${new Date().toLocaleDateString('zh-CN')}`,
        slug: `synthesis-${Date.now().toString().slice(-4)}`,
        category: 'synthesis',
        content: mdText,
        linkedRegionIds: imageRegions.map((r) => r.id),
      });

      handleSelectArticle(created);
      toast.success('已从当前工作区增量编译生成 Wiki 知识条目');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleRunQueryWriteback = async () => {
    if (!queryText.trim()) {
      toast.error('请输入知识库提问内容');
      return;
    }
    setIsCompiling(true);
    try {
      const kbContext = wikiArticles
        .map((w) => `## [[${w.slug}]] ${w.title}\n${w.content}`)
        .join('\n\n');

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
                '请基于以下用户私有 LLM Wiki 知识库内容回答研究问题，并输出可作为新 Wiki 页面保存的 Markdown 专题笔记。',
            },
            {
              role: 'user',
              content: `【知识库上下文】：\n${kbContext || '（当前知识库为空）'}\n\n【研究问题】：${queryText}`,
            },
          ],
        }),
      });

      let answer = '';
      if (resp.ok) {
        const data = await resp.json();
        answer = data?.choices?.[0]?.message?.content?.trim() || '';
      }
      if (!answer) {
        answer = `# 专题问答：${queryText}\n\n（请先编译或录入更多档案证据以丰富知识库上下文）`;
      }

      const saved = upsertWikiArticle({
        title: `问答综合：${queryText.slice(0, 24)}`,
        slug: `qa-${Date.now().toString().slice(-4)}`,
        category: 'synthesis',
        content: answer,
        linkedRegionIds: [],
      });
      handleSelectArticle(saved);
      setQueryText('');
      toast.success('已完成问答综合并写回 Wiki 知识库');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-widest text-[#7a7166] uppercase">
            WESTERN COLLECTIONS · QING HISTORY
          </div>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1f1b17]">
            LLM Wiki 知识编译库
          </h1>
          <p className="mt-1.5 text-sm text-[#4a433a]">
            将您上传校订的档案证据与版本比对记录增量编译为结构化 Markdown 知识页（Ingest / Query / Write-back）。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleNewBlank}
            className="rounded-[3px] border border-[#dcd5c9] bg-white px-4 py-2.5 text-xs font-medium text-[#1f1b17] hover:bg-[#faf8f3]"
          >
            + 新建空白知识页
          </button>
          <button
            type="button"
            disabled={isCompiling}
            onClick={handleIngestFromWorkspace}
            className="rounded-[3px] bg-[#1f1b17] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#36302a] disabled:opacity-50"
          >
            {isCompiling ? '正在增量编译...' : '从已校订证据增量编译 (Ingest) →'}
          </button>
        </div>
      </div>

      {/* Query & Write-back Bar */}
      <div className="flex flex-col gap-2.5 rounded-[4px] border border-[#dcd5c9] bg-white p-4 sm:flex-row sm:items-center">
        <span className="shrink-0 text-xs font-semibold text-[#1f1b17]">
          知识库提问与写回
        </span>
        <input
          type="text"
          value={queryText}
          onChange={(e) => setQueryText(e.target.value)}
          placeholder="基于您已编译的知识库提问，生成结果将自动作为新 Markdown 页面写回..."
          className="flex-1 rounded-[3px] border border-[#dcd5c9] bg-[#f6f4ef] px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:bg-white focus:outline-none"
        />
        <button
          type="button"
          disabled={isCompiling}
          onClick={handleRunQueryWriteback}
          className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a] disabled:opacity-50"
        >
          提问并写回知识库
        </button>
      </div>

      {/* Main Split View: Left Directory, Right Markdown Editor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
        <div className="overflow-hidden rounded-[4px] border border-[#dcd5c9] bg-white lg:col-span-4">
          <div className="border-b border-[#dcd5c9] px-5 py-3.5 text-xs font-semibold text-[#1f1b17]">
            知识页目录 ({wikiArticles.length})
          </div>
          {wikiArticles.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#7a7166]">
              当前知识库为空（0 篇）。可点击右上角「从已校订证据增量编译」或「+ 新建空白知识页」。
            </div>
          ) : (
            <div className="divide-y divide-[#dcd5c9]">
              {wikiArticles.map((w) => (
                <div
                  key={w.id}
                  onClick={() => handleSelectArticle(w)}
                  className={`cursor-pointer px-5 py-3.5 transition ${
                    activeArticle?.id === w.id
                      ? 'bg-[#f3efe7]/60'
                      : 'hover:bg-[#f6f4ef]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-[#1f1b17]">
                      {w.title}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteWikiArticle(w.id);
                      }}
                      className="text-[11px] text-zinc-400 hover:text-red-600"
                    >
                      删除
                    </button>
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-[#7a7166]">
                    <span>[[{w.slug}]]</span>
                    <span>{w.updatedAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-[4px] border border-[#dcd5c9] bg-white p-6 lg:col-span-8">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#4a433a]">
                条目名称
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="输入知识页标题..."
                className="mt-1 w-full rounded-[3px] border border-[#dcd5c9] bg-white px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#4a433a]">
                分类
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as WikiArticle['category'])
                }
                className="mt-1 w-full rounded-[3px] border border-[#dcd5c9] bg-white px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:outline-none"
              >
                <option value="source">档案文献摘要 (source)</option>
                <option value="entity">人物与机构 (entity)</option>
                <option value="concept">核心概念演进 (concept)</option>
                <option value="synthesis">综合研究笔记 (synthesis)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#4a433a]">
              Markdown 正文内容（支持 [[双向链接]] 与证据坐标引用）
            </label>
            <textarea
              rows={14}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# 条目名称&#10;&#10;在此编写或由智能体编译生成 Markdown 内容..."
              className="mt-1.5 w-full rounded-[3px] border border-[#dcd5c9] bg-[#f6f4ef] p-4 font-mono text-xs leading-relaxed text-[#1f1b17] focus:border-[#1f1b17] focus:bg-white focus:outline-none"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveManual}
              className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a]"
            >
              保存知识页
            </button>
          </div>

          {/* ─── 证据链穿透与时空映射联动卡片 ─── */}
          {activeArticle &&
            (linkedRegions.length > 0 || linkedPlaces.length > 0) && (
              <div className="rounded-[3px] border border-[#dcd5c9] bg-[#faf8f3] p-4 text-xs">
                <div className="flex items-center justify-between border-b border-[#e6e0d4] pb-2">
                  <span className="font-serif font-semibold text-[#1f1b17]">
                    🔗 本知识词条关联的原始证据与历史地理时空
                  </span>
                  <button
                    type="button"
                    onClick={() => navigate('/atlas')}
                    className="rounded-[3px] border border-[#1f1b17] bg-white px-2.5 py-1 text-[11px] font-medium text-[#1f1b17] hover:bg-[#f6f4ef]"
                  >
                    前往 3D 历史地理图谱溯源 →
                  </button>
                </div>

                {/* Linked Regions */}
                {linkedRegions.length > 0 && (
                  <div className="mt-3">
                    <div className="font-medium text-[#7a7166]">
                      关联图像切片证据 ({linkedRegions.length} 处)：
                    </div>
                    <div className="mt-1.5 space-y-1.5">
                      {linkedRegions.map((reg) => (
                        <div
                          key={reg.id}
                          className="flex items-center justify-between rounded border border-[#e6e0d4] bg-white px-3 py-1.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-[var(--seal)]">
                              [{reg.id}]
                            </span>
                            <span className="font-medium text-[#1f1b17]">
                              {reg.label}
                            </span>
                            <span className="font-mono text-[10px] text-[#7a7166]">
                              xywh=({reg.xywh.x},{reg.xywh.y},{reg.xywh.w},
                              {reg.xywh.h})
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFileId(reg.fileId);
                                setActiveRegionId(reg.id);
                                navigate('/reader');
                              }}
                              className="text-[11px] text-[#1f1b17] hover:underline"
                            >
                              原图定位 ↗
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveFileId(reg.fileId);
                                setActiveRegionId(reg.id);
                                navigate('/proofread');
                              }}
                              className="text-[11px] text-[#7a7166] hover:underline"
                            >
                              校订核验 ↗
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Linked Places */}
                {linkedPlaces.length > 0 && (
                  <div className="mt-3">
                    <div className="font-medium text-[#7a7166]">
                      关联历史地理点位 ({linkedPlaces.length} 处)：
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {linkedPlaces.map((plc) => (
                        <div
                          key={plc.id}
                          onClick={() => navigate('/atlas')}
                          className="cursor-pointer rounded border border-[#dcd5c9] bg-white px-2.5 py-1 text-[11px] text-[#1f1b17] hover:border-[var(--seal)] hover:text-[var(--seal)]"
                          title={`${plc.admin} · 依据: ${plc.basis}`}
                        >
                          📍 <strong>{plc.name}</strong>{' '}
                          <span className="font-mono text-[10px] text-[#7a7166]">
                            ({plc.lng.toFixed(2)}, {plc.lat.toFixed(2)})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};

