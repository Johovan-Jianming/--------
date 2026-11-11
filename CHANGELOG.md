# 本地 Git 更新日志 (CHANGELOG.md)

本文件持续记录《智能体赋能西方馆藏汉学家未刊清史研究文献的整理、价值发现与知识生产研究》数智平台（`d:\Web Designer`）的每一次 Git 版本提交与功能演进。

---

## [v2.7.0] - 2026-11-11 11:45 (Branch: `main`)

### 修复与升级 (Fixed & Enhanced — 1.3 OCR版芯聚焦放大、逐行锚定对齐与 3D 地图中文字符集修复)
- **升级 `1.3 OCR与人工校订` (`/proofread`) 图像视窗与版芯逐行精准对齐**（`frontend/src/pages/Proofread.tsx`, `frontend/src/store.tsx`）：
  - **扩大原件图像阅览画幅**：默认切换为 `7:5 大图优先` 布局（并支持 `6:6 对开` 与 `12:12 全宽巨幕` 一键切换），图像视窗高度由 `440px` 提升至 `760px` 高清可滚动视口。
  - **新增 `🎯 聚焦文字版芯 (ROI 放大)` 与多级缩放（100% / 130% / 165%）**：自动过滤手稿扫描件周边的案卷夹空白与桌面黑边，将打字机正文与铅笔批注放大至铺满左侧视窗，支持随时切换回 `🖼️ 全页原图视图`。
  - **修复左侧行框（`#01..#N`）与原件物理行的像素级对应关系**：
    1. 移除旧版 `object-contain` 造成的容器宽高比偏移，采用 1:1 紧贴原图像素比例的图层容器；
    2. 将所有行级色框严格锚定在当前证据区的 `normRect (x, y, w, h)` 正文版芯域内部，而非跨越整张照片；
    3. 将魏特夫 Box 66 & Box 9 全部示范证据区（如 `REG-KAW-66-01` 宣统登基与摄政王载沣铅笔校改段共 15 行物理打字行）按原件真实物理换行拆分校准，并新增 **「📏 按打字机物理行宽自动拆行」** 与 **「🔧 微调版芯对齐 (X/Y/W/H 滑块)」** 工具。
- **修复 `3.2 历史地理图谱` 3D 模式（`deck.gl` `TextLayer`）中文地名显示白框问题**（`frontend/src/components/MapLibreDeckAtlas.tsx`）：
  - 为 `TextLayer` 开启 `characterSet: 'auto'` 动态 Unicode/CJK 字形纹理集，解决 WebGL 默认仅渲染 ASCII 字符（导致中文地名只显示 `/` 与白色背景框）的问题。

---

## [v2.6.0] - 2026-11-11 06:03 (Branch: `main`)

### 新增与方法论升级 (Added — 重组历史解释形态 · 梁晨“第二路径”落地)
- **新增 `2.5 解释网络与弱实验台` (`/radar?mode=experiment`)**（`frontend/src/pages/Radar.tsx`, `frontend/src/components/Shell.tsx`）：
  - **可展开的竞争性解释网络（Competing Explanations Network）**：突破传统论著将多元史料收敛为单一线性结论的局限，针对魏特夫 Box 9 & Box 66 核心议题并置三套竞争解释版本——**解释 α（财政汲取与河工荒政官僚内卷说 · 契合账簿/奏销材料）**、**解释 β（军机独裁与乾隆—和珅宫廷奢靡说 · 契合政治叙事/晚清笔记）**、**解释 γ（征服王朝双元裂痕与八旗兵饷寄生说 · 契合比较军制/旗务档案）**。
  - **史学解释检验的“弱实验”控制台（Weak Experiment / Evidence Sensitivity Lab）**：支持研究者交互式执行**移除关键证据（如剔除《庸盦笔记》八亿两传闻）**、**注入反例（如加入一史馆《内务府查抄和珅家产清单》实核账册、Box 66 p.17 胡适《红楼梦》满汉融合内证）**、**切换材料范围（仅账簿 vs 仅官方实录 vs 仅汉学家手稿）**，系统实时展开并记录证据条件变动所引发的解释支撑度偏移（Δ）与依赖度诊断。
  - **领域认识论与 AI 介入克制调节器（Domain Epistemology & Restraint Switch）**：显式区分「财政/制度密集型领域（开启关系扩展与机制推演）」与「概念/语境/个体经验领域（克制介入，停用机械打分，退居语境并置）」。
  - **学者判断与学术责任署名（Scholarly Responsibility Anchor）**：将最终证据采信、解释分支取舍与学术责任声明交由研究者亲自签署，同步写入 `LLM Wiki` 与审计链。

---

## [v2.5.0] - 2026-11-11 05:52 (Branch: `main`)

### 新增与示范 (Added)
- **魏特夫（Karl A. Wittfogel）真实未刊清史档案 Box 9 & Box 66 全链路实证示范**：
  - 原件 PDF 与高分辨率正向扫描页入库（`frontend/public/iiif-samples/`）：
    - `wittfogel-box9-f2.pdf` 及 `wittfogel-box9-f2_p0001.jpg`–`p0007.jpg`：魏特夫主持“中国历史研究计划”编拟之《清史研究十六章分类总纲》（`FOLDER NO. (c) 9-2: CHING OUTLINE`）。
    - `wittfogel-box66-f7.pdf` 及 `wittfogel-box66-f7_p0001.jpg`–`p0018.jpg`：魏特夫未刊书稿《中国革命简史》第一章《满洲帝国的衰落》（`66.7 | KARL A. WITTFOGEL | SPEECHES AND WRITINGS | "A Short History of the Chinese Revolution," n.d.`），并针对横置扫描页完成 EXIF 正向校准。
  - 预置全链路示范数据（`frontend/src/store.tsx`）：
    - **1.1 七级编目**：建立 `CAT-KAW-COLL`（全宗）→ `CAT-KAW-SER-01`（系列）→ `CAT-KAW-BOX09` / `CAT-KAW-BOX66`（盒）→ `CAT-KAW-B09-F02` / `CAT-KAW-B66-F07`（文件夹）完整层级与 150 字三段式摘记。
    - **1.2/1.3 双层手迹解耦与行句辅助校订**：锚定 8 处核心像素坐标证据区（含 Box 66 叶三宣统登基摄政王 `Tsai-li` → 铅笔改订 `Tsai-feng`［载沣］、叶六乾隆军机处与和珅八亿两、叶十一右上角魏特夫亲笔顶批 `Criticism of T'an - K.A.W.!` 與官督商办、叶十七八旗驻防与页脚 `/ cf. Dr. Hu!` 胡适红学考证互证；Box 9 叶二满汉二元农牧与军屯、叶六 `Relief as a racket` 荒政中饱、叶七 `mêng-an, mo-k'o; banners` 猛安谋克至八旗军制）。
    - **2.1–2.4 考异长编与五维雷达**：新增 3 篇跨卷深度比对长编（`CMP-KAW-01` 至 `CMP-KAW-03`），辨析“征服王朝二元预设”与手稿自承“满汉交融”之张力，剥离晚清野史“和珅八亿两”夸大数字，发掘“清代内务府抄家财政（Confiscations）”与“荒政中饱”研究选题。
    - **3.1–3.2 LLM Wiki 与 1820 CHGIS 图谱**：新增 5 篇双向链接 Wiki 词条（`WIKI-KAW-01` 至 `WIKI-KAW-05`）及北京、清江浦（南河总督署）、扬州/江宁、上海、盛京、胡佛/华盛顿大学特藏部等时空节点。
- **书卷风 Bento 专题展示首页重构（`frontend/src/pages/ShowcaseHome.tsx`）**：
  - 学习 MinerU 首页的清晰空间布局（顶部居中胶囊导航 + 中央圆角动态画幅 + 下方双栏特性条 + Bento-Grid 专题展示卡），全面采用清代档案宣纸与朱砂墨色视觉体系（`#f6f4ef`, `#fcfaf5`, `#1f1b17`, `#9b2c1f`）。
  - 在首页底部内嵌可视化 **本地 Git 版本日志** 与 **Plan & Goal 推进面板**。
- **持续推进计划文档**：新增 `PLAN_AND_GOAL.md` 与 `CHANGELOG.md`。

---

## [v2.4.0] - 2026-11-11 05:10 (Commit `e55cb0c`)

### 新增与重构 (Added & Changed)
- **拆分“贰 · 价值发现与长编”为 4 个独立专业子工作台**（`frontend/src/pages/Radar.tsx`, `frontend/src/components/Shell.tsx`）：
  - `2.1 文献溯源与价值甄别` (`/radar?mode=value`)：三层史源剥离（清朝官方原档摘抄 / 汉学家亲历见闻与批注 / 晚清野史二手转引）。
  - `2.2 多版本对读与考异长编` (`/radar?mode=changbian`)：三栏同步对读 + 司马光《通鉴考异》体长编一键纂修。
  - `2.3 五维雷达与盲区选题` (`/radar?mode=radar`)：ECharts 五维雷达 + 隐蔽盲区探针 + 国家社科标准课题假说卡。
  - `2.4 概念流变与中国立场审定` (`/radar?mode=stance`)：中西概念对译偏移对照表 + 中国史学主体立场审定按语。
- **对标 `nashsu/llm_wiki` 客户端重构知识库工作台**（`frontend/src/pages/Wiki.tsx`）：
  - 新增 `📄 词条与证据链`（四级证据链穿透回溯 + 双向链接 `[[wikilinks]]` + 反向链接面板）。
  - 新增 `🕸️ 交互关系网 (Graph View)`（Cytoscape.js 力学图谱，按文献源、制度、综合长编、原图切片、1820 地名着色）。
  - 新增 `⚡ 两步思维链摄取 (2-Step CoT Ingest)` 与 `🩺 知识库巡检 (Wiki Lint)`。
- **新增 `4.0 智能体协同与外部 MCP 台`**（`frontend/src/pages/AgentWorkspace.tsx`）：
  - 支持 `Chat（对话检索）` 与 `Work（工单执行写入）` 双模式切换。
  - 接入 **OpenAlex 全球学术文献 API**、**Wikipedia 跨语种百科 API**、**CHGIS 1820 历史地理服务**、**CBDB 人物传记检索** 及 **Zotero (.bib) 导出**。

---

## [v2.1.0] - 2026-11-11 04:40 (Commit `1b44bfc`)

### 新增 (Added)
- **初始化本地 Git 仓库与 GitHub Actions 自动部署工作流**（`.github/workflows/deploy.yml`, `.gitignore`）。
- **行句级辅助校勘升级**（`frontend/src/pages/Proofread.tsx`）：支持行/句阅读顺序 `#01` 标号、原图与译校区双向悬停高亮、自动古籍标点、TXT/JSON 结构化导出。
- **创建清史领域 Agent Skills 与 MCP Server**：
  - `.agent/skills/qing-ead-cataloging/SKILL.md`
  - `.agent/skills/historiography-radar/SKILL.md`
  - `backend/mcp_server.py`
