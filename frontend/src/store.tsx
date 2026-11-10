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
  containerText: string; // 盒夹实际载体，如 "Box 12, Folder 1"
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

const LS_KEYS = {
  catalog: 'qal_v2_catalog',
  regions: 'qal_v2_regions',
  comparisons: 'qal_v2_comparisons',
  wiki: 'qal_v2_wiki',
  audits: 'qal_v2_audits',
  places: 'qal_v3_places',
  events: 'qal_v3_events',
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
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
  // Clean empty initial states (no pre-populated fake demo content)
  const [catalogEntries, setCatalogEntries] = useState<CatalogEntry[]>(() =>
    loadJson<CatalogEntry[]>(LS_KEYS.catalog, [])
  );
  const [uploadedFiles, setUploadedFiles] = useState<StoredArchiveFile[]>([]);
  const [activeFileId, setActiveFileId] = useState<string>('');

  const [imageRegions, setImageRegions] = useState<ImageEvidenceRegion[]>(() =>
    loadJson<ImageEvidenceRegion[]>(LS_KEYS.regions, [])
  );
  const [activeRegionId, setActiveRegionId] = useState<string>('');

  const [comparisons, setComparisons] = useState<ComparisonRecord[]>(() =>
    loadJson<ComparisonRecord[]>(LS_KEYS.comparisons, [])
  );
  const [wikiArticles, setWikiArticles] = useState<WikiArticle[]>(() =>
    loadJson<WikiArticle[]>(LS_KEYS.wiki, [])
  );
  const [auditRecords, setAuditRecords] = useState<AuditRecord[]>(() =>
    loadJson<AuditRecord[]>(LS_KEYS.audits, [])
  );

  const [mapPlaces, setMapPlaces] = useState<MapPlace[]>(() =>
    loadJson<MapPlace[]>(LS_KEYS.places, [])
  );
  const [mapEvents, setMapEvents] = useState<MapEvent[]>(() =>
    loadJson<MapEvent[]>(LS_KEYS.events, [])
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

  // Load persisted files from IndexedDB on mount
  useEffect(() => {
    idbGetAllFiles().then((files) => {
      const sorted = files.sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt)
      );
      setUploadedFiles(sorted);
      if (sorted.length > 0) {
        setActiveFileId((prev) => prev || sorted[0].id);
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
    const demoCatalogs: CatalogEntry[] = [
      {
        id: 'CAT-DEMO-01',
        titleOriginal:
          'Harvard-Yenching Library Rare Books & Special Collections',
        titleZh: '哈佛燕京图书馆善本与特藏部',
        title: '哈佛大学燕京图书馆善本部 (Harvard-Yenching Library Rare Books)',
        level: 'collection',
        referenceCode: 'HYL-SPECIAL-COLL',
        callNumber: 'HYL-SPECIAL-COLL',
        containerText: 'Main Vault',
        parentId: '',
        scopeNote:
          '美国哈佛大学燕京图书馆藏清代满汉文善本档案、未刊稿抄本与海外汉学往来文书集合。',
        sourceNote:
          '美国哈佛大学燕京图书馆藏清代满汉文善本档案与未刊稿抄本集合。',
        verificationStage: 'catalog_checked',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
      {
        id: 'CAT-DEMO-02',
        titleOriginal:
          'Series IX: Western Sinologists & Late Qing Frontier Geography Manuscripts',
        titleZh: '系列九：近代西方汉学与晚清边疆舆地文献稿本系列',
        title: '近代西方汉学与晚清边疆舆地文献稿本系列',
        level: 'series',
        referenceCode: 'SER-WEST-QING-09',
        callNumber: 'SER-WEST-QING-09',
        containerText: 'Series 9',
        parentId: 'CAT-DEMO-01',
        scopeNote:
          '涵括魏源、林则徐、徐继畬等晚清经世学人著作之早期写抄本及西方汉学家校读批注。',
        sourceNote:
          '涵括魏源、林则徐、徐继畬等晚清经世学人著作之早期写抄本及西方汉学家校读批注。',
        verificationStage: 'catalog_checked',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
      {
        id: 'CAT-DEMO-02B',
        titleOriginal:
          'Box 12: Inner Mongolia Demarcation & Dzungar Campaigns (1690-1755)',
        titleZh: '第12盒：漠北内外蒙古定界与准噶尔战事稿本（1690-1755）',
        title: '第12盒：漠北内外蒙古定界与准噶尔战事稿本',
        level: 'box',
        referenceCode: 'Box 12',
        callNumber: 'Box 12',
        containerText: 'Box 12',
        boxNo: '12',
        parentId: 'CAT-DEMO-02',
        scopeNote:
          '包含多伦诺尔会盟、喀尔喀编旗、乌里雅苏台定边将军设立之满汉文档案抄件与手稿草痕。',
        sourceNote: '馆方目录直达盒级，内含 6 个文件夹。',
        verificationStage: 'sample_checked',
        boundaryNote: '馆方目录第4页；已抽查Folder 1样本，其余各夹细目待继续展开。',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
      {
        id: 'CAT-DEMO-03',
        titleOriginal:
          'Folder 1: Wei Yuan Sheng-wu chi Chapter 3 Manuscript Fragment (Kangxi 30th Year Assembly)',
        titleZh:
          '文件夹1：魏源《圣武纪》卷三《康熙亲征准噶尔记》稿本残卷（多伦诺尔会盟）',
        title:
          '魏源《圣武纪》康熙三十年多伦诺尔会盟稿本残卷（Box 12 Folder 1）',
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
        catalogingNote:
          '稿本叶三第十四行与二十一行清晰保留关于札萨克编佐领的早期军事组织表述，刊本删平。',
        boundaryNote:
          '已比对第3页高清晰度原图像素坐标切片；叶一、叶二尚需逐字对照微缩胶卷。',
        verificationStage: 'item_verified',
        parentId: 'CAT-DEMO-02B',
        sourcePageNumber: 4,
        sourceUrl: 'https://hollisarchives.lib.harvard.edu/repositories/24',
        transcriptionMethod: '原馆高清扫描件 + PaddleOCR-VL-1.6 人工核对标定',
        sourceBasis: 'item_inspection',
        displayStatus: 'trial',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
    ];

    const demoFile: StoredArchiveFile = {
      id: 'FILE-DEMO-Shengwu',
      name: 'wu-box12-f1_p0003.jpg',
      mimeType: 'image/jpeg',
      size: 142850,
      catalogId: 'CAT-DEMO-03',
      dataUrl: '/iiif-samples/wu-box12-f1_p0003.jpg',
      textContent:
        '康熙三十年五月，上幸多伦诺尔，七旗喀尔喀与四十九旗内札萨克咸集，大会定界，恭行三跪九叩礼。诏定喀尔喀为三十四旗札萨克，悉依内扎萨克之例编为佐领，分设乌里雅苏台将军统领之。',
      pageCount: 3,
      createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
    };

    const demoRegions: ImageEvidenceRegion[] = [
      {
        id: 'REG-DEMO-01',
        fileId: demoFile.id,
        catalogId: 'CAT-DEMO-03',
        page: 1,
        label: '叶三·第十四行 多伦诺尔会盟定界',
        xywh: { x: 382, y: 520, w: 420, h: 180 },
        normRect: { x: 28.5, y: 34.2, w: 31.3, h: 11.8 },
        cropDataUrl: undefined,
        ocrText:
          '康熙三十年五月，上御多伦诺尔，内外扎萨克蒙古咸集，大会定界，行稽首礼。',
        correctedText:
          '康熙三十年五月，上幸多伦诺尔，七旗喀尔喀与四十九旗内札萨克咸集，大会定界，恭行三跪九叩礼。',
        translation:
          'In the 5th month of Kangxi 30th year (1691), the Emperor arrived at Dolon Nor; the Khalkha and Inner Jasagh Mongols assembled, border demarcated, performing the solemn rites.',
        engineUsed: 'PaddleOCR-VL-1.6',
        status: 'verified',
        note: '经对照清圣祖实录与内阁满文原档，稿本在此处存有双层朱墨批改痕迹，明确记载七旗喀尔喀之具体建制。',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
      {
        id: 'REG-DEMO-02',
        fileId: demoFile.id,
        catalogId: 'CAT-DEMO-03',
        page: 1,
        label: '叶三·第二十一行 喀尔喀札萨克编旗分佐领',
        xywh: { x: 382, y: 730, w: 410, h: 165 },
        normRect: { x: 28.5, y: 48.0, w: 30.6, h: 10.8 },
        cropDataUrl: undefined,
        ocrText:
          '定喀尔喀为三十四札萨克，依内札萨克例编佐领，设将军大臣以总统之。',
        correctedText:
          '诏定喀尔喀为三十四旗札萨克，悉依内扎萨克之例编为佐领，分设乌里雅苏台将军统领之。',
        translation:
          'Decreed Khalkha into 34 banners, organized into arrows according to Inner Jasagh precedent, under General of Uliastai.',
        engineUsed: 'MinerU-v4',
        status: 'verified',
        note: '订正乌里雅苏台将军统辖职权之早期表述异同。',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
    ];

    const demoComparisons: ComparisonRecord[] = [
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
          '本案聚焦 1691 年多伦诺尔会盟的关键制度演变。未刊抄本保留了魏源初拟《圣武纪》时对满文档案与实录材料的剪裁草痕，相较于道光刊本删削了七旗喀尔喀向外札萨克转化的具体编旗细节，是探寻晚清经世学者重构边疆叙事的一手珍稀文献。',
        changbian:
          '【长编正文】康熙三十年（1691）五月，康熙帝巡幸多伦诺尔，举行多伦会盟。\n【考异】母本《清圣祖实录》详载会盟礼节与四十九旗内札萨克、喀尔喀三部会盟座次，而未刊抄本作「七旗喀尔喀与四十九旗内札萨克咸集……诏定喀尔喀为三十四旗札萨克」，道光刊本则概括为「喀尔喀三部悉隶版图」。考其删削，刊本为照顾文章体裁与经世义理，抹平了初编旗时的三十四札萨克分封细节。未刊稿更近于早期档案蓝本。',
        radarNotes:
          '1. 漏译删削维度：刊本删节了关于札萨克编佐领的早期军事组织表述；\n2. 概念置换维度：满汉档案中“会盟”与西方手稿“Imperial Assembly / Fealty”之间的对译偏移；\n3. 一手文献价值：该未刊抄本批注字体疑为清道光间学人（魏源或其门人）亲笔朱墨套校，补足道光刻本缺失的考证按语。',
        createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
    ];

    const demoWiki: WikiArticle[] = [
      {
        id: 'WIKI-DEMO-01',
        title: '多伦诺尔会盟与喀尔喀编旗（1691）',
        slug: 'dolon-nor-assembly-1691',
        category: 'concept',
        content: `# 多伦诺尔会盟与喀尔喀编旗（1691）

> 关联原图证据：[REG-DEMO-01 坐标(382, 520, 420, 180)] · 出自馆藏 [MS-Qing-Box12-F01]
> 空间点位：[[多伦诺尔]] (116.47, 42.18) · 清内蒙古察哈尔都统辖区

## 1. 历史事件与文献背景
康熙三十年（1691）五月，清圣祖于[[多伦诺尔]]（今内蒙古锡林郭勒盟多伦县）举行多伦会盟，接纳漠北喀尔喀蒙古三部内附，将内外蒙古统辖于清中央政权之下。

## 2. 文本版本源流与长编考异
根据西方馆藏未刊手稿 \`wu-box12-f1_p0003.jpg\` 与《清圣祖实录》、道光刊本《圣武纪》三部对照：
- **未刊手稿** 强调制度建置细节：「诏定喀尔喀为三十四旗札萨克，悉依内扎萨克之例编为佐领」；
- **道光刊本** 简化为「自是喀尔喀三部悉隶版图」；
- **清代舆地归属**：多伦诺尔不仅是会盟汇聚地，此后更兴建汇宗寺、善因寺，成为外札萨克管理与蒙藏佛教文化中心。

## 3. 证据链条溯源与空间流动
- 原件：哈佛燕京图书馆藏未刊清史手稿残页第 3 页
- 对应空间流转路径：北京（清廷出塞） → [[多伦诺尔]]（会盟立界） → 乌里雅苏台（设立定边左副将军）`,
        linkedRegionIds: ['REG-DEMO-01', 'REG-DEMO-02'],
        updatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      },
    ];

    const demoPlaces: MapPlace[] = [
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
        note: '1691年多伦会盟所在地，后置多伦诺尔厅与汇宗寺。',
      },
      {
        id: 'PLC-DEMO-02',
        name: '北京（清紫禁城）',
        alias: 'Peking / 顺天府',
        lat: 39.91,
        lng: 116.40,
        admin: '顺天府大兴县 / 宛平县',
        basis: 'CHGIS 1820 京师中枢坐标',
        confidence: 'explicit',
        kind: 'place',
        year: 1691,
        regionId: 'REG-DEMO-01',
        catalogId: 'CAT-DEMO-03',
        note: '康熙帝出塞会盟启程与朝议决策中枢。',
      },
      {
        id: 'PLC-DEMO-03',
        name: '乌里雅苏台',
        alias: 'Uliastai / 扎萨克图汗部',
        lat: 47.74,
        lng: 96.85,
        admin: '乌里雅苏台定边左副将军治所',
        basis: '清乾隆设置之漠北喀尔喀军事与政务中枢',
        confidence: 'verified',
        kind: 'place',
        year: 1733,
        regionId: 'REG-DEMO-02',
        catalogId: 'CAT-DEMO-03',
        note: '分设乌里雅苏台将军统领喀尔喀四部。',
      },
      {
        id: 'PLC-DEMO-04',
        name: '哈佛燕京图书馆',
        alias: 'Harvard-Yenching Library',
        lat: 42.37,
        lng: -71.12,
        admin: '美国马萨诸塞州剑桥',
        basis: '现代海外汉学文献收藏馆所',
        confidence: 'explicit',
        kind: 'repository',
        year: 1928,
        regionId: 'REG-DEMO-01',
        catalogId: 'CAT-DEMO-01',
        note: '西方馆藏中国未刊手稿与善本藏书楼。',
      },
    ];

    const demoEvents: MapEvent[] = [
      {
        id: 'EVT-DEMO-01',
        type: '会盟',
        fromPlaceId: 'PLC-DEMO-02',
        toPlaceId: 'PLC-DEMO-01',
        yearStart: 1691,
        yearEnd: 1691,
        regionId: 'REG-DEMO-01',
        note: '康熙帝自京师启銮出塞，于多伦诺尔举行多伦会盟，喀尔喀蒙古各部归附。',
      },
      {
        id: 'EVT-DEMO-02',
        type: '入藏',
        fromPlaceId: 'PLC-DEMO-02',
        toPlaceId: 'PLC-DEMO-04',
        yearStart: 1930,
        yearEnd: 1935,
        regionId: 'REG-DEMO-01',
        note: '晚清学人旧藏手稿经由西方汉学家访购，入藏哈佛燕京图书馆善本部。',
      },
      {
        id: 'EVT-DEMO-03',
        type: '其他',
        fromPlaceId: 'PLC-DEMO-01',
        toPlaceId: 'PLC-DEMO-03',
        yearStart: 1691,
        yearEnd: 1733,
        regionId: 'REG-DEMO-02',
        note: '外札萨克编旗后建立乌里雅苏台将军体制，形成漠北边防管辖链条。',
      },
    ];

    const demoAudits: AuditRecord[] = [
      {
        id: 'AUD-DEMO-01',
        timestamp: new Date().toLocaleString('zh-CN', { hour12: false }),
        actor: '系统示范引导',
        action: '载入示范实证卷宗',
        target: '魏源《圣武纪》多伦诺尔会盟案例',
        detail:
          '一键载入哈佛燕京图书馆藏未刊文献、原图像素坐标切片、考异长编、Wiki 与 CHGIS 空间数据',
      },
    ];

    await idbPutFile(demoFile);
    setCatalogEntries(demoCatalogs);
    setUploadedFiles([demoFile]);
    setActiveFileId(demoFile.id);
    setImageRegions(demoRegions);
    setActiveRegionId(demoRegions[0].id);
    setComparisons(demoComparisons);
    setWikiArticles(demoWiki);
    setMapPlaces(demoPlaces);
    setMapEvents(demoEvents);
    setAuditRecords(demoAudits);
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
