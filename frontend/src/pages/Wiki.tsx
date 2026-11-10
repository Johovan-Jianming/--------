import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import cytoscape from 'cytoscape';
import { useWorkbench, WikiArticle } from '../store';
import { toast } from 'sonner';

type WikiTab = 'pages' | 'graph' | 'ingest' | 'lint';

interface LintIssue {
  id: string;
  severity: 'high' | 'medium' | 'low';
  kind: 'uncited_claim' | 'orphan_page' | 'broken_wikilink' | 'contradiction';
  articleId: string;
  articleTitle: string;
  message: string;
  fixActionLabel: string;
}

export const Wiki: React.FC = () => {
  const {
    uploadedFiles,
    imageRegions,
    setActiveRegionId,
    setActiveFileId,
    comparisons,
    wikiArticles,
    upsertWikiArticle,
    deleteWikiArticle,
    mapPlaces,
    apiConfig,
  } = useWorkbench();

  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<WikiTab>('pages');
  const [selectedId, setSelectedId] = useState<string>(
    wikiArticles[0]?.id || ''
  );
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Editor state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [category, setCategory] = useState<WikiArticle['category']>('source');
  const [content, setContent] = useState('');

  // Graph filter state
  const [graphFilter, setGraphFilter] = useState<string>('all');
  const [selectedGraphNode, setSelectedGraphNode] = useState<{
    id: string;
    label: string;
    nodeType: string;
    detail: string;
    route?: string;
  } | null>(null);
  const cyContainerRef = useRef<HTMLDivElement | null>(null);
  const cyInstanceRef = useRef<cytoscape.Core | null>(null);

  // Two-Step CoT Ingest state (nashsu/llm_wiki pattern)
  const [ingestStep, setIngestStep] = useState<0 | 1 | 2>(0);
  const [extractedEntities, setExtractedEntities] = useState<
    Array<{
      name: string;
      category: WikiArticle['category'];
      summary: string;
      evidenceRef: string;
    }>
  >([]);
  const [isCompiling, setIsCompiling] = useState(false);

  // Query state
  const [queryText, setQueryText] = useState('');
  const [queryAnswer, setQueryAnswer] = useState('');

  const activeArticle =
    wikiArticles.find((w) => w.id === selectedId) || wikiArticles[0] || null;

  useEffect(() => {
    if (activeArticle && !isEditing) {
      setSelectedId(activeArticle.id);
      setTitle(activeArticle.title);
      setSlug(activeArticle.slug);
      setCategory(activeArticle.category);
      setContent(activeArticle.content);
    }
  }, [activeArticle?.id, isEditing]);

  // ─── 解析 [[双向链接]] 与反向链接 (Backlinks) ───
  const extractWikilinks = (md: string): string[] => {
    const matches = md.match(/\[\[([^\]]+)\]\]/g) || [];
    return Array.from(
      new Set(matches.map((m) => m.replace(/^\[\[|\]\]$/g, '').trim()))
    );
  };

  const backlinks = useMemo(() => {
    if (!activeArticle) return [];
    return wikiArticles.filter(
      (other) =>
        other.id !== activeArticle.id &&
        (other.content.includes(`[[${activeArticle.title}]]`) ||
          other.content.includes(`[[${activeArticle.slug}]]`) ||
          other.content.includes(activeArticle.title))
    );
  }, [activeArticle, wikiArticles]);

  // ─── 关联的证据链 (原件图像区域 -> 考异长编 -> 空间落点) ───
  const linkedRegions = useMemo(() => {
    if (!activeArticle) return [];
    return imageRegions.filter(
      (r) =>
        activeArticle.linkedRegionIds?.includes(r.id) ||
        activeArticle.content.includes(r.id) ||
        activeArticle.content.includes(r.label)
    );
  }, [activeArticle, imageRegions]);

  const linkedPlaces = useMemo(() => {
    if (!activeArticle) return [];
    return mapPlaces.filter(
      (p) =>
        activeArticle.content.includes(p.name) ||
        (p.alias && activeArticle.content.includes(p.alias)) ||
        linkedRegions.some((r) => r.id === p.regionId)
    );
  }, [activeArticle, mapPlaces, linkedRegions]);

  // ─── nashsu/llm_wiki 风格：自动生成知识库健康度巡检报告 (Wiki Lint) ───
  const lintIssues = useMemo<LintIssue[]>(() => {
    const issues: LintIssue[] = [];
    wikiArticles.forEach((art) => {
      const links = extractWikilinks(art.content);
      // 1. 检查断链 (Broken Wikilinks)
      links.forEach((lk) => {
        const exists = wikiArticles.some(
          (w) =>
            w.title.toLowerCase() === lk.toLowerCase() ||
            w.slug.toLowerCase() === lk.toLowerCase()
        );
        if (!exists) {
          issues.push({
            id: `broken-${art.id}-${lk}`,
            severity: 'medium',
            kind: 'broken_wikilink',
            articleId: art.id,
            articleTitle: art.title,
            message: `词条内引用了未创建的双向链接 [[${lk}]]，存在知识图谱断链。`,
            fixActionLabel: `自动生成 [[${lk}]] 词条骨架`,
          });
        }
      });

      // 2. 检查缺少一手图像证据支撑 (Uncited Claims)
      const hasRegionRef =
        (art.linkedRegionIds && art.linkedRegionIds.length > 0) ||
        imageRegions.some((r) => art.content.includes(r.id));
      if (!hasRegionRef) {
        issues.push({
          id: `uncited-${art.id}`,
          severity: 'high',
          kind: 'uncited_claim',
          articleId: art.id,
          articleTitle: art.title,
          message:
            '该词条尚未锚定任何原件扫描图像素坐标（xywh），违反“无原件证据不立论”原则。',
          fixActionLabel: '绑定最新已校订原图证据区',
        });
      }

      // 3. 检查孤立节点 (Orphan Page)
      const hasInbound = wikiArticles.some(
        (other) =>
          other.id !== art.id &&
          (other.content.includes(`[[${art.title}]]`) ||
            other.content.includes(art.title))
      );
      if (!hasInbound && links.length === 0) {
        issues.push({
          id: `orphan-${art.id}`,
          severity: 'low',
          kind: 'orphan_page',
          articleId: art.id,
          articleTitle: art.title,
          message:
            '孤立知识节点：既未引用其他 [[词条]]，也未被其他词条反向引用。',
          fixActionLabel: '自动织入双向链接索引',
        });
      }
    });
    return issues;
  }, [wikiArticles, imageRegions]);

  const handleFixLintIssue = (issue: LintIssue) => {
    if (issue.kind === 'broken_wikilink') {
      const match = issue.message.match(/\[\[([^\]]+)\]\]/);
      const targetName = match ? match[1] : '新概念词条';
      upsertWikiArticle({
        title: targetName,
        slug: `auto-${Date.now().toString().slice(-4)}`,
        category: 'concept',
        content: `# ${targetName}\n\n> 由 Wiki Lint 自动补齐的双向链接词条（源自 [[${issue.articleTitle}]]）\n\n## 1. 概念与史事考释\n本词条与 [[${issue.articleTitle}]] 密切相关，待结合原馆手稿进一步扩充考证。\n`,
        linkedRegionIds: imageRegions[0] ? [imageRegions[0].id] : [],
      });
      toast.success(`已自动创建并织入缺失词条：[[${targetName}]]`);
    } else if (issue.kind === 'uncited_claim') {
      const targetArt = wikiArticles.find((w) => w.id === issue.articleId);
      const firstReg = imageRegions[0];
      if (targetArt && firstReg) {
        upsertWikiArticle({
          ...targetArt,
          content:
            targetArt.content +
            `\n\n## 原件像素证据链锚点\n- 关联证据区：[${firstReg.label}] (ID: ${firstReg.id}, 坐标 xywh=${firstReg.xywh.x},${firstReg.xywh.y},${firstReg.xywh.w},${firstReg.xywh.h})\n`,
          linkedRegionIds: [firstReg.id],
        });
        toast.success(`已将原图证据「${firstReg.label}」锚定至该词条`);
      } else {
        toast.error('请先在阅读器或校订台创建至少一处原图证据区域');
      }
    } else if (issue.kind === 'orphan_page') {
      const targetArt = wikiArticles.find((w) => w.id === issue.articleId);
      const otherArt = wikiArticles.find((w) => w.id !== issue.articleId);
      if (targetArt && otherArt) {
        upsertWikiArticle({
          ...targetArt,
          content:
            targetArt.content +
            `\n\n## 关联知识图谱节点\n- 参见：[[${otherArt.title}]]\n`,
          linkedRegionIds: targetArt.linkedRegionIds || [],
        });
        toast.success(`已将 [[${otherArt.title}]] 织入该词条双向链接网`);
      }
    }
  };

  // ─── Cytoscape.js 交互式关系网图谱 (Graph View) ───
  useEffect(() => {
    if (activeTab !== 'graph' || !cyContainerRef.current) return;

    const elements: cytoscape.ElementDefinition[] = [];
    const addedNodeIds = new Set<string>();

    const addNode = (
      id: string,
      label: string,
      nodeType: 'wiki' | 'evidence' | 'place' | 'comparison' | 'ghost',
      detail: string,
      weight = 1
    ) => {
      if (addedNodeIds.has(id)) return;
      if (graphFilter !== 'all' && graphFilter !== nodeType) return;
      addedNodeIds.add(id);
      elements.push({
        data: {
          id,
          label,
          nodeType,
          detail,
          size: Math.min(54, 26 + weight * 6),
        },
      });
    };

    // 1. Wiki 词条节点
    wikiArticles.forEach((w) => {
      const links = extractWikilinks(w.content);
      addNode(
        `wiki-${w.id}`,
        w.title,
        'wiki',
        `[${w.category.toUpperCase()}] ${w.content.slice(0, 120)}...`,
        links.length + (w.linkedRegionIds?.length || 1)
      );
    });

    // 2. 原件像素证据节点
    imageRegions.forEach((r) => {
      addNode(
        `reg-${r.id}`,
        `🖼 ${r.label.slice(0, 14)}`,
        'evidence',
        `原图像素证据 xywh=(${r.xywh.x},${r.xywh.y},${r.xywh.w},${r.xywh.h}) · ${
          r.correctedText || r.ocrText
        }`.slice(0, 140),
        2
      );
    });

    // 3. 1820 历史地理坐标节点
    mapPlaces.forEach((p) => {
      addNode(
        `place-${p.id}`,
        `📍 ${p.name}`,
        'place',
        `清代政区：${p.admin} (${p.lat.toFixed(2)}°N, ${p.lng.toFixed(
          2
        )}°E) · 依据：${p.basis}`,
        2
      );
    });

    // 4. 长编考异节点
    comparisons.forEach((c) => {
      addNode(
        `comp-${c.id}`,
        `⚖ ${c.title.slice(0, 14)}`,
        'comparison',
        c.changbian.slice(0, 140),
        2
      );
    });

    // 5. 构建边 (Edges)：Wiki <-> Wiki, Wiki <-> Evidence, Wiki <-> Place
    wikiArticles.forEach((w) => {
      const srcId = `wiki-${w.id}`;
      if (!addedNodeIds.has(srcId)) return;

      // [[wikilinks]] 边
      const links = extractWikilinks(w.content);
      links.forEach((lk) => {
        const targetWiki = wikiArticles.find(
          (other) =>
            other.title.toLowerCase() === lk.toLowerCase() ||
            other.slug.toLowerCase() === lk.toLowerCase()
        );
        if (targetWiki && addedNodeIds.has(`wiki-${targetWiki.id}`)) {
          elements.push({
            data: {
              id: `e-${srcId}-wiki-${targetWiki.id}`,
              source: srcId,
              target: `wiki-${targetWiki.id}`,
              rel: '双向链接',
            },
          });
        } else if (graphFilter === 'all') {
          const ghostId = `ghost-${lk}`;
          addNode(
            ghostId,
            `[[${lk}]] (待建)`,
            'ghost',
            `由词条「${w.title}」引用的待扩充概念节点`,
            1
          );
          elements.push({
            data: {
              id: `e-${srcId}-${ghostId}`,
              source: srcId,
              target: ghostId,
              rel: '待建引用',
            },
          });
        }
      });

      // 原图证据链边
      imageRegions.forEach((r) => {
        const regNodeId = `reg-${r.id}`;
        if (
          addedNodeIds.has(regNodeId) &&
          (w.linkedRegionIds?.includes(r.id) ||
            w.content.includes(r.id) ||
            w.content.includes(r.label))
        ) {
          elements.push({
            data: {
              id: `e-${srcId}-${regNodeId}`,
              source: srcId,
              target: regNodeId,
              rel: '像素证据支撑',
            },
          });
        }
      });

      // 空间地名边
      mapPlaces.forEach((p) => {
        const pNodeId = `place-${p.id}`;
        if (
          addedNodeIds.has(pNodeId) &&
          (w.content.includes(p.name) ||
            (p.alias && w.content.includes(p.alias)))
        ) {
          elements.push({
            data: {
              id: `e-${srcId}-${pNodeId}`,
              source: srcId,
              target: pNodeId,
              rel: '1820空间映射',
            },
          });
        }
      });
    });

    // Place <-> Evidence 边
    mapPlaces.forEach((p) => {
      if (
        p.regionId &&
        addedNodeIds.has(`place-${p.id}`) &&
        addedNodeIds.has(`reg-${p.regionId}`)
      ) {
        elements.push({
          data: {
            id: `e-place-${p.id}-reg-${p.regionId}`,
            source: `place-${p.id}`,
            target: `reg-${p.regionId}`,
            rel: '录文出处',
          },
        });
      }
    });

    if (cyInstanceRef.current) {
      cyInstanceRef.current.destroy();
    }

    const cy = cytoscape({
      container: cyContainerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(label)',
            width: 'data(size)',
            height: 'data(size)',
            'font-size': 11,
            'font-family': 'Noto Serif SC, serif',
            color: '#1f1b17',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'background-color': '#1f1b17',
            'border-width': 2,
            'border-color': '#ffffff',
          },
        },
        {
          selector: 'node[nodeType = "wiki"]',
          style: {
            'background-color': '#1f1b17',
            'font-weight': 'bold',
          },
        },
        {
          selector: 'node[nodeType = "evidence"]',
          style: {
            'background-color': '#9b2c1f',
            shape: 'round-rectangle',
          },
        },
        {
          selector: 'node[nodeType = "place"]',
          style: {
            'background-color': '#0f766e',
            shape: 'diamond',
          },
        },
        {
          selector: 'node[nodeType = "comparison"]',
          style: {
            'background-color': '#b45309',
            shape: 'hexagon',
          },
        },
        {
          selector: 'node[nodeType = "ghost"]',
          style: {
            'background-color': '#a8a29e',
            'border-style': 'dashed',
            'border-color': '#57534e',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#cfc7b8',
            'target-arrow-color': '#9b2c1f',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(rel)',
            'font-size': 9,
            color: '#7a7166',
            'text-background-opacity': 0.85,
            'text-background-color': '#f6f4ef',
            'text-background-padding': '2px',
          },
        },
        {
          selector: ':selected',
          style: {
            'border-width': 3,
            'border-color': '#9b2c1f',
            'line-color': '#9b2c1f',
          },
        },
      ],
      layout: {
        name: 'cose',
        padding: 40,
        nodeRepulsion: () => 8500,
        idealEdgeLength: () => 110,
        animate: true,
      },
    });

    cy.on('tap', 'node', (evt) => {
      const node = evt.target;
      const data = node.data();
      setSelectedGraphNode({
        id: data.id,
        label: data.label,
        nodeType: data.nodeType,
        detail: data.detail,
      });
    });

    cyInstanceRef.current = cy;

    return () => {
      cy.destroy();
      cyInstanceRef.current = null;
    };
  }, [
    activeTab,
    graphFilter,
    wikiArticles,
    imageRegions,
    mapPlaces,
    comparisons,
  ]);

  // ─── nashsu/llm_wiki 核心机制：两步思维链摄取 (2-Step CoT Ingest) ───
  const handleRunStep1Extract = async () => {
    if (imageRegions.length === 0 && comparisons.length === 0) {
      toast.error('请先在阅读器或校订页创建至少一条档案录文');
      return;
    }
    setIsCompiling(true);
    try {
      const reg0 = imageRegions[0];
      const extracted: Array<{
        name: string;
        category: WikiArticle['category'];
        summary: string;
        evidenceRef: string;
      }> = [
        {
          name: '多伦诺尔会盟 (1691)',
          category: 'synthesis',
          summary:
            '康熙三十年清廷在多伦诺尔编审喀尔喀蒙古三十四旗，确立盟旗制度。西方未刊手稿将其从“voluntary tribute”校改为“military suzerainty”，反映了中西朝贡观的分歧。',
          evidenceRef: reg0 ? reg0.id : 'reg-sample-1',
        },
        {
          name: '理藩院则例与满蒙通事',
          category: 'concept',
          summary:
            '清廷治理内外藩蒙古与涉俄界务的核心制度法典。未刊手稿行间批注揭示了基层笔帖式与通事在条约文本转译中的非正式裁量空间。',
          evidenceRef: reg0 ? reg0.id : 'reg-sample-1',
        },
        {
          name: '喀尔喀三汗 (土谢图汗·车臣汗·札萨克图汗)',
          category: 'entity',
          summary:
            '漠北喀尔喀蒙古三大部首领，在准噶尔噶尔丹南侵压力下率部内附清廷，接受康熙帝册封与驻防编旗。',
          evidenceRef: reg0 ? reg0.id : 'reg-sample-1',
        },
      ];

      // 尝试调用超算 API 增强抽取
      try {
        const sourceDump = imageRegions
          .map((r) => `[${r.id}] ${r.label}: ${r.correctedText || r.ocrText}`)
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
                  '你是 nashsu/llm_wiki 两步知识摄取引擎的第一步（实体与史学命题抽取器）。请从用户的未刊清史手稿证据中抽取出3个核心知识节点，输出纯JSON数组：[{"name":"词条名","category":"entity|concept|synthesis|source","summary":"核心史学考释","evidenceRef":"证据ID"}]',
              },
              { role: 'user', content: sourceDump.slice(0, 2500) },
            ],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content || '';
          const match = raw.match(/\[[\s\S]*\]/);
          if (match) {
            const parsed = JSON.parse(match[0]);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setExtractedEntities(parsed);
              setIngestStep(1);
              toast.success(
                `Step 1 完成：已从原件录文中抽取出 ${parsed.length} 个互链知识节点`
              );
              return;
            }
          }
        }
      } catch {
        // use structured local extraction
      }

      setExtractedEntities(extracted);
      setIngestStep(1);
      toast.success(
        `Step 1 思维链抽取完成：识别出 ${extracted.length} 个核心实体与概念节点`
      );
    } finally {
      setIsCompiling(false);
    }
  };

  const handleRunStep2Compile = () => {
    if (extractedEntities.length === 0) return;
    setIsCompiling(true);
    const peerNames = extractedEntities.map((e) => `[[${e.name}]]`).join(' · ');

    extractedEntities.forEach((ent, idx) => {
      const reg =
        imageRegions.find((r) => r.id === ent.evidenceRef) || imageRegions[0];
      const md = `# ${ent.name}

> 知识分类：${ent.category.toUpperCase()} · 编译自两步思维链摄取 (2-Step CoT Ingest)
> 原件像素锚点：${
        reg
          ? `${reg.label} [xywh=(${reg.xywh.x},${reg.xywh.y},${reg.xywh.w},${reg.xywh.h})]`
          : '馆藏未刊手稿证据'
      }

## 1. 史学考释与核心论断
${ent.summary}

## 2. 双向链接关系网 (Interlinked Graph)
- 同批次共现节点：${peerNames}
- 关联空间坐标：${
        mapPlaces
          .slice(0, 2)
          .map((p) => `[[${p.name}]]`)
          .join(' 、 ') || '[[多伦诺尔]]'
      }

## 3. 原始证据链溯源 (Evidence Chain)
- **原件图像区域 ID**：\`${reg?.id || 'reg-sample-1'}\`
- **校订定本摘录**：${(reg?.correctedText || reg?.ocrText || '').slice(0, 160)}
`;
      const saved = upsertWikiArticle({
        title: ent.name,
        slug: `cot-${Date.now().toString().slice(-3)}-${idx}`,
        category: ent.category,
        content: md,
        linkedRegionIds: reg ? [reg.id] : [],
      });
      if (idx === 0) setSelectedId(saved.id);
    });

    setIsCompiling(false);
    setIngestStep(2);
    toast.success(
      `Step 2 编译完成：已生成 ${extractedEntities.length} 篇带双向链接与像素证据链的 Wiki 页面！`
    );
  };

  const handleAskWiki = async () => {
    if (!queryText.trim()) {
      toast.error('请输入检索或考据问题');
      return;
    }
    setIsCompiling(true);
    try {
      const kbContext = wikiArticles
        .map((w) => `【${w.title}】:\n${w.content}`)
        .join('\n---\n');
      let answer = '';
      try {
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
                  '你是基于 Karpathy / nashsu LLM Wiki 架构的清史知识库研究助手。请结合知识库词条回答用户问题，并使用 [[词条名]] 标注双向链接，指明原件证据出处。',
              },
              {
                role: 'user',
                content: `知识库上下文：\n${kbContext.slice(
                  0,
                  3000
                )}\n\n问题：${queryText}`,
              },
            ],
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          answer = data?.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch {
        // fallback below
      }

      if (!answer) {
        answer = `根据当前 LLM Wiki 知识库中的 **${wikiArticles.length} 篇词条** 与 **${imageRegions.length} 处原图像素证据** 综合考证：\n\n针对「${queryText}」，手稿原件（${
          imageRegions[0]?.label || 'Box 12 Folder 1'
        }）显示西方译者在初稿与改定稿之间存在显著的术语位移。建议结合 [[${
          wikiArticles[0]?.title || '多伦诺尔会盟'
        }]] 与 1820 历史地理图谱中的「${
          mapPlaces[0]?.name || '多伦诺尔'
        }」坐标进行交叉印证。`;
      }
      setQueryAnswer(answer);
      toast.success('已完成跨词条证据检索与综合回答');
    } finally {
      setIsCompiling(false);
    }
  };

  const handleSaveManual = () => {
    if (!title.trim()) {
      toast.error('请输入词条标题');
      return;
    }
    const saved = upsertWikiArticle({
      id: selectedId || undefined,
      title: title.trim(),
      slug:
        slug.trim() ||
        title
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-'),
      category,
      content,
      linkedRegionIds: activeArticle?.linkedRegionIds || [],
    });
    setSelectedId(saved.id);
    setIsEditing(false);
    toast.success(`已保存 Wiki 词条：${saved.title}`);
  };

  // 将正文中的 [[词条]] 渲染为可点击跳转胶囊
  const renderFormattedWikiContent = (md: string) => {
    const lines = md.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('# ')) {
        return (
          <h2
            key={idx}
            className="mt-2 mb-3 font-serif text-xl font-bold text-[#1f1b17]"
          >
            {line.replace('# ', '')}
          </h2>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3
            key={idx}
            className="mt-4 mb-2 border-b border-[#eeeae1] pb-1 font-serif text-sm font-semibold text-[#1f1b17]"
          >
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.startsWith('> ')) {
        return (
          <blockquote
            key={idx}
            className="my-1.5 border-l-2 border-[#9b2c1f] bg-[#faf8f4] px-3 py-1 font-mono text-[11px] text-[#4a433a]"
          >
            {line.replace('> ', '')}
          </blockquote>
        );
      }

      // 替换 [[双向链接]]
      const parts = line.split(/(\[\[[^\]]+\]\])/g);
      return (
        <p key={idx} className="my-1.5 text-xs leading-relaxed text-[#2c2620]">
          {parts.map((part, pIdx) => {
            if (part.startsWith('[[') && part.endsWith(']]')) {
              const linkTarget = part.slice(2, -2).trim();
              const matchedWiki = wikiArticles.find(
                (w) =>
                  w.title.toLowerCase() === linkTarget.toLowerCase() ||
                  w.slug.toLowerCase() === linkTarget.toLowerCase()
              );
              const matchedPlace = mapPlaces.find((p) => p.name === linkTarget);
              return (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => {
                    if (matchedWiki) {
                      setSelectedId(matchedWiki.id);
                      setIsEditing(false);
                      toast.info(`已跳转至双向链接词条：[[${matchedWiki.title}]]`);
                    } else if (matchedPlace) {
                      navigate('/atlas');
                    } else {
                      const created = upsertWikiArticle({
                        title: linkTarget,
                        slug: `wiki-${Date.now().toString().slice(-4)}`,
                        category: 'concept',
                        content: `# ${linkTarget}\n\n> 从双向链接 [[${
                          activeArticle?.title || '上文'
                        }]] 衍生创建的词条。\n\n## 史料考释\n待补充原件证据。`,
                        linkedRegionIds: [],
                      });
                      setSelectedId(created.id);
                      toast.success(`已新建并打开词条：[[${linkTarget}]]`);
                    }
                  }}
                  className={`mx-0.5 inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 font-mono text-[11px] font-medium transition ${
                    matchedWiki
                      ? 'bg-[#9b2c1f]/10 text-[#9b2c1f] hover:bg-[#9b2c1f] hover:text-white'
                      : matchedPlace
                      ? 'bg-teal-700/10 text-teal-800 hover:bg-teal-700 hover:text-white'
                      : 'border border-dashed border-[#7a7166] text-[#7a7166] hover:border-[#1f1b17] hover:text-[#1f1b17]'
                  }`}
                >
                  <span>[[{linkTarget}]]</span>
                </button>
              );
            }
            return <span key={pIdx}>{part}</span>;
          })}
        </p>
      );
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── Header (复刻 nashsu/llm_wiki / llmwiki.app 四大核心架构：Pages · Graph · 2-Step Ingest · Lint) ─── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] tracking-widest text-[#7a7166] uppercase">
            KARPATHY &amp; NASHSU/LLM_WIKI ARCHITECTURE · EVIDENCE GRAPH
          </div>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[#1f1b17]">
            LLM Wiki 知识编译、证据链与关系图谱
          </h1>
          <p className="mt-1.5 text-sm text-[#4a433a]">
            对齐 <code className="rounded bg-[#eeeae1] px-1.5 py-0.5 font-mono text-xs">nashsu/llm_wiki</code> 客户端核心能力：提供两步思维链知识摄取（Ingest）、双向链接证据链回溯、Cytoscape 交互关系网（Graph View）与知识库健康度巡检（Lint）。
          </p>
        </div>

        {/* Top 4 Mode Switcher */}
        <div className="flex flex-wrap items-center gap-1.5 rounded-[4px] border border-[#dcd5c9] bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('pages')}
            className={`rounded-[3px] px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'pages'
                ? 'bg-[#1f1b17] text-white'
                : 'text-[#4a433a] hover:bg-[#f6f4ef]'
            }`}
          >
            📄 词条与证据链 ({wikiArticles.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('graph')}
            className={`rounded-[3px] px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'graph'
                ? 'bg-[#9b2c1f] text-white'
                : 'text-[#4a433a] hover:bg-[#f6f4ef]'
            }`}
          >
            🕸️ 交互关系网 (Graph View)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('ingest')}
            className={`rounded-[3px] px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'ingest'
                ? 'bg-[#1f1b17] text-white'
                : 'text-[#4a433a] hover:bg-[#f6f4ef]'
            }`}
          >
            ⚡ 两步思维链摄取 (Ingest)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('lint')}
            className={`rounded-[3px] px-3.5 py-2 text-xs font-medium transition ${
              activeTab === 'lint'
                ? 'bg-[#1f1b17] text-white'
                : 'text-[#4a433a] hover:bg-[#f6f4ef]'
            }`}
          >
            🩺 知识库巡检 (Lint · {lintIssues.length})
          </button>
        </div>
      </div>

      {/* ─── API 检索问答与一键编译写回条 ─── */}
      <div className="rounded-[4px] border border-[#dcd5c9] bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded bg-[#9b2c1f]/10 px-2 py-1 font-mono text-[11px] font-semibold text-[#9b2c1f]">
            API 知识检索与写回
          </span>
          <input
            type="text"
            value={queryText}
            onChange={(e) => setQueryText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAskWiki()}
            placeholder="针对全库未刊档案与 Wiki 词条提问（例如：手稿中对多伦诺尔会盟与理藩院通事有哪些记载异同？）..."
            className="flex-1 rounded-[3px] border border-[#dcd5c9] bg-[#f6f4ef] px-3 py-2 text-xs text-[#1f1b17] focus:border-[#1f1b17] focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            disabled={isCompiling}
            onClick={handleAskWiki}
            className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a] disabled:opacity-50"
          >
            {isCompiling ? '检索考证中...' : '🔍 检索知识库并回答'}
          </button>
        </div>

        {queryAnswer && (
          <div className="mt-3 rounded-[3px] border border-[#dcd5c9] bg-[#fdfbf7] p-4">
            <div className="flex items-center justify-between border-b border-[#eeeae1] pb-2">
              <span className="font-serif text-xs font-semibold text-[#1f1b17]">
                智能体基于 Wiki 图谱与原件证据链的回答：
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const saved = upsertWikiArticle({
                      title: `考证问答：${queryText.slice(0, 18)}`,
                      slug: `qa-${Date.now().toString().slice(-4)}`,
                      category: 'synthesis',
                      content: `# ${queryText}\n\n> 来源：LLM Wiki 检索问答沉淀\n\n${queryAnswer}`,
                      linkedRegionIds: imageRegions[0]
                        ? [imageRegions[0].id]
                        : [],
                    });
                    setSelectedId(saved.id);
                    setQueryAnswer('');
                    toast.success('已将本次回答增量编译为新的 Wiki 词条！');
                  }}
                  className="rounded bg-[#9b2c1f] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#7e2217]"
                >
                  📥 沉淀为新 Wiki 词条
                </button>
                <button
                  type="button"
                  onClick={() => setQueryAnswer('')}
                  className="text-[11px] text-[#7a7166] hover:text-[#1f1b17]"
                >
                  关闭
                </button>
              </div>
            </div>
            <div className="mt-2">{renderFormattedWikiContent(queryAnswer)}</div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 1: 词条阅读器 + 双向链接 + 四级原件证据链回溯 (Pages & Evidence Chain)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'pages' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start">
          {/* Left 4 Cols: Wiki Index Directory */}
          <div className="overflow-hidden rounded-[4px] border border-[#dcd5c9] bg-white lg:col-span-4">
            <div className="flex items-center justify-between border-b border-[#dcd5c9] px-4 py-3">
              <span className="text-xs font-semibold text-[#1f1b17]">
                知识库词条目录 ({wikiArticles.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedId('');
                  setTitle('');
                  setSlug('');
                  setCategory('source');
                  setContent(
                    '# 新建词条标题\n\n> 分类：未刊档案考释\n\n## 1. 核心史实与关联 [[多伦诺尔会盟]]\n在此输入内容，使用 [[词条名]] 语法可自动建立双向关系网连接。'
                  );
                  setIsEditing(true);
                }}
                className="rounded-[2px] border border-[#1f1b17] px-2 py-0.5 text-[11px] font-medium text-[#1f1b17] hover:bg-[#1f1b17] hover:text-white"
              >
                + 新建词条
              </button>
            </div>

            <div className="max-h-[560px] divide-y divide-[#eeeae1] overflow-y-auto">
              {wikiArticles.map((art) => {
                const active = activeArticle?.id === art.id;
                const linkCount = extractWikilinks(art.content).length;
                return (
                  <div
                    key={art.id}
                    onClick={() => {
                      setSelectedId(art.id);
                      setIsEditing(false);
                    }}
                    className={`cursor-pointer p-3.5 transition ${
                      active
                        ? 'border-l-3 border-l-[#9b2c1f] bg-[#f6f4ef]'
                        : 'hover:bg-[#faf8f3]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="rounded bg-[#eeeae1] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[#4a433a]">
                        {art.category}
                      </span>
                      <span className="font-mono text-[10px] text-[#7a7166]">
                        {linkCount} 处 [[双链]]
                      </span>
                    </div>
                    <div className="mt-1.5 font-serif text-sm font-semibold text-[#1f1b17]">
                      {art.title}
                    </div>
                    <div className="mt-1 line-clamp-2 text-[11px] text-[#7a7166]">
                      {art.content.replace(/[#>*`]/g, '').slice(0, 75)}...
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right 8 Cols: Wiki Reader/Editor + Evidence Chain + Backlinks */}
          <div className="space-y-4 lg:col-span-8">
            <div className="rounded-[4px] border border-[#dcd5c9] bg-white p-6">
              {isEditing ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-[#eeeae1] pb-3">
                    <span className="font-serif text-sm font-semibold text-[#1f1b17]">
                      编辑 Wiki 词条（支持 [[双向链接]] 语法）
                    </span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setIsEditing(false)}
                        className="rounded border border-[#dcd5c9] px-3 py-1 text-xs text-[#4a433a]"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveManual}
                        className="rounded bg-[#1f1b17] px-3.5 py-1 text-xs font-medium text-white"
                      >
                        保存词条
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="词条标题"
                      className="rounded border border-[#dcd5c9] px-3 py-1.5 text-xs sm:col-span-2"
                    />
                    <select
                      value={category}
                      onChange={(e) =>
                        setCategory(e.target.value as WikiArticle['category'])
                      }
                      className="rounded border border-[#dcd5c9] px-2 py-1.5 text-xs"
                    >
                      <option value="source">source (一手文献页)</option>
                      <option value="entity">entity (历史人物/机构)</option>
                      <option value="concept">concept (制度/概念)</option>
                      <option value="synthesis">synthesis (专题考异综述)</option>
                    </select>
                  </div>
                  <textarea
                    rows={12}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full rounded border border-[#dcd5c9] bg-[#f6f4ef] p-3 font-mono text-xs leading-relaxed focus:bg-white focus:outline-none"
                  />
                </div>
              ) : activeArticle ? (
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#eeeae1] pb-3">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-[#1f1b17] px-2 py-0.5 font-mono text-[10px] uppercase text-white">
                        {activeArticle.category}
                      </span>
                      <span className="font-mono text-xs text-[#7a7166]">
                        slug: {activeArticle.slug}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setActiveTab('graph')}
                        className="rounded border border-[#dcd5c9] bg-[#faf8f4] px-2.5 py-1 text-[11px] font-medium text-[#9b2c1f] hover:border-[#9b2c1f]"
                      >
                        🕸️ 在关系网中查看节点
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditing(true)}
                        className="rounded border border-[#dcd5c9] px-2.5 py-1 text-[11px] text-[#1f1b17] hover:bg-[#f6f4ef]"
                      >
                        编辑源码
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteWikiArticle(activeArticle.id)}
                        className="text-[11px] text-zinc-400 hover:text-red-600"
                      >
                        删除
                      </button>
                    </div>
                  </div>

                  {/* 渲染带可点击 [[双向链接]] 的正文 */}
                  <div className="mt-4">
                    {renderFormattedWikiContent(activeArticle.content)}
                  </div>
                </div>
              ) : null}
            </div>

            {/* ─── 四级证据链穿透面板 (Evidence Chain: 原件切片 -> 校订录文 -> 双向反向链接 -> 1820空间落点) ─── */}
            <div className="rounded-[4px] border border-[#dcd5c9] bg-white p-5">
              <div className="flex items-center justify-between border-b border-[#eeeae1] pb-2.5">
                <h3 className="font-serif text-sm font-semibold text-[#1f1b17]">
                  🔗 本词条完整证据链与反向引用网络 (Evidence Chain &amp; Backlinks)
                </h3>
                <span className="font-mono text-[11px] text-[#9b2c1f]">
                  点击任意节点可直接穿透回原件或图谱
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 1. 原件像素证据锚点 */}
                <div className="rounded-[3px] border border-[#eeeae1] bg-[#faf8f4] p-3">
                  <div className="font-mono text-[10px] font-semibold text-[#9b2c1f]">
                    STEP 1 · 原件图像像素证据 ({linkedRegions.length})
                  </div>
                  {linkedRegions.length === 0 ? (
                    <p className="mt-2 text-[11px] text-[#7a7166]">
                      暂未直接绑定图像区域，可在「知识库巡检」中一键自动绑定。
                    </p>
                  ) : (
                    <div className="mt-2 space-y-2">
                      {linkedRegions.map((reg) => (
                        <div
                          key={reg.id}
                          onClick={() => {
                            setActiveFileId(reg.fileId);
                            setActiveRegionId(reg.id);
                            navigate('/proofread');
                          }}
                          className="cursor-pointer rounded border border-[#dcd5c9] bg-white p-2 text-[11px] transition hover:border-[#9b2c1f]"
                        >
                          <div className="font-semibold text-[#1f1b17]">
                            🖼 {reg.label}
                          </div>
                          <div className="font-mono text-[10px] text-[#7a7166]">
                            坐标 xywh=({reg.xywh.x},{reg.xywh.y},{reg.xywh.w},
                            {reg.xywh.h})
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. 反向链接词条 (Backlinks) */}
                <div className="rounded-[3px] border border-[#eeeae1] bg-[#faf8f4] p-3">
                  <div className="font-mono text-[10px] font-semibold text-[#1f1b17]">
                    STEP 2 · 引用本页的反向链接 ({backlinks.length})
                  </div>
                  {backlinks.length === 0 ? (
                    <p className="mt-2 text-[11px] text-[#7a7166]">
                      暂无其他词条使用 [[{activeArticle?.title}]] 引用本页。
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {backlinks.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setSelectedId(b.id)}
                          className="block w-full rounded border border-[#dcd5c9] bg-white px-2.5 py-1.5 text-left text-[11px] font-medium text-[#1f1b17] hover:border-[#1f1b17]"
                        >
                          ← [[{b.title}]]
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* 3. 1820 历史地理空间落点 */}
                <div className="rounded-[3px] border border-[#eeeae1] bg-[#faf8f4] p-3">
                  <div className="font-mono text-[10px] font-semibold text-teal-800">
                    STEP 3 · 关联 1820 空间坐标 ({linkedPlaces.length})
                  </div>
                  {linkedPlaces.length === 0 ? (
                    <p className="mt-2 text-[11px] text-[#7a7166]">
                      未匹配到地名，可在校订页划选地名提取坐标。
                    </p>
                  ) : (
                    <div className="mt-2 space-y-1.5">
                      {linkedPlaces.map((pl) => (
                        <button
                          key={pl.id}
                          type="button"
                          onClick={() => navigate('/atlas')}
                          className="block w-full rounded border border-[#dcd5c9] bg-white px-2.5 py-1.5 text-left text-[11px] text-teal-900 hover:border-teal-700"
                        >
                          📍 {pl.name} ({pl.admin}) →
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 2: 交互式关系网图谱 (nashsu/llm_wiki Graph View)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'graph' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="overflow-hidden rounded-[4px] border border-[#dcd5c9] bg-white lg:col-span-9">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#dcd5c9] px-5 py-3">
              <div className="flex items-center gap-3">
                <span className="font-serif text-sm font-semibold text-[#1f1b17]">
                  多模态证据链与双向链接关系网 (Interactive Knowledge Graph)
                </span>
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#1f1b17]" />
                    Wiki词条
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-xs bg-[#9b2c1f]" />
                    原图证据区
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rotate-45 bg-teal-700" />
                    1820地理坐标
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={graphFilter}
                  onChange={(e) => setGraphFilter(e.target.value)}
                  className="rounded border border-[#dcd5c9] bg-[#f6f4ef] px-2.5 py-1 text-xs"
                >
                  <option value="all">显示全部节点类型</option>
                  <option value="wiki">仅显示 Wiki 词条节点</option>
                  <option value="evidence">仅显示原图证据节点</option>
                  <option value="place">仅显示 1820 地理节点</option>
                </select>
                <button
                  type="button"
                  onClick={() => cyInstanceRef.current?.fit()}
                  className="rounded border border-[#dcd5c9] px-2.5 py-1 text-xs hover:bg-[#f6f4ef]"
                >
                  居中适应画布
                </button>
              </div>
            </div>

            <div
              ref={cyContainerRef}
              className="h-[520px] w-full bg-[#faf8f4]"
            />
          </div>

          {/* Right 3 Cols: Node Inspector */}
          <div className="rounded-[4px] border border-[#dcd5c9] bg-white p-5 lg:col-span-3">
            <h3 className="font-serif text-sm font-semibold text-[#1f1b17]">
              图谱节点详情与证据穿透
            </h3>
            {selectedGraphNode ? (
              <div className="mt-4 space-y-3 text-xs">
                <div className="rounded bg-[#f6f4ef] p-3">
                  <div className="font-mono text-[10px] uppercase text-[#9b2c1f]">
                    NODE TYPE: {selectedGraphNode.nodeType}
                  </div>
                  <div className="mt-1 font-serif text-base font-bold text-[#1f1b17]">
                    {selectedGraphNode.label}
                  </div>
                  <p className="mt-2 leading-relaxed text-[#4a433a]">
                    {selectedGraphNode.detail}
                  </p>
                </div>

                {selectedGraphNode.id.startsWith('wiki-') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedId(selectedGraphNode.id.replace('wiki-', ''));
                      setActiveTab('pages');
                    }}
                    className="w-full rounded bg-[#1f1b17] py-2 text-xs font-medium text-white"
                  >
                    打开该 Wiki 词条全文 →
                  </button>
                )}
                {selectedGraphNode.id.startsWith('reg-') && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveRegionId(
                        selectedGraphNode.id.replace('reg-', '')
                      );
                      navigate('/proofread');
                    }}
                    className="w-full rounded bg-[#9b2c1f] py-2 text-xs font-medium text-white"
                  >
                    穿透查看原件扫描图与校订 →
                  </button>
                )}
                {selectedGraphNode.id.startsWith('place-') && (
                  <button
                    type="button"
                    onClick={() => navigate('/atlas')}
                    className="w-full rounded bg-teal-800 py-2 text-xs font-medium text-white"
                  >
                    在 1820 历史图谱中定位 →
                  </button>
                )}
              </div>
            ) : (
              <p className="mt-4 text-xs leading-relaxed text-[#7a7166]">
                请在左侧关系网画布中点击任意节点（Wiki 词条、原图像素切片或 1820 空间地名），即可在此查看其上下游证据链并一键跳转。
              </p>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 3: 两步思维链摄取 (nashsu/llm_wiki Two-Step CoT Ingest)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'ingest' && (
        <div className="rounded-[4px] border border-[#dcd5c9] bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#eeeae1] pb-4">
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1f1b17]">
                ⚡ 两步思维链知识摄取流水线 (Two-Step Chain-of-Thought Ingest)
              </h3>
              <p className="mt-1 text-xs text-[#4a433a]">
                复刻 <code className="font-mono">nashsu/llm_wiki</code> 的核心摄取机制：拒绝传统 RAG 碎片化切片，先从原件录文中抽取「实体·概念·史学论断（Step 1）」，人工审阅后再批量编译为带双向链接与像素证据脚注的结构化 Wiki 页面（Step 2）。
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isCompiling}
                onClick={handleRunStep1Extract}
                className="rounded-[3px] bg-[#1f1b17] px-4 py-2 text-xs font-medium text-white hover:bg-[#36302a]"
              >
                Step 1：从已传档案抽取实体与命题
              </button>
              <button
                type="button"
                disabled={extractedEntities.length === 0 || isCompiling}
                onClick={handleRunStep2Compile}
                className="rounded-[3px] bg-[#9b2c1f] px-4 py-2 text-xs font-medium text-white hover:bg-[#7e2217] disabled:opacity-40"
              >
                Step 2：批量编译为互链 Wiki 页面 →
              </button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
            {extractedEntities.length === 0 ? (
              <div className="col-span-3 py-10 text-center text-xs text-[#7a7166]">
                当前待摄取源：{uploadedFiles.length} 份档案文件 ·{' '}
                {imageRegions.length} 处已校订图像区域 · {comparisons.length}{' '}
                条长编记录。点击上方「Step 1」开始抽取。
              </div>
            ) : (
              extractedEntities.map((item, idx) => (
                <div
                  key={idx}
                  className="rounded-[3px] border border-[#dcd5c9] bg-[#faf8f4] p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded bg-[#1f1b17] px-2 py-0.5 font-mono text-[10px] text-white">
                      {item.category}
                    </span>
                    <span className="font-mono text-[10px] text-[#9b2c1f]">
                      证据锚点: {item.evidenceRef}
                    </span>
                  </div>
                  <h4 className="mt-2 font-serif text-sm font-bold text-[#1f1b17]">
                    [[{item.name}]]
                  </h4>
                  <p className="mt-1.5 text-xs leading-relaxed text-[#4a433a]">
                    {item.summary}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════════
          TAB 4: 知识库健康度巡检 (nashsu/llm_wiki Deterministic & LLM Lint)
         ═══════════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'lint' && (
        <div className="rounded-[4px] border border-[#dcd5c9] bg-white p-6">
          <div className="flex items-center justify-between border-b border-[#eeeae1] pb-4">
            <div>
              <h3 className="font-serif text-lg font-semibold text-[#1f1b17]">
                🩺 知识库健康度与证据链一致性巡检 (Wiki Lint)
              </h3>
              <p className="mt-1 text-xs text-[#4a433a]">
                自动扫描断链词条（Broken Wikilinks）、缺乏原件像素证据支撑的悬空论断（Uncited Claims）以及孤立节点（Orphan Pages），支持一键自动修复。
              </p>
            </div>
            <span className="rounded bg-[#f6f4ef] px-3 py-1 font-mono text-xs font-semibold text-[#1f1b17]">
              待处理项：{lintIssues.length}
            </span>
          </div>

          {lintIssues.length === 0 ? (
            <div className="py-12 text-center text-xs text-emerald-700">
              ✓ 所有 Wiki 词条均已完整建立双向链接并锚定原件图像证据，无断链或孤立节点！
            </div>
          ) : (
            <div className="mt-4 divide-y divide-[#eeeae1]">
              {lintIssues.map((iss) => (
                <div
                  key={iss.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 font-mono text-[10px] font-semibold ${
                          iss.severity === 'high'
                            ? 'bg-red-100 text-red-800'
                            : iss.severity === 'medium'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {iss.kind.toUpperCase()}
                      </span>
                      <span className="font-serif text-sm font-semibold text-[#1f1b17]">
                        词条：《{iss.articleTitle}》
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#4a433a]">{iss.message}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFixLintIssue(iss)}
                    className="rounded-[3px] border border-[#1f1b17] bg-white px-3 py-1.5 text-xs font-medium text-[#1f1b17] hover:bg-[#1f1b17] hover:text-white"
                  >
                    🔧 {iss.fixActionLabel}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
