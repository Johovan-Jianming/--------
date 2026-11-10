# 《智能体赋能西方馆藏汉学家未刊清史研究文献的整理、价值发现与知识生产研究》数智平台交接文档 (Project Handover)

> **更新时间**：2026-11-11  
> **工作目录**：`d:\Web Designer`（前端：`d:\Web Designer\frontend`，后端：`d:\Web Designer\backend`）  
> **当前状态**：已完成全栈架构、接口配置、持久化存储与页面重构，生产构建（`tsc -b && vite build`）零错误通过；工作台处于**纯净初始状态（0 预设假数据）**，可直接上传真实课题档案开展工作或继续迭代开发。

---

## 一、核心启动命令

### 1. 启动前端开发服务器（含 Vite 跨域 API 代理）
```powershell
cd "d:\Web Designer\frontend"
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```
- 浏览器访问：`http://127.0.0.1:5173/`

### 2. 启动后端服务（可选，用于 MinerU 批量任务轮询与 SQLite 存储扩展）
```powershell
cd "d:\Web Designer\backend"
pip install fastapi uvicorn httpx pydantic
python main.py
```
- 后端默认运行于：`http://127.0.0.1:8000`

---

## 二、核心目录与文件说明（File Reference）

### 1. 前端核心配置与全局状态（`d:\Web Designer\frontend`）

| 文件路径 | 功能与职责说明 |
| :--- | :--- |
| `vite.config.ts` | Vite 构建与反向代理配置：内置 `/api-tokenplan`（超算中心大模型）、`/api-paddle`（PaddleOCR-VL-1.6）、`/api-mineru`（MinerU v4）、`/api-chgis`（复旦 CHGIS 地理接口）跨域代理。 |
| `src/index.css` | 全局设计系统与样式表：采用温润宣纸（`--paper: #f6f4ef`）、内页稿纸（`--sheet: #fffefb`）、松烟墨（`--ink: #1f1b17`）与朱砂印泥（`--seal: #9b2c1f`）配色规范；定义三字体体系（`Noto Serif SC`、`IBM Plex Sans`、`JetBrains Mono`）及动态扫描线关键帧（`kh-scan-beam`）。 |
| `src/main.tsx` | 路由总入口：`/` 为独立展示门户首页；`/workbench`、`/reader`、`/proofread`、`/radar`、`/wiki`、`/atlas`、`/lab` 为内部四步研究工作台。 |
| `src/store.tsx` | **核心数据底座与持久化引擎**：<br>1. 使用 **IndexedDB (`QingArchivalLabDB_v2`)** 持久化存储已上传的 PDF / JPG / PNG / TXT 档案原件（单文件支持 20MB+，刷新不丢失）；<br>2. 使用 **localStorage (`qal_v2_*`)** 持久化存储五级馆藏目录（`catalogEntries`）、原图框选像素坐标区域（`imageRegions`）、多史料比对与长编记录（`comparisons`）、LLM Wiki 知识页（`wikiArticles`）及操作审计流水（`auditRecords`）；<br>3. 内置一键清空重置方法 `clearAllData()`、全局 API 密钥配置 `apiConfig`、**全链路上下文穿透暂存（`stagedComparisonInput`）**以及**一键载入示范实证卷宗（`loadSampleDossier()`，圣武纪案例）**。 |
| `src/components/Shell.tsx` | 内部工作台外框：左侧为「壹 编目与原图阅读 → 贰 价值发现与长编 → 叁 知识编译与空间 → 肆 审定与成果导出」古典台账导航栏；顶部操作栏集成「📚 载入示范卷宗（圣武纪案例）」与「清空工作区」切换开关，以及「接口配置」弹窗。 |

---

### 2. 前端各页面模块说明（`d:\Web Designer\frontend\src\pages`）

| 路由 | 页面文件 | 模块名称 | 核心功能说明 |
| :--- | :--- | :--- | :--- |
| `/` | `src/pages/ShowcaseHome.tsx` | **独立展示首页** | 参考 **MinerU 官网**与欧洲 **Transkribus** 范式设计的极简门户首页。包含自动循环播放的**四阶段动态工作流演示视窗（Live Workflow Cinema）**，直观演示「原图框选 `xywh` → 双层手迹 OCR → 三方长编考异 → LLM Wiki 与 CHGIS 1820 图谱」，支持暂停/切换并一键进入对应工作台。 |
| `/workbench`<br>`/library` | `src/pages/Overview.tsx` | **1.1 馆藏与资料库** | 包含三个子面板：<br>① **原馆目录层级**：建立 `收藏机构 / 集合 / 系列 / 文件夹 / 件` 五级目录，空状态提供「一键载入示范卷宗」引导；<br>② **已传档案存储库（资料库）**：管理存入 IndexedDB 的所有 PDF/JPG/文本文件，支持绑定目录、下载、删除或一键送入阅读台与 OCR；<br>③ **上传公开目录智能编目**：粘贴或上传欧美档案馆 Finding Aid / EAD / CSV 目录，调用超算大模型自动解析入库。 |
| `/reader` | `src/pages/ArchiveReader.tsx` | **1.2 档案阅读台** | **原始图像证据定位器**：支持调阅已传档案或直接上传新 PDF/JPG，支持一键载入《圣武纪》多伦诺尔会盟示范手稿。在原图上**按住鼠标左键拖动框选文字/批注区域**，自动换算原图真实像素坐标 `xywh=(x, y, w, h)`、生成原图裁剪切片（`cropDataUrl`），并一键送入 `1.3 OCR与人工校订`。 |
| `/proofread` | `src/pages/Proofread.tsx` | **1.3 OCR与人工校订** | 左侧对照展示原图或框选切片及 `xywh` 坐标；右侧支持切换调用 **PaddleOCR-VL-1.6**、**MinerU**、**超算中心 TokenPlan API** 进行识读，提供「OCR 原始结果 → 人工校订定本 → 学术翻译与注释」三栏编辑，并可审定保存版本。<br>• **1.4 地名提取**：在校订录文中划选地名文字，一键点击「📌 划选提取地名至地图」，自动调用超算大模型推测清代建置与经纬度，并自动绑定当前原图切片进入地图图谱。<br>• **2.1 穿透流转**：点击「送入多史料比对与长编 →」，自动将当前校订定本穿透带入长编工作台「西方汉学家未刊手稿」栏。 |
| `/radar` | `src/pages/Radar.tsx` | **2.1 多史料对比与长编** | 自动接收来自 1.3 步校订的未刊文献文本，支持从已校订区域载入或手动粘贴「中文清史母本」「西方汉学家未刊手稿」「已刊著作」三方文本，调用大模型生成：**史料摘要与文献价值**、**司马光体【考异】长编**、**珍稀一手文献 vs 二手文献挖掘**及**五维史料问题雷达**。<br>• **一键沉淀 Wiki**：比对结果支持一键点击「一键沉淀为 LLM Wiki 知识词条 →」，直接编译为结构化 Markdown 条目并入库。 |
| `/wiki` | `src/pages/Wiki.tsx` | **3.1 LLM Wiki 知识库** | 复刻 Karpathy LLM Wiki 知识编译范式：支持将工作区已校订的图像证据与比对记录**一键增量编译（Ingest）**为带 `[[双向链接]]` 的 Markdown 知识条目，支持基于私有知识库提问并将综述自动写回（Query & Write-back）。<br>• **时空与证据穿透联动**：词条底部自动展示关联的原图切片证据（支持一键回溯原图坐标定位）与关联清代地理点位（支持一键跳转 3D 历史地理图谱）。 |
| `/atlas` | `src/pages/Atlas.tsx` | **3.2 历史地理图谱** | 集成**国家天地图 WMTS 底图**与**复旦/哈佛官方 CHGIS V6 1820 清代历史疆域矢量数据**（`public/maps/chgis_1820_qing.geojson`，由哈佛 Dataverse 官方 Shapefile 转出）。支持**双引擎无缝切换**：<br>① **2D 经典学术图谱 (Leaflet)**：点位聚合、热力图（Leaflet.heat）、时间轴动态演化；<br>② **3D 时空流动 (MapLibre GL + deck.gl)**：支持按住右键自由倾斜与旋转视角（Pitch 0–60°）、3D 跨国文献流转抛物线（ArcLayer）、GPU 级空间热力（HeatmapLayer）与浮动注记。 |
| `/lab` | `src/pages/Lab.tsx` | **4.1 证据审定与导出** | 包含三个子面板：<br>① **证据审定台**：核查所有框选图像切片、像素坐标、校订文本并执行「通过审定 / 退回重校」；<br>② **专题论证与学术批驳**：基于已审定证据调用大模型生成图尔敏（Toulmin）结构专题考辨长文；<br>③ **操作审计轨迹与导出**：查看完整操作审计流水，支持一键导出 **JSON 数据包**与 **Markdown 研究报告**。 |

---

### 3. 静态资源与后端文件

| 文件路径 | 功能与职责说明 |
| :--- | :--- |
| `frontend/public/maps/chgis_1820_qing.geojson` | 复旦大学 CHGIS V6 1820年（嘉庆二十五年）清代十八省、驻防将军辖区及驻藏/西宁办事大臣辖区标准 GeoJSON 矢量底图数据。 |
| `frontend/public/iiif-samples/wu-box12-f1_p0001..0003.jpg` | 首页动态工作流演示视窗使用的真实未刊打字手稿与手写校改扫描件样本。 |
| `backend/main.py` | FastAPI 后端服务：提供 MinerU v4 批量上传 URL 申请与 ZIP 结果轮询解压接口（`/api/ocr/mineru`）、PaddleOCR 代理转发接口及本地 SQLite 扩展骨架。 |

---

## 三、已预置接入的外部 API 与密钥清单

所有密钥均已预置在 `frontend/src/store.tsx` 的 `apiConfig` 中（亦可在工作台右上角「接口配置」弹窗中随时修改）：

1. **超算中心 TokenPlan API（大模型编目、校勘、翻译、长编、Wiki 编译）**
   - Endpoint: `https://api.lkeap.cloud.tencent.com/plan/v3`（前端代理路径：`/api-tokenplan/chat/completions`）
   - API Key: `sk-tp-ODM5LTIxOTk1ODY0Mzk4LTE3OTI2MzQ2MzEwNzY=`
   - 默认模型: `deepseek-v3`
2. **PaddleOCR-VL-1.6（版面解析与手写体/印刷体识别）**
   - 前端代理路径：`/api-paddle/layout-parsing`
   - Token: `80d1c23d689bd9339e2cfb56b722903fd82f763a`
3. **MinerU 官方云端解析 API（PDF 与复杂文档解析）**
   - Base URL: `https://mineru.net/api/v4`
   - Token: `sk-qdW1brJL9X1kOYcWuRKhrPOPxhCwLD2tn3geHX7zWI7K1ruW`
4. **国家天地图（Tianditu WMTS 历史底图服务）**
   - Key: `47bbf45b9b9f709d7f2840b6e0c01be2`
