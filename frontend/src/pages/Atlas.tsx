import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet.heat';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import {
  useWorkbench,
  MapPlace,
  MapEventType,
  PlaceConfidence,
} from '../store';
import { MapLibreDeckAtlas } from '../components/MapLibreDeckAtlas';
import { toast } from 'sonner';

type ViewMode = 'space' | 'repo' | 'route' | 'heat';

const VIEWS: { key: ViewMode; label: string; hint: string }[] = [
  { key: 'space', label: '历史空间', hint: 'CHGIS 疆域 + 历史地名' },
  { key: 'repo', label: '采获与馆藏', hint: '文献从哪来、藏在哪' },
  { key: 'route', label: '流转路线', hint: '时间轴 + 路线动画' },
  { key: 'heat', label: '热力与统计', hint: '地名被引用密度' },
];

const CONF_LABEL: Record<PlaceConfidence, string> = {
  explicit: '原文直接记载',
  verified: '学者核定',
  inferred: '智能体推测待核',
};

const CONF_COLOR: Record<PlaceConfidence, string> = {
  explicit: '#1f1b17',
  verified: '#9b2c1f',
  inferred: '#b08d57',
};

const EVENT_TYPES: MapEventType[] = ['采购', '入藏', '译写', '会盟', '通信', '其他'];

export const Atlas: React.FC = () => {
  const {
    catalogEntries,
    imageRegions,
    mapPlaces,
    addMapPlace,
    deleteMapPlace,
    mapEvents,
    addMapEvent,
    deleteMapEvent,
    setActiveFileId,
    setActiveRegionId,
    apiConfig,
  } = useWorkbench();
  const navigate = useNavigate();

  const mapElRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const baseRef = useRef<L.TileLayer | null>(null);
  const labelRef = useRef<L.TileLayer | null>(null);
  const chgisRef = useRef<L.GeoJSON | null>(null);
  const overlayRef = useRef<L.LayerGroup | null>(null);

  const [view, setView] = useState<ViewMode>('space');
  const [baseStyle, setBaseStyle] = useState<'vec' | 'ter' | 'img'>('ter');
  const [showChgis, setShowChgis] = useState(true);
  const [chgisData, setChgisData] = useState<GeoJSON.GeoJsonObject | null>(null);
  const [engineMode, setEngineMode] = useState<'2d' | '3d'>('3d');

  const [clickMode, setClickMode] = useState(false);
  const clickModeRef = useRef(false);
  clickModeRef.current = clickMode;

  // filters
  const [confFilter, setConfFilter] = useState<Record<PlaceConfidence, boolean>>({
    explicit: true,
    verified: true,
    inferred: true,
  });
  const [onlyLinked, setOnlyLinked] = useState(false);

  // timeline
  const [year, setYear] = useState<number>(0);
  const [playing, setPlaying] = useState(false);

  // place form
  const [pName, setPName] = useState('');
  const [pAlias, setPAlias] = useState('');
  const [pLat, setPLat] = useState('');
  const [pLng, setPLng] = useState('');
  const [pAdmin, setPAdmin] = useState('');
  const [pBasis, setPBasis] = useState('');
  const [pConf, setPConf] = useState<PlaceConfidence>('inferred');
  const [pKind, setPKind] = useState<'place' | 'repository'>('place');
  const [pYear, setPYear] = useState('');
  const [pRegion, setPRegion] = useState('');
  const [pCatalog, setPCatalog] = useState('');
  const [pNote, setPNote] = useState('');

  // event form
  const [eType, setEType] = useState<MapEventType>('采购');
  const [eFrom, setEFrom] = useState('');
  const [eTo, setETo] = useState('');
  const [eStart, setEStart] = useState('');
  const [eEnd, setEEnd] = useState('');
  const [eRegion, setERegion] = useState('');
  const [eNote, setENote] = useState('');

  const [panel, setPanel] = useState<'place' | 'event' | 'list'>('list');

  const placeById = useMemo(() => {
    const m = new Map<string, MapPlace>();
    mapPlaces.forEach((p) => m.set(p.id, p));
    return m;
  }, [mapPlaces]);

  const visiblePlaces = useMemo(
    () =>
      mapPlaces.filter((p) => {
        if (!confFilter[p.confidence]) return false;
        if (onlyLinked && !p.regionId) return false;
        return true;
      }),
    [mapPlaces, confFilter, onlyLinked]
  );

  // year bounds
  const [minYear, maxYear] = useMemo(() => {
    const ys: number[] = [];
    mapEvents.forEach((e) => ys.push(e.yearStart, e.yearEnd));
    mapPlaces.forEach((p) => p.year && ys.push(p.year));
    if (ys.length === 0) return [1800, 1950];
    return [Math.min(...ys), Math.max(...ys)];
  }, [mapEvents, mapPlaces]);

  useEffect(() => {
    setYear(maxYear);
  }, [minYear, maxYear]);

  useEffect(() => {
    if (!playing) return;
    if (year >= maxYear) setYear(minYear);
    const t = setInterval(() => {
      setYear((y) => {
        if (y >= maxYear) {
          setPlaying(false);
          return maxYear;
        }
        return y + Math.max(1, Math.round((maxYear - minYear) / 100));
      });
    }, 120);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, minYear, maxYear]);

  useEffect(() => {
    fetch('/maps/chgis_1820_qing.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setChgisData(d))
      .catch(() => {});
  }, []);

  // init map
  useEffect(() => {
    if (!mapElRef.current || mapRef.current) return;
    const map = L.map(mapElRef.current, { center: [36, 104], zoom: 4 });
    map.on('click', (e: L.LeafletMouseEvent) => {
      if (clickModeRef.current) {
        setPLat(e.latlng.lat.toFixed(4));
        setPLng(e.latlng.lng.toFixed(4));
        toast.success(`已拾取坐标 (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`);
      }
    });
    overlayRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // base layers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const tk = apiConfig.tiandituKey;
    const sub = ['0', '1', '2', '3', '4', '5', '6', '7'];
    const mk = (layer: string) =>
      `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`;
    const lbl = baseStyle === 'vec' ? 'cva' : baseStyle === 'ter' ? 'cta' : 'cia';
    if (baseRef.current) map.removeLayer(baseRef.current);
    if (labelRef.current) map.removeLayer(labelRef.current);
    baseRef.current = L.tileLayer(mk(baseStyle), { subdomains: sub, maxZoom: 18 }).addTo(map);
    labelRef.current = L.tileLayer(mk(lbl), { subdomains: sub, maxZoom: 18 }).addTo(map);
    baseRef.current.bringToBack();
  }, [baseStyle, apiConfig.tiandituKey]);

  // CHGIS layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (chgisRef.current) {
      map.removeLayer(chgisRef.current);
      chgisRef.current = null;
    }
    if (showChgis && chgisData) {
      chgisRef.current = L.geoJSON(chgisData, {
        style: () => ({
          color: '#7a7166',
          weight: 1.4,
          fillColor: '#b08d57',
          fillOpacity: 0.08,
        }),
        onEachFeature: (f, layer) => {
          const p = (f.properties || {}) as Record<string, string>;
          layer.bindPopup(
            `<div style="font-size:12px"><b>${p.name_zh || p.name || '政区'}</b><br/>${p.admin_type || ''} ${p.year || ''}</div>`
          );
        },
      }).addTo(map);
      chgisRef.current.bringToBack();
    }
  }, [showChgis, chgisData]);

  const openEvidence = (regionId: string) => {
    const reg = imageRegions.find((r) => r.id === regionId);
    if (!reg) {
      toast.error('关联的图像证据区域已不存在');
      return;
    }
    setActiveFileId(reg.fileId);
    setActiveRegionId(reg.id);
    navigate('/reader');
  };

  const popupFor = (p: MapPlace): HTMLElement => {
    const el = document.createElement('div');
    el.style.fontSize = '12px';
    el.style.minWidth = '180px';
    const reg = imageRegions.find((r) => r.id === p.regionId);
    el.innerHTML = `<div style="font-weight:600;font-size:13px">${p.name}${
      p.alias ? ` <span style="color:#7a7166;font-weight:400">(${p.alias})</span>` : ''
    }</div>
    <div style="color:#7a7166;margin-top:2px">${p.admin || '政区未填'}${p.year ? ' · ' + p.year : ''}</div>
    <div style="margin-top:4px"><span style="color:${CONF_COLOR[p.confidence]}">● ${CONF_LABEL[p.confidence]}</span></div>
    <div style="margin-top:2px;color:#4a433a">坐标依据：${p.basis || '未填'}</div>
    ${p.note ? `<div style="margin-top:2px">${p.note}</div>` : ''}`;
    if (reg) {
      const btn = document.createElement('button');
      btn.textContent = '在阅读台打开原图 →';
      btn.style.cssText =
        'margin-top:8px;padding:4px 8px;font-size:11px;background:#1f1b17;color:#fff;border:0;border-radius:3px;cursor:pointer';
      btn.onclick = () => openEvidence(reg.id);
      el.appendChild(btn);
    } else {
      const warn = document.createElement('div');
      warn.style.cssText = 'margin-top:6px;color:#9b2c1f';
      warn.textContent = '未关联原图证据';
      el.appendChild(warn);
    }
    return el;
  };

  // overlay (markers / routes / heat) according to view
  useEffect(() => {
    const map = mapRef.current;
    const group = overlayRef.current;
    if (!map || !group) return;
    group.clearLayers();

    const markerFor = (p: MapPlace, idx = 0) => {
      const m = L.circleMarker([p.lat, p.lng], {
        radius: p.kind === 'repository' ? 8 : 6.5,
        color: '#fffefb',
        weight: 2,
        fillColor: CONF_COLOR[p.confidence],
        fillOpacity: 0.95,
      });
      m.bindPopup(() => popupFor(p));
      const shortSummary = (p.note || p.basis || '')
        .replace(/^魏特夫\s*/, '')
        .slice(0, 26);
      const dir =
        p.id === 'PLC-KAW-02'
          ? 'left'
          : p.id === 'PLC-KAW-04'
          ? 'bottom'
          : idx % 2 === 0
          ? 'right'
          : 'top';
      m.bindTooltip(
        `<div style="font-family:'Noto Serif SC',serif;line-height:1.3;padding:1px 2px;">
          <div style="font-weight:700;font-size:11.5px;color:#1f1b17;">${p.name.split('（')[0]}${
          p.year ? ` <span style="color:#9b2c1f;font-family:monospace;font-size:10px;">[${p.year}]</span>` : ''
        }</div>
          <div style="font-size:10px;color:#4a433a;max-width:190px;white-space:normal;">${shortSummary}…</div>
        </div>`,
        {
          permanent: true,
          direction: dir,
          offset: dir === 'left' ? [-8, 0] : dir === 'right' ? [8, 0] : [0, -6],
          opacity: 0.96,
        }
      );
      return m;
    };

    if (view === 'space' || view === 'repo') {
      const list = visiblePlaces.filter((p) =>
        view === 'repo' ? p.kind === 'repository' : true
      );
      list.forEach((p, idx) => group.addLayer(markerFor(p, idx)));
    }

    if (view === 'heat') {
      const pts: [number, number, number][] = visiblePlaces.map((p) => {
        const refs = imageRegions.filter((r) => r.id === p.regionId).length;
        return [p.lat, p.lng, 0.4 + refs * 0.6];
      });
      if (pts.length > 0) {
        group.addLayer(
          (
            L as unknown as {
              heatLayer: (
                p: [number, number, number][],
                o: Record<string, number>
              ) => L.Layer;
            }
          ).heatLayer(pts, { radius: 32, blur: 24, maxZoom: 8 })
        );
      }
      visiblePlaces.forEach((p, idx) => group.addLayer(markerFor(p, idx)));
    }

    if (view === 'route') {
      const used = new Set<string>();
      mapEvents.forEach((e) => {
        if (e.yearStart > year) return;
        const a = placeById.get(e.fromPlaceId);
        const b = placeById.get(e.toPlaceId);
        if (!a || !b) return;
        const span = Math.max(1, e.yearEnd - e.yearStart);
        const frac = Math.min(1, (year - e.yearStart) / span);
        const lat = a.lat + (b.lat - a.lat) * frac;
        const lng = a.lng + (b.lng - a.lng) * frac;
        const line = L.polyline(
          [
            [a.lat, a.lng],
            [lat, lng],
          ],
          { color: '#9b2c1f', weight: 3, opacity: 0.9, dashArray: frac < 1 ? '6 6' : undefined }
        );
        line.bindTooltip(
          `<div style="font-size:11px;font-weight:600;color:#9b2c1f;">📜 ${e.yearStart}–${e.yearEnd} ${e.type}：${(e.note || '').slice(0, 22)}…</div>`,
          { permanent: true, direction: 'center' }
        );
        line.on('click', () => {
          if (e.regionId) openEvidence(e.regionId);
        });
        group.addLayer(line);
        used.add(a.id);
        if (frac >= 1) used.add(b.id);
      });
      Array.from(used).forEach((id, idx) => {
        const p = placeById.get(id);
        if (p) group.addLayer(markerFor(p, idx));
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, visiblePlaces, mapEvents, year, imageRegions, placeById]);

  const submitPlace = (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(pLat);
    const lng = parseFloat(pLng);
    if (!pName.trim() || Number.isNaN(lat) || Number.isNaN(lng)) {
      toast.error('请填写地名与有效经纬度（可开启地图点选拾取）');
      return;
    }
    addMapPlace({
      name: pName.trim(),
      alias: pAlias.trim(),
      lat,
      lng,
      admin: pAdmin.trim(),
      basis: pBasis.trim(),
      confidence: pConf,
      kind: pKind,
      year: pYear ? parseInt(pYear, 10) : undefined,
      regionId: pRegion,
      catalogId: pCatalog,
      note: pNote.trim(),
    });
    setPName('');
    setPAlias('');
    setPNote('');
    setPBasis('');
    toast.success('已添加地名');
  };

  const submitEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const ys = parseInt(eStart, 10);
    const ye = parseInt(eEnd || eStart, 10);
    if (!eFrom || !eTo || Number.isNaN(ys) || Number.isNaN(ye)) {
      toast.error('请选择起点、终点并填写年份');
      return;
    }
    addMapEvent({
      type: eType,
      fromPlaceId: eFrom,
      toPlaceId: eTo,
      yearStart: ys,
      yearEnd: Math.max(ys, ye),
      regionId: eRegion,
      note: eNote.trim(),
    });
    setENote('');
    toast.success('已登记流转事件');
    setView('route');
  };

  const inputCls =
    'mt-1 w-full rounded-[3px] border border-[var(--line)] bg-white px-2.5 py-1.5 text-xs text-[var(--ink)] focus:border-[var(--ink)] focus:outline-none';
  const labelCls = 'block text-[11px] font-medium text-[var(--ink-secondary)]';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="kh-eyebrow">3.2 · HISTORICAL ATLAS</div>
          <h1 className="mt-1 font-serif text-3xl font-semibold text-[var(--ink)]">
            历史地理图谱
          </h1>
          <p className="mt-1.5 max-w-2xl text-sm text-[var(--ink-secondary)]">
            地图上的每个点和每条线都应能追溯到具体档案与原图框选区域；坐标按可信度分级标注。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] p-1">
            <button
              type="button"
              onClick={() => setEngineMode('2d')}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition ${
                engineMode === '2d'
                  ? 'bg-[var(--ink)] text-white'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
              }`}
            >
              2D 学术图谱 (Leaflet)
            </button>
            <button
              type="button"
              onClick={() => setEngineMode('3d')}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-medium transition ${
                engineMode === '3d'
                  ? 'bg-[var(--seal)] text-white'
                  : 'text-[var(--ink-secondary)] hover:text-[var(--ink)]'
              }`}
            >
              ✨ 3D 时空流动 (deck.gl)
            </button>
          </div>

          <div className="inline-flex rounded-[3px] border border-[var(--line)] bg-[var(--sheet)] p-1">
            {(
              [
                ['ter', '地形'],
                ['vec', '矢量'],
                ['img', '影像'],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setBaseStyle(k)}
                className={`rounded-[2px] px-2.5 py-1 text-xs font-medium ${
                  baseStyle === k
                    ? 'bg-[var(--ink)] text-white'
                    : 'text-[var(--ink-secondary)]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* View switcher */}
      <div className="grid grid-cols-2 border-t border-b border-[var(--ink)] bg-[var(--sheet)] md:grid-cols-4">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setView(v.key)}
            className={`border-l-2 px-4 py-2.5 text-left first:border-l-0 md:border-l md:first:border-l-0 ${
              view === v.key
                ? 'bg-[var(--seal-soft)] shadow-[inset_0_-2px_0_var(--seal)]'
                : 'hover:bg-[#faf8f3]'
            }`}
          >
            <div
              className={`text-[13px] font-semibold ${
                view === v.key ? 'text-[var(--seal)]' : 'text-[var(--ink)]'
              }`}
            >
              {v.label}
            </div>
            <div className="text-[11px] text-[var(--ink-muted)]">{v.hint}</div>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-start">
        {/* Map column */}
        <div className="lg:col-span-8">
          <div className="overflow-hidden rounded-[4px] border border-[var(--line)] bg-[var(--sheet)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[var(--line)] px-4 py-2.5 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={showChgis}
                  onChange={(e) => setShowChgis(e.target.checked)}
                />
                CHGIS 疆域层
              </label>
              <span className="text-[var(--line)]">|</span>
              {(Object.keys(CONF_LABEL) as PlaceConfidence[]).map((c) => (
                <label key={c} className="flex items-center gap-1.5">
                  <input
                    type="checkbox"
                    checked={confFilter[c]}
                    onChange={(e) =>
                      setConfFilter((f) => ({ ...f, [c]: e.target.checked }))
                    }
                  />
                  <span style={{ color: CONF_COLOR[c] }}>●</span>
                  {CONF_LABEL[c]}
                </label>
              ))}
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={onlyLinked}
                  onChange={(e) => setOnlyLinked(e.target.checked)}
                />
                仅显示已关联原图
              </label>
              <button
                type="button"
                onClick={() => setClickMode((v) => !v)}
                className={`ml-auto rounded-[3px] px-2.5 py-1 ${
                  clickMode
                    ? 'bg-[var(--seal)] text-white'
                    : 'border border-[var(--line)] text-[var(--ink-secondary)]'
                }`}
              >
                {clickMode ? '点选坐标中…' : '点选拾取坐标'}
              </button>
            </div>

            {engineMode === '3d' ? (
              <MapLibreDeckAtlas
                places={visiblePlaces}
                events={mapEvents}
                imageRegions={imageRegions}
                currentYear={year}
                tiandituKey={apiConfig.tiandituKey}
                baseStyle={baseStyle}
                showChgis={showChgis}
                viewMode={view}
                onSelectPlace={(p) => {
                  setPName(p.name);
                  setPLat(String(p.lat));
                  setPLng(String(p.lng));
                  setPAdmin(p.admin);
                  setPBasis(p.basis);
                  setPanel('place');
                }}
                onOpenEvidence={(regId) => openEvidence(regId)}
              />
            ) : (
              <div ref={mapElRef} className="h-[520px] w-full" />
            )}

            {/* Timeline */}
            <div className="flex items-center gap-3 border-t border-[var(--line)] px-4 py-3">
              <button
                type="button"
                onClick={() => setPlaying((p) => !p)}
                disabled={mapEvents.length === 0}
                className="w-16 rounded-[3px] bg-[var(--ink)] py-1 text-xs text-white disabled:opacity-40"
              >
                {playing ? '暂停' : '播放'}
              </button>
              <span className="font-mono text-[11px] text-[var(--ink-muted)]">{minYear}</span>
              <input
                type="range"
                min={minYear}
                max={maxYear}
                value={year}
                onChange={(e) => {
                  setPlaying(false);
                  setYear(parseInt(e.target.value, 10));
                }}
                className="flex-1 accent-[#9b2c1f]"
              />
              <span className="font-mono text-[11px] text-[var(--ink-muted)]">{maxYear}</span>
              <span className="w-16 text-right font-mono text-sm font-semibold text-[var(--seal)]">
                {year}
              </span>
            </div>
          </div>
          {view === 'route' && mapEvents.length === 0 && (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              暂无流转事件。在右侧「流转事件」标签中先添加至少两个地名，再登记事件。
            </p>
          )}
          {view === 'heat' && mapPlaces.length === 0 && (
            <p className="mt-2 text-xs text-[var(--ink-muted)]">
              热力图以地名关联的图像证据数量为权重，请先添加地名并关联原图证据。
            </p>
          )}
        </div>

        {/* Side panel */}
        <div className="rounded-[4px] border border-[var(--line)] bg-[var(--sheet)] lg:col-span-4">
          <div className="flex border-b border-[var(--line)] text-xs">
            {(
              [
                ['place', '添加地名'],
                ['event', '流转事件'],
                ['list', `已录入 (${mapPlaces.length})`],
              ] as const
            ).map(([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => setPanel(k)}
                className={`flex-1 px-3 py-2.5 font-medium ${
                  panel === k
                    ? 'border-b-2 border-[var(--seal)] text-[var(--ink)]'
                    : 'text-[var(--ink-muted)]'
                }`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {panel === 'place' && (
            <form onSubmit={submitPlace} className="space-y-2.5 p-4">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>地名 / 机构</label>
                  <input className={inputCls} value={pName} onChange={(e) => setPName(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>别名 / 外文名</label>
                  <input className={inputCls} value={pAlias} onChange={(e) => setPAlias(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>纬度</label>
                  <input className={`${inputCls} font-mono`} value={pLat} onChange={(e) => setPLat(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>经度</label>
                  <input className={`${inputCls} font-mono`} value={pLng} onChange={(e) => setPLng(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>类型</label>
                  <select className={inputCls} value={pKind} onChange={(e) => setPKind(e.target.value as 'place' | 'repository')}>
                    <option value="place">历史地名</option>
                    <option value="repository">馆藏机构</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>年份（可选）</label>
                  <input className={`${inputCls} font-mono`} value={pYear} onChange={(e) => setPYear(e.target.value)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>清代政区归属</label>
                <input className={inputCls} value={pAdmin} onChange={(e) => setPAdmin(e.target.value)} />
              </div>
              <div>
                <label className={labelCls}>坐标依据</label>
                <input
                  className={inputCls}
                  value={pBasis}
                  onChange={(e) => setPBasis(e.target.value)}
                  placeholder="如：CHGIS 点位 / 现地名对应 / 研究者判断"
                />
              </div>
              <div>
                <label className={labelCls}>可信度</label>
                <select className={inputCls} value={pConf} onChange={(e) => setPConf(e.target.value as PlaceConfidence)}>
                  {(Object.keys(CONF_LABEL) as PlaceConfidence[]).map((c) => (
                    <option key={c} value={c}>
                      {CONF_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>关联原图证据区域</label>
                <select className={inputCls} value={pRegion} onChange={(e) => setPRegion(e.target.value)}>
                  <option value="">不关联</option>
                  {imageRegions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>关联馆藏条目</label>
                <select className={inputCls} value={pCatalog} onChange={(e) => setPCatalog(e.target.value)}>
                  <option value="">不关联</option>
                  {catalogEntries.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>备注</label>
                <textarea rows={2} className={inputCls} value={pNote} onChange={(e) => setPNote(e.target.value)} />
              </div>
              <button type="submit" className="w-full rounded-[3px] bg-[var(--ink)] py-2 text-xs font-medium text-white hover:bg-zinc-800">
                添加到地图
              </button>
            </form>
          )}

          {panel === 'event' && (
            <form onSubmit={submitEvent} className="space-y-2.5 p-4">
              {mapPlaces.length < 2 && (
                <div className="rounded-[3px] bg-[var(--seal-soft)] p-2 text-[11px] text-[var(--seal)]">
                  需要至少 2 个地名才能登记事件。
                </div>
              )}
              <div>
                <label className={labelCls}>事件类型</label>
                <select className={inputCls} value={eType} onChange={(e) => setEType(e.target.value as MapEventType)}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className={labelCls}>起点</label>
                  <select className={inputCls} value={eFrom} onChange={(e) => setEFrom(e.target.value)}>
                    <option value="">选择</option>
                    {mapPlaces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>终点</label>
                  <select className={inputCls} value={eTo} onChange={(e) => setETo(e.target.value)}>
                    <option value="">选择</option>
                    {mapPlaces.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>起始年</label>
                  <input className={`${inputCls} font-mono`} value={eStart} onChange={(e) => setEStart(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls}>结束年</label>
                  <input className={`${inputCls} font-mono`} value={eEnd} onChange={(e) => setEEnd(e.target.value)} placeholder="同起始年" />
                </div>
              </div>
              <div>
                <label className={labelCls}>依据的原图证据</label>
                <select className={inputCls} value={eRegion} onChange={(e) => setERegion(e.target.value)}>
                  <option value="">不关联</option>
                  {imageRegions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>说明</label>
                <textarea rows={2} className={inputCls} value={eNote} onChange={(e) => setENote(e.target.value)} />
              </div>
              <button type="submit" className="w-full rounded-[3px] bg-[var(--ink)] py-2 text-xs font-medium text-white hover:bg-zinc-800">
                登记事件
              </button>
            </form>
          )}

          {panel === 'list' && (
            <div className="max-h-[620px] space-y-4 overflow-y-auto p-4">
              <div>
                <div className="kh-eyebrow">
                  已锚定史料空间节点 ({mapPlaces.length})
                </div>
                {mapPlaces.length === 0 ? (
                  <p className="py-4 text-xs text-[var(--ink-muted)]">暂无。</p>
                ) : (
                  <ul className="mt-2.5 space-y-2.5">
                    {mapPlaces.map((p) => {
                      const reg = imageRegions.find((r) => r.id === p.regionId);
                      return (
                        <li
                          key={p.id}
                          className="rounded-[3px] border border-[var(--line)] bg-[#fcfaf5] p-3 text-xs transition hover:border-[var(--ink)]"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              className="text-left"
                              onClick={() =>
                                mapRef.current?.setView([p.lat, p.lng], 6)
                              }
                            >
                              <span
                                style={{ color: CONF_COLOR[p.confidence] }}
                              >
                                ●{' '}
                              </span>
                              <span className="font-serif font-semibold text-[var(--ink)]">
                                {p.name}
                              </span>
                              {p.year && (
                                <span className="ml-1.5 rounded bg-[#eeeae1] px-1.5 py-0.2 font-mono text-[10px] font-semibold text-[var(--seal)]">
                                  {p.year}年
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteMapPlace(p.id)}
                              className="shrink-0 text-[10px] text-[var(--ink-muted)] hover:text-[var(--seal)]"
                            >
                              删除
                            </button>
                          </div>

                          <div className="mt-1 font-mono text-[10.5px] text-[var(--ink-muted)]">
                            {p.admin || '清代政区'} · ({p.lat.toFixed(2)},{' '}
                            {p.lng.toFixed(2)})
                          </div>

                          {(p.note || p.basis) && (
                            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-secondary)]">
                              {p.note || p.basis}
                            </p>
                          )}

                          <div className="mt-2 flex items-center justify-between border-t border-[#ece6da] pt-1.5 text-[10.5px]">
                            <span className="truncate text-[var(--ink-muted)]">
                              依据：{p.basis.slice(0, 24)}
                            </span>
                            {reg && (
                              <button
                                type="button"
                                onClick={() => openEvidence(reg.id)}
                                className="shrink-0 font-semibold text-[var(--seal)] hover:underline"
                              >
                                📄 打开原件图像 →
                              </button>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              <div className="border-t border-[var(--line)] pt-4">
                <div className="kh-eyebrow">
                  时空流转与历史事件轨迹 ({mapEvents.length})
                </div>
                {mapEvents.length === 0 ? (
                  <p className="py-4 text-xs text-[var(--ink-muted)]">暂无。</p>
                ) : (
                  <ul className="mt-2.5 space-y-2.5">
                    {mapEvents.map((ev) => {
                      const reg = imageRegions.find(
                        (r) => r.id === ev.regionId
                      );
                      return (
                        <li
                          key={ev.id}
                          className="rounded-[3px] border border-[var(--line)] bg-white p-3 text-xs"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-[var(--ink)]">
                              <span className="mr-1.5 rounded bg-[var(--seal)] px-1.5 py-0.5 font-mono text-[10px] text-white">
                                {ev.yearStart}
                                {ev.yearEnd !== ev.yearStart
                                  ? `–${ev.yearEnd}`
                                  : ''}
                              </span>
                              {placeById.get(ev.fromPlaceId)?.name.split('（')[0]}{' '}
                              →{' '}
                              {placeById.get(ev.toPlaceId)?.name.split('（')[0]}
                            </span>
                            <button
                              type="button"
                              onClick={() => deleteMapEvent(ev.id)}
                              className="shrink-0 text-[10px] text-[var(--ink-muted)] hover:text-[var(--seal)]"
                            >
                              删除
                            </button>
                          </div>
                          {ev.note && (
                            <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--ink-secondary)]">
                              {ev.note}
                            </p>
                          )}
                          {reg && (
                            <button
                              type="button"
                              onClick={() => openEvidence(reg.id)}
                              className="mt-1.5 inline-block text-[10.5px] font-semibold text-[var(--seal)] hover:underline"
                            >
                              📄 调阅轨迹关联原图：{reg.label.split('·')[0].trim()} →
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
