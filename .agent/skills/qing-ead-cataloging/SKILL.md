---
name: qing-ead-cataloging
description: 西方馆藏汉学家未刊清史研究文献 EAD/ISAD(G) 七级编目、三层分离与三态核验技能。当需要对海外馆藏清史档案进行目录著录、层级划分、生成150字三段式内容摘记或核验目录状态时使用。
---

# 西方馆藏未刊清史文献 EAD 七级编目规范技能 (v2.1)

本技能严格遵循项目《编目规范与作业过程 v2.1》，用于指导智能体对西方馆藏（如哈佛燕京图书馆、法国国家图书馆、大英图书馆、耶鲁大学等）汉学家未刊清史手稿进行标准化编目。

## 1. 七级目录层级 (CatalogLevel)
- `collection` (全宗/馆藏集合)
- `series` (系列)
- `subseries` (子系列)
- `box` (档案盒 — 支持“仅到盒/无上位系列”标记 `isUnparentedBox`)
- `folder` (文件夹 — 核心著录单元)
- `file` (卷/册)
- `item` (单件手稿/信函)

## 2. 三层分离原则
1. **客观著录层**：原馆题名 (`titleOriginal`)、馆藏编号 (`referenceCode`)、物理容器 (`containerText`)、责任者 (`creator`)、年代 (`dateRange`)、语种 (`languages`)，严禁混入主观推测。
2. **内容摘记层**：针对 Folder 级区分三类 (`folderType`)：
   - `research_manuscript` (研究手稿/读书札记)
   - `correspondence` (往来书信)
   - `admin_clipping` (行政文书/剪报资料)
   - 必须生成 **150字以内三段式摘记 (`contentDigest`)**：【核心史事/主题】+【涉及清代制度/人物/地名】+【文献形态与批注特征】。
3. **内部工作层**：存储 OCR 状态、校订进度与研究按语。

## 3. 三态核验状态机 (VerificationStage)
- `catalog_verified` (`○ 目录已核`)：仅凭原馆 Finding Aid 完成著录。
- `sample_verified` (`● 样例已核`)：已抽样核对部分扫描页。
- `original_verified` (`★ 原件已核`)：已逐页核对原件扫描图并绑定像素坐标。
