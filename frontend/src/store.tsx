import React, { createContext, useContext, useState, useEffect } from 'react';

export interface ApiConfig {
  endpoint: string;
  apiKey: string;
  model: string;
  mineruToken: string;
  paddleToken: string;
  paddleModel: string;
  tiandituKey: string;
}

export type CatalogLevel =
  | 'collection'
  | 'series'
  | 'subseries'
  | 'box'
  | 'folder'
  | 'file'
  | 'item';

export type FolderType = 'general' | 'correspondence' | 'fragmentary';

export type VerificationStage =
  | 'catalog_checked'
  | 'sample_checked'
  | 'item_verified';

export const LEVEL_LABELS: Record<CatalogLevel, string> = {
  collection: '馆藏 (Collection)',
  series: '系列 (Series)',
  subseries: '子系列 (Subseries)',
  box: '盒 (Box)',
  folder: '文件夹 (Folder)',
  file: '单件 (File)',
  item: '件 (Item)',
};

export interface CatalogEntry {
  id: string;

  // ─── 第一层：原馆著录（馆方原文，照录不改） ───
  titleOriginal: string;
  titleZh?: string; // 编者中译名（并列不覆盖）
  level: CatalogLevel;
  referenceCode: string; // 馆藏号，无则 'none'
  containerText: string; // 盒夹实际载体，如 "Box 9, Folder 2"
  boxNo?: string;
  folderNo?: string;
  dateText?: string; // 馆方原文年代，无则 'n.d.'
  yearFrom?: number; // 推定起始年
  yearTo?: number; // 推定结束年
  scopeNote?: string; // 馆方原始摘要
  sourcePageNumber?: number; // 馆方目录 PDF 页码
  sourceUrl?: string; // 馆方目录源链接
  transcriptionMethod?: string; // PDF版面重建 / 文本层解析 / PaddleOCR

  // ─── 第二层：编者提要（1030 规范） ───
  folderType?: FolderType; // 普通类 / 信件类 / 零碎杂页类
  contentDigest?: string; // 150字内容简介：体量 + 清史内容 + 与已刊关系
  subjectHeading?: string; // 清史关联主题
  periodLabel?: string; // 形成时段
  placeLabel?: string; // 清代舆地
  materialType?: string; // 文献类型
  knowledgeStage?: string; // 知识生产阶段：摘录 / 抄录 / 编排 / 批注 / 成稿
  catalogingNote?: string; // 编者考订意见
  boundaryNote?: string; // 边界说明（明确未核到的部分）

  // ─── 第三层：证据与状态 ───
  verificationStage: VerificationStage; // 目录已核 / 样例已核 / 原件已核
  sourceBasis?: 'official_catalog' | 'official_and_sample' | 'item_inspection';
  displayStatus?: 'trial' | 'pending';
  parentId: string;
  createdAt: string;

  // ─── 兼容别名 ───
  title?: string;
  callNumber?: string;
  sourceNote?: string;
}

export interface StoredArchiveFile {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  catalogId: string;
  dataUrl: string;
  textContent?: string;
  pageCount: number;
  createdAt: string;
}

export interface ImageEvidenceRegion {
  id: string;
  fileId: string;
  catalogId: string;
  page: number;
  label: string;
  /** Exact pixel coordinates on the original image */
  xywh: { x: number; y: number; w: number; h: number };
  /** Normalized percentage coordinates (0-100) for responsive overlay */
  normRect: { x: number; y: number; w: number; h: number };
  cropDataUrl?: string;
  ocrText: string;
  correctedText: string;
  translation: string;
  engineUsed: string;
  status: 'draft' | 'verified' | 'rejected';
  note: string;
  createdAt: string;
}

export type PlaceConfidence = 'explicit' | 'verified' | 'inferred';

export interface MapPlace {
  id: string;
  name: string;
  alias: string;
  lat: number;
  lng: number;
  /** 清代政区归属 */
  admin: string;
  /** 坐标依据 */
  basis: string;
  confidence: PlaceConfidence;
  kind: 'place' | 'repository';
  year?: number;
  regionId: string;
  catalogId: string;
  note: string;
}

export type MapEventType = '采购' | '入藏' | '译写' | '会盟' | '通信' | '其他';

export interface MapEvent {
  id: string;
  type: MapEventType;
  fromPlaceId: string;
  toPlaceId: string;
  yearStart: number;
  yearEnd: number;
  regionId: string;
  note: string;
}

export interface ComparisonRecord {
  id: string;
  title: string;
  primaryText: string;
  manuscriptText: string;
  publishedText: string;
  summary: string;
  changbian: string;
  radarNotes: string;
  createdAt: string;
}

export interface StagedComparisonInput {
  title: string;
  primaryText?: string;
  manuscriptText: string;
  publishedText?: string;
  regionId?: string;
}

export interface WikiArticle {
  id: string;
  slug: string;
  title: string;
  category: 'source' | 'entity' | 'concept' | 'synthesis';
  content: string;
  linkedRegionIds: string[];
  updatedAt: string;
}

export interface AuditRecord {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
}

// ─── IndexedDB Helper for Persistent Large File Storage (Up to 20MB+ per file) ───
const DB_NAME = 'QingArchivalLabDB_v2';
const FILE_STORE = 'archive_files';

function openFileDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAllFiles(): Promise<StoredArchiveFile[]> {
  try {
    const db = await openFileDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readonly');
      const store = tx.objectStore(FILE_STORE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function idbPutFile(file: StoredArchiveFile): Promise<void> {
  try {
    const db = await openFileDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_STORE);
      store.put(file);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore fallback
  }
}

async function idbDeleteFile(id: string): Promise<void> {
  try {
    const db = await openFileDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_STORE);
      store.delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

async function idbClearAllFiles(): Promise<void> {
  try {
    const db = await openFileDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(FILE_STORE, 'readwrite');
      const store = tx.objectStore(FILE_STORE);
      store.clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

// ─── Wittfogel Box 9 & Box 66 + Harvard-Yenching Built-in Archival Demonstration ───
const NOW_STR = '2026-11-11 05:30:00';

export const DEFAULT_CATALOGS: CatalogEntry[] = [
  {
    id: 'CAT-KAW-COLL',
    titleOriginal: 'Karl August Wittfogel Papers (Chinese History Project Archives)',
    titleZh: '卡尔·奥古斯特·魏特夫全宗（中国历史研究计划未刊档案）',
    title: '卡尔·魏特夫全宗 (Karl A. Wittfogel Papers)',
    level: 'collection',
    referenceCode: 'KAW-COLL-CHP',
    callNumber: 'KAW-COLL-CHP',
    containerText: 'Hoover / UW Special Collections Vault',
    parentId: '',
    dateText: '1935–1965',
    yearFrom: 1935,
    yearTo: 1965,
    scopeNote:
      '西方汉学家魏特夫（Karl A. Wittfogel, 1896–1988）主持“中国历史研究计划”（Chinese History Project）期间形成的清代制度史提纲、满汉双元政体笔记、手稿及行间批注原件。',
    sourceNote: '西方馆藏魏特夫汉学档案全宗，含 Box 9 与 Box 66 实测原件扫描卷。',
    verificationStage: 'item_verified',
    sourceBasis: 'item_inspection',
    displayStatus: 'trial',
    createdAt: NOW_STR,
  },
  {
    id: 'CAT-KAW-SER-01',
    titleOriginal: 'Series I: Chinese History Project Outlines & Institutional Drafts',
    titleZh: '系列一：中国历史研究计划·清史总纲与制度史专题底稿',
    title: '系列一：中国历史研究计划·清史总纲与制度史底稿',
    level: 'series',
    referenceCode: 'KAW-SER-01',
    callNumber: 'KAW-SER-01',
    containerText: 'Series I (Boxes 1–70)',
    parentId: 'CAT-KAW-COLL',
    dateText: '1939–1957',
    yearFrom: 1939,
    yearTo: 1957,
    scopeNote:
      '涵盖辽金清征服王朝比较视野下的清代地理人口、满汉二元农业与屯田、八旗手工业、驿传通信、财政捐纳抄家、荒政仓储及满洲帝国衰落史手稿。',
    verificationStage: 'item_verified',
    createdAt: NOW_STR,
  },
  {
    id: 'CAT-KAW-BOX09',
    titleOriginal: 'Box 9: Dynastic Outlines — Ch’ing Dynasty Institutional Framework',
    titleZh: '第9盒：断代史研究提纲·清代社会经济与政治军事建制总纲',
    title: '第9盒：清代社会经济与政治军事建制总纲 (Box 9)',
    level: 'box',
    referenceCode: 'KAW-Box-09',
    callNumber: 'KAW-Box-09',
    containerText: 'Box 9',
    boxNo: '9',
    parentId: 'CAT-KAW-SER-01',
    dateText: 'c. 1941–1946',
    yearFrom: 1941,
    yearTo: 1946,
    scopeNote: '内含魏特夫主持拟定的清史十六章分类研究大纲（Ch’ing Outline）打字底稿。',
    verificationStage: 'item_verified',
    boundaryNote: 'Box 9 Folder 2 全卷 7 页高清扫描图已逐页入库核验。',
    createdAt: NOW_STR,
  },
  {
    id: 'CAT-KAW-B09-F02',
    titleOriginal: 'Folder 2: FOLDER NO. (c) 9-2 — CHING OUTLINE (Sections I–XVI & Appendices)',
    titleZh: '文件夹2：清史研究十六章分类总纲（FOLDER NO. (c) 9-2: CHING OUTLINE）',
    title: '魏特夫《清史研究十六章分类总纲》(Box 9, Folder 2)',
    level: 'folder',
    referenceCode: 'KAW-Box9-F02',
    callNumber: 'KAW-Box9-F02',
    containerText: 'Box 9, Folder 2',
    boxNo: '9',
    folderNo: '2',
    dateText: 'n.d. [c. 1942]',
    yearFrom: 1942,
    yearTo: 1945,
    folderType: 'general',
    contentDigest:
      '本夹共7页（含档案夹封面与6页打字提纲），系魏特夫团队编拟之《清史总纲》（CHING OUTLINE）。分列舆地人口、满汉二元农牧与军屯、八旗匠役、驿站、捐纳抄家、荒政中饱（Relief as a racket）、双元政体及猛安谋克至八旗军制十六章。系其未刊《清代社会史》总设计蓝图，补足已刊《辽代社会史》之后清史卷缺失。',
    subjectHeading: '满汉二元体制 · 军屯与旗地 · 驿站 · 捐纳与抄家 · 荒政仓储 · 猛安谋克与八旗',
    periodLabel: '1644–1911年（清代全史制度提纲）/ 1940年代初拟',
    placeLabel: '满洲 · 十八省本部（China Proper）· 蒙古 · 西藏 · 新疆',
    materialType: '西方馆藏未刊英文打字提纲原件（含手写下划线强调）',
    knowledgeStage: '编排与顶层框架设计（中国历史研究计划清史卷总纲）',
    catalogingNote:
      '原件第1页明确提出农业与畜牧之“double roots: Manchu and Chinese”及政权组织之“Dual root (in case of conquest)”；第5页将清代荒政列专目“7. Relief as a racket”（赈灾作为敛财骗局）；第6页手写横线强调“mêng-an, mo-k’o; banners”（金代猛安谋克至清代八旗之制度源流）。',
    boundaryNote: '全卷 7 页原件已全部扫描入库（wittfogel-box9-f2_p0001..0007.jpg）。',
    verificationStage: 'item_verified',
    sourceBasis: 'item_inspection',
    displayStatus: 'trial',
    parentId: 'CAT-KAW-BOX09',
    sourcePageNumber: 1,
    transcriptionMethod: '原件高分辨率扫描 + 行句辅助校勘',
    createdAt: NOW_STR,
  },
  {
    id: 'CAT-KAW-BOX66',
    titleOriginal: 'Box 66: Speeches and Writings — Draft Manuscripts on Late Imperial & Modern China',
    titleZh: '第66盒：演讲与著述·晚清帝国衰落与中国革命史未刊手稿',
    title: '第66盒：演讲与著述·晚清帝国衰落未刊手稿 (Box 66)',
    level: 'box',
    referenceCode: 'KAW-Box-66',
    callNumber: 'KAW-Box-66',
    containerText: 'Box 66',
    boxNo: '66',
    parentId: 'CAT-KAW-SER-01',
    dateText: 'c. 1945–1955',
    yearFrom: 1945,
    yearTo: 1955,
    scopeNote: '收录魏特夫关于清朝衰落、官僚财政腐败、洋务运动官督商办、戊戌变法与满汉关系之书稿及审稿批注。',
    verificationStage: 'item_verified',
    boundaryNote: 'Box 66 Folder 7 全卷 21 页原件已入库，重点页已提取像素坐标。',
    createdAt: NOW_STR,
  },
  {
    id: 'CAT-KAW-B66-F07',
    titleOriginal:
      'Folder 7: 66.7 | KARL A. WITTFOGEL | SPEECHES AND WRITINGS | "A Short History of the Chinese Revolution," n.d. — Chapter 1: Decline of the Manchu Empire',
    titleZh:
      '文件夹7：《中国革命简史（未刊稿）》第一章《满洲帝国的衰落》（含魏特夫铅笔密批与行间改写）',
    title: '魏特夫《满洲帝国的衰落》未刊打字修改稿 (Box 66, Folder 7)',
    level: 'folder',
    referenceCode: 'KAW-Box66-F07',
    callNumber: 'KAW-Box66-F07',
    containerText: 'Box 66, Folder 7',
    boxNo: '66',
    folderNo: '7',
    dateText: 'n.d. [c. 1948–1952]',
    yearFrom: 1948,
    yearTo: 1952,
    folderType: 'general',
    contentDigest:
      '本夹共21页，为未刊书稿《A Short History of the Chinese Revolution》第一章《Decline of the Manchu Empire》打字底稿。详述宣统登基、乾隆军机处集权与南巡耗银、和珅贪墨八亿两、河道总督治河糜费、琦善占地二百万亩、官督商办与八旗驻防，存留大量铅笔行间增删与“K.A.W.!”“cf. Dr. Hu!”等珍贵手迹。',
    subjectHeading: '乾隆朝由盛转衰 · 军机处 · 和珅案 · 南河总督 · 官督商办 · 八旗驻防 · 戊戌变法',
    periodLabel: '1736–1911年（乾隆至宣统朝）/ 1940年代末手批',
    placeLabel: '北京 · 大运河 · 江南（扬州/杭州）· 广西 · 广州 · 东京',
    materialType: '西方馆藏未刊打字书稿（双层文本：打字底稿层 + 铅笔/墨水审订旁批层）',
    knowledgeStage: '批注与审改（魏特夫及合作者行间校改、商榷谭嗣同与胡适红学考证）',
    catalogingNote:
      '第3页（原稿p.1）记1908年12月2日溥仪登基大典，将打字稿误植之摄政王“Tsai-li”以铅笔改订为“Tsai-feng”（载沣）；第6页（p.4）论乾隆十全武功、内阁权力向军机处转移及和珅抄家八亿两；第11页（p.9）页眉铅笔批注“Criticism of T’an - K.A.W.!”；第17页（p.15）页脚铅笔批注“/ cf. Dr. Hu!”（参校胡适《红楼梦考证》）。',
    boundaryNote: '全卷 21 页 PDF 及前 18 页正向高清图已入库核验。',
    verificationStage: 'item_verified',
    sourceBasis: 'item_inspection',
    displayStatus: 'trial',
    parentId: 'CAT-KAW-BOX66',
    sourcePageNumber: 1,
    transcriptionMethod: '原件高清扫描 + 双层手迹解耦识读',
    createdAt: NOW_STR,
  },
  {
    id: 'CAT-DEMO-01',
    titleOriginal: 'Harvard-Yenching Library Rare Books & Special Collections',
    titleZh: '哈佛燕京图书馆善本与特藏部',
    title: '哈佛大学燕京图书馆善本部 (Harvard-Yenching Library Rare Books)',
    level: 'collection',
    referenceCode: 'HYL-SPECIAL-COLL',
    callNumber: 'HYL-SPECIAL-COLL',
    containerText: 'Main Vault',
    parentId: '',
    scopeNote: '美国哈佛大学燕京图书馆藏清代满汉文善本档案、未刊稿抄本与海外汉学往来文书集合。',
    verificationStage: 'catalog_checked',
    createdAt: NOW_STR,
  },
  {
    id: 'CAT-DEMO-03',
    titleOriginal: 'Folder 1: Wei Yuan Sheng-wu chi Chapter 3 Manuscript Fragment (Kangxi 30th Year Assembly)',
    titleZh: '文件夹1：魏源《圣武纪》卷三《康熙亲征准噶尔记》稿本残卷（多伦诺尔会盟）',
    title: '魏源《圣武纪》康熙三十年多伦诺尔会盟稿本残卷（Box 12 Folder 1）',
    level: 'folder',
    referenceCode: 'MS-Qing-Box12-F01',
    callNumber: 'MS-Qing-Box12-F01',
    containerText: 'Box 12, Folder 1',
    boxNo: '12',
    folderNo: '1',
    folderType: 'general',
    contentDigest:
      '本文件夹共计 3 页写抄本档案材料，材料为魏源《圣武纪》卷三早期草拟残卷。重点涉及康熙三十年多伦诺尔会盟、喀尔喀三十四札萨克编旗分佐领等关键建制草案。反映晚清经世学者重构漠北疆土的知识生产过程。',
    subjectHeading: '清圣祖西征 · 多伦会盟 · 喀尔喀扎萨克编旗',
    periodLabel: '1691年（多伦会盟纪年）/ 道光初年手抄',
    placeLabel: '多伦诺尔（内蒙古察哈尔都统辖区）',
    materialType: '西方馆藏未刊汉文稿抄本（带朱墨双层手写批注）',
    knowledgeStage: '抄录与删改（对读母本《清圣祖实录》与道光刊本）',
    verificationStage: 'item_verified',
    parentId: 'CAT-DEMO-01',
    sourceBasis: 'item_inspection',
    displayStatus: 'trial',
    createdAt: NOW_STR,
  },
];

export const DEFAULT_FILES: StoredArchiveFile[] = [
  {
    id: 'FILE-KAW-B66-P03',
    name: 'wittfogel-box66-f7_p0003.jpg',
    mimeType: 'image/jpeg',
    size: 263741,
    catalogId: 'CAT-KAW-B66-F07',
    dataUrl: '/iiif-samples/wittfogel-box66-f7_p0003.jpg',
    textContent:
      'Chapter 1: Decline of the Manchu Empire. I. In the early cold morning of December 2, 1908, a remarkable imperial ceremony was held in Peking, in which Henry Pu-yi, a Manchu child of three, was enthroned [typed: ascended to the throne] as the new ruler of the Chinese empire... Standing by his side, the Prince Regent, Tsai-li [pencil revision: Tsai-feng], coaxed the crying emperor by saying repeatedly, "Don\'t cry, Your Majesty. This will end soon... this will end soon..." Within three years after the ceremony, His Majesty\'s regime "ended" with the outbreak of a revolution on October 10, 1911, the hsin-hai ke-ming.',
    pageCount: 21,
    createdAt: NOW_STR,
  },
  {
    id: 'FILE-KAW-B66-P06',
    name: 'wittfogel-box66-f7_p0006.jpg',
    mimeType: 'image/jpeg',
    size: 272953,
    catalogId: 'CAT-KAW-B66-F07',
    dataUrl: '/iiif-samples/wittfogel-box66-f7_p0006.jpg',
    textContent:
      'In the Ch\'ing dynasty, we see the symptom of dynastic decay begin during the Ch\'ien-lung period (1736 to 1795)... Successive military operations also caused the shift of governmental power from the traditional Imperial Cabinet to a military board, commonly known as the Grand Council, which was subject to closer control of the notorious monarch rather than to learned statesmen of the nation. Coupling with these conquests, the Emperor conducted six luxurious, nay, destructive and oppressive, imperial tours from Peking to the Yangtze valley along the Grand Canal... exhausted more than two hundred million taels from the national revenue... a state minister by the name of Ho-shen was reported to have robbed the public treasury eight hundred million taels of silver which was equal to the total national revenue of eleven and a half years.',
    pageCount: 21,
    createdAt: NOW_STR,
  },
  {
    id: 'FILE-KAW-B66-P11',
    name: 'wittfogel-box66-f7_p0011.jpg',
    mimeType: 'image/jpeg',
    size: 278952,
    catalogId: 'CAT-KAW-B66-F07',
    dataUrl: '/iiif-samples/wittfogel-box66-f7_p0011.jpg',
    textContent:
      '[Top Pencil Marginalia: Criticism of T\'an - K.A.W.!] IV. The multiple challenge imposed on China by Western nations formed, apart from anything traditional, another peculiar feature characterizing the downfall of the Manchu regime... "Chinese learning for fundamental principles, Western learning for practical application," a maxim, which was first formulated by a modern thinker, Feng Kuei-fen, in 1860, and later maximed by another thinker and statesman, Chang Chih-tung, in 1898... This system, known as kuan-tu shang-pan (official supervision, merchant operation), which characterized the initial phase of industrialization movement in China, lasted nearly thirty years from 1865 to 1895.',
    pageCount: 21,
    createdAt: NOW_STR,
  },
  {
    id: 'FILE-KAW-B66-P17',
    name: 'wittfogel-box66-f7_p0017.jpg',
    mimeType: 'image/jpeg',
    size: 289171,
    catalogId: 'CAT-KAW-B66-F07',
    dataUrl: '/iiif-samples/wittfogel-box66-f7_p0017.jpg',
    textContent:
      'Intermarriage between these two races were strictly forbidden. Chinese men were not allowed to participate in the national military service, unless they had been "naturalized" by their conquerors. The Manchu troops, known as the Banner Armies, were stationed as garrisons in all strategic cities throughout the nation... Men and women of the entire Manchu race were organized into a military polity known as Banners and all of them lived under government rations as soldiers... Their emperors and learned intellectuals such as the author of the famed Dream of the Red Chamber were equally respectable in the Chinese eyes. [Bottom Right Pencil Annotation: / cf. Dr. Hu!]',
    pageCount: 21,
    createdAt: NOW_STR,
  },
  {
    id: 'FILE-KAW-B09-P02',
    name: 'wittfogel-box9-f2_p0002.jpg',
    mimeType: 'image/jpeg',
    size: 1241041,
    catalogId: 'CAT-KAW-B09-F02',
    dataUrl: '/iiif-samples/wittfogel-box9-f2_p0002.jpg',
    textContent:
      'OUTLINE. I. GEOGRAPHY AND POPULATION. A. Administrative Geography: 1. Historical development (Manchuria, China Proper, conquered territories: Mongolia, Tibet, Singkiang). 2. Main divisions (provinces), including population figures. II. AGRICULTURE AND PASTORALISM. A. Agriculture: 1. Historical roots (if double roots, i.e., Manchu and Chinese, indicate both). 4. Land tenure: a. Government, b. Military settlements (conquerors), c. Communal and institutional (towns, temples, schools, clans), d. Private, e. Foreigners. B. Stockbreeding: 1. Dual root and dual development (if two national complexes, e.g. Manchu and Chinese).',
    pageCount: 7,
    createdAt: NOW_STR,
  },
  {
    id: 'FILE-KAW-B09-P06',
    name: 'wittfogel-box9-f2_p0006.jpg',
    mimeType: 'image/jpeg',
    size: 1126270,
    catalogId: 'CAT-KAW-B09-F02',
    dataUrl: '/iiif-samples/wittfogel-box9-f2_p0006.jpg',
    textContent:
      'XII. CALAMITIES AND RELIEF POLICY. A. Types of calamities (1. Floods, 2. Droughts, 3. Locusts). B. Government measures (1. Charitable, 2. Fiscal, 3. Granaries, 4. Policy toward migrants and resettlement, 5. Other forms of relief, 6. Magic devices, 7. Relief as a racket). XIII. REBELLIONS. D. Large scale revolts: 2. Predominantly national (Chin: Po-hai; Ch\'i-tan; Ch\'ing: Chinese, Mohammedans). XIV. GOVERNMENT ORGANIZATION. A. Traditions and tasks of the period\'s government: 1. Dual root (in case of conquest). 2. Specific problems inherent in conquest situation.',
    pageCount: 7,
    createdAt: NOW_STR,
  },
  {
    id: 'FILE-KAW-B09-P07',
    name: 'wittfogel-box9-f2_p0007.jpg',
    mimeType: 'image/jpeg',
    size: 1364419,
    catalogId: 'CAT-KAW-B09-F02',
    dataUrl: '/iiif-samples/wittfogel-box9-f2_p0007.jpg',
    textContent:
      'D. Special functions of government: 2. Intellectual functions (a. Astronomy, b. Historiography, c. Attitude toward learning, education: government academies, libraries). XV. ARMY, NAVY, AND WARFARE. A. The Army: 1. Historical roots. 2. Centers of conquest power (mêng-an, mo-k\'o; banners). 3. Chinese armies. 4. Frontier defense. C. Warfare: 3. Types of warfare (a. Against troops of similar type, b. Against tribal enemies, c. Against modern western troops).',
    pageCount: 7,
    createdAt: NOW_STR,
  },
  {
    id: 'FILE-DEMO-Shengwu',
    name: 'wu-box12-f1_p0003.jpg',
    mimeType: 'image/jpeg',
    size: 142850,
    catalogId: 'CAT-DEMO-03',
    dataUrl: '/iiif-samples/wu-box12-f1_p0003.jpg',
    textContent:
      '康熙三十年五月，上幸多伦诺尔，七旗喀尔喀与四十九旗内札萨克咸集，大会定界，恭行三跪九叩礼。诏定喀尔喀为三十四旗札萨克，悉依内扎萨克之例编为佐领，分设乌里雅苏台将军统领之。',
    pageCount: 3,
    createdAt: NOW_STR,
  },
];

export const DEFAULT_REGIONS: ImageEvidenceRegion[] = [
  {
    id: 'REG-KAW-66-01',
    fileId: 'FILE-KAW-B66-P03',
    catalogId: 'CAT-KAW-B66-F07',
    page: 3,
    label: 'Box66-F7 叶三 · 宣统登基大典与铅笔校改摄政王载沣（Tsai-li → Tsai-feng）',
    xywh: { x: 260, y: 310, w: 720, h: 410 },
    normRect: { x: 20.5, y: 18.2, w: 56.5, h: 24.1 },
    ocrText:
      'In the early cold morning of December 2, 1908, a remarkable imperial ceremony was held in Peking, in which Henry Pu-yi, a Manchu child of three, was ascended to the throne... standing by his side, the Prince Regent, Tsai-li, coaxed the crying emperor by saying repeatedly, "Don\'t cry, Your Majesty. This will end soon... this will end soon..."',
    correctedText:
      'In the early cold morning of December 2, 1908, a remarkable imperial ceremony was held in Peking, in which Henry Pu-yi, a Manchu child of three, was [pencil: enthroned] as the new ruler of the Chinese empire... standing by his side, the Prince Regent, [typed: Tsai-li -> pencil: Tsai-feng], coaxed the crying emperor by saying repeatedly, "Don\'t cry, Your Majesty. This will end soon... this will end soon..."',
    translation:
      '光绪三十四年十一月初九日（1908年12月2日）清早，北京紫禁城太和殿举行登基大典，三岁满洲幼主溥仪即皇帝位……侍立一旁的摄政王【打字底稿误作“载濂/载礼 Tsai-li”，审稿人铅笔校改为“载沣 Tsai-feng”】连声哄慰啼哭的幼帝：“陛下别哭，快完了，快完了……”三年后，辛亥革命爆发，清廷果真终结。',
    engineUsed: 'PaddleOCR-VL-1.6 + 双层手迹解耦',
    status: 'verified',
    note: '核心考据发现：打字初稿将醇亲王载沣（Zaifeng, Prince Chun）误植为 Tsai-li，审稿人以铅笔在行间增补 “enthroned”、“Easter”，并将 Tsai-li 校订为 Tsai-feng，体现海外汉学书稿从口述/初稿到史实核校的过程。',
    createdAt: NOW_STR,
  },
  {
    id: 'REG-KAW-66-02',
    fileId: 'FILE-KAW-B66-P06',
    catalogId: 'CAT-KAW-B66-F07',
    page: 6,
    label: 'Box66-F7 叶六 · 乾隆十全武功、内阁移权军机处与六下江南、和珅贪墨八亿两',
    xywh: { x: 210, y: 230, w: 760, h: 980 },
    normRect: { x: 16.5, y: 13.5, w: 59.6, h: 57.6 },
    ocrText:
      'Successive military operations also caused the shift of governmental power from the traditional Imperial Cabinet to a military board, commonly known as the Grand Council, which was subject to closer control of the notorious monarch rather than to learned statesmen of the nation. Coupling with these conquests, the Emperor conducted six luxurious, nay, destructive and oppressive, imperial tours from Peking to the Yangtze valley along the Grand Canal... exhausted more than two hundred million taels... a state minister by the name of Ho-shen was reported to have robbed the public treasury eight hundred million taels of silver which was equal to the total national revenue of eleven and a half years.',
    correctedText:
      'Successive military operations also caused the shift of governmental power from the traditional Imperial Cabinet [内阁] to a military board, commonly known as the Grand Council [军机处], which was subject to closer control of the notorious monarch rather than to learned statesmen of the nation. Coupling with these conquests, the Emperor conducted six luxurious, nay, destructive and oppressive, imperial tours from Peking to the Yangtze valley along the Grand Canal... exhausted more than two hundred million taels from the national revenue... a state minister by the name of Ho-shen [和珅] was reported to have robbed the public treasury eight hundred million taels of silver which was equal to the total national revenue of eleven and a half years.',
    translation:
      '接连不断的军事行动亦导致中枢政权由传统的内阁（Imperial Cabinet）转移至军机处（Grand Council），使大权更紧密地受控于专制君主而非饱学大臣。伴随十全武功，乾隆帝沿大运河自北京至长江流域举行了六次奢靡且劳民伤财的南巡，耗竭国库逾二亿两白银……大学士和珅更被曝侵吞公帑八亿两白银，相当于清廷十一年半的全国财政岁入总和，或庚子赔款总额的两倍。',
    engineUsed: 'MinerU + TokenPlan 考异校勘',
    status: 'verified',
    note: '史料批判要点：手稿准确指出了雍乾军机处取代内阁的制度转型，但直接采信了晚清民间野史“和珅家产八亿两”与“南巡耗银二亿两”的夸大数字（据《清仁宗实录》与内务府抄家档案实核，和珅本息资产约二千余万至数千万两级），属典型“西方汉学转引晚清传闻”之案例。',
    createdAt: NOW_STR,
  },
  {
    id: 'REG-KAW-66-03',
    fileId: 'FILE-KAW-B66-P11',
    catalogId: 'CAT-KAW-B66-F07',
    page: 11,
    label: 'Box66-F7 叶十一 · 魏特夫铅笔顶批“Criticism of T\'an - K.A.W.!”与中体西用、官督商办',
    xywh: { x: 180, y: 280, w: 830, h: 990 },
    normRect: { x: 14.1, y: 16.5, w: 65.1, h: 58.2 },
    ocrText:
      'Criticism of T\'an - K.A.W.! ... "Chinese learning for fundamental principles, Western learning for practical application," a maxim, which was first formulated by a modern thinker, Feng Kuei-fen, in 1860, and later maximed by another thinker and statesman, Chang Chih-tung, in 1898... This system, known as kuan-tu shang-pan (official supervision, merchant operation), which characterized the initial phase of industrialization movement in China, lasted nearly thirty years from 1865 to 1895.',
    correctedText:
      '[Top Right Pencil Annotation: Criticism of T\'an - K.A.W.!] [Left Margin Pencil: + C.T. / Jap. / 63)] ... "Chinese learning for fundamental principles, Western learning for practical application" [中学为体，西学为用], a maxim, which was first formulated by a modern thinker, Feng Kuei-fen [冯桂芬], in 1860, and later maximed by another thinker and statesman, Chang Chih-tung [张之洞], in 1898... This system, known as kuan-tu shang-pan [官督商办] (official supervision, merchant operation), which characterized the initial phase of industrialization movement in China, lasted nearly thirty years from 1865 to 1895.',
    translation:
      '【右上角魏特夫亲笔铅笔批注：补入对谭嗣同之批评——K.A.W.［Karl August Wittfogel 缩写］！】……“中学为体，西学为用”这一格言，最早由近代思想家冯桂芬于1860年（《校邠庐抗议》）提出雏形，后由思想家兼封疆大吏张之洞于1898年（《劝学篇》）定型……这一被称为“官督商办”的体制，构成了1865至1895年近三十年间中国早期工业化运动的核心特征。',
    engineUsed: 'PaddleOCR-VL-1.6 + 手写批注剥离',
    status: 'verified',
    note: '手迹物证：本页右上角留有 “Criticism of T\'an - K.A.W.!” 铅笔签名式批注，左侧栏外有关于官督商办与日本明治维新对比之铅笔速记，直接证明该稿经魏特夫本人审阅定夺。',
    createdAt: NOW_STR,
  },
  {
    id: 'REG-KAW-66-04',
    fileId: 'FILE-KAW-B66-P17',
    catalogId: 'CAT-KAW-B66-F07',
    page: 17,
    label: 'Box66-F7 叶十七 · 八旗驻防体制、“K.A.W.: Liao??”与“/ cf. Dr. Hu!”（胡适红学考证）',
    xywh: { x: 195, y: 220, w: 815, h: 1080 },
    normRect: { x: 15.3, y: 12.9, w: 63.9, h: 63.5 },
    ocrText:
      'The Manchu troops, known as the Banner Armies, were stationed as garrisons in all strategic cities throughout the nation. The arm bearers lived with their families in separate quarters not to be mixed with the local Chinese residents. Men and women of the entire Manchu race were organized into a military polity known as Banners and all of them lived under government rations as soldiers... Their emperors and learned intellectuals such as the author of the famed Dream of the Red Chamber were equally respectable in the Chinese eyes. / cf. Dr. Hu!',
    correctedText:
      '[Top Right Faint Pencil: K.A.W.: Liao??] The Manchu troops, known as the Banner Armies [八旗驻防], were stationed as garrisons in all strategic cities throughout the nation. The arm bearers lived with their families in separate quarters [满城] not to be mixed with the local Chinese residents. Men and women of the entire Manchu race were organized into a military polity known as Banners and all of them lived under government rations as soldiers... [Typed: The Manchu -> Pencil: Their] emperors and [typed: their -> deleted] learned intellectuals such as the author of the famed Dream of the Red Chamber [红楼梦] were equally respectable in the Chinese eyes. [Bottom Right Pencil: / cf. Dr. Hu!]',
    translation:
      '【右上铅笔批注：K.A.W.：参看《辽代社会史》？？】被称为“八旗军”的满洲军队作为驻防军屯驻于全国各战略要冲城市。披甲人携家眷居住于独立的“满城”（separate quarters），不得与当地汉民混居。整个满洲族群男女皆编入名为“八旗”的军事共同体，全员仰赖朝廷钱粮（兵饷）为生……其帝王与诸如名著《红楼梦》作者（曹雪芹）之类的博学文人，在汉人眼中同样受人敬重。【右下角铅笔批注：/ 参校胡适博士（Dr. Hu Shih）！】',
    engineUsed: 'PaddleOCR-VL-1.6 + 双层手迹解耦',
    status: 'verified',
    note: '跨文本互证：本页同时出现“K.A.W.: Liao??”（指向魏特夫与冯家昇《中国社会史：辽》中的斡鲁朵/部族军制）和“/ cf. Dr. Hu!”（指向胡适对曹雪芹满洲包衣身份的考证，胡适时在美与魏特夫多有学术往来）。',
    createdAt: NOW_STR,
  },
  {
    id: 'REG-KAW-09-01',
    fileId: 'FILE-KAW-B09-P02',
    catalogId: 'CAT-KAW-B09-F02',
    page: 2,
    label: 'Box9-F2 叶二 · 《清史总纲》满汉二元农牧体制与征服者军屯（Double roots: Manchu and Chinese）',
    xywh: { x: 610, y: 850, w: 1960, h: 2650 },
    normRect: { x: 19.8, y: 20.8, w: 63.8, h: 64.7 },
    ocrText:
      'I. GEOGRAPHY AND POPULATION. A. Administrative Geography: 1. Historical development (Manchuria, China Proper, conquered territories: Mongolia, Tibet, Singkiang)... II. AGRICULTURE AND PASTORALISM. A. Agriculture: 1. Historical roots (if double roots, i.e., Manchu and Chinese, indicate both)... 4. Land tenure: a. Government, b. Military settlements (conquerors), c. Communal and institutional... B. Stockbreeding: 1. Dual root and dual development (if two national complexes, e.g. Manchu and Chinese).',
    correctedText:
      'I. GEOGRAPHY AND POPULATION\nA. Administrative Geography\n  1. Historical development (Manchuria, China Proper, conquered territories: Mongolia, Tibet, Singkiang)\nII. AGRICULTURE AND PASTORALISM\nA. Agriculture\n  1. Historical roots (if double roots, i.e., Manchu and Chinese, indicate both)\n  4. Land tenure: a. Government; b. Military settlements (conquerors) [圈地与旗地军屯]; c. Communal and institutional\nB. Stockbreeding\n  1. Dual root and dual development (if two national complexes, e.g. Manchu and Chinese)',
    translation:
      '一、地理与人口：A. 政区地理：1. 历史演进（满洲、十八省本部，以及蒙古、西藏、新疆等疆域）。\n二、农业与畜牧业：A. 农业：1. 历史渊源（若具满洲与汉族双重源流，须并列指明）……4. 土地制度：a. 官田；b. 征服者之军事屯垦（圈地、旗地与驻防屯田）；c. 族田、学田与寺庙公产。\nB. 畜牧业：1. 双重根源与双元发展（满洲与汉族两个民族复合体）。',
    engineUsed: 'MinerU 版面结构化还原',
    status: 'verified',
    note: '中国史学立场审定要点：魏特夫在《清史总纲》第一章将“满洲、十八省本部”与“蒙古、西藏、新疆（conquered territories）”二元割裂，并在第二章强调“Manchu and Chinese double roots”。此为后来“征服王朝论”与“新清史”叙事的早期学术源头，需以清代“大一统”多民族国家治理框架加以辨析。',
    createdAt: NOW_STR,
  },
  {
    id: 'REG-KAW-09-02',
    fileId: 'FILE-KAW-B09-P06',
    catalogId: 'CAT-KAW-B09-F02',
    page: 6,
    label: 'Box9-F2 叶六 · 荒政“赈灾敛财骗局（Relief as a racket）”与征服政权双元组织（Dual root）',
    xywh: { x: 480, y: 420, w: 2050, h: 3180 },
    normRect: { x: 15.6, y: 10.2, w: 66.7, h: 77.6 },
    ocrText:
      'XII. CALAMITIES AND RELIEF POLICY. B. Government measures: 1. Charitable, 2. Fiscal, 3. Granaries, 4. Policy toward migrants and resettlement, 5. Other forms of relief, 6. Magic devices, 7. Relief as a racket. XIII. REBELLIONS... XIV. GOVERNMENT ORGANIZATION. A. Traditions and tasks of the period\'s government: 1. Dual root (in case of conquest). 2. Specific problems inherent in conquest situation.',
    correctedText:
      'XII. CALAMITIES AND RELIEF POLICY\nB. Government measures:\n  1. Charitable  2. Fiscal  3. Granaries [常平仓/社仓/义仓]\n  4. Policy toward migrants and resettlement [流民安插与移民实边]\n  6. Magic devices [祈雨/设坛]  7. Relief as a racket [荒政中饱与捏灾冒赈]\nXIV. GOVERNMENT ORGANIZATION\nA. Traditions and tasks of the period\'s government:\n  1. Dual root (in case of conquest) [满汉复职与二元中枢]\n  2. Specific problems inherent in conquest situation',
    translation:
      '十二、灾荒与荒政：B. 政府举措：1. 蠲免抚恤；2. 财政拨补；3. 仓储制度（常平仓、义仓、社仓）；4. 流民安插与移民垦荒政策；6. 祈禳巫术（祈雨）；7. 沦为敛财骗局的赈灾（Relief as a racket，即捏灾冒赈与河工侵吞）。\n十四、政府组织：A. 政权传统与治理任务：1. 征服情境下的双元根基（Dual root）；2. 征服局面固有的特殊治理难题。',
    engineUsed: 'MinerU 版面结构化还原',
    status: 'verified',
    note: 'Box 9 与 Box 66 跨卷互证：Box 9 提纲第 XII.B.7 条专门设立 “Relief as a racket”（荒政作为敛财勾当），在 Box 66 第 7 页（MS p.5）即化为具体叙事——清廷每年拨付数百万两治理黄河水患，河道总督却层层中饱，甚至“宰杀五十头猪只为烹制一盘烤肉宴客”。',
    createdAt: NOW_STR,
  },
  {
    id: 'REG-KAW-09-03',
    fileId: 'FILE-KAW-B09-P07',
    catalogId: 'CAT-KAW-B09-F02',
    page: 7,
    label: 'Box9-F2 叶七 · 军事核心：从女真“猛安谋克”到满洲“八旗”（mêng-an, mo-k\'o; banners）',
    xywh: { x: 520, y: 1280, w: 2020, h: 1520 },
    normRect: { x: 16.9, y: 31.2, w: 65.7, h: 37.1 },
    ocrText:
      'XV. ARMY, NAVY, AND WARFARE. A. The Army: 1. Historical roots. 2. Centers of conquest power (mêng-an, mo-k\'o; banners). 3. Chinese armies. 4. Frontier defense. 5. Weapons. 6. Provisions. 7. Changes in the military organization.',
    correctedText:
      'XV. ARMY, NAVY, AND WARFARE\nA. The Army\n  1. Historical roots\n  2. Centers of conquest power ([underlined in ink:] mêng-an, mo-k\'o; banners) [猛安谋克 → 八旗牛录]\n  3. Chinese armies [绿营与湘淮勇营]\n  4. Frontier defense [卡伦与驻防将军]',
    translation:
      '十五、陆军、海军与战事：A. 陆军：1. 历史渊源；2. 征服武力之中枢核心（【原件手写横线强调：】金代“猛安谋克”与清代“八旗”）；3. 汉人军队（绿营及晚清湘淮军）；4. 边疆防务。',
    engineUsed: 'PaddleOCR-VL-1.6 + 手写标记识别',
    status: 'verified',
    note: '原件细节：打字稿在 “mêng-an, mo-k\'o” 下方有醒目的手写黑色横线与音标符号，展示魏特夫将金代女真猛安谋克制与清代满洲八旗牛录（niru）并置贯通的比较制度史视角。',
    createdAt: NOW_STR,
  },
  {
    id: 'REG-DEMO-01',
    fileId: 'FILE-DEMO-Shengwu',
    catalogId: 'CAT-DEMO-03',
    page: 1,
    label: 'Harvard Box12-F1 叶三 · 康熙三十年多伦诺尔会盟定界',
    xywh: { x: 382, y: 520, w: 420, h: 180 },
    normRect: { x: 28.5, y: 34.2, w: 31.3, h: 11.8 },
    ocrText: '康熙三十年五月，上御多伦诺尔，内外扎萨克蒙古咸集，大会定界，行稽首礼。',
    correctedText:
      '康熙三十年五月，上幸多伦诺尔，七旗喀尔喀与四十九旗内札萨克咸集，大会定界，恭行三跪九叩礼。诏定喀尔喀为三十四旗札萨克，悉依内扎萨克之例编为佐领，分设乌里雅苏台将军统领之。',
    translation:
      'In the 5th month of Kangxi 30th year (1691), the Emperor arrived at Dolon Nor; the 7 Khalkha banners and 49 Inner Jasagh banners assembled, borders demarcated, decreed into 34 Khalkha Jasagh banners.',
    engineUsed: 'PaddleOCR-VL-1.6',
    status: 'verified',
    note: '经对照《清圣祖实录》与内阁满文原档，稿本保留了三十四旗札萨克编佐领之早期制度细节。',
    createdAt: NOW_STR,
  },
];

export const DEFAULT_COMPARISONS: ComparisonRecord[] = [
  {
    id: 'CMP-KAW-01',
    title:
      '魏特夫 Box 9《清史总纲》与 Box 66《满洲帝国的衰落》跨卷互证：从“猛安谋克—八旗”双元体制到晚清驻防瓦解',
    primaryText:
      '《清朝文献通考·兵考一》：「太祖高皇帝辛丑年（1601），始设四旗……甲寅年（1614），定三百人为一牛录（佐领），五牛录为一甲喇（参领），五甲喇为一固山（旗），每固山设都统一人，副都统二人。」又《清史稿·兵志一》：「八旗驻防，分驻畿辅及直省冲要，与绿营相维制。」',
    manuscriptText:
      '【Box 9, Folder 2, p.6 (CHING OUTLINE)】：「XIV. GOVERNMENT ORGANIZATION: A.1. Dual root (in case of conquest)... XV. ARMY, NAVY, AND WARFARE: A.2. Centers of conquest power (mêng-an, mo-k\'o; banners); A.3. Chinese armies.」\n【Box 66, Folder 7, p.17 (Decline of the Manchu Empire, MS p.15)】：「The Manchu troops, known as the Banner Armies, were stationed as garrisons in all strategic cities... Men and women of the entire Manchu race were organized into a military polity known as Banners and all of them lived under government rations as soldiers... [Top Pencil: K.A.W.: Liao??] [Bottom Pencil: / cf. Dr. Hu!]」',
    publishedText:
      'Karl A. Wittfogel & Fêng Chia-shêng, History of Chinese Society: Liao (907–1125) (1949), Introduction & General Survey; Karl A. Wittfogel, Oriental Despotism: A Comparative Study of Total Power (1957), Chap. 9.',
    summary:
      '本案打通魏特夫档案 Box 9（制度设计提纲）与 Box 66（历史叙事初稿）：Box 9 提纲以“双元根基（Dual root）”和“猛安谋克—八旗（mêng-an, mo-k\'o; banners）”确立清代征服政权分析框架；Box 66 初稿则将该框架演绎为满城隔离驻防、八旗兵饷寄生化与晚清满汉关系演变，并由魏特夫亲笔批注“K.A.W.: Liao??”与“cf. Dr. Hu!”。',
    changbian:
      '【长编正文】清朝定鼎中原，以八旗制度统合满、蒙、汉军，于京师设禁旅八旗，于直省要冲设驻防八旗（满城），并与绿营汉军相维制；中枢则设满汉复职，由内阁渐移大权于军机处。\n【考异】魏特夫未刊档案 Box 9 提纲第14、15章将清代政权与军制归结为「Dual root (in case of conquest)」及「Centers of conquest power (mêng-an, mo-k\'o; banners)」，试图将金代女真猛安谋克与清代八旗直线贯穿；至 Box 66 第17页手稿，则进一步表述为「The Manchu oppressors and the oppressed Chinese were distinctively of two different classes」，但紧接着在同一页第2段又不得不承认：「经过两百年承平，汉人已习于满洲统治，视其与明朝等本土王朝无异，甚至更加仁厚；满洲帝王与《红楼梦》作者等博学士人在汉人眼中同样可敬（pencil: / cf. Dr. Hu!）」。考其手稿内部张力，魏特夫一方面试图套用“异族征服—专制官僚”理论模型，另一方面在面对康乾盛世满汉文化融合与胡适《红楼梦考证》揭示的包衣汉军世家史实时，在同一页手稿中流露出明显的自我修正与史实妥协。',
    radarNotes:
      '1. 史料等级：★ 一手孤本手稿（含 K.A.W. 亲笔铅笔批注与跨卷提纲对应）；\n2. 隐蔽盲区：Box 66 第17页页脚“/ cf. Dr. Hu!”揭示了1940年代胡适旅美期间与魏特夫团队围绕《红楼梦》曹雪芹家族旗籍身份的直接学术互动；\n3. 中国史学立场审定：辨析魏特夫“征服王朝二元对立”预设与其手稿后半段承认“满汉文化深度交融、清同于明”之间的逻辑裂缝，有力支撑清代多民族大一统国家认同研究。',
    createdAt: NOW_STR,
  },
  {
    id: 'CMP-KAW-02',
    title:
      '乾隆朝军机处集权、南巡耗银与和珅抄家案：Box 66 手稿、Box 9 财政荒政提纲与《清实录》三方考异',
    primaryText:
      '《清仁宗实录》卷三十八嘉庆四年正月丁卯：「籍没和珅家产……查出正珠、朝珠、银两、当铺、古玩等项。」又中国第一历史档案馆藏《内务府查抄和珅家产清单》：实核查抄白银及折银约二千余万两。又《清高宗实录》载乾隆六次南巡，由户部及两淮盐政支应。',
    manuscriptText:
      '【Box 66, Folder 7, p.6–7 (Decline of the Manchu Empire, MS p.4–5)】：「Successive military operations also caused the shift of governmental power from the traditional Imperial Cabinet to a military board, commonly known as the Grand Council... the Emperor conducted six luxurious... imperial tours from Peking to the Yangtze valley along the Grand Canal... exhausted more than two hundred million taels... Ho-shen was reported to have robbed the public treasury eight hundred million taels of silver which was equal to the total national revenue of eleven and a half years... To prepare for the Emperor and his parasites a single dish of broiled pork, the Commissioner of the Yellow River... had to kill as many as fifty pigs!」\n【Box 9, Folder 2, p.4–5 (CHING OUTLINE)】：「X. FINANCIAL SYSTEM: B.3. Contributions [捐纳]; B.4. Confiscations [抄家]... XII. CALAMITIES AND RELIEF POLICY: B.7. Relief as a racket.」',
    publishedText:
      '薛福成《庸盦笔记》卷三《查抄和珅住宅花园清单》：「合计估值约八百兆两。」Karl A. Wittfogel, Oriental Despotism (1957), Chap. 3–8 (Hydraulic Bureaucracy & Fiscal Corruption).',
    summary:
      '本案揭示西方汉学名著背后的史源层级：魏特夫在 Box 9 提纲中专门设置“X.B.4. Confiscations（抄家财政）”与“XII.B.7. Relief as a racket（荒政中饱）”，并在 Box 66 手稿中以乾隆军机处集权、六下江南耗银二亿两、和珅贪墨八亿两及河道总督“杀五十口猪做一盘烤肉”作为帝国衰落的实证。',
    changbian:
      '【长编正文】乾隆一朝（1736–1795）历经十全武功与六次南巡，中枢决策由内阁全面移归军机处；晚年宠信大学士和珅，嘉庆四年（1799）正月太上皇崩逝，仁宗即赐和珅自尽并籍没其家。\n【考异】魏特夫 Box 66 手稿第6页称乾隆南巡「exhausted more than two hundred million taels」，和珅贪墨「eight hundred million taels of silver（八亿两，合十一年半岁入）」，第7页又称河道总督为备御膳一盘烤肉「had to kill as many as fifty pigs」。考诸清代内务府与户部原档，乾隆六次南巡每次支销约一百万至三百万两，合共约两千万两级，手稿“二亿两”实系十倍夸大；和珅抄家八亿两之说则源自晚清薛福成《庸盦笔记》等野史传钞，非内务府实核档册；至于“杀五十猪取背肉一盘”亦出自晚清笔记对河工厅汛宴饮之渲染。然魏特夫在 Box 9 提纲将“捐纳（Contributions）”“抄家（Confiscations）”与“荒政中饱（Relief as a racket）”提炼为清代财政与治河官僚体制的结构性病灶，其制度洞察力仍具重要学术参考价值。',
    radarNotes:
      '1. 史源剥离：成功甄别手稿中“制度史洞见（内阁→军机处、抄家财政）”与“晚清野史夸张数字（八亿两、五十头猪）”的混杂；\n2. 隐蔽盲区：Box 9 提纲 X.B.4 将“抄家（Confiscations）”列为清朝常规国家财政收入来源之一（与田赋、盐课、捐纳并列），与当代清史学界关于“内务府抄家财政”的前沿研究高度契合！',
    createdAt: NOW_STR,
  },
  {
    id: 'CMP-KAW-03',
    title:
      '1908年宣统登基大典手稿校改考：从打字误植“Tsai-li”到铅笔审订“Tsai-feng（载沣）”与政权合法性叙事',
    primaryText:
      '《清德宗实录》卷五九七光绪三十四年十月壬申：「授醇亲王载沣为摄政王。」《清宣统政纪》卷一光绪三十四年十一月辛巳（1908年12月2日）：「上即皇帝位于太和殿，摄政王载沣代受百官朝贺。」',
    manuscriptText:
      '【Box 66, Folder 7, p.3 (Decline of the Manchu Empire, MS p.1)】：「In the early cold morning of December 2, 1908, a remarkable imperial ceremony was held in Peking, in which Henry Pu-yi, a Manchu child of three, was [typed: ascended to the throne -> pencil: enthroned] as the new ruler of the Chinese empire... standing by his side, the Prince Regent, [typed: Tsai-li -> pencil: Tsai-feng], coaxed the crying emperor by saying repeatedly, "Don\'t cry, Your Majesty. This will end soon... this will end soon..."」',
    publishedText:
      'Reginald F. Johnston (庄士敦), Twilight in the Forbidden City (《紫禁城的黄昏》, 1934), Chap. 4.',
    summary:
      'Box 66 开篇第一页即展现未刊手稿双层手迹的文献学价值：打字底稿在叙述1908年12月2日溥仪太和殿登基及“快完了”谶语时，将摄政王载沣误打为“Tsai-li”，审稿人用铅笔精准校改为“Tsai-feng”，并润色多处英文修辞。',
    changbian:
      '【长编正文】光绪三十四年十一月初九日（1908年12月2日），三岁幼帝溥仪于太和殿行登基大典，监国摄政王醇亲王载沣侍立护持。\n【考异】Box 66 未刊打字底稿原作「the Prince Regent, Tsai-li」，审稿人以铅笔划去「li」改写为「feng」（即载沣 Tsai-feng），并将上文语法不通之「was ascended to the throne」删改为「was enthroned」，又将天主教弥撒比喻「religious service in a Catholic cathedral」改订为「Easter service in a Catholic cathedral」。此组双层手迹清晰还原了西方汉学论著成稿过程中合作者（Chinese History Project 华裔助手）起草英文底稿、魏特夫等审定人核校清室宗藩人名与西文修辞的协作流水线。',
    radarNotes:
      '1. 双层手迹解耦示范：打字层（华裔助手英文初稿）vs 铅笔层（审稿人史实与修辞校订）；\n2. 史源追踪：溥仪登基啼哭与载沣“快完了”一语，系转引自庄士敦《紫禁城的黄昏》（1934）及晚清民国报刊追述。',
    createdAt: NOW_STR,
  },
  {
    id: 'CMP-DEMO-01',
    title:
      '魏源《圣武纪》卷三《康熙亲征准噶尔记》与西方馆藏未刊抄本对读考异',
    primaryText:
      '《清圣祖实录》卷一五一康熙三十年五月丙戌：「上御幄殿，苏尼特等四十九旗札萨克、喀尔喀三部诸王贝勒台吉等，俱齐集跪迎。上慰谕劳苦，赐坐，大燕。」',
    manuscriptText:
      '西方馆藏未刊抄本（Box12-F01, p.3）：「康熙三十年五月，上幸多伦诺尔，七旗喀尔喀与四十九旗内札萨克咸集，大会定界，恭行三跪九叩礼。诏定喀尔喀为三十四旗札萨克，悉依内札萨克之例编佐领，分设乌里雅苏台将军统领之。」',
    publishedText:
      '道光二十二年魏源刻本《圣武纪》卷三：「五月，车驾出塞，幸多伦诺尔……会盟定界，分置佐领，自是喀尔喀三部悉隶版图。」',
    summary:
      '本案聚焦 1691 年多伦诺尔会盟的关键制度演变。未刊抄本保留了魏源初拟《圣武纪》时对满文档案与实录材料的剪裁草痕，相较于道光刊本删削了七旗喀尔喀向外札萨克转化的具体编旗细节。',
    changbian:
      '【长编正文】康熙三十年（1691）五月，康熙帝巡幸多伦诺尔，举行多伦会盟。\n【考异】母本《清圣祖实录》详载会盟礼节，未刊抄本作「七旗喀尔喀与四十九旗内札萨克咸集……诏定喀尔喀为三十四旗札萨克」，道光刊本则概括为「喀尔喀三部悉隶版图」。',
    radarNotes:
      '1. 漏译删削维度：刊本删节了关于札萨克编佐领的早期军事组织表述；\n2. 概念置换维度：满汉档案中“会盟”与西方手稿“Imperial Assembly / Fealty”之间的对译偏移。',
    createdAt: NOW_STR,
  },
];

export const DEFAULT_WIKI: WikiArticle[] = [
  {
    id: 'WIKI-KAW-01',
    title: '魏特夫《清史研究十六章总纲》（Box 9 Folder 2: CHING OUTLINE）',
    slug: 'wittfogel-box9-ching-outline',
    category: 'source',
    content: `# 魏特夫《清史研究十六章总纲》（Box 9 Folder 2: CHING OUTLINE）

> 关联原图证据：[REG-KAW-09-01] · [REG-KAW-09-02] · [REG-KAW-09-03] · 出自馆藏 [KAW-Box9-F02]
> 关联卷宗：[[满洲帝国的衰落手稿（Box 66 Folder 7）]] · [[猛安谋克与八旗驻防体制]] · [[清代抄家财政与荒政中饱]]

## 1. 档案形态与知识生产定位
本件系卡尔·魏特夫（Karl A. Wittfogel）主持“中国历史研究计划”（Chinese History Project）期间拟定的清代断代史研究总提纲，原件藏于 **Box 9, Folder 2（档案夹编号 FOLDER NO. (c) 9-2: CHING OUTLINE）**，共 7 页（含封套 1 页、打字正文 6 页）。

该提纲原计划作为《中国社会史：辽（907–1125）》之后的清史卷顶层蓝图，后因冷战学术转向未克成书，遂成研究20世纪中叶西方汉学如何建构“征服王朝（Conquest Dynasty）”理论的一手孤本档案。

## 2. 十六章结构与核心问题意识
提纲分为 16 章及 4 项附录：
- **I–II. 地理人口与二元农牧体制**：将清朝疆域划分为满洲、十八省本部与蒙藏新，并在农业与畜牧业下双双标明 \`double roots, i.e., Manchu and Chinese\`，重点突出 \`Military settlements (conquerors)\`（圈地、旗地与军屯）。
- **III–IV. 手工业与驿传通信**：关注八旗匠役（Banner artisans）与清代驿站体系（The Courier Service: Foundations & Organization）。
- **X & XII. 财政体系与荒政中饱**：在常规赋税外单列 **捐纳（Contributions）** 与 **抄家（Confiscations）**，并在第12章荒政下特设 \`7. Relief as a racket\`（沦为敛财骗局的赈灾），直接呼应 [[满洲帝国的衰落手稿（Box 66 Folder 7）]] 中对乾隆朝和珅抄家八亿两与河道总督侵吞河工经费的叙事。
- **XIV–XV. 双元政府组织与猛安谋克—八旗军制**：提出 \`Dual root (in case of conquest)\`，并在第15章以手写黑线强调 \`Centers of conquest power (mêng-an, mo-k'o; banners)\`。

## 3. 中国史学主体立场审定
提纲将满洲与汉人机械切分为两个分立的“民族复合体（two national complexes）”，并将蒙藏新定义为纯粹的武力征服领土，体现了早期“征服王朝论”的理论预设；需结合清代多民族大一统国家治理与 [[多伦诺尔会盟与喀尔喀编旗（1691）]] 等实证档案加以辩证批判。`,
    linkedRegionIds: ['REG-KAW-09-01', 'REG-KAW-09-02', 'REG-KAW-09-03'],
    updatedAt: NOW_STR,
  },
  {
    id: 'WIKI-KAW-02',
    title: '满洲帝国的衰落手稿（Box 66 Folder 7）',
    slug: 'wittfogel-box66-decline-manchu-empire',
    category: 'source',
    content: `# 满洲帝国的衰落手稿（Box 66 Folder 7）

> 关联原图证据：[REG-KAW-66-01] · [REG-KAW-66-02] · [REG-KAW-66-03] · [REG-KAW-66-04] · 出自馆藏 [KAW-Box66-F07]
> 关联词条：[[魏特夫《清史研究十六章总纲》（Box 9 Folder 2: CHING OUTLINE）]] · [[清代抄家财政与荒政中饱]] · [[官督商办与晚清工业化（1865-1895）]]

## 1. 双层手迹结构（打字底稿层 + 铅笔批注层）
本卷藏于魏特夫档案 **Box 66, Folder 7**，题为 *"A Short History of the Chinese Revolution," n.d. — Chapter 1: Decline of the Manchu Empire*，全卷 21 页。通过本平台「双层手迹剥离与行句辅助校订」模块，可清晰分离出两层历史信息：
1. **打字底稿层**：由研究计划合作者撰写的英文初稿，涵盖1908年溥仪登基、乾隆朝由盛转衰、军机处集权、和珅贪腐、琦善占地二百万亩、太平天国、洋务运动 [[官督商办与晚清工业化（1865-1895）]]、戊戌变法与满汉八旗关系。
2. **铅笔与墨水审校层**：
   - **叶三（MS p.1）**：将误植的摄政王 \`Tsai-li\` 铅笔改订为 \`Tsai-feng\`（醇亲王载沣）；
   - **叶十一（MS p.9）**：右上角魏特夫亲笔签署 \`Criticism of T'an - K.A.W.!\`，要求补入对谭嗣同《仁学》激进维新思想的分析；
   - **叶十七（MS p.15）**：页顶批注 \`K.A.W.: Liao??\`，页脚批注 \`/ cf. Dr. Hu!\`（指向胡适关于《红楼梦》曹雪芹满洲包衣身份的考证）。

## 2. 空间坐标关联
手稿涉及的核心历史地理节点已映射至 1820 CHGIS 底图：[[北京（清紫禁城）]]、[[京杭大运河与南河总督署（清江浦）]]、[[扬州（两淮盐政与南巡行宫）]]、[[广州（粤海关与十三行）]]。`,
    linkedRegionIds: ['REG-KAW-66-01', 'REG-KAW-66-02', 'REG-KAW-66-03', 'REG-KAW-66-04'],
    updatedAt: NOW_STR,
  },
  {
    id: 'WIKI-KAW-03',
    title: '猛安谋克与八旗驻防体制',
    slug: 'mengan-moko-and-eight-banners',
    category: 'concept',
    content: `# 猛安谋克与八旗驻防体制

> 关联原图证据：[REG-KAW-09-03] · [REG-KAW-66-04]
> 关联词条：[[魏特夫《清史研究十六章总纲》（Box 9 Folder 2: CHING OUTLINE）]] · [[满洲帝国的衰落手稿（Box 66 Folder 7）]]

## 1. 概念源流：从女真猛安谋克到满洲八旗牛录
在 **Box 9 Folder 2** 第 7 页（MS p.6）第 XV 章《陆军、海军与战事》中，魏特夫在 \`2. Centers of conquest power (mêng-an, mo-k'o; banners)\` 下方亲笔划出粗黑横线。他试图将12世纪金代女真的“猛安谋克”（千夫长/百夫长，平战结合的社会军事组织）与17世纪努尔哈赤创立的“八旗牛录（niru）”作为北亚森林—草原政权统治中原的连续制度原型。

## 2. 满城驻防与晚清生计危机
在 **Box 66 Folder 7** 第 17 页（MS p.15）中，手稿进一步剖析清代八旗驻防（Banner Garrisons）：
- 八旗官兵携眷驻防于全国战略都会之独立“满城（separate quarters）”；
- 全族仰赖国家财政兵饷（government rations）维生，不事农商，在承平日久与人口滋生后陷入严重的“八旗生计”危机与军事退化。`,
    linkedRegionIds: ['REG-KAW-09-03', 'REG-KAW-66-04'],
    updatedAt: NOW_STR,
  },
  {
    id: 'WIKI-KAW-04',
    title: '清代抄家财政与荒政中饱',
    slug: 'qing-confiscations-and-relief-racket',
    category: 'synthesis',
    content: `# 清代抄家财政与荒政中饱

> 关联原图证据：[REG-KAW-09-02] · [REG-KAW-66-02]
> 关联词条：[[魏特夫《清史研究十六章总纲》（Box 9 Folder 2: CHING OUTLINE）]] · [[满洲帝国的衰落手稿（Box 66 Folder 7）]] · [[京杭大运河与南河总督署（清江浦）]]

## 1. 史料雷达盲区发掘：作为制度化财政工具的“抄家（Confiscations）”
常态清史阅读往往将官员抄家视为偶发的反腐惩戒，而魏特夫在 **Box 9 Folder 2** 第 4 页 ` + '`X. FINANCIAL SYSTEM -> B. Government revenues`' + ` 中，将 **1. Taxes（赋税）、2. Tribute（贡赋）、3. Contributions（捐纳）、4. Confiscations（抄家籍没）** 并列为清廷四大财政汲取支柱。

## 2. 河工与荒政的官僚内卷（Relief as a racket）
在 **Box 9 Folder 2** 第 6 页 \`XII.B.7\` 提出 \`Relief as a racket\` 后，**Box 66 Folder 7** 第 6–7 页以乾隆朝和珅案、六次南巡及黄河河道总督（Commissioner of the Yellow River）“宰五十猪取一盘烤肉”为例，剖析治河与赈灾经费在层层衙门中的中饱私囊。通过本平台《通鉴考异》长编模块与《清实录》对读，既可剥离手稿中“和珅八亿两”的野史夸大成分，又能提炼出“内务府抄家财政与河工经费漏卮”这一极具潜力的现代清史研究课题。`,
    linkedRegionIds: ['REG-KAW-09-02', 'REG-KAW-66-02'],
    updatedAt: NOW_STR,
  },
  {
    id: 'WIKI-KAW-05',
    title: '官督商办与晚清工业化（1865-1895）',
    slug: 'kuan-tu-shang-pan-industrialization',
    category: 'concept',
    content: `# 官督商办与晚清工业化（1865-1895）

> 关联原图证据：[REG-KAW-66-03] · 出自馆藏 [KAW-Box66-F07]
> 关联词条：[[满洲帝国的衰落手稿（Box 66 Folder 7）]]

## 1. 冯桂芬、张之洞与“中体西用”
**Box 66 Folder 7** 第 11–12 页（MS p.9–10）系统检讨了1860年代至1895年甲午战败前夕的洋务新政，指出冯桂芬（1860《校邠庐抗议》）与张之洞（1898《劝学篇》）“中学为体，西学为用”构成了晚清回应西方冲击的主导思想框架。

## 2. 官督商办（Kuan-tu shang-pan）的制度困境
手稿第 11 页将江南制造局、轮船招商局、开平煤矿、电报局与棉纺厂的经营模式概括为 \`kuan-tu shang-pan (official supervision, merchant operation)\`，并在第 12 页指出清廷将现代企业变成“旧式腐败官僚体系下的新式衙门分号（merely a new branch office in the old corrupt system, commonly known as yamen）”，导致1895年《马关条约》允许外资在华设厂后，华商企业在官僚掣肘与外资竞争双重挤压下陷入困境。`,
    linkedRegionIds: ['REG-KAW-66-03'],
    updatedAt: NOW_STR,
  },
  {
    id: 'WIKI-DEMO-01',
    title: '多伦诺尔会盟与喀尔喀编旗（1691）',
    slug: 'dolon-nor-assembly-1691',
    category: 'concept',
    content: `# 多伦诺尔会盟与喀尔喀编旗（1691）

> 关联原图证据：[REG-DEMO-01] · 出自馆藏 [MS-Qing-Box12-F01]
> 空间点位：[[多伦诺尔]] (116.47, 42.18) · 清内蒙古察哈尔都统辖区

## 1. 历史事件与文献背景
康熙三十年（1691）五月，清圣祖于[[多伦诺尔]]举行多伦会盟，接纳漠北喀尔喀蒙古三部内附，定为三十四旗札萨克，悉依内札萨克例编设佐领。`,
    linkedRegionIds: ['REG-DEMO-01'],
    updatedAt: NOW_STR,
  },
];

export const DEFAULT_PLACES: MapPlace[] = [
  {
    id: 'PLC-KAW-01',
    name: '北京（清紫禁城/顺天府）',
    alias: 'Peking / Imperial Cabinet & Grand Council',
    lat: 39.9163,
    lng: 116.3972,
    admin: '直隶顺天府大兴县/宛平县（京师中枢）',
    basis: 'CHGIS 1820 京师坐标；Box 66 p.3 宣统太和殿登基与 p.6 军机处、和珅案发地',
    confidence: 'explicit',
    kind: 'place',
    year: 1908,
    regionId: 'REG-KAW-66-01',
    catalogId: 'CAT-KAW-B66-F07',
    note: '魏特夫 Box 66 手稿核心中枢：乾隆军机处取代内阁、嘉庆四年查抄和珅府第、1908年溥仪登基大典所在地。',
  },
  {
    id: 'PLC-KAW-02',
    name: '京杭大运河与南河总督署（清江浦）',
    alias: 'Grand Canal & Yellow River Conservancy (Huai’an)',
    lat: 33.588,
    lng: 119.032,
    admin: '江苏省淮安府山阳县清江浦（江南河道总督驻地）',
    basis: 'CHGIS 1820 淮安府治点位；Box 66 p.6–7 乾隆大运河南巡与河道总督治河经费糜费案',
    confidence: 'verified',
    kind: 'place',
    year: 1780,
    regionId: 'REG-KAW-66-02',
    catalogId: 'CAT-KAW-B66-F07',
    note: 'Box 9 提纲“XII.B.7 荒政与治河中饱”与 Box 66 第7页“河道总督杀五十口猪备办一盘烤肉”对应之黄淮运交汇枢纽。',
  },
  {
    id: 'PLC-KAW-03',
    name: '扬州/江宁（乾隆六下江南驻跸核心）',
    alias: 'Yangtze Valley / Yangzhou & Nanking',
    lat: 32.3942,
    lng: 119.4129,
    admin: '江苏省扬州府江都县 / 江宁府（两江总督与江宁织造驻地）',
    basis: 'CHGIS 1820 扬州府/江宁府坐标；Box 66 p.6 乾隆南巡及 p.17 曹雪芹《红楼梦》背景地',
    confidence: 'explicit',
    kind: 'place',
    year: 1784,
    regionId: 'REG-KAW-66-02',
    catalogId: 'CAT-KAW-B66-F07',
    note: '乾隆六次沿大运河南巡至长江流域核心都会，亦为 Box 66 p.17 所引胡适考证《红楼梦》曹氏家族所居之地。',
  },
  {
    id: 'PLC-KAW-04',
    name: '上海/汉口（晚清官督商办工业基地）',
    alias: 'Shanghai / Hankow (Kuan-tu shang-pan)',
    lat: 31.2304,
    lng: 121.4737,
    admin: '江苏省松江府上海县（江南制造局、轮船招商局驻地）',
    basis: 'CHGIS 1820 上海县治；Box 66 p.11–12 冯桂芬、张之洞与 1865–1895 官督商办企业群',
    confidence: 'explicit',
    kind: 'place',
    year: 1872,
    regionId: 'REG-KAW-66-03',
    catalogId: 'CAT-KAW-B66-F07',
    note: 'Box 66 第11页详述 1865–1895 年间清廷于沿海与内陆通商口岸设立船政、机器局、轮船招商局与纱厂之核心枢纽。',
  },
  {
    id: 'PLC-KAW-05',
    name: '盛京（奉天府/满洲八旗龙兴之地）',
    alias: 'Manchuria / Mukden (Shengjing)',
    lat: 41.7968,
    lng: 123.4514,
    admin: '盛京将军辖区奉天府承德县',
    basis: 'CHGIS 1820 盛京坐标；Box 9 p.2 & p.7 满汉双元农业与猛安谋克—八旗起源地',
    confidence: 'explicit',
    kind: 'place',
    year: 1644,
    regionId: 'REG-KAW-09-03',
    catalogId: 'CAT-KAW-B09-F02',
    note: '魏特夫 Box 9《清史总纲》第 I、II、XV 章所述满洲八旗（Banners）与满汉二元体制之历史策源地。',
  },
  {
    id: 'PLC-DEMO-01',
    name: '多伦诺尔',
    alias: 'Dolon Nor / 诺尔会盟地',
    lat: 42.18,
    lng: 116.47,
    admin: '内蒙古察哈尔都统辖区 / 直隶省口北三厅多伦诺尔厅',
    basis: 'CHGIS 1820 县治点位比定，清代官修实录与会盟手稿直载',
    confidence: 'explicit',
    kind: 'place',
    year: 1691,
    regionId: 'REG-DEMO-01',
    catalogId: 'CAT-DEMO-03',
    note: '1691年康熙多伦会盟所在地，外札萨克三十四旗编佐领立界处。',
  },
  {
    id: 'PLC-KAW-REPO',
    name: '胡佛研究所与华盛顿大学特藏部（魏特夫档案藏所）',
    alias: 'Hoover Institution / UW Archives (Wittfogel Papers)',
    lat: 37.4275,
    lng: -122.1663,
    admin: '美国加利福尼亚州斯坦福 / 华盛顿州西雅图',
    basis: 'Karl A. Wittfogel Papers 现代馆藏地（Box 9 & Box 66 原件保藏处）',
    confidence: 'explicit',
    kind: 'repository',
    year: 1949,
    regionId: 'REG-KAW-66-03',
    catalogId: 'CAT-KAW-COLL',
    note: '魏特夫主持“中国历史研究计划”形成的清史提纲（Box 9）与手稿（Box 66）海外馆藏机构。',
  },
];

export const DEFAULT_EVENTS: MapEvent[] = [
  {
    id: 'EVT-KAW-01',
    type: '其他',
    fromPlaceId: 'PLC-KAW-05',
    toPlaceId: 'PLC-KAW-01',
    yearStart: 1644,
    yearEnd: 1735,
    regionId: 'REG-KAW-09-03',
    note: '八旗军制自满洲入主中原，于京师设禁旅八旗、于全国要冲设驻防满城（Box 9 p.7 & Box 66 p.17）。',
  },
  {
    id: 'EVT-KAW-02',
    type: '其他',
    fromPlaceId: 'PLC-KAW-01',
    toPlaceId: 'PLC-KAW-03',
    yearStart: 1751,
    yearEnd: 1784,
    regionId: 'REG-KAW-66-02',
    note: '乾隆帝自北京沿京杭大运河六下江南，途经清江浦南河总督署至扬州、江宁（Box 66 p.6–7）。',
  },
  {
    id: 'EVT-KAW-03',
    type: '其他',
    fromPlaceId: 'PLC-KAW-01',
    toPlaceId: 'PLC-KAW-04',
    yearStart: 1865,
    yearEnd: 1895,
    regionId: 'REG-KAW-66-03',
    note: '洋务运动时期推行“官督商办（kuan-tu shang-pan）”，于上海、汉口等口岸兴办近代军工与民用企业（Box 66 p.11）。',
  },
  {
    id: 'EVT-KAW-04',
    type: '译写',
    fromPlaceId: 'PLC-KAW-01',
    toPlaceId: 'PLC-KAW-REPO',
    yearStart: 1939,
    yearEnd: 1952,
    regionId: 'REG-KAW-66-04',
    note: '魏特夫团队整理清代制度史料，编撰 Box 9《清史总纲》与 Box 66《满洲帝国的衰落》手稿并与旅美学者胡适等切磋批注。',
  },
  {
    id: 'EVT-DEMO-01',
    type: '会盟',
    fromPlaceId: 'PLC-KAW-01',
    toPlaceId: 'PLC-DEMO-01',
    yearStart: 1691,
    yearEnd: 1691,
    regionId: 'REG-DEMO-01',
    note: '康熙帝自京师启銮出塞，于多伦诺尔举行多伦会盟，喀尔喀蒙古三十四旗编设佐领。',
  },
];

export const DEFAULT_AUDITS: AuditRecord[] = [
  {
    id: 'AUD-KAW-01',
    timestamp: NOW_STR,
    actor: 'joho chen · 智能体全链路示范',
    action: '入库魏特夫 Box 9 与 Box 66 真实档案',
    target: 'KAW-Box9-F02 (CHING OUTLINE) & KAW-Box66-F07 (Decline of the Manchu Empire)',
    detail:
      '完成 2 份真实 PDF 档案（7页+21页）高清页面提取、自动正向校准、EAD 七级编目、双层铅笔手迹解耦、五维史料雷达与 CHGIS 1820 空间落点示范。',
  },
  {
    id: 'AUD-KAW-02',
    timestamp: NOW_STR,
    actor: 'joho chen · 行句辅助校勘',
    action: '审定 Box 66 铅笔批注证据',
    target: 'REG-KAW-66-01 / 03 / 04',
    detail:
      '锁定叶三摄政王“Tsai-li → Tsai-feng（载沣）”改订、叶十一“Criticism of T\'an - K.A.W.!”顶批及叶十七“/ cf. Dr. Hu!”（胡适《红楼梦考证》）互证坐标。',
  },
];

const LS_KEYS = {
  catalog: 'qal_v4_catalog',
  regions: 'qal_v4_regions',
  comparisons: 'qal_v4_comparisons',
  wiki: 'qal_v4_wiki',
  audits: 'qal_v4_audits',
  places: 'qal_v4_places',
  events: 'qal_v4_events',
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as T;
    if (Array.isArray(parsed) && parsed.length === 0) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

interface WorkbenchContextType {
  catalogEntries: CatalogEntry[];
  addCatalogEntry: (entry: Omit<CatalogEntry, 'id' | 'createdAt'>) => CatalogEntry;
  updateCatalogEntry: (id: string, patch: Partial<CatalogEntry>) => void;
  deleteCatalogEntry: (id: string) => void;

  uploadedFiles: StoredArchiveFile[];
  activeFileId: string;
  setActiveFileId: (id: string) => void;
  uploadArchiveFile: (
    file: File,
    catalogId?: string
  ) => Promise<StoredArchiveFile>;
  deleteArchiveFile: (id: string) => Promise<void>;
  updateArchiveFileCatalog: (fileId: string, catalogId: string) => Promise<void>;

  imageRegions: ImageEvidenceRegion[];
  activeRegionId: string;
  setActiveRegionId: (id: string) => void;
  addImageRegion: (
    region: Omit<ImageEvidenceRegion, 'id' | 'createdAt'>
  ) => ImageEvidenceRegion;
  updateImageRegion: (id: string, patch: Partial<ImageEvidenceRegion>) => void;
  deleteImageRegion: (id: string) => void;

  comparisons: ComparisonRecord[];
  addComparison: (
    rec: Omit<ComparisonRecord, 'id' | 'createdAt'>
  ) => ComparisonRecord;
  deleteComparison: (id: string) => void;

  wikiArticles: WikiArticle[];
  upsertWikiArticle: (
    article: Omit<WikiArticle, 'id' | 'updatedAt'> & { id?: string }
  ) => WikiArticle;
  deleteWikiArticle: (id: string) => void;

  mapPlaces: MapPlace[];
  addMapPlace: (p: Omit<MapPlace, 'id'>) => MapPlace;
  deleteMapPlace: (id: string) => void;
  mapEvents: MapEvent[];
  addMapEvent: (e: Omit<MapEvent, 'id'>) => MapEvent;
  deleteMapEvent: (id: string) => void;

  auditRecords: AuditRecord[];
  appendAudit: (action: string, target: string, detail: string) => void;
  clearAllData: () => Promise<void>;

  stagedComparisonInput: StagedComparisonInput | null;
  setStagedComparisonInput: (input: StagedComparisonInput | null) => void;
  loadSampleDossier: () => Promise<void>;

  apiConfig: ApiConfig;
  setApiConfig: (cfg: ApiConfig) => void;
}

const WorkbenchContext = createContext<WorkbenchContextType | null>(null);

export const WorkbenchProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>(() =>
    loadJson<CatalogEntry[]>(LS_KEYS.catalog, DEFAULT_CATALOGS)
  );
  const [uploadedFiles, setUploadedFiles] =
    useState<StoredArchiveFile[]>(DEFAULT_FILES);
  const [activeFileId, setActiveFileId] = useState<string>(
    DEFAULT_FILES[0]?.id || ''
  );

  const [imageRegions, setImageRegions] = useState<ImageEvidenceRegion[]>(() =>
    loadJson<ImageEvidenceRegion[]>(LS_KEYS.regions, DEFAULT_REGIONS)
  );
  const [activeRegionId, setActiveRegionId] = useState<string>(
    DEFAULT_REGIONS[0]?.id || ''
  );

  const [comparisons, setComparisons] = useState<ComparisonRecord[]>(() =>
    loadJson<ComparisonRecord[]>(LS_KEYS.comparisons, DEFAULT_COMPARISONS)
  );
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>(() =>
    loadJson<WikiArticle[]>(LS_KEYS.wiki, DEFAULT_WIKI)
  );
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>(() =>
    loadJson<AuditRecord[]>(LS_KEYS.audits, DEFAULT_AUDITS)
  );

  const [mapPlaces, setMapPlaces] = useState<MapPlace[]>(() =>
    loadJson<MapPlace[]>(LS_KEYS.places, DEFAULT_PLACES)
  );
  const [mapEvents, setMapEvents] = useState<MapEvent[]>(() =>
    loadJson<MapEvent[]>(LS_KEYS.events, DEFAULT_EVENTS)
  );

  const [stagedComparisonInput, setStagedComparisonInput] =
    useState<StagedComparisonInput | null>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.places, JSON.stringify(mapPlaces));
  }, [mapPlaces]);
  useEffect(() => {
    localStorage.setItem(LS_KEYS.events, JSON.stringify(mapEvents));
  }, [mapEvents]);

  const [apiConfig, setApiConfig] = useState<ApiConfig>({
    endpoint: 'https://api.lkeap.cloud.tencent.com/plan/v3',
    apiKey: 'sk-tp-ODM5LTIxOTk1ODY0Mzk4LTE3OTI2MzQ2MzEwNzY=',
    model: 'deepseek-v3',
    mineruToken: 'sk-qdW1brJL9X1kOYcWuRKhrPOPxhCwLD2tn3geHX7zWI7K1ruW',
    paddleToken: '80d1c23d689bd9339e2cfb56b722903fd82f763a',
    paddleModel: 'PaddleOCR-VL-1.6',
    tiandituKey: '47bbf45b9b9f709d7f2840b6e0c01be2',
  });

  // Load persisted files from IndexedDB on mount and merge with built-in Wittfogel files
  useEffect(() => {
    idbGetAllFiles().then(async (files) => {
      const existingIds = new Set(files.map((f) => f.id));
      const merged = [...files];
      for (const df of DEFAULT_FILES) {
        if (!existingIds.has(df.id)) {
          await idbPutFile(df);
          merged.push(df);
        }
      }
      setUploadedFiles(merged);
      if (merged.length > 0) {
        setActiveFileId((prev) => prev || merged[0].id);
      }
    });
  }, []);

  // Sync metadata to localStorage
  useEffect(() => {
    localStorage.setItem(LS_KEYS.catalog, JSON.stringify(catalogEntries));
  }, [catalogEntries]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.regions, JSON.stringify(imageRegions));
  }, [imageRegions]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.comparisons, JSON.stringify(comparisons));
  }, [comparisons]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.wiki, JSON.stringify(wikiArticles));
  }, [wikiArticles]);

  useEffect(() => {
    localStorage.setItem(LS_KEYS.audits, JSON.stringify(auditRecords));
  }, [auditRecords]);

  const appendAudit = (action: string, target: string, detail: string) => {
    const rec: AuditRecord = {
      id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
      actor: 'joho chen',
      action,
      target,
      detail,
    };
    setAuditRecords((prev) => [rec, ...prev]);
  };

  const addCatalogEntry = (
    entry: Omit<CatalogEntry, 'id' | 'createdAt'>
  ): CatalogEntry => {
    const tOriginal = entry.titleOriginal || entry.title || '未命名著录';
    const refCode = entry.referenceCode || entry.callNumber || 'none';
    const newEntry: CatalogEntry = {
      ...entry,
      titleOriginal: tOriginal,
      title: entry.title || tOriginal,
      referenceCode: refCode,
      callNumber: entry.callNumber || refCode,
      containerText: entry.containerText || '',
      verificationStage: entry.verificationStage || 'catalog_checked',
      id: `CAT-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    setCatalogEntries((prev) => [newEntry, ...prev]);
    appendAudit(
      '新建馆藏条目',
      `${newEntry.titleOriginal} (${newEntry.referenceCode})`,
      `建立原馆目录层级 [${LEVEL_LABELS[newEntry.level] || newEntry.level}] · 核验阶段: ${newEntry.verificationStage}`
    );
    return newEntry;
  };

  const updateCatalogEntry = (id: string, patch: Partial<CatalogEntry>) => {
    setCatalogEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
    appendAudit('更新馆藏目录', id, '修订馆藏目录元数据');
  };

  const deleteCatalogEntry = (id: string) => {
    const target = catalogEntries.find((c) => c.id === id);
    setCatalogEntries((prev) => prev.filter((item) => item.id !== id));
    if (target) {
      appendAudit(
        '删除馆藏条目',
        target.titleOriginal || target.title || id,
        `移除档号 ${target.referenceCode || target.callNumber || 'none'}`
      );
    }
  };

  const uploadArchiveFile = async (
    file: File,
    catalogId = ''
  ): Promise<StoredArchiveFile> => {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    let textContent: string | undefined;
    if (
      file.type.startsWith('text/') ||
      /\.(txt|md|csv|json|xml)$/i.test(file.name)
    ) {
      textContent = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.onerror = () => resolve('');
        r.readAsText(file);
      });
    }

    const stored: StoredArchiveFile = {
      id: `FILE-${Date.now().toString().slice(-6)}`,
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
      catalogId,
      dataUrl,
      textContent,
      pageCount: 1,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };

    await idbPutFile(stored);
    setUploadedFiles((prev) => [stored, ...prev]);
    setActiveFileId(stored.id);
    appendAudit(
      '上传档案原件',
      stored.name,
      `存入持久化文件存储 (${(stored.size / 1024).toFixed(1)} KB)`
    );
    return stored;
  };

  const updateArchiveFileCatalog = async (
    fileId: string,
    catalogId: string
  ) => {
    const target = uploadedFiles.find((f) => f.id === fileId);
    if (!target) return;
    const updated = { ...target, catalogId };
    await idbPutFile(updated);
    setUploadedFiles((prev) =>
      prev.map((f) => (f.id === fileId ? updated : f))
    );
    appendAudit('关联馆藏目录', target.name, `绑定至目录条目 ${catalogId || '未分类'}`);
  };

  const deleteArchiveFile = async (id: string) => {
    const target = uploadedFiles.find((f) => f.id === id);
    await idbDeleteFile(id);
    setUploadedFiles((prev) => {
      const rest = prev.filter((f) => f.id !== id);
      if (activeFileId === id) {
        setActiveFileId(rest[0]?.id || '');
      }
      return rest;
    });
    setImageRegions((prev) => prev.filter((r) => r.fileId !== id));
    if (target) {
      appendAudit('删除档案文件', target.name, '从持久化存储库移除文件及关联图像区域');
    }
  };

  const addImageRegion = (
    region: Omit<ImageEvidenceRegion, 'id' | 'createdAt'>
  ): ImageEvidenceRegion => {
    const created: ImageEvidenceRegion = {
      ...region,
      id: `REG-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    setImageRegions((prev) => [created, ...prev]);
    setActiveRegionId(created.id);
    appendAudit(
      '框选图像证据区域',
      created.label,
      `像素坐标 xywh=(${created.xywh.x}, ${created.xywh.y}, ${created.xywh.w}, ${created.xywh.h})`
    );
    return created;
  };

  const updateImageRegion = (
    id: string,
    patch: Partial<ImageEvidenceRegion>
  ) => {
    setImageRegions((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...patch } : r))
    );
    const target = imageRegions.find((r) => r.id === id);
    if (target) {
      if (patch.status === 'verified') {
        appendAudit(
          '审定图像证据',
          target.label,
          `人工校订通过，锁定坐标 xywh=(${target.xywh.x},${target.xywh.y},${target.xywh.w},${target.xywh.h})`
        );
      } else if (patch.correctedText !== undefined) {
        appendAudit('修订OCR校订文本', target.label, '保存新文本版本');
      }
    }
  };

  const deleteImageRegion = (id: string) => {
    const target = imageRegions.find((r) => r.id === id);
    setImageRegions((prev) => prev.filter((r) => r.id !== id));
    if (activeRegionId === id) setActiveRegionId('');
    if (target) {
      appendAudit('删除图像证据区域', target.label, '移除框选坐标区域');
    }
  };

  const addComparison = (
    rec: Omit<ComparisonRecord, 'id' | 'createdAt'>
  ): ComparisonRecord => {
    const created: ComparisonRecord = {
      ...rec,
      id: `CMP-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };
    setComparisons((prev) => [created, ...prev]);
    appendAudit('生成多史料比对与长编', created.title, '保存版本考异与问题雷达记录');
    return created;
  };

  const deleteComparison = (id: string) => {
    setComparisons((prev) => prev.filter((c) => c.id !== id));
  };

  const upsertWikiArticle = (
    article: Omit<WikiArticle, 'id' | 'updatedAt'> & { id?: string }
  ): WikiArticle => {
    const now = new Date().toLocaleString('zh-CN', { hour12: false });
    if (article.id) {
      let updatedItem!: WikiArticle;
      setWikiArticles((prev) =>
        prev.map((w) => {
          if (w.id === article.id) {
            updatedItem = { ...w, ...article, id: w.id, updatedAt: now };
            return updatedItem;
          }
          return w;
        })
      );
      appendAudit('更新 Wiki 知识页', article.title, `编译更新 [[${article.slug}]]`);
      return updatedItem;
    }
    const created: WikiArticle = {
      ...article,
      id: `WIKI-${Date.now().toString().slice(-6)}`,
      updatedAt: now,
    };
    setWikiArticles((prev) => [created, ...prev]);
    appendAudit('新建 Wiki 知识页', created.title, `写入知识条目 [[${created.slug}]]`);
    return created;
  };

  const deleteWikiArticle = (id: string) => {
    setWikiArticles((prev) => prev.filter((w) => w.id !== id));
  };

  const addMapPlace = (p: Omit<MapPlace, 'id'>): MapPlace => {
    const created: MapPlace = {
      ...p,
      id: `PLC-${Date.now().toString().slice(-6)}`,
    };
    setMapPlaces((prev) => [created, ...prev]);
    appendAudit('标注地名', created.name, `(${created.lat}, ${created.lng}) 依据：${created.basis || '未填'}`);
    return created;
  };

  const deleteMapPlace = (id: string) => {
    setMapPlaces((prev) => prev.filter((p) => p.id !== id));
    setMapEvents((prev) =>
      prev.filter((e) => e.fromPlaceId !== id && e.toPlaceId !== id)
    );
  };

  const addMapEvent = (e: Omit<MapEvent, 'id'>): MapEvent => {
    const created: MapEvent = {
      ...e,
      id: `EVT-${Date.now().toString().slice(-6)}`,
    };
    setMapEvents((prev) => [created, ...prev]);
    appendAudit('登记流转事件', `${created.type} ${created.yearStart}`, created.note || '');
    return created;
  };

  const deleteMapEvent = (id: string) => {
    setMapEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const clearAllData = async () => {
    setMapPlaces([]);
    setMapEvents([]);
    await idbClearAllFiles();
    Object.values(LS_KEYS).forEach((k) => localStorage.removeItem(k));
    setCatalogEntries([]);
    setUploadedFiles([]);
    setActiveFileId('');
    setImageRegions([]);
    setActiveRegionId('');
    setComparisons([]);
    setWikiArticles([]);
    setAuditRecords([]);
    setStagedComparisonInput(null);
  };

  const loadSampleDossier = async () => {
    for (const df of DEFAULT_FILES) {
      await idbPutFile(df);
    }
    setCatalogEntries(DEFAULT_CATALOGS);
    setUploadedFiles(DEFAULT_FILES);
    setActiveFileId(DEFAULT_FILES[0].id);
    setImageRegions(DEFAULT_REGIONS);
    setActiveRegionId(DEFAULT_REGIONS[0].id);
    setComparisons(DEFAULT_COMPARISONS);
    setWikiArticles(DEFAULT_WIKI);
    setMapPlaces(DEFAULT_PLACES);
    setMapEvents(DEFAULT_EVENTS);
    setAuditRecords(DEFAULT_AUDITS);
  };

  return (
    <WorkbenchContext.Provider
      value={{
        catalogEntries,
        addCatalogEntry,
        updateCatalogEntry,
        deleteCatalogEntry,
        uploadedFiles,
        activeFileId,
        setActiveFileId,
        uploadArchiveFile,
        deleteArchiveFile,
        updateArchiveFileCatalog,
        imageRegions,
        activeRegionId,
        setActiveRegionId,
        addImageRegion,
        updateImageRegion,
        deleteImageRegion,
        comparisons,
        addComparison,
        deleteComparison,
        wikiArticles,
        upsertWikiArticle,
        deleteWikiArticle,
        mapPlaces,
        addMapPlace,
        deleteMapPlace,
        mapEvents,
        addMapEvent,
        deleteMapEvent,
        auditRecords,
        appendAudit,
        clearAllData,
        stagedComparisonInput,
        setStagedComparisonInput,
        loadSampleDossier,
        apiConfig,
        setApiConfig,
      }}
    >
      {children}
    </WorkbenchContext.Provider>
  );
};

export const useWorkbench = () => {
  const ctx = useContext(WorkbenchContext);
  if (!ctx) {
    throw new Error('useWorkbench must be used within a WorkbenchProvider');
  }
  return ctx;
};
