import React, { useState } from 'react';
import { useWorkbench } from '../store';
import { toast } from 'sonner';

export const Lab: React.FC = () => {
  const {
    catalogEntries,
    uploadedFiles,
    imageRegions,
    updateImageRegion,
    comparisons,
    wikiArticles,
    auditRecords,
    apiConfig,
  } = useWorkbench();

  const [activeTab, setActiveTab] = useState<'verify' | 'critique' | 'audit'>(
    'verify'
  );
  const [critiqueTopic, setCritiqueTopic] = useState('');
  const [critiqueOutput, setCritiqueOutput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleExportJson = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      catalogEntries,
      uploadedFiles: uploadedFiles.map((f) => ({
        id: f.id,
        name: f.name,
        mimeType: f.mimeType,
        size: f.size,
        catalogId: f.catalogId,
        createdAt: f.createdAt,
      })),
      imageRegions: imageRegions.map((r) => ({
        ...r,
        cropDataUrl: undefined,
      })),
      comparisons,
      wikiArticles,
      auditRecords,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qing-archival-lab-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出研究空间 JSON 数据包');
  };

  const handleExportMarkdown = () => {
    const lines: string[] = [
      '# 西方馆藏未刊清史文献研究空间导出报告',
      `导出时间：${new Date().toLocaleString('zh-CN')}`,
      '',
      `## 一、馆藏目录层级 (${catalogEntries.length} 条)`,
      ...catalogEntries.map(
        (c) => `- **[${c.level}] ${c.title}** | 档号：\`${c.callNumber}\` | 来源：${c.sourceNote}`
      ),
      '',
      `## 二、图像证据与人工校订记录 (${imageRegions.length} 处)`,
      ...imageRegions.map(
        (r) =>
          `### ${r.label} (${r.status === 'verified' ? '已审定' : '草稿'})\n- 像素坐标：\`xywh=(${r.xywh.x}, ${r.xywh.y}, ${r.xywh.w}, ${r.xywh.h})\`\n- 校订定本：${r.correctedText || r.ocrText || '无'}\n- 译文：${r.translation || '无'}`
      ),
      '',
      `## 三、多史料比对与长编记录 (${comparisons.length} 条)`,
      ...comparisons.map(
        (c) => `### ${c.title}\n- 摘要：${c.summary}\n- 长编与考异：\n${c.changbian}`
      ),
      '',
      `## 四、操作审计记录 (${auditRecords.length} 条)`,
      ...auditRecords.map(
        (a) => `- \`${a.timestamp}\` [${a.action}] **${a.target}**：${a.detail}`
      ),
    ];

    const blob = new Blob([lines.join('\n')], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `qing-archival-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('已导出研究空间 Markdown 报告');
  };

  const handleRunCritique = async () => {
    if (!critiqueTopic.trim()) {
      toast.error('请输入专题研究或史观辨析命题');
      return;
    }
    setIsGenerating(true);
    try {
      const verifiedEvidence = imageRegions
        .filter((r) => r.status === 'verified')
        .map(
          (r) =>
            `[证据 ${r.id} · 坐标 xywh(${r.xywh.x},${r.xywh.y},${r.xywh.w},${r.xywh.h})]: ${
              r.correctedText || r.ocrText
            }`
        )
        .join('\n');

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
                '你是清史专题研究与学术批判专家。请基于用户已审定的档案证据与比对记录，围绕用户提出的专题命题，运用图尔敏（Toulmin）论证结构撰写真实严谨的专题考辨文章（明确标注每一处引用的证据坐标）。',
            },
            {
              role: 'user',
              content: `【研究命题】：${critiqueTopic}\n【工作区已审定证据】：\n${
                verifiedEvidence || '（当前尚未关联特定审定证据，请做方法论与框架阐述）'
              }`,
            },
          ],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        setCritiqueOutput(
          data?.choices?.[0]?.message?.content?.trim() || ''
        );
        toast.success('已生成专题论证稿');
      }
    } finally {
      setIsGenerating(false);
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
            证据审定与审计导出
          </h1>
          <p className="mt-1.5 text-sm text-[#4a433a]">
            核查“原始图像坐标 → 人工校订文本 → 审定状态”完整证据链，支持生成专题考辨文章并导出研究数据包。
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportMarkdown}
            className="rounded-[3px] border border-[#dcd5c9] bg-white px-4 py-2.5 text-xs font-medium text-[#1f1b17] hover:bg-[#faf8f3]"
          >
            导出 Markdown 报告
          </button>
          <button
            type="button"
            onClick={handleExportJson}
            className="rounded-[3px] bg-[#1f1b17] px-4 py-2.5 text-xs font-medium text-white hover:bg-[#36302a]"
          >
            导出 JSON 数据包
          </button>
        </div>
      </div>

      {/* Sub-tabs */}
      <div className="inline-flex rounded-[3px] border border-[#dcd5c9] bg-white p-1">
        <button
          type="button"
          onClick={() => setActiveTab('verify')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
            activeTab === 'verify'
              ? 'bg-[#f3efe7] text-[#1f1b17]'
              : 'text-[#4a433a]'
          }`}
        >
          证据审定台 ({imageRegions.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('critique')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
            activeTab === 'critique'
              ? 'bg-[#f3efe7] text-[#1f1b17]'
              : 'text-[#4a433a]'
          }`}
        >
          专题论证与学术批驳
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={`rounded-md px-3.5 py-1.5 text-xs font-medium transition ${
            activeTab === 'audit'
              ? 'bg-[#f3efe7] text-[#1f1b17]'
              : 'text-[#4a433a]'
          }`}
        >
          操作审计轨迹 ({auditRecords.length})
        </button>
      </div>

      {/* TAB 1: Evidence Verification */}
      {activeTab === 'verify' && (
        <div className="overflow-hidden rounded-[4px] border border-[#dcd5c9] bg-white">
          <table className="kh-table">
            <thead>
              <tr>
                <th>原图切片与区域名称</th>
                <th>像素坐标 (xywh)</th>
                <th>人工校订文本</th>
                <th>状态</th>
                <th className="text-right">审定操作</th>
              </tr>
            </thead>
            <tbody>
              {imageRegions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-xs text-[#7a7166]">
                    暂无待审定的图像证据（0 条）。请先在「档案阅读器」框选图像区域或在「OCR与人工校订」中保存文本。
                  </td>
                </tr>
              ) : (
                imageRegions.map((reg) => (
                  <tr key={reg.id}>
                    <td>
                      <div className="flex items-center gap-3">
                        {reg.cropDataUrl && (
                          <img
                            src={reg.cropDataUrl}
                            alt={reg.label}
                            className="h-12 w-16 shrink-0 rounded border border-[#dcd5c9] object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium text-[#1f1b17]">
                            {reg.label}
                          </div>
                          <div className="font-mono text-[11px] text-[#7a7166]">
                            第 {reg.page} 页 · {reg.engineUsed}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="font-mono text-xs text-[#4a433a]">
                      x={reg.xywh.x}, y={reg.xywh.y}, w={reg.xywh.w}, h=
                      {reg.xywh.h}
                    </td>
                    <td className="max-w-md text-xs text-[#1f1b17]">
                      <div className="line-clamp-2">
                        {reg.correctedText || reg.ocrText || '（尚未录入校订文本）'}
                      </div>
                    </td>
                    <td>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          reg.status === 'verified'
                            ? 'bg-[#f3efe7] text-[#1f1b17]'
                            : reg.status === 'rejected'
                            ? 'bg-red-50 text-red-700'
                            : 'bg-amber-50 text-amber-800'
                        }`}
                      >
                        {reg.status === 'verified'
                          ? '已审定通过'
                          : reg.status === 'rejected'
                          ? '已退回重校'
                          : '待审定'}
                      </span>
                    </td>
                    <td className="text-right">
                      <div className="inline-flex items-center gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => {
                            updateImageRegion(reg.id, { status: 'verified' });
                            toast.success(`已审定通过：${reg.label}`);
                          }}
                          className="font-medium text-[#1f1b17] hover:underline"
                        >
                          通过审定
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            updateImageRegion(reg.id, { status: 'rejected' });
                            toast.info(`已退回重校：${reg.label}`);
                          }}
                          className="text-zinc-400 hover:text-red-600"
                        >
                          退回
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TAB 2: Thematic Critique & Synthesis */}
      {activeTab === 'critique' && (
        <div className="space-y-4 rounded-[4px] border border-[#dcd5c9] bg-white p-6">
          <div>
            <h2 className="font-serif text-base font-semibold text-[#1f1b17]">
              基于已审定证据生成专题研究与史观批驳
            </h2>
            <p className="mt-1 text-xs text-[#4a433a]">
              结合工作区中已审定的图像坐标证据与多版本考异记录，围绕您输入的命题进行实证论述。
            </p>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row">
            <input
              type="text"
              value={critiqueTopic}
              onChange={(e) => setCritiqueTopic(e.target.value)}
              placeholder="输入专题研究题目或拟批驳的错误史观命题..."
              className="flex-1 rounded-[3px] border border-[#dcd5c9] bg-[#f6f4ef] px-3.5 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:bg-white focus:outline-none"
            />
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleRunCritique}
              className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a] disabled:opacity-50"
            >
              {isGenerating ? '正在生成论证...' : '生成专题实证论述 →'}
            </button>
          </div>

          <textarea
            rows={12}
            value={critiqueOutput}
            onChange={(e) => setCritiqueOutput(e.target.value)}
            placeholder="生成的专题研究或学术批驳长文将显示在此处，支持直接编辑与导出..."
            className="w-full rounded-[3px] border border-[#dcd5c9] bg-[#f6f4ef] p-4 font-serif text-sm leading-relaxed text-[#1f1b17] focus:border-[#1f1b17] focus:bg-white focus:outline-none"
          />
        </div>
      )}

      {/* TAB 3: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="overflow-hidden rounded-[4px] border border-[#dcd5c9] bg-white">
          <table className="kh-table">
            <thead>
              <tr>
                <th>时间</th>
                <th>操作者</th>
                <th>操作类型</th>
                <th>目标对象</th>
                <th>详细记录</th>
              </tr>
            </thead>
            <tbody>
              {auditRecords.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-xs text-[#7a7166]">
                    暂无操作审计记录（0 条）。当您新建馆藏条目、上传档案、框选图像坐标或审定文本时，系统将自动记录可追溯的审计流水。
                  </td>
                </tr>
              ) : (
                auditRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td className="font-mono text-xs text-[#7a7166]">
                      {rec.timestamp}
                    </td>
                    <td className="text-xs font-medium text-[#1f1b17]">
                      {rec.actor}
                    </td>
                    <td>
                      <span className="rounded bg-[#eeeae1] px-2 py-0.5 text-xs text-[#4a433a]">
                        {rec.action}
                      </span>
                    </td>
                    <td className="font-medium text-xs text-[#1f1b17]">
                      {rec.target}
                    </td>
                    <td className="text-xs text-[#4a433a]">{rec.detail}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

