import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';

interface StageSpec {
  id: number;
  code: string;
  title: string;
  subtitle: string;
  engine: string;
  summary: string;
  route: string;
}

const WORKFLOW_STAGES: StageSpec[] = [
  {
    id: 0,
    code: 'STEP 01 · EAD 7-LEVEL CATALOGING',
    title: '馆藏七级编目与原件像素框选',
    subtitle: '客观著录层 · 150字三段摘记层 · 三态核验机',
    engine: 'EAD v2.1 · IndexedDB 持久化存储 · xywh 坐标锚定',
    summary:
      '支持全宗、系列、子系列、档案盒、文件夹、卷、单件七级编目，上传 PDF / JPG 扫描件并在原图上框选证据区域。',
    route: '/reader',
  },
  {
    id: 1,
    code: 'STEP 02 · ASSISTED LINE & LAYER PROOFREADING',
    title: '双层手迹剥离与行句辅助校订',
    subtitle: '打字底稿与手写旁批解耦 · 逐行辅助框对照',
    engine: 'MinerU · PaddleOCR-VL-1.6 · 超算 TokenPlan',
    summary:
      '对框选区域进行多引擎识读，通过行句辅助框实现图文逐行对照校勘、古籍标点、学术翻译与地名提取。',
    route: '/proofread',
  },
  {
    id: 2,
    code: 'STEP 03 · 5D HISTORIOGRAPHICAL RADAR',
    title: '五维史料雷达与《通鉴考异》长编',
    subtitle: '隐蔽盲区探寻 · 前沿选题假说 · 中国史学立场审定',
    engine: 'ECharts 5D Radar · 司马光考异体例 · 概念偏移纠偏',
    summary:
      '自主发掘常态阅读易忽略的底层通事、耗银账目与概念错位，输出五维雷达评分、科研课题假说与三方比对长编。',
    route: '/radar',
  },
  {
    id: 3,
    code: 'STEP 04 · LLM WIKI & CHGIS 1820 ATLAS',
    title: 'LLM Wiki 知识编译与 1820 清代图谱',
    subtitle: '双向链接知识沉淀 · 哈佛/复旦 CHGIS 府州县底图',
    engine: 'Karpathy LLM Wiki · 天地图 × CHGIS v6 · Cytoscape',
    summary:
      '将审定证据与课题假说沉淀为双向链接 Markdown 词条，并在 1820 年清代疆域底图与多模态知识图谱上联动呈现。',
    route: '/atlas',
  },
];

const AGENT_SKILLS_AND_MCP = [
  {
    kind: 'Agent Skill',
    id: 'qing-ead-cataloging',
    path: '.agent/skills/qing-ead-cataloging/SKILL.md',
    title: 'EAD 七级编目与三态核验技能',
    desc: '遵循 v2.1 编目规范，严格分离客观著录层与内容摘记层，自动生成 150 字以内三段式摘记并维护「○目录 / ●样例 / ★原件」核验状态。',
    route: '/workbench',
  },
  {
    kind: 'Agent Skill',
    id: 'historiography-radar',
    path: '.agent/skills/historiography-radar/SKILL.md',
    title: '五维史料雷达与《考异》长编技能',
    desc: '驱动智能体从制度异文、隐蔽盲区、概念置换、母本冲突、课题潜力五个维度扫描未刊手稿，按司马光体例纂修长编。',
    route: '/radar',
  },
  {
    kind: 'MCP Server',
    id: 'search_chgis_1820',
    path: 'backend/mcp_server.py :: search_chgis_1820',
    title: 'CHGIS 1820 清代历史地理考据工具',
    desc: '基于标准 Model Context Protocol 协议检索 1820 年清代府/州/厅/县矢量边界与治所坐标，支持三色置信度空间落点。',
    route: '/atlas',
  },
  {
    kind: 'MCP Server',
    id: 'audit_china_stance',
    path: 'backend/mcp_server.py :: run_historiography_radar',
    title: '中西概念置换与中国史学立场审计工具',
    desc: '识别西方汉学手稿将威斯特伐利亚主权、殖民宗藩概念强加于清代“朝贡/藩服/理藩”体制的语义偏移并生成校勘按语。',
    route: '/radar',
  },
];

export const ShowcaseHome: React.FC = () => {
  const navigate = useNavigate();
  const [activeStage, setActiveStage] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [customVideoUrl, setCustomVideoUrl] = useState<string>('');
  const videoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isPlaying || customVideoUrl) return;
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % WORKFLOW_STAGES.length);
    }, 4500);
    return () => clearInterval(timer);
  }, [isPlaying, customVideoUrl]);

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCustomVideoUrl(URL.createObjectURL(file));
  };

  const currentStage = WORKFLOW_STAGES[activeStage];

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] selection:bg-[#9b2c1f]/15">
      {/* ─── 1. 顶部书卷风导航栏 ─── */}
      <header className="sticky top-0 z-30 border-b border-[var(--line)] bg-[var(--paper)]/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5">
          <div className="flex items-center gap-3">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-[3px] font-serif text-xs font-semibold text-white"
              style={{ backgroundColor: 'var(--seal)' }}
            >
              清
            </span>
            <div>
              <span className="font-serif text-[15px] font-semibold tracking-tight text-[var(--ink)]">
                西方馆藏未刊清史文献 · 数智整理与知识生产平台
              </span>
            </div>
          </div>

          <nav className="hidden items-center gap-5 text-xs font-medium text-[var(--ink-secondary)] md:flex">
            <button
              type="button"
              onClick={() => navigate('/workbench')}
              className="hover:text-[var(--ink)]"
            >
              馆藏编目
            </button>
            <button
              type="button"
              onClick={() => navigate('/reader')}
              className="hover:text-[var(--ink)]"
            >
              原图阅读台
            </button>
            <button
              type="button"
              onClick={() => navigate('/proofread')}
              className="hover:text-[var(--ink)]"
            >
              OCR与校订
            </button>
            <button
              type="button"
              onClick={() => navigate('/radar')}
              className="hover:text-[var(--ink)]"
            >
              史料雷达
            </button>
            <button
              type="button"
              onClick={() => navigate('/atlas')}
              className="hover:text-[var(--ink)]"
            >
              1820历史图谱
            </button>
            <button
              type="button"
              onClick={() => navigate('/wiki')}
              className="hover:text-[var(--ink)]"
            >
              LLM Wiki
            </button>
          </nav>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/reader')}
              className="hidden rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] px-3 py-1.5 text-xs font-medium text-[var(--ink)] hover:border-[var(--ink)] sm:inline-flex"
            >
              上传 PDF 实测
            </button>
            <button
              type="button"
              onClick={() => navigate('/workbench')}
              className="rounded-[3px] bg-[var(--ink)] px-4 py-1.5 text-xs font-medium text-[var(--sheet)] transition hover:bg-zinc-800"
            >
              进入研究工作台 →
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pt-8 pb-20">
        {/* ─── 2. 首屏标题 + 中间主画幅展示区 (保留宣纸墨色美学，居中画幅动态演示) ─── */}
        <section>
          <div className="mx-auto max-w-3xl text-center">
            <div className="font-mono text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
              AGENT-EMPOWERED QING ARCHIVAL RESEARCH &amp; KNOWLEDGE PRODUCTION
            </div>
            <h1 className="mt-2 font-serif text-2xl font-semibold leading-snug text-[var(--ink)] sm:text-4xl">
              智能体赋能西方馆藏汉学家未刊清史文献的整理、价值发现与知识生产
            </h1>
            <p className="mt-2.5 text-sm text-[var(--ink-secondary)]">
              以原件扫描图像素坐标为锚点，贯通「EAD 七级编目 → 行句辅助校订 → 五维史料问题雷达 → LLM Wiki 与 1820 清代历史图谱」。
            </p>
          </div>

          {/* ─── 中间核心演示画幅 (Central Showcase Frame) ─── */}
          <div className="mt-7 overflow-hidden rounded-[8px] border border-[var(--line-strong)] bg-[var(--sheet)] shadow-[0_10px_36px_rgba(31,27,23,0.07)]">
            {/* 画幅顶部轻量状态条 */}
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--line)] bg-[#f3efe6] px-5 py-2.5 text-xs">
              <div className="flex items-center gap-2.5">
                <span className="inline-block h-2 w-2 rounded-full bg-[#9b2c1f]" />
                <span className="font-mono text-[11px] font-semibold text-[var(--ink)]">
                  {customVideoUrl ? 'LOCAL VIDEO PLAYBACK' : currentStage.code}
                </span>
                <span className="hidden text-[var(--ink-muted)] sm:inline">
                  | {currentStage.engine}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  ref={videoFileInputRef}
                  type="file"
                  accept="video/mp4,video/webm"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
                {customVideoUrl ? (
                  <button
                    type="button"
                    onClick={() => setCustomVideoUrl('')}
                    className="rounded-[3px] border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] text-[var(--ink)] hover:border-[var(--ink)]"
                  >
                    返回内置工作流画幅
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsPlaying((p) => !p)}
                    className="rounded-[3px] border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
                  >
                    {isPlaying ? '❚❚ 暂停轮播' : '▶ 自动轮播'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => videoFileInputRef.current?.click()}
                  className="rounded-[3px] border border-[var(--line)] bg-white px-2.5 py-1 text-[11px] text-[var(--ink-secondary)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                >
                  📁 载入演示视频 (MP4)
                </button>
                <button
                  type="button"
                  onClick={() => navigate(currentStage.route)}
                  className="rounded-[3px] bg-[#9b2c1f] px-3 py-1 text-[11px] font-medium text-white hover:bg-[#7e2217]"
                >
                  进入当前模块 →
                </button>
              </div>
            </div>

            {/* 画幅主体：若用户载入了本地 MP4 视频则直接无黑框播放；否则展示清爽的白底工作流画幅 */}
            {customVideoUrl ? (
              <div className="aspect-video w-full bg-[#faf8f4]">
                <video
                  src={customVideoUrl}
                  controls
                  autoPlay
                  loop
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="grid min-h-[420px] grid-cols-1 lg:grid-cols-12">
                {/* 左侧：原件图像与行句辅助锚定画布 (6 Cols) */}
                <div className="flex flex-col justify-between border-b border-[var(--line)] bg-[#f7f4ec] p-6 lg:col-span-6 lg:border-r lg:border-b-0">
                  <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-muted)]">
                    <span>档案样本：Harvard-Yenching Box 12, Folder 1</span>
                    <span>核验状态：★ 原件已核</span>
                  </div>

                  <div className="relative my-4 overflow-hidden rounded-[4px] border border-[var(--line-strong)] bg-white shadow-xs">
                    <img
                      src="/iiif-samples/wu-box12-f1_p0003.jpg"
                      alt="未刊清史手稿样本"
                      className="h-64 w-full object-cover object-top"
                    />
                    {/* 区域/行句辅助框示意 */}
                    <div
                      className={`absolute top-[14%] left-[7%] h-[20%] w-[85%] rounded-[2px] border-2 transition-all duration-500 ${
                        activeStage === 0 || activeStage === 1
                          ? 'border-[#1f1b17] bg-[#1f1b17]/10 shadow-xs'
                          : 'border-sky-600/50 bg-sky-500/5'
                      }`}
                    >
                      <span className="absolute -top-4 left-0 rounded bg-[#1f1b17] px-1.5 py-0.2 font-mono text-[9px] text-white">
                        #01 打字底稿区 xywh=(198,350,2030,560)
                      </span>
                    </div>

                    <div
                      className={`absolute top-[44%] left-[7%] h-[34%] w-[85%] rounded-[2px] border-2 transition-all duration-500 ${
                        activeStage >= 1
                          ? 'border-[#9b2c1f] bg-[#9b2c1f]/15 shadow-xs'
                          : 'border-amber-600/40 bg-amber-500/5'
                      }`}
                    >
                      <span className="absolute -top-4 left-0 rounded bg-[#9b2c1f] px-1.5 py-0.2 font-mono text-[9px] text-white">
                        #02 审稿人手写改写层 · 概念偏移敏感区
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[var(--ink-secondary)]">
                    <span>定位粒度：图像证据区域框选 + 行句级辅助对齐</span>
                    <span className="font-mono text-[var(--seal)]">
                      Pixel-to-Wiki Traceable
                    </span>
                  </div>
                </div>

                {/* 右侧：随四步切换的实时处理视图 (6 Cols) */}
                <div className="flex flex-col justify-between bg-white p-6 lg:col-span-6">
                  <div>
                    <div className="inline-block rounded-[2px] bg-[#9b2c1f]/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#9b2c1f]">
                      {currentStage.subtitle}
                    </div>
                    <h2 className="mt-2 font-serif text-xl font-semibold text-[var(--ink)]">
                      {currentStage.title}
                    </h2>
                    <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                      {currentStage.summary}
                    </p>

                    {/* 各阶段对应的真实数据卡片预览 */}
                    <div className="mt-5 rounded-[4px] border border-[var(--line)] bg-[#faf8f4] p-4">
                      {activeStage === 0 && (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between border-b border-[var(--line)] pb-1.5 font-mono text-[11px] text-[var(--ink-muted)]">
                            <span>EAD LEVEL: FOLDER (文件夹级)</span>
                            <span className="text-emerald-700">
                              ★ 原件已核 (original_verified)
                            </span>
                          </div>
                          <div className="font-serif font-semibold text-[var(--ink)]">
                            原馆题名：Draft chapters on Khalkha Mongolia &amp;
                            Treaty of Nerchinsk
                          </div>
                          <div className="text-[var(--ink-secondary)]">
                            <strong>150字三段摘记：</strong>
                            【核心主题】康熙二十八至三十年尼布楚界务与多伦诺尔会盟英译底稿；【涉及制度】理藩院则例、满蒙联姻与喀尔喀三汗封爵；【文献形态】含打字机初稿及红墨水行间删改批注14处。
                          </div>
                        </div>
                      )}

                      {activeStage === 1 && (
                        <div className="space-y-2.5 text-xs">
                          <div className="rounded border border-[var(--line)] bg-white p-2.5">
                            <span className="mr-2 rounded bg-[#1f1b17] px-1.5 py-0.5 font-mono text-[10px] text-white">
                              #01 底稿层
                            </span>
                            <span className="font-mono text-[var(--ink-secondary)] line-through">
                              The Khalkha Khans offered voluntary tribute...
                            </span>
                          </div>
                          <div className="rounded border border-[#9b2c1f]/40 bg-[#9b2c1f]/5 p-2.5">
                            <span className="mr-2 rounded bg-[#9b2c1f] px-1.5 py-0.5 font-mono text-[10px] text-white">
                              #02 校订层
                            </span>
                            <span className="font-serif font-medium text-[var(--ink)]">
                              手写改作：submission under Qing military protection
                              at Dolon Nor (1691)
                            </span>
                          </div>
                          <div className="text-[11px] text-[var(--ink-muted)]">
                            说明：支持区域框选与行句级双向高亮对照，辅助人工校勘、断句标点与地名坐标提取。
                          </div>
                        </div>
                      )}

                      {activeStage === 2 && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-serif font-semibold text-[#9b2c1f]">
                              🧭 史学盲区探针与选题假说自发现
                            </span>
                            <span className="font-mono text-[11px] font-bold text-[var(--ink)]">
                              五维综合潜力 95/100
                            </span>
                          </div>
                          <div className="rounded border border-[var(--line)] bg-white p-2.5">
                            <div className="font-semibold text-[var(--ink)]">
                              发现盲区：理藩院笔帖式与边疆通事的译词裁量权
                            </div>
                            <p className="mt-1 text-[var(--ink-secondary)]">
                              对比《圣武纪》母本与汉学家未刊稿，揭示西方学者将清廷“恩威并施之会盟”置换为近代殖民宗主权（Suzerainty）的概念偏移。
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStage === 3 && (
                        <div className="space-y-2 text-xs">
                          <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-muted)]">
                            <span>CHGIS V6 · 1820 历史政区叠加</span>
                            <span>WIKI: [[多伦诺尔会盟]]</span>
                          </div>
                          <div className="rounded border border-[var(--line)] bg-white p-2.5">
                            <div className="font-serif font-semibold text-[var(--ink)]">
                              空间落点：多伦诺尔厅 (42.18°N, 116.47°E) ·
                              恰克图互市圈
                            </div>
                            <p className="mt-1 text-[var(--ink-secondary)]">
                              自动关联 1820 年清代府州厅县矢量边界，生成使团行进路线、频次热力图与多模态知识图谱节点。
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 画幅底部 4 步切换器 */}
                  <div className="mt-5 grid grid-cols-4 gap-2 border-t border-[var(--line)] pt-3">
                    {WORKFLOW_STAGES.map((st, idx) => (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setActiveStage(idx);
                          setIsPlaying(false);
                        }}
                        className={`rounded-[3px] border px-2.5 py-2 text-left transition ${
                          idx === activeStage
                            ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                            : 'border-[var(--line)] bg-[#faf8f4] text-[var(--ink-secondary)] hover:border-[var(--ink)]'
                        }`}
                      >
                        <div className="font-mono text-[10px] opacity-80">
                          0{idx + 1}
                        </div>
                        <div className="mt-0.5 truncate font-serif text-xs font-semibold">
                          {st.title.slice(0, 6)}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ─── 3. 画幅下方介绍区一：四大核心研究模块详解 ─── */}
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
            <div>
              <div className="font-mono text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
                RESEARCH PIPELINE &amp; CORE MODULES
              </div>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--ink)]">
                全链路数智考据工作台架构
              </h2>
            </div>
            <span className="text-xs text-[var(--ink-secondary)]">
              从原始扫描件入库到历史地理图谱的闭环求证
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {WORKFLOW_STAGES.map((stage, i) => (
              <div
                key={stage.id}
                onClick={() => navigate(stage.route)}
                className="group flex cursor-pointer flex-col justify-between rounded-[4px] border border-[var(--line)] bg-[var(--sheet)] p-5 transition hover:border-[var(--ink)] hover:shadow-xs"
              >
                <div>
                  <div className="flex items-center justify-between font-mono text-[11px] text-[var(--ink-muted)]">
                    <span>MODULE 0{i + 1}</span>
                    <span className="text-[var(--seal)]">→</span>
                  </div>
                  <h3 className="mt-2 font-serif text-base font-semibold text-[var(--ink)] group-hover:text-[var(--seal)]">
                    {stage.title}
                  </h3>
                  <div className="mt-1 font-mono text-[11px] text-[var(--ink-muted)]">
                    {stage.subtitle}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-[var(--ink-secondary)]">
                    {stage.summary}
                  </p>
                </div>
                <div className="mt-4 border-t border-[var(--line)] pt-3 font-mono text-[11px] font-medium text-[var(--ink)]">
                  进入模块 ({stage.route})
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 4. 画幅下方介绍区二：MCP 协议与 Agent Skills 领域技能底座 ─── */}
        <section className="mt-14">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--line-strong)] pb-3">
            <div>
              <div className="font-mono text-[11px] tracking-widest text-[var(--ink-muted)] uppercase">
                MODEL CONTEXT PROTOCOL &amp; AGENT SKILLS
              </div>
              <h2 className="mt-1 font-serif text-2xl font-semibold text-[var(--ink)]">
                内置 MCP 工具服务与清史领域 Agent Skills
              </h2>
            </div>
            <span className="font-mono text-xs text-[var(--seal)]">
              已配置于 .agent/skills/ 与 backend/mcp_server.py
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            {AGENT_SKILLS_AND_MCP.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(item.route)}
                className="cursor-pointer rounded-[4px] border border-[var(--line)] bg-[var(--sheet)] p-5 transition hover:border-[var(--ink)]"
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`rounded-[2px] px-2 py-0.5 font-mono text-[10px] font-semibold ${
                      item.kind === 'Agent Skill'
                        ? 'bg-[#1f1b17] text-white'
                        : 'bg-[#9b2c1f] text-white'
                    }`}
                  >
                    {item.kind}
                  </span>
                  <span className="font-mono text-[11px] text-[var(--ink-muted)]">
                    {item.path}
                  </span>
                </div>
                <h3 className="mt-2.5 font-serif text-base font-semibold text-[var(--ink)]">
                  {item.title}
                </h3>
                <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-secondary)]">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ─── 5. 画幅下方介绍区三：文献价值发现与中国史学主体立场审定 ─── */}
        <section className="mt-14 rounded-[4px] border border-[var(--line-strong)] bg-[var(--sheet)] p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div>
              <div className="font-mono text-[11px] text-[var(--seal)] uppercase">
                PILLAR I · SOURCE CRITICISM
              </div>
              <h3 className="mt-1 font-serif text-lg font-semibold text-[var(--ink)]">
                一手珍稀手稿 vs 二手转引甄别
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                自动剥离西方汉学家未刊手稿中的原始档案摘抄、私人通信、行间删改与后期二手文献转引，避免将传教士或外交官的主观臆测误作清代实录史实。
              </p>
            </div>

            <div>
              <div className="font-mono text-[11px] text-[var(--seal)] uppercase">
                PILLAR II · CHINESE HISTORIOGRAPHICAL STANCE
              </div>
              <h3 className="mt-1 font-serif text-lg font-semibold text-[var(--ink)]">
                概念置换辨析与中国立场判断
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                针对涉清边疆、朝贡礼制、理藩院治理及涉外条约手稿，利用五维雷达自动预警威斯特伐利亚殖民宗主话语对清代“大一统”治理概念的偷换与曲解。
              </p>
            </div>

            <div>
              <div className="font-mono text-[11px] text-[var(--seal)] uppercase">
                PILLAR III · PIXEL-LEVEL PROVENANCE
              </div>
              <h3 className="mt-1 font-serif text-lg font-semibold text-[var(--ink)]">
                从原图像素坐标到知识图谱的闭环
              </h3>
              <p className="mt-2 text-xs leading-relaxed text-[var(--ink-secondary)]">
                严守“无出处不立论”的考据准则：平台产出的每一条《考异》长编、每一个 1820 地图坐标点与每一篇 Wiki 词条，均可一键回溯至原件扫描图的具体框选区域。
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};
