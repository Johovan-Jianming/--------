# 本地 Git 更新日志 (CHANGELOG.md)

本文件持续记录《智能体赋能西方馆藏汉学家未刊清史研究文献的整理、价值发现与知识生产研究》数智平台（`d:\Web Designer`）的每一次 Git 版本提交与功能演进。

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
