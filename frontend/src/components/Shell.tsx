import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useWorkbench } from '../store';
import { toast } from 'sonner';

interface StepItem {
  to: string;
  code: string;
  label: string;
  desc: string;
  badge?: number;
}

interface StepGroup {
  numeral: string;
  title: string;
  items: StepItem[];
}

const ApiField: React.FC<{
  label: string;
  hint: string;
  value: string;
  secret?: boolean;
  onChange: (v: string) => void;
}> = ({ label, hint, value, secret, onChange }) => (
  <label className="block">
    <span className="flex items-baseline justify-between">
      <span className="text-xs font-medium text-[var(--ink)]">{label}</span>
      <span className="font-mono text-[11px] text-[var(--ink-muted)]">{hint}</span>
    </span>
    <input
      type={secret ? 'password' : 'text'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1.5 w-full rounded-[3px] border border-[var(--line)] bg-white px-3 py-1.5 font-mono text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none"
    />
  </label>
);

export const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    catalogEntries,
    uploadedFiles,
    imageRegions,
    auditRecords,
    clearAllData,
    loadSampleDossier,
    apiConfig,
    setApiConfig,
  } = useWorkbench();

  const [apiModalOpen, setApiModalOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const verifiedCount = imageRegions.filter(
    (r) => r.status === 'verified'
  ).length;

  const groups: StepGroup[] = [
    {
      numeral: '壹',
      title: '编目与原图阅读',
      items: [
        {
          to: '/workbench',
          code: '1.1',
          label: '馆藏与资料库',
          desc: '五级目录 · 已传档案存储库',
          badge: catalogEntries.length + uploadedFiles.length,
        },
        {
          to: '/reader',
          code: '1.2',
          label: '档案阅读台',
          desc: '原图浏览 · 拖动框选像素坐标',
          badge: imageRegions.length,
        },
        {
          to: '/proofread',
          code: '1.3',
          label: 'OCR与人工校订',
          desc: 'MinerU · PaddleOCR · 译注',
        },
      ],
    },
    {
      numeral: '贰',
      title: '价值发现与考异',
      items: [
        {
          to: '/radar?mode=value',
          code: '2.1',
          label: '文献溯源与价值甄别',
          desc: '一手孤本 vs 二手转引剥离',
        },
        {
          to: '/radar?mode=changbian',
          code: '2.2',
          label: '多版本对读与考异长编',
          desc: '母本 · 未刊稿 · 已刊本互勘',
        },
        {
          to: '/radar?mode=radar',
          code: '2.3',
          label: '五维雷达与盲区选题',
          desc: '隐蔽盲区探针 · 社科选题孵化',
        },
        {
          to: '/radar?mode=stance',
          code: '2.4',
          label: '概念流变与中国立场审定',
          desc: '跨语际术语偏移 · 主体立场纠偏',
        },
      ],
    },
    {
      numeral: '叁',
      title: '知识编译与空间',
      items: [
        {
          to: '/wiki',
          code: '3.1',
          label: 'LLM Wiki 与关系图谱',
          desc: 'Graph View · 两步摄取 · 巡检',
        },
        {
          to: '/atlas',
          code: '3.2',
          label: '历史地理图谱',
          desc: '天地图 · 复旦 CHGIS 1820',
        },
        {
          to: '/agent',
          code: '3.3',
          label: '智能体 Chat & Work 台',
          desc: '外部 MCP 联查 · 自动产出成果',
        },
      ],
    },
    {
      numeral: '肆',
      title: '审定与成果导出',
      items: [
        {
          to: '/lab',
          code: '4.1',
          label: '证据审定与导出',
          desc: '证据链核查 · 专题批驳 · 审计',
          badge: verifiedCount,
        },
      ],
    },
  ];

  const flatItems = groups.flatMap((g) => g.items);
  const fullPath = location.pathname + location.search;
  const currentItem =
    flatItems.find((i) => i.to === fullPath) ||
    flatItems.find((i) => i.to.split('?')[0] === location.pathname) ||
    flatItems[0];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] lg:grid lg:grid-cols-[256px_1fr]">
      {/* ─── Left Archival Ledger Sidebar (Book & Seal Design System) ─── */}
      <aside
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } border-r border-[var(--line)] bg-[var(--paper)] lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col`}
      >
        <div className="px-5 pt-5 pb-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="group flex items-start gap-3 text-left"
          >
            <span
              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-[3px] font-serif text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--seal)' }}
            >
              清
            </span>
            <div>
              <div className="font-serif text-[15px] font-semibold leading-snug text-[var(--ink)]">
                未刊清史文献
                <br />
                数智研究工作台
              </div>
              <div className="mt-1 font-mono text-[11px] text-[var(--ink-muted)] group-hover:text-[var(--ink)]">
                ← 返回展示首页
              </div>
            </div>
          </button>
        </div>

        <div className="mx-5 border-t border-[var(--ink)]" />

        {/* Navigation Groups */}
        <nav className="mt-2 flex-1 overflow-y-auto px-3 pb-4">
          {groups.map((group) => {
            const groupActive = group.items.some(
              (i) => i.to === location.pathname
            );
            return (
              <div key={group.title} className="mb-3">
                <div className="flex items-baseline gap-2 px-2 pt-2 pb-1">
                  <span
                    className={`font-serif text-sm font-semibold ${
                      groupActive
                        ? 'text-[var(--seal)]'
                        : 'text-[var(--ink-muted)]'
                    }`}
                  >
                    {group.numeral}
                  </span>
                  <span
                    className={`text-xs font-semibold tracking-wide ${
                      groupActive
                        ? 'text-[var(--ink)]'
                        : 'text-[var(--ink-secondary)]'
                    }`}
                  >
                    {group.title}
                  </span>
                </div>

                <div className="ml-3.5 border-l border-[var(--line)]">
                  {group.items.map((item) => {
                    const isExactActive =
                      fullPath === item.to ||
                      (!location.search &&
                        item.to === '/radar?mode=radar' &&
                        location.pathname === '/radar') ||
                      (!item.to.includes('?') &&
                        location.pathname === item.to);
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={() =>
                          `relative -ml-px block border-l-2 py-2 pr-2.5 pl-3.5 transition-colors ${
                            isExactActive
                              ? 'border-[var(--seal)] bg-[var(--sheet)] text-[var(--ink)]'
                              : 'border-transparent text-[var(--ink-secondary)] hover:border-[var(--ink-muted)] hover:text-[var(--ink)]'
                          }`
                        }
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={`text-[13px] ${
                              isExactActive ? 'font-semibold' : ''
                            }`}
                          >
                            {item.label}
                          </span>
                          <div className="flex items-center gap-1.5">
                            {typeof item.badge === 'number' &&
                              item.badge > 0 && (
                                <span className="rounded-[2px] bg-[#9b2c1f]/10 px-1.5 py-0.2 font-mono text-[10px] font-semibold text-[var(--seal)]">
                                  {item.badge}
                                </span>
                              )}
                            <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                              {item.code}
                            </span>
                          </div>
                        </div>
                        <div className="mt-0.5 text-[11px] text-[var(--ink-muted)]">
                          {item.desc}
                        </div>
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Bottom Provenance Rule */}
        <div className="border-t border-[var(--line)] px-5 py-3.5">
          <div className="kh-eyebrow">EVIDENCE CHAIN · 证据链准则</div>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-secondary)]">
            原始图像坐标 (xywh) → 校订版本 → 审定记录，全链路本地持久化存证。
          </p>
        </div>
      </aside>

      {/* ─── Right Main Workspace ─── */}
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-[var(--line)] bg-[var(--paper)]/95 px-6 py-3 backdrop-blur-xs lg:px-10">
          <div className="flex items-center gap-3 text-xs">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] px-2.5 py-1 text-xs lg:hidden"
            >
              目录
            </button>
            <button
              type="button"
              onClick={() => navigate('/')}
              className="text-[var(--ink-muted)] hover:text-[var(--ink)]"
            >
              首页
            </button>
            <span className="text-[var(--line)]">/</span>
            <span className="font-mono text-[var(--seal)]">
              {currentItem.code}
            </span>
            <span className="font-medium text-[var(--ink)]">
              {currentItem.label}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/agent')}
              className="rounded-[3px] bg-[#1f1b17] px-3 py-1 text-xs font-medium text-white hover:bg-[#36302a]"
              title="打开智能体 Chat & Work 协同工作台（接入外部 MCP 论文库与工具）"
            >
              🤖 智能体 Chat / Work
            </button>

            <button
              type="button"
              onClick={async () => {
                await loadSampleDossier();
                toast.success(
                  '已载入示范实证卷宗（魏源《圣武纪》多伦诺尔会盟案例）'
                );
              }}
              className="rounded-[3px] border border-[var(--seal)] bg-[var(--seal-soft)] px-2.5 py-1 text-xs font-medium text-[var(--seal)] hover:bg-[#ebd5d2]"
              title="一键载入哈佛燕京图书馆未刊稿、原图像素切片、考异长编、Wiki与时空流转完整案例"
            >
              📚 载入示范卷宗（圣武纪案例）
            </button>

            {(catalogEntries.length > 0 ||
              uploadedFiles.length > 0 ||
              imageRegions.length > 0 ||
              auditRecords.length > 0) && (
              <button
                type="button"
                onClick={async () => {
                  await clearAllData();
                  toast.success('已清空所有工作区数据');
                }}
                className="rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] px-2.5 py-1 text-xs text-[var(--ink-secondary)] hover:border-[var(--seal)] hover:text-[var(--seal)]"
              >
                清空工作区
              </button>
            )}
            <button
              type="button"
              onClick={() => setApiModalOpen(true)}
              className="rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] px-3 py-1 font-mono text-xs text-[var(--ink)] hover:border-[var(--ink)]"
            >
              接口配置 (MinerU / Paddle / 超算)
            </button>
          </div>
        </header>

        <main className="kh-enter mx-auto w-full max-w-6xl flex-1 px-6 py-8 lg:px-10">
          {children}
        </main>
      </div>

      {/* ─── API Modal ─── */}
      {apiModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setApiModalOpen(false)}
        >
          <div
            className="kh-enter w-full max-w-md rounded-[4px] border border-[var(--ink)] bg-[var(--sheet)] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--ink)] pb-3">
              <h3 className="font-serif text-base font-semibold text-[var(--ink)]">
                模型、OCR 与历史地图接口配置
              </h3>
              <button
                type="button"
                onClick={() => setApiModalOpen(false)}
                className="text-xs text-[var(--ink-muted)] hover:text-[var(--ink)]"
              >
                关闭
              </button>
            </div>

            <div className="mt-4 space-y-3.5">
              <ApiField
                label="超算中心 TokenPlan API Key"
                hint="编目 · 校勘 · 长编 · Wiki"
                secret
                value={apiConfig.apiKey}
                onChange={(v) => setApiConfig({ ...apiConfig, apiKey: v })}
              />
              <ApiField
                label="MinerU Token"
                hint="mineru.net/api/v4"
                secret
                value={apiConfig.mineruToken}
                onChange={(v) => setApiConfig({ ...apiConfig, mineruToken: v })}
              />
              <ApiField
                label="PaddleOCR-VL-1.6 Token"
                hint="版面与双层手迹识别"
                secret
                value={apiConfig.paddleToken}
                onChange={(v) => setApiConfig({ ...apiConfig, paddleToken: v })}
              />
              <ApiField
                label="国家天地图 Key"
                hint="tianditu.gov.cn"
                value={apiConfig.tiandituKey}
                onChange={(v) => setApiConfig({ ...apiConfig, tiandituKey: v })}
              />
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  toast.success('接口配置已保存');
                  setApiModalOpen(false);
                }}
                className="rounded-[3px] bg-[var(--ink)] px-4 py-2 text-xs font-medium text-white hover:bg-zinc-800"
              >
                保存配置
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
