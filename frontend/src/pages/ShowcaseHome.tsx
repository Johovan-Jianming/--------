import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWorkbench } from '../store';

interface HeroScene {
  id: number;
  tag: string;
  headlinePrefix: string;
  headlineAccent: string;
  caption: string;
  route: string;
}

const HERO_SCENES: HeroScene[] = [
  {
    id: 0,
    tag: 'SCENE 01 · MULTIMODAL ARCHIVAL INGEST',
    headlinePrefix: '多模态未刊档案 ',
    headlineAccent: '全格式兼容',
    caption:
      '支持海外馆藏 PDF 全卷、高分辨率 TIFF/JPG 原件扫描页、EAD XML 与 Markdown 笔记一键入库，自动挂载七级编目树。',
    route: '/workbench',
  },
  {
    id: 1,
    tag: 'SCENE 02 · DUAL-LAYER HANDWRITING & MARGINALIA',
    headlinePrefix: '双层手迹与旁批 ',
    headlineAccent: '精准解耦提取',
    caption:
      '以魏特夫 Box 66 手稿为例：自动分离英文打字底稿与审稿人铅笔行间改订（Tsai-li → Tsai-feng 载沣、K.A.W.!、cf. Dr. Hu!）。',
    route: '/proofread',
  },
  {
    id: 2,
    tag: 'SCENE 03 · 5D RADAR & SIMA GUANG KAOYI',
    headlinePrefix: '五维史料雷达 ',
    headlineAccent: '盲区探寻与考异',
    caption:
      '贯通 Box 9《清史总纲》与 Box 66《满洲帝国的衰落》，自主发掘“抄家财政”“荒政中饱”选题并按《通鉴考异》体例对读实录。',
    route: '/radar?mode=radar',
  },
  {
    id: 3,
    tag: 'SCENE 04 · LLM WIKI & CHGIS 1820 ATLAS',
    headlinePrefix: '四级证据链图谱 ',
    headlineAccent: '1820 空间落点',
    caption:
      '复刻 nashsu/llm_wiki 双向链接、Cytoscape 关系网与两步思维链摄取，联动 CHGIS 1820 清代府州县底图与外部 MCP 检索。',
    route: '/wiki',
  },
];

const GIT_COMMIT_LOG = [
  {
    hash: 'HEAD · v2.5',
    date: '2026-11-11 05:50',
    scope: 'feat(wittfogel & home)',
    msg: '入库魏特夫 Box 9《清史总纲》与 Box 66《满洲帝国的衰落》真实档案全链路示范；重构书卷风 Bento 专题首页与 PLAN_AND_GOAL',
  },
  {
    hash: 'e55cb0c · v2.4',
    date: '2026-11-11 05:10',
    scope: 'feat(radar, wiki, agent)',
    msg: '拆分阶段贰为 4 个独立工作台；升级 nashsu/llm_wiki 图谱/两步摄取/Lint 巡检；新增 /agent 智能体 Chat & Work 协同与 OpenAlex/CHGIS MCP',
  },
  {
    hash: '1b44bfc · v2.1',
    date: '2026-11-11 04:40',
    scope: 'feat(proofread, skills, ci)',
    msg: '实现 OCR 行句级辅助框双向高亮校勘；创建 .agent/skills 领域技能与 backend/mcp_server.py；配置 GitHub Pages 自动部署',
  },
];

export const ShowcaseHome: React.FC = () => {
  const navigate = useNavigate();
  const { loadSampleDossier } = useWorkbench();
  const [activeScene, setActiveScene] = useState<number>(1);
  const [activeFeatureIdx, setActiveFeatureIdx] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [customVideoUrl, setCustomVideoUrl] = useState<string>('');
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isPlaying || customVideoUrl) return;
    const timer = setInterval(() => {
      setActiveScene((prev) => (prev + 1) % HERO_SCENES.length);
    }, 4800);
    return () => clearInterval(timer);
  }, [isPlaying, customVideoUrl]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomVideoUrl(URL.createObjectURL(file));
  };

  const handleLoadWittfogelDemo = async () => {
    await loadSampleDossier();
    navigate('/proofread');
  };

  const scene = HERO_SCENES[activeScene];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] selection:bg-[#9b2c1f]/15">
      {/* ─── 1. 极简书卷风顶部栏（中间胶囊导航 + 右侧操作） ─── */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)]/80 bg-[var(--paper)]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          {/* 左侧品牌印记 */}
          <div
            onClick={() => navigate('/')}
            className="flex cursor-pointer items-center gap-2.5"
          >
            <span
              className="flex h-7 w-7 items-center justify-center rounded-[4px] font-serif text-xs font-semibold text-white shadow-xs"
              style={{ backgroundColor: 'var(--seal)' }}
            >
              清
            </span>
            <span className="font-serif text-[15px] font-semibold tracking-tight text-[var(--ink)]">
              清史未刊文献 · 数智整理平台
            </span>
          </div>

          {/* 中间悬浮胶囊导航（借鉴参考图1的居中胶囊导航结构，保留宣纸书卷色调） */}
          <nav className="hidden items-center gap-1 rounded-full border border-[var(--line-strong)] bg-[#fcfaf5] px-2 py-1 text-xs font-medium text-[var(--ink-secondary)] shadow-[0_2px_10px_rgba(31,27,23,0.04)] md:flex">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="rounded-full bg-[var(--ink)] px-3 py-1 text-white"
            >
              首页
            </button>
            <button
              type="button"
              onClick={() => navigate('/workbench')}
              className="rounded-full px-3 py-1 transition hover:bg-[#f0ece1] hover:text-[var(--ink)]"
            >
              七级编目
            </button>
            <button
              type="button"
              onClick={() => navigate('/proofread')}
              className="rounded-full px-3 py-1 transition hover:bg-[#f0ece1] hover:text-[var(--ink)]"
            >
              双层校订
            </button>
            <button
              type="button"
              onClick={() => navigate('/radar?mode=radar')}
              className="rounded-full px-3 py-1 transition hover:bg-[#f0ece1] hover:text-[var(--ink)]"
            >
              价值与长编
            </button>
            <button
              type="button"
              onClick={() => navigate('/wiki')}
              className="rounded-full px-3 py-1 transition hover:bg-[#f0ece1] hover:text-[var(--ink)]"
            >
              LLM Wiki
            </button>
            <button
              type="button"
              onClick={() => navigate('/atlas')}
              className="rounded-full px-3 py-1 transition hover:bg-[#f0ece1] hover:text-[var(--ink)]"
            >
              1820图谱
            </button>
            <button
              type="button"
              onClick={() => navigate('/agent')}
              className="rounded-full px-3 py-1 text-[#9b2c1f] transition hover:bg-[#9b2c1f]/10"
            >
              智能体协同
            </button>
          </nav>

          {/* 右侧快捷入口 */}
          <div className="flex items-center gap-2">
            <a
              href="#git-changelog"
              className="hidden rounded-full border border-[var(--line)] bg-[#fcfaf5] px-2.5 py-1 font-mono text-[11px] text-[var(--ink-secondary)] hover:border-[var(--ink)] sm:inline-block"
            >
              Git v2.5
            </a>
            <button
              type="button"
              onClick={() => navigate('/workbench')}
              className="rounded-full border border-[var(--ink)] bg-[var(--ink)] px-3.5 py-1 text-xs font-medium text-[var(--sheet)] transition hover:bg-zinc-800"
            >
              在线使用 →
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-10 pb-24">
        {/* ═══════════════════════════════════════════════════════════════════
            第一屏：居中标题 + 中央圆角动态画幅 + 双栏功能概要（对应参考图 1 布局）
           ═══════════════════════════════════════════════════════════════════ */}
        <section className="relative">
          {/* 顶部胶囊徽标 */}
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--line-strong)] bg-[#fcfaf5] px-3.5 py-1 text-[11px] shadow-2xs">
              <span className="font-semibold text-[#9b2c1f]">
                ★ 实测示范已就绪
              </span>
              <span className="text-[var(--line-strong)]">|</span>
              <span className="font-mono text-[var(--ink-secondary)]">
                Karl A. Wittfogel Papers · Box 9 &amp; Box 66
              </span>
            </div>

            {/* 主标题：渐变朱砂与浓墨书法感衬线体 */}
            <h1 className="mt-4 font-serif text-3xl font-semibold tracking-tight sm:text-[40px] sm:leading-[1.2]">
              <span className="text-[#9b2c1f]">LLM 与 Agent 赋能的</span>
              <span className="text-[var(--ink)]">未刊清史文献考据引擎</span>
            </h1>

            <p className="mt-3 max-w-2xl text-xs leading-relaxed text-[var(--ink-secondary)] sm:text-sm">
              全面适配 EAD 七级编目规范、双层手迹解耦、五维史料雷达、LLM Wiki 与 MCP 协议，助力清史数字人文深度知识生产
            </p>

            {/* 两个胶囊按钮 */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleLoadWittfogelDemo}
                className="rounded-full border border-[var(--line-strong)] bg-[#fcfaf5] px-5 py-2 text-xs font-medium text-[var(--ink)] shadow-2xs transition hover:border-[var(--ink)] hover:bg-white"
              >
                魏特夫 Box 9 &amp; 66 示范 ↗
              </button>
              <button
                type="button"
                onClick={() => navigate('/agent')}
                className="rounded-full bg-[var(--ink)] px-5 py-2 text-xs font-medium text-white shadow-xs transition hover:bg-[#9b2c1f]"
              >
                进入智能体协同台
              </button>
            </div>
          </div>

          {/* ─── 中央圆角动态展示画幅（Central Rounded Showcase Frame） ─── */}
          <div className="relative mx-auto mt-8 max-w-4xl">
            {/* 柔和宣纸朱砂环境背光 */}
            <div
              className="pointer-events-none absolute -inset-4 -z-10 rounded-[28px] opacity-60 blur-2xl"
              style={{
                background:
                  'radial-gradient(circle at 30% 30%, rgba(155,44,31,0.14), rgba(180,140,80,0.10) 50%, transparent 80%)',
              }}
            />

            <div className="overflow-hidden rounded-[16px] border border-[var(--line-strong)] bg-[#fcfaf5] shadow-[0_20px_60px_rgba(31,27,23,0.09)]">
              {/* 若用户选择了本地 MP4 视频则直接播放，否则展示清爽点阵动态画幅 */}
              {customVideoUrl ? (
                <div className="relative aspect-[16/9] w-full bg-[#faf8f3]">
                  <video
                    src={customVideoUrl}
                    controls
                    autoPlay
                    loop
                    className="h-full w-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={() => setCustomVideoUrl('')}
                    className="absolute top-3 right-3 rounded-full border border-[var(--line)] bg-white/90 px-3 py-1 text-[11px] font-medium text-[var(--ink)] shadow-xs"
                  >
                    返回内置动态画幅
                  </button>
                </div>
              ) : (
                <div
                  className="relative flex min-h-[390px] flex-col justify-between p-6 sm:p-8"
                  style={{
                    backgroundImage:
                      'radial-gradient(rgba(31, 27, 23, 0.09) 1px, transparent 1px)',
                    backgroundSize: '18px 18px',
                  }}
                >
                  {/* 顶部极简场景状态与核心大字标题 */}
                  <div className="text-center">
                    <div className="font-mono text-[10px] tracking-widest text-[var(--ink-muted)] uppercase">
                      {scene.tag}
                    </div>
                    <div className="mt-1.5 font-serif text-2xl font-semibold tracking-tight sm:text-3xl">
                      <span className="text-[var(--ink)]">
                        {scene.headlinePrefix}
                      </span>
                      <span className="text-[#9b2c1f]">
                        {scene.headlineAccent}
                      </span>
                    </div>
                    <p className="mx-auto mt-1.5 max-w-xl text-xs text-[var(--ink-secondary)]">
                      {scene.caption}
                    </p>
                  </div>

                  {/* 画幅中央动态视觉舞台（4 个清爽场景无杂乱切换） */}
                  <div className="my-5 flex flex-1 items-center justify-center">
                    {activeScene === 0 && (
                      <div className="grid w-full max-w-3xl grid-cols-1 items-center gap-4 md:grid-cols-12">
                        {/* 左侧：多格式未刊档案输入卡片 */}
                        <div className="space-y-2.5 md:col-span-5">
                          <div className="flex items-center gap-3 rounded-[8px] border border-[var(--line-strong)] bg-white p-3 shadow-xs">
                            <span className="rounded bg-[#9b2c1f] px-2 py-1 font-mono text-[10px] font-bold text-white">
                              PDF
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-mono text-xs font-semibold text-[var(--ink)]">
                                Box9folder2_ChingOutline.pdf
                              </div>
                              <div className="text-[11px] text-[var(--ink-muted)]">
                                魏特夫《清史总纲》· 7 页高清原件
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-[8px] border border-[var(--line-strong)] bg-white p-3 shadow-xs">
                            <span className="rounded bg-[#1f1b17] px-2 py-1 font-mono text-[10px] font-bold text-white">
                              PDF
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-mono text-xs font-semibold text-[var(--ink)]">
                                Box66_F7_manchu_empire.pdf
                              </div>
                              <div className="text-[11px] text-[var(--ink-muted)]">
                                《满洲帝国的衰落》手批稿 · 21 页
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 rounded-[8px] border border-[var(--line)] bg-white/80 p-2.5">
                            <span className="rounded bg-amber-700 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                              EAD
                            </span>
                            <div className="text-[11px] text-[var(--ink-secondary)]">
                              自动匹配 ISAD(G) 七级目录与三态核验机
                            </div>
                          </div>
                        </div>

                        {/* 中间流转箭头 */}
                        <div className="flex justify-center md:col-span-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-[var(--line-strong)] bg-white font-mono text-sm text-[#9b2c1f] shadow-xs">
                            ➔
                          </div>
                        </div>

                        {/* 右侧：结构化七级编目与150字摘记卡 */}
                        <div className="rounded-[10px] border border-[var(--line-strong)] bg-white p-4 shadow-sm md:col-span-5">
                          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                            <span className="font-mono text-[10px] font-semibold text-[#9b2c1f]">
                              EAD 7-LEVEL · 文件夹级 (FOLDER)
                            </span>
                            <span className="rounded bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-800">
                              ★ 原件已核
                            </span>
                          </div>
                          <div className="mt-2 font-serif text-sm font-semibold text-[var(--ink)]">
                            Karl A. Wittfogel Papers · Box 9 &amp; Box 66
                          </div>
                          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--ink-secondary)]">
                            <strong>150字三段式内容摘记：</strong>
                            自动分离【第一层：馆方原始英文题名】与【第二层：体量+清史内容+已刊关系摘记】，完整记录从《清史十六章总纲》到《满洲帝国的衰落》手稿的知识生产链条。
                          </p>
                        </div>
                      </div>
                    )}

                    {activeScene === 1 && (
                      <div className="grid w-full max-w-3xl grid-cols-1 items-center gap-5 md:grid-cols-12">
                        {/* 左侧：真实 Box 66 原件局部与框选高亮 */}
                        <div className="relative overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-white p-2 shadow-sm md:col-span-6">
                          <img
                            src="/iiif-samples/wittfogel-box66-f7_p0003.jpg"
                            alt="Wittfogel Box 66 Page 3"
                            className="h-52 w-full rounded-[4px] object-cover object-[center_26%]"
                          />
                          <div className="absolute top-[28%] left-[16%] h-[24%] w-[68%] rounded-[3px] border-2 border-[#1f1b17] bg-[#1f1b17]/10">
                            <span className="absolute -top-4 left-0 rounded bg-[#1f1b17] px-1.5 py-0.2 font-mono text-[9px] text-white">
                              #01 打字底稿层 (1908 溥仪登基)
                            </span>
                          </div>
                          <div className="absolute top-[56%] left-[16%] h-[22%] w-[68%] rounded-[3px] border-2 border-[#9b2c1f] bg-[#9b2c1f]/15">
                            <span className="absolute -top-4 left-0 rounded bg-[#9b2c1f] px-1.5 py-0.2 font-mono text-[9px] text-white">
                              #02 铅笔校改层：Tsai-li → Tsai-feng (载沣)
                            </span>
                          </div>
                        </div>

                        {/* 右侧：双层手迹剥离卡片 */}
                        <div className="space-y-2.5 md:col-span-6">
                          <div className="rounded-[8px] border border-[var(--line)] bg-white p-3 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="rounded bg-[#1f1b17] px-1.5 py-0.5 font-mono text-[10px] text-white">
                                LAYER 1 · 打字机初稿层
                              </span>
                              <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                                Box 66, Folder 7, p.3
                              </span>
                            </div>
                            <p className="mt-1.5 font-mono text-xs text-[var(--ink-secondary)]">
                              ...standing by his side, the Prince Regent,{' '}
                              <span className="line-through text-red-700">
                                Tsai-li
                              </span>
                              , coaxed the crying emperor...
                            </p>
                          </div>

                          <div className="rounded-[8px] border border-[#9b2c1f]/40 bg-white p-3 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="rounded bg-[#9b2c1f] px-1.5 py-0.5 font-mono text-[10px] text-white">
                                LAYER 2 · 魏特夫铅笔审订层
                              </span>
                              <span className="font-mono text-[10px] text-[#9b2c1f]">
                                行间手迹剥离
                              </span>
                            </div>
                            <p className="mt-1.5 font-serif text-xs font-medium text-[var(--ink)]">
                              铅笔校改为{' '}
                              <span className="font-mono font-bold text-[#9b2c1f]">
                                Tsai-feng（摄政王醇亲王载沣）
                              </span>
                              ；同卷 p.11 顶批{' '}
                              <span className="font-mono font-semibold">
                                &ldquo;Criticism of T&apos;an - K.A.W.!&rdquo;
                              </span>
                              ，p.17 页脚批注{' '}
                              <span className="font-mono font-semibold">
                                &ldquo;/ cf. Dr. Hu!&rdquo;
                              </span>
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeScene === 2 && (
                      <div className="grid w-full max-w-3xl grid-cols-1 items-center gap-4 md:grid-cols-12">
                        <div className="rounded-[10px] border border-[var(--line-strong)] bg-white p-4 shadow-xs md:col-span-5">
                          <div className="font-mono text-[10px] font-semibold text-[#9b2c1f]">
                            5D HISTORIOGRAPHICAL RADAR
                          </div>
                          <div className="mt-1 font-serif text-sm font-semibold text-[var(--ink)]">
                            魏特夫档案五维价值评估
                          </div>
                          <div className="mt-3 space-y-2 text-xs">
                            {[
                              { k: '制度细节异文', v: 96 },
                              { k: '隐蔽史学盲区 (抄家财政)', v: 95 },
                              { k: '中西概念偏移预警', v: 94 },
                              { k: '实录母本冲突考异', v: 92 },
                              { k: '前沿课题孵化潜力', v: 97 },
                            ].map((item) => (
                              <div key={item.k}>
                                <div className="flex justify-between text-[11px]">
                                  <span className="text-[var(--ink-secondary)]">
                                    {item.k}
                                  </span>
                                  <span className="font-mono font-bold text-[var(--ink)]">
                                    {item.v}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[#f0ece1]">
                                  <div
                                    className="h-full rounded-full bg-[#9b2c1f]"
                                    style={{ width: `${item.v}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="space-y-2.5 md:col-span-7">
                          <div className="rounded-[10px] border border-[var(--line-strong)] bg-white p-3.5 shadow-xs">
                            <div className="flex items-center justify-between">
                              <span className="font-serif text-xs font-bold text-[#9b2c1f]">
                                🧭 跨卷盲区发掘：Box 9 提纲 × Box 66 手稿
                              </span>
                              <span className="rounded bg-[#f3efe6] px-2 py-0.5 font-mono text-[10px] text-[var(--ink)]">
                                司马光《通鉴考异》体
                              </span>
                            </div>
                            <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                              <strong>【考异发现】</strong>Box 9 提纲将
                              <code className="mx-1 rounded bg-[#f3efe6] px-1 font-mono text-[11px]">
                                X.B.4 Confiscations (抄家)
                              </code>
                              与
                              <code className="mx-1 rounded bg-[#f3efe6] px-1 font-mono text-[11px]">
                                XII.B.7 Relief as a racket (荒政敛财)
                              </code>
                              列为清代制度专目；Box 66 手稿则以“和珅贪墨八亿两”“南河总督杀五十猪做一盘烤肉”实证之。经对读《清实录》与内务府抄家档，自动剥离晚清野史十倍夸大数字，提炼出“清代内务府抄家财政与河工漏卮”高价值选题。
                            </p>
                          </div>

                          <div className="rounded-[10px] border border-[var(--line)] bg-[#faf7f0] p-3 text-xs">
                            <span className="font-semibold text-[var(--ink)]">
                              ⚖️ 中国史学主体立场审定：
                            </span>
                            <span className="text-[var(--ink-secondary)]">
                              辨析魏特夫 Box 9“满汉二元征服论（Dual root）”与 Box 66 第17页自承“汉人视清廷同于明朝、敬重《红楼梦》满洲文人”之内部张力。
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {activeScene === 3 && (
                      <div className="grid w-full max-w-3xl grid-cols-1 items-center gap-4 md:grid-cols-12">
                        <div className="rounded-[10px] border border-[var(--line-strong)] bg-white p-4 shadow-xs md:col-span-6">
                          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                            <span className="font-mono text-[10px] font-semibold text-[#9b2c1f]">
                              NASHSU/LLM_WIKI · 四级证据链
                            </span>
                            <span className="font-mono text-[10px] text-emerald-700">
                              Wiki Lint 100%
                            </span>
                          </div>
                          <div className="mt-2.5 space-y-2 text-xs">
                            <div className="rounded bg-[#f7f4ec] p-2 font-mono text-[11px] text-[var(--ink)]">
                              [[魏特夫《清史研究十六章总纲》]] ↔ [[满洲帝国的衰落手稿]]
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <span className="rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[10px]">
                                ① 原图 xywh 坐标
                              </span>
                              <span className="rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[10px]">
                                ② 考异长编 CMP-KAW-01
                              </span>
                              <span className="rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[10px]">
                                ③ 双向链接词条
                              </span>
                              <span className="rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[10px]">
                                ④ CHGIS 1820 坐标
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-[10px] border border-[var(--line-strong)] bg-white p-4 shadow-xs md:col-span-6">
                          <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                            <span className="font-mono text-[10px] font-semibold text-[var(--ink)]">
                              CHGIS V6 · 1820 历史地理落点
                            </span>
                            <span className="font-mono text-[10px] text-[#9b2c1f]">
                              5 个核心点位已锚定
                            </span>
                          </div>
                          <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px]">
                            <div className="rounded border border-[var(--line)] bg-[#faf8f4] p-2">
                              <div className="font-semibold text-[var(--ink)]">
                                ● 北京（顺天府）
                              </div>
                              <div className="text-[10px] text-[var(--ink-muted)]">
                                军机处 · 太和殿登基 (39.91°N)
                              </div>
                            </div>
                            <div className="rounded border border-[var(--line)] bg-[#faf8f4] p-2">
                              <div className="font-semibold text-[var(--ink)]">
                                ● 清江浦（南河总督）
                              </div>
                              <div className="text-[10px] text-[var(--ink-muted)]">
                                治河糜费与运河枢纽 (33.58°N)
                              </div>
                            </div>
                            <div className="rounded border border-[var(--line)] bg-[#faf8f4] p-2">
                              <div className="font-semibold text-[var(--ink)]">
                                ● 扬州 / 江宁府
                              </div>
                              <div className="text-[10px] text-[var(--ink-muted)]">
                                乾隆南巡 · 曹雪芹故里
                              </div>
                            </div>
                            <div className="rounded border border-[var(--line)] bg-[#faf8f4] p-2">
                              <div className="font-semibold text-[var(--ink)]">
                                ● 上海 / 盛京
                              </div>
                              <div className="text-[10px] text-[var(--ink-muted)]">
                                官督商办 · 八旗龙兴地
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 画幅底部极简控制栏（场景切换圆点 + MP4载入 + 立即跳转） */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--line)]/80 pt-3">
                    <div className="flex items-center gap-1.5">
                      {HERO_SCENES.map((s, idx) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            setActiveScene(idx);
                            setIsPlaying(false);
                          }}
                          className={`rounded-full px-2.5 py-0.5 font-mono text-[11px] transition ${
                            idx === activeScene
                              ? 'bg-[var(--ink)] font-semibold text-white'
                              : 'bg-[#f0ece1] text-[var(--ink-secondary)] hover:bg-[#e5dfd0]'
                          }`}
                        >
                          0{idx + 1}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setIsPlaying((p) => !p)}
                        className="ml-1 rounded-full border border-[var(--line)] bg-white px-2.5 py-0.5 text-[11px] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      >
                        {isPlaying ? '❚❚' : '▶'}
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        ref={videoFileInputRef}
                        type="file"
                        accept="video/mp4,video/webm"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => videoFileInputRef.current?.click()}
                        className="rounded-full border border-[var(--line)] bg-white px-3 py-1 text-[11px] text-[var(--ink-secondary)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                      >
                        载入演示视频 (MP4)
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate(scene.route)}
                        className="rounded-full bg-[#9b2c1f] px-3.5 py-1 text-[11px] font-medium text-white hover:bg-[#7e2217]"
                      >
                        进入该场景模块 →
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── 画幅正下方：左文右图双栏核心能力区（对应参考图 1 下半部分） ─── */}
          <div className="mx-auto mt-10 max-w-5xl rounded-[16px] border border-[var(--line)] bg-[#f1ede4]/85 p-6 sm:p-10">
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              {/* 左栏：标题 + 简述 + 3行可切换特性条 */}
              <div className="lg:col-span-5">
                <h2 className="font-serif text-xl font-semibold text-[var(--ink)]">
                  多模态手稿与全格式兼容
                </h2>
                <p className="mt-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  PDF 扫描卷、JPG 单页、海外馆藏目录、打字机底稿与手写铅笔批注一站式解析，让智能体直接读取“证据级”干净文本与像素坐标。
                </p>

                <div className="mt-5 divide-y divide-[var(--line-strong)]/60 border-t border-b border-[var(--line-strong)]/60">
                  {[
                    {
                      title: '跨页提纲与双层手迹自动剥离',
                      desc: '精准分离魏特夫 Box 9 打字大纲与 Box 66 铅笔行间改写、顶批签名',
                    },
                    {
                      title: '保留原件图像坐标与三级核验上下文',
                      desc: '每一处识读均绑定 xywh 像素框与 ○目录 / ●样例 / ★原件 核验状态',
                    },
                    {
                      title: '原生融入主流 Agent 与外部 MCP 协议',
                      desc: '内置 OpenAlex、Wikipedia、CHGIS 1820、CBDB 与 Zotero 实时连接器',
                    },
                  ].map((feat, idx) => (
                    <div
                      key={feat.title}
                      onClick={() => setActiveFeatureIdx(idx)}
                      className={`cursor-pointer py-3 transition ${
                        activeFeatureIdx === idx
                          ? 'text-[var(--ink)]'
                          : 'text-[var(--ink-muted)] hover:text-[var(--ink-secondary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{feat.title}</span>
                        <span className="font-mono text-[10px] text-[#9b2c1f]">
                          {activeFeatureIdx === idx ? '●' : '○'}
                        </span>
                      </div>
                      {activeFeatureIdx === idx && (
                        <p className="mt-1 text-[11px] leading-relaxed text-[var(--ink-secondary)]">
                          {feat.desc}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 右栏：白底悬浮文件标签卡片（对应参考图 1 右下白底悬浮窗） */}
              <div className="lg:col-span-7">
                <div className="relative overflow-hidden rounded-[12px] border border-[var(--line-strong)] bg-[#fcfaf5] p-6 shadow-sm">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#9b2c1f]/80" />
                      <span className="h-2.5 w-2.5 rounded-full bg-amber-600/70" />
                      <span className="h-2.5 w-2.5 rounded-full bg-emerald-700/70" />
                      <span className="ml-2 font-serif text-xs font-semibold text-[var(--ink)]">
                        未刊档案与多源知识流 ——{' '}
                        <span className="text-[#9b2c1f]">一网打尽</span>
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                      IndexedDB + MCP Ready
                    </span>
                  </div>

                  {/* 错落有致的档案与数据流浮动卡 */}
                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div
                      onClick={() => navigate('/reader')}
                      className="cursor-pointer rounded-[8px] border border-[var(--line)] bg-white p-3 shadow-2xs transition hover:-translate-y-0.5 hover:border-[var(--ink)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#9b2c1f] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          BOX 9
                        </span>
                        <span className="font-serif text-xs font-semibold text-[var(--ink)]">
                          CHING OUTLINE (7 Pages)
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--ink-secondary)]">
                        满汉二元农牧 · 军屯 · 抄家财政 · 荒政中饱 · 猛安谋克至八旗
                      </p>
                    </div>

                    <div
                      onClick={() => navigate('/proofread')}
                      className="cursor-pointer rounded-[8px] border border-[var(--line)] bg-white p-3 shadow-2xs transition hover:-translate-y-0.5 hover:border-[var(--ink)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#1f1b17] px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          BOX 66
                        </span>
                        <span className="font-serif text-xs font-semibold text-[var(--ink)]">
                          Decline of Manchu Empire (21 Pages)
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--ink-secondary)]">
                        溥仪登基改订载沣 · 军机处 · 和珅八亿两 · 官督商办 · 胡适红学批注
                      </p>
                    </div>

                    <div
                      onClick={() => navigate('/agent')}
                      className="cursor-pointer rounded-[8px] border border-[var(--line)] bg-white p-3 shadow-2xs transition hover:-translate-y-0.5 hover:border-[var(--ink)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-amber-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          MCP
                        </span>
                        <span className="font-serif text-xs font-semibold text-[var(--ink)]">
                          OpenAlex + CHGIS + CBDB
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--ink-secondary)]">
                        实时检索全球汉学论文 DOI、清代人物传记与 1820 历史地理坐标
                      </p>
                    </div>

                    <div
                      onClick={() => navigate('/wiki')}
                      className="cursor-pointer rounded-[8px] border border-[var(--line)] bg-white p-3 shadow-2xs transition hover:-translate-y-0.5 hover:border-[var(--ink)]"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-emerald-800 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                          WIKI
                        </span>
                        <span className="font-serif text-xs font-semibold text-[var(--ink)]">
                          nashsu/llm_wiki 知识编译
                        </span>
                      </div>
                      <p className="mt-1.5 text-[11px] text-[var(--ink-secondary)]">
                        四级证据链 · Cytoscape 关系网 · 两步思维链摄取 · Wiki Lint 巡检
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            第二屏：功能专题展示 Bento Grid（严格学习参考图 2 的层次结构，保持宣纸墨色美学）
           ═══════════════════════════════════════════════════════════════════ */}
        <section className="mt-20">
          {/* 专题一标题 */}
          <div className="text-center">
            <div className="font-mono text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
              FEATURE SHOWCASE I · MACHINE-READABLE MANUSCRIPT EXTRACTION
            </div>
            <h2 className="mt-1.5 font-serif text-2xl font-semibold text-[var(--ink)] sm:text-3xl">
              未刊手稿的机器可读与双层结构化提取
            </h2>
          </div>

          {/* 专题一：左右对称双大卡（文字要点在上 + 叠层原件与引出框在下，完全对应参考图 2 上半部） */}
          <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* 左卡：提纲与目录智能还原 */}
            <div
              onClick={() => navigate('/workbench')}
              className="group flex cursor-pointer flex-col justify-between rounded-[16px] border border-[var(--line-strong)] bg-[#f4f1e8] p-6 transition hover:border-[var(--ink)] hover:shadow-md sm:p-7"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg font-semibold text-[var(--ink)] group-hover:text-[#9b2c1f]">
                    馆藏提纲智能还原与七级编目结构化
                  </h3>
                  <span className="font-mono text-xs text-[var(--ink-muted)]">
                    1.1 &amp; 1.2 →
                  </span>
                </div>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  <li>
                    攻克海外打字提纲跨页罗马数字章节、手写下划线与缩进层级，消除 AI 对复杂档案目录的阅读障碍
                  </li>
                  <li>
                    输出 EAD 七级目录树、150字三段式内容摘记与 JSON/CSV 机器可读格式，无缝接入后续考据流
                  </li>
                </ul>
              </div>

              {/* 下方叠层原件标注微缩窗口（Box 9 CHING OUTLINE） */}
              <div className="relative mt-6 rounded-[10px] border border-[var(--line-strong)] bg-[#fcfaf5] p-4 shadow-xs">
                <div className="grid grid-cols-12 items-center gap-3">
                  {/* 原件窗口 */}
                  <div className="col-span-6 overflow-hidden rounded-[6px] border border-[var(--line-strong)] bg-white shadow-2xs">
                    <div className="bg-[#1f1b17] px-2.5 py-1 font-mono text-[9px] text-white">
                      Box 9, Folder 2 · CHING OUTLINE
                    </div>
                    <img
                      src="/iiif-samples/wittfogel-box9-f2_p0002.jpg"
                      alt="Wittfogel Box 9 Outline"
                      className="h-44 w-full object-cover object-top"
                    />
                  </div>

                  {/* 引出结构化卡片（对应参考图2中的白底弹出小卡） */}
                  <div className="col-span-6 space-y-2">
                    <div className="rounded-[6px] border border-[#9b2c1f]/40 bg-white p-2.5 shadow-2xs">
                      <div className="font-mono text-[9px] font-bold text-[#9b2c1f]">
                        II. AGRICULTURE &amp; PASTORALISM
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--ink)]">
                        1. Double roots: Manchu and Chinese
                      </div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        4.b. Military settlements (conquerors) 圈地与军屯
                      </div>
                    </div>

                    <div className="rounded-[6px] border border-[var(--line-strong)] bg-white p-2.5 shadow-2xs">
                      <div className="font-mono text-[9px] font-bold text-[var(--ink)]">
                        XII. CALAMITIES &amp; RELIEF (p.6)
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--ink)]">
                        B.3 Granaries 常平仓 / B.7 Relief as a racket
                      </div>
                    </div>

                    <div className="rounded-[6px] border border-[var(--line-strong)] bg-white p-2.5 shadow-2xs">
                      <div className="font-mono text-[9px] font-bold text-[var(--ink)]">
                        XV. ARMY &amp; WARFARE (p.7)
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[#9b2c1f]">
                        2. mêng-an, mo-k&apos;o; banners (猛安谋克→八旗)
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 右卡：双层手迹解耦转化为标准校勘码 */}
            <div
              onClick={() => navigate('/proofread')}
              className="group flex cursor-pointer flex-col justify-between rounded-[16px] border border-[var(--line-strong)] bg-[#f4f1e8] p-6 transition hover:border-[var(--ink)] hover:shadow-md sm:p-7"
            >
              <div>
                <div className="flex items-center justify-between">
                  <h3 className="font-serif text-lg font-semibold text-[var(--ink)] group-hover:text-[#9b2c1f]">
                    双层手迹解耦与行句辅助校订
                  </h3>
                  <span className="font-mono text-xs text-[var(--ink-muted)]">
                    1.3 →
                  </span>
                </div>
                <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  <li>
                    强力解析打字机初稿、审稿人铅笔行间增删、页眉签名批注与页脚学者互证标记
                  </li>
                  <li>
                    输出行句级双向高亮对照、自动标点与学术汉译，为史料雷达与推理大模型提供标准证据输入
                  </li>
                </ul>
              </div>

              {/* 下方叠层原件标注微缩窗口（Box 66 Decline of Manchu Empire） */}
              <div className="relative mt-6 rounded-[10px] border border-[var(--line-strong)] bg-[#fcfaf5] p-4 shadow-xs">
                <div className="grid grid-cols-12 items-center gap-3">
                  {/* 原件窗口 */}
                  <div className="col-span-6 overflow-hidden rounded-[6px] border border-[var(--line-strong)] bg-white shadow-2xs">
                    <div className="bg-[#9b2c1f] px-2.5 py-1 font-mono text-[9px] text-white">
                      Box 66, Folder 7 · Decline of Manchu Empire
                    </div>
                    <img
                      src="/iiif-samples/wittfogel-box66-f7_p0011.jpg"
                      alt="Wittfogel Box 66 Page 11"
                      className="h-44 w-full object-cover object-top"
                    />
                  </div>

                  {/* 引出批注卡片 */}
                  <div className="col-span-6 space-y-2">
                    <div className="rounded-[6px] border border-[#9b2c1f]/40 bg-white p-2.5 shadow-2xs">
                      <div className="font-mono text-[9px] font-bold text-[#9b2c1f]">
                        PENCIL MARGINALIA · 叶十一顶批
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] font-semibold text-[var(--ink)]">
                        &ldquo;Criticism of T&apos;an - K.A.W.!&rdquo;
                      </div>
                      <div className="text-[10px] text-[var(--ink-muted)]">
                        魏特夫亲笔要求补入对谭嗣同之评析
                      </div>
                    </div>

                    <div className="rounded-[6px] border border-[var(--line-strong)] bg-white p-2.5 shadow-2xs">
                      <div className="font-mono text-[9px] font-bold text-[var(--ink)]">
                        INTERLINEAR REVISION · 叶三改订
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[var(--ink)]">
                        Prince Regent:{' '}
                        <span className="line-through text-red-700">Tsai-li</span>{' '}
                        → <span className="font-bold text-[#9b2c1f]">Tsai-feng</span>
                      </div>
                    </div>

                    <div className="rounded-[6px] border border-[var(--line-strong)] bg-white p-2.5 shadow-2xs">
                      <div className="font-mono text-[9px] font-bold text-[var(--ink)]">
                        SCHOLARLY CROSS-REF · 叶十七页脚
                      </div>
                      <div className="mt-0.5 text-[11px] font-medium text-[#9b2c1f]">
                        Dream of the Red Chamber → &ldquo;/ cf. Dr. Hu!&rdquo;
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ─── 专题二：大容器包裹的“左一高卡 + 右二横卡” Bento 布局（严格对应参考图 2 下半部） ─── */}
          <div className="mt-10 rounded-[20px] border border-[var(--line-strong)] bg-[#f1ede4] p-6 sm:p-8">
            {/* 顶部标题栏 + 右侧联动链接 */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-serif text-2xl font-semibold text-[var(--ink)]">
                  深度史料考据与多维知识生产
                </h2>
              </div>
              <button
                type="button"
                onClick={handleLoadWittfogelDemo}
                className="font-serif text-xs font-medium text-[#9b2c1f] hover:underline"
              >
                携手魏特夫 Box 9 &amp; Box 66 实测卷宗，赋能清史科研突破，立即体验！ ↗
              </button>
            </div>

            {/* 左 1 高卡 + 右 2 叠卡 Bento Grid */}
            <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* 左侧高卡（占 5 列）：五维史料雷达与中国立场审定 */}
              <div
                onClick={() => navigate('/radar?mode=radar')}
                className="group flex cursor-pointer flex-col justify-between rounded-[14px] border border-[var(--line)] bg-[#fcfaf5] p-6 shadow-2xs transition hover:border-[var(--ink)] hover:shadow-sm lg:col-span-5"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-lg font-semibold text-[var(--ink)] group-hover:text-[#9b2c1f]">
                      五维史料雷达与中国立场审定
                    </h3>
                    <span className="rounded bg-[#9b2c1f]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#9b2c1f]">
                      2.1 · 2.3 · 2.4
                    </span>
                  </div>
                  <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                    <li>
                      精确剥离一手孤本手稿与晚清野史二手转引（如和珅八亿两传闻）
                    </li>
                    <li>
                      自主探寻常态阅读易忽略的“抄家财政（Confiscations）”与“荒政中饱”盲区
                    </li>
                    <li>
                      识别“征服王朝二元论”概念预设，以清代多民族大一统史观生成审定按语
                    </li>
                  </ul>
                </div>

                {/* 底部可视化微缩图 */}
                <div className="mt-6 rounded-[10px] border border-[var(--line)] bg-white p-4">
                  <div className="flex items-center justify-between border-b border-[var(--line)] pb-2">
                    <span className="font-mono text-[10px] font-bold text-[var(--ink)]">
                      RADAR SCORE: 95.4 / 100
                    </span>
                    <span className="font-mono text-[10px] text-[#9b2c1f]">
                      ★ 一手孤本手稿
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-5 items-end gap-2 pt-2 text-center">
                    {[
                      { label: '制度异文', h: 'h-20', val: '96' },
                      { label: '隐蔽盲区', h: 'h-24', val: '98' },
                      { label: '概念纠偏', h: 'h-18', val: '94' },
                      { label: '母本考异', h: 'h-16', val: '92' },
                      { label: '选题潜力', h: 'h-22', val: '97' },
                    ].map((bar) => (
                      <div
                        key={bar.label}
                        className="flex flex-col items-center"
                      >
                        <span className="font-mono text-[10px] font-semibold text-[#9b2c1f]">
                          {bar.val}
                        </span>
                        <div className="mt-1 flex h-24 w-full items-end justify-center rounded bg-[#f4f1e8] p-1">
                          <div
                            className={`w-full rounded-t bg-[#1f1b17] transition-all group-hover:bg-[#9b2c1f] ${bar.h}`}
                          />
                        </div>
                        <span className="mt-1.5 text-[10px] text-[var(--ink-secondary)]">
                          {bar.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 右侧上下两张横卡（占 7 列） */}
              <div className="flex flex-col justify-between gap-6 lg:col-span-7">
                {/* 右上横卡：司马光《通鉴考异》长编 */}
                <div
                  onClick={() => navigate('/radar?mode=changbian')}
                  className="group grid cursor-pointer grid-cols-1 items-center gap-5 rounded-[14px] border border-[var(--line)] bg-[#fcfaf5] p-6 shadow-2xs transition hover:border-[var(--ink)] hover:shadow-sm sm:grid-cols-12"
                >
                  <div className="sm:col-span-6">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg font-semibold text-[var(--ink)] group-hover:text-[#9b2c1f]">
                        《通鉴考异》三方对读长编
                      </h3>
                      <span className="rounded bg-[#1f1b17] px-1.5 py-0.5 font-mono text-[9px] text-white">
                        2.2
                      </span>
                    </div>
                    <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      <li>
                        精确比对《清实录》母本、魏特夫未刊手稿与已刊专著三方异同
                      </li>
                      <li>
                        自动纂修【长编正文】【考异】【价值按语】标准史学文本
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-[8px] border border-[var(--line-strong)] bg-white p-3.5 shadow-2xs sm:col-span-6">
                    <div className="flex items-center justify-between border-b border-[var(--line)] pb-1.5 font-mono text-[9px] text-[var(--ink-muted)]">
                      <span>CMP-KAW-01 · 跨卷互证</span>
                      <span className="text-[#9b2c1f]">Box 9 × Box 66</span>
                    </div>
                    <div className="mt-2 space-y-1.5 text-[11px]">
                      <div className="rounded bg-[#f7f4ec] px-2 py-1 text-[var(--ink)]">
                        <strong>母本：</strong>《清朝文献通考》八旗牛录与驻防建制
                      </div>
                      <div className="rounded bg-[#9b2c1f]/10 px-2 py-1 text-[#9b2c1f]">
                        <strong>未刊稿：</strong>mêng-an, mo-k&apos;o; banners + / cf. Dr. Hu!
                      </div>
                      <div className="rounded bg-[#f7f4ec] px-2 py-1 text-[var(--ink-secondary)]">
                        <strong>考异结论：</strong>揭示手稿内“二元对立”与“满汉交融”之张力
                      </div>
                    </div>
                  </div>
                </div>

                {/* 右下横卡：全局知识关联（LLM Wiki + 1820 图谱 + Agent 协同） */}
                <div
                  onClick={() => navigate('/wiki')}
                  className="group grid cursor-pointer grid-cols-1 items-center gap-5 rounded-[14px] border border-[var(--line)] bg-[#fcfaf5] p-6 shadow-2xs transition hover:border-[var(--ink)] hover:shadow-sm sm:grid-cols-12"
                >
                  <div className="sm:col-span-6">
                    <div className="flex items-center gap-2">
                      <h3 className="font-serif text-lg font-semibold text-[var(--ink)] group-hover:text-[#9b2c1f]">
                        全局知识图谱与时空关联
                      </h3>
                      <span className="rounded bg-[#9b2c1f] px-1.5 py-0.5 font-mono text-[9px] text-white">
                        3.1 · 3.2 · 4.0
                      </span>
                    </div>
                    <ul className="mt-3 list-disc space-y-1.5 pl-4 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      <li>
                        提取手稿中的人物、官制、地名标识符，构建 Cytoscape 全局关系网
                      </li>
                      <li>
                        复刻 nashsu/llm_wiki 两步思维链摄取与 Wiki Lint 断链巡检
                      </li>
                      <li>
                        获得「原图坐标 ↔ 考异长编 ↔ Wiki 词条 ↔ 1820 地图」交错证据链
                      </li>
                    </ul>
                  </div>

                  <div className="rounded-[8px] border border-[var(--line-strong)] bg-white p-3.5 shadow-2xs sm:col-span-6">
                    <div className="flex items-center justify-between font-mono text-[9px] text-[var(--ink-muted)]">
                      <span>GRAPH VIEW &amp; EVIDENCE CHAIN</span>
                      <span className="text-emerald-700">6 Nodes Linked</span>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      <div className="flex-1 space-y-1.5">
                        <div className="rounded border border-[var(--line)] bg-[#faf8f4] px-2 py-1 font-mono text-[10px] text-[var(--ink)]">
                          [[清代抄家财政与荒政中饱]]
                        </div>
                        <div className="rounded border border-[var(--line)] bg-[#faf8f4] px-2 py-1 font-mono text-[10px] text-[var(--ink)]">
                          [[猛安谋克与八旗驻防体制]]
                        </div>
                        <div className="rounded border border-[var(--line)] bg-[#faf8f4] px-2 py-1 font-mono text-[10px] text-[var(--ink)]">
                          [[官督商办与晚清工业化]]
                        </div>
                      </div>
                      <div className="flex flex-col items-center gap-1 rounded-[6px] border border-[#9b2c1f]/30 bg-[#9b2c1f]/5 px-2.5 py-2 text-center">
                        <span className="font-mono text-[9px] font-bold text-[#9b2c1f]">
                          CHGIS 1820
                        </span>
                        <span className="text-[10px] font-semibold text-[var(--ink)]">
                          北京 · 清江浦
                        </span>
                        <span className="text-[10px] text-[var(--ink-secondary)]">
                          扬州 · 上海
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            第三屏：本地 Git 版本日志与 Plan & Goal 持续推进状态栏
           ═══════════════════════════════════════════════════════════════════ */}
        <section id="git-changelog" className="mt-16">
          <div className="rounded-[16px] border border-[var(--line-strong)] bg-[#fcfaf5] p-6 sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--line)] pb-4">
              <div>
                <div className="font-mono text-[10px] tracking-widest text-[#9b2c1f] uppercase">
                  LOCAL GIT CHANGELOG &amp; CONTINUOUS PLAN
                </div>
                <h2 className="mt-1 font-serif text-xl font-semibold text-[var(--ink)]">
                  本地 Git 演进日志与 Plan &amp; Goal 持续推进路线图
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1 font-mono text-[11px] font-semibold text-emerald-800">
                  ● branch: main (working tree tracked)
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/agent')}
                  className="rounded-full border border-[var(--ink)] bg-[var(--ink)] px-3.5 py-1 text-xs font-medium text-white hover:bg-[#9b2c1f]"
                >
                  打开智能体协同台 →
                </button>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* 左侧：Git 提交记录 */}
              <div className="space-y-3 lg:col-span-7">
                <div className="font-mono text-xs font-semibold text-[var(--ink-secondary)]">
                  最近 Git 提交记录 (CHANGELOG.md 同步记录)
                </div>
                {GIT_COMMIT_LOG.map((c) => (
                  <div
                    key={c.hash}
                    className="rounded-[8px] border border-[var(--line)] bg-white p-3.5 shadow-2xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-[#1f1b17] px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                          {c.hash}
                        </span>
                        <span className="font-mono text-[11px] font-semibold text-[#9b2c1f]">
                          {c.scope}
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-[var(--ink-muted)]">
                        {c.date}
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      {c.msg}
                    </p>
                  </div>
                ))}
              </div>

              {/* 右侧：Plan & Goal 阶段达成面板 */}
              <div className="rounded-[10px] border border-[var(--line)] bg-[#f4f1e8] p-4 lg:col-span-5">
                <div className="flex items-center justify-between">
                  <span className="font-serif text-sm font-semibold text-[var(--ink)]">
                    📋 Plan &amp; Goal 持续推进矩阵
                  </span>
                  <span className="font-mono text-[10px] text-[#9b2c1f]">
                    PLAN_AND_GOAL.md
                  </span>
                </div>
                <div className="mt-3 space-y-2.5 text-xs">
                  <div className="rounded bg-white p-2.5">
                    <div className="flex items-center justify-between font-semibold text-emerald-800">
                      <span>✓ Phase I：EAD 七级编目与双层手迹辅助校订</span>
                      <span className="font-mono text-[10px]">DONE</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">
                      支持三层分离编目、150字摘记、行句辅助框双向高亮与自动标点。
                    </p>
                  </div>

                  <div className="rounded bg-white p-2.5">
                    <div className="flex items-center justify-between font-semibold text-emerald-800">
                      <span>✓ Phase II：四子工作台考异与五维史料雷达</span>
                      <span className="font-mono text-[10px]">DONE</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">
                      独立拆分 2.1 价值甄别、2.2 考异长编、2.3 五维雷达、2.4 中国立场审定。
                    </p>
                  </div>

                  <div className="rounded bg-white p-2.5">
                    <div className="flex items-center justify-between font-semibold text-emerald-800">
                      <span>✓ Phase III：魏特夫 Box 9 &amp; Box 66 全链路实测示范</span>
                      <span className="font-mono text-[10px]">ACTIVE</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-[var(--ink-secondary)]">
                      已完成 28 页档案提取、正向校准、8 处核心证据框选、3 篇跨卷考异与 5 篇 Wiki 词条编译。
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
