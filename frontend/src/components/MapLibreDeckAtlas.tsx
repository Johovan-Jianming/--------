import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { ArcLayer, ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import { MapPlace, MapEvent, ImageEvidenceRegion } from '../store';

interface MapLibreDeckAtlasProps {
  places: MapPlace[];
  events: MapEvent[];
  imageRegions: ImageEvidenceRegion[];
  currentYear: number;
  tiandituKey: string;
  baseStyle: 'vec' | 'ter' | 'img';
  showChgis: boolean;
  viewMode: 'space' | 'repo' | 'route' | 'heat';
  onSelectPlace?: (place: MapPlace) => void;
  onOpenEvidence?: (regionId: string) => void;
}

export const MapLibreDeckAtlas: React.FC<MapLibreDeckAtlasProps> = ({
  places,
  events,
  imageRegions,
  currentYear,
  tiandituKey,
  baseStyle,
  showChgis,
  viewMode,
  onSelectPlace,
  onOpenEvidence,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapLibreOverlay | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);

  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    confidence?: string;
    basis?: string;
    note?: string;
    regionId?: string;
  } | null>(null);

  const [pitch, setPitch] = useState<number>(42);
  const [labelMode, setLabelMode] = useState<'rich' | 'compact' | 'hidden'>('rich');
  const [activePlaceId, setActivePlaceId] = useState<string>(places[0]?.id || '');

  // Initialize MapLibre
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const tk = tiandituKey || '47bbf45b9b9f709d7f2840b6e0c01be2';
    const layerName = baseStyle;
    const labelLayer =
      baseStyle === 'vec' ? 'cva' : baseStyle === 'ter' ? 'cta' : 'cia';

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          'tdt-base': {
            type: 'raster',
            tiles: [
              `https://t0.tianditu.gov.cn/${layerName}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerName}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`,
              `https://t1.tianditu.gov.cn/${layerName}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerName}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`,
              `https://t2.tianditu.gov.cn/${layerName}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layerName}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`,
            ],
            tileSize: 256,
          },
          'tdt-label': {
            type: 'raster',
            tiles: [
              `https://t0.tianditu.gov.cn/${labelLayer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${labelLayer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`,
              `https://t1.tianditu.gov.cn/${labelLayer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${labelLayer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${tk}`,
            ],
            tileSize: 256,
          },
        },
        layers: [
          {
            id: 'tdt-base-layer',
            type: 'raster',
            source: 'tdt-base',
            minzoom: 0,
            maxzoom: 18,
          },
          {
            id: 'tdt-label-layer',
            type: 'raster',
            source: 'tdt-label',
            minzoom: 0,
            maxzoom: 18,
          },
        ],
      },
      center: [115.5, 36.2],
      zoom: 4.3,
      pitch: 42,
      bearing: -4,
    });

    map.addControl(
      new maplibregl.NavigationControl({ visualizePitch: true }),
      'top-right'
    );

    // Load official CHGIS 1820 GeoJSON
    map.on('load', () => {
      fetch('/maps/chgis_1820_qing.geojson')
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (!data || !map.getSource) return;
          map.addSource('chgis-1820', {
            type: 'geojson',
            data,
          });

          map.addLayer({
            id: 'chgis-1820-fill',
            type: 'fill',
            source: 'chgis-1820',
            paint: {
              'fill-color': '#b08d57',
              'fill-opacity': 0.08,
            },
          });

          map.addLayer({
            id: 'chgis-1820-line',
            type: 'line',
            source: 'chgis-1820',
            paint: {
              'line-color': '#7a7166',
              'line-width': 1.2,
              'line-opacity': 0.7,
            },
          });
        })
        .catch(() => {});
    });

    const overlay = new MapLibreOverlay({
      layers: [],
    });
    map.addControl(overlay);

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Update CHGIS Layer Visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer) return;
    if (map.getLayer('chgis-1820-fill')) {
      map.setLayoutProperty(
        'chgis-1820-fill',
        'visibility',
        showChgis ? 'visible' : 'none'
      );
    }
    if (map.getLayer('chgis-1820-line')) {
      map.setLayoutProperty(
        'chgis-1820-line',
        'visibility',
        showChgis ? 'visible' : 'none'
      );
    }
  }, [showChgis]);

  // Update Deck.gl Layers (Heatmap, 3D Arcs, Scatterplot Dots)
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay) return;

    const placeMap = new Map<string, MapPlace>();
    places.forEach((p) => placeMap.set(p.id, p));

    const layers: any[] = [];

    // 1. GPU Heatmap Layer (when in 'heat' mode)
    if (viewMode === 'heat') {
      layers.push(
        new HeatmapLayer({
          id: 'deck-heatmap-layer',
          data: places,
          getPosition: (d: MapPlace) => [d.lng, d.lat],
          getWeight: (d: MapPlace) => {
            const count = imageRegions.filter((r) => r.id === d.regionId).length;
            return 1 + count * 2;
          },
          radiusPixels: 48,
          intensity: 1.25,
          threshold: 0.05,
        })
      );
    }

    // 2. 3D Arc Flow Layer (when in 'route' or 'space' mode)
    if (viewMode === 'route' || viewMode === 'space') {
      const activeEvents = events.filter((e) => e.yearStart <= currentYear);
      layers.push(
        new ArcLayer({
          id: 'deck-arc-layer',
          data: activeEvents,
          getSourcePosition: (e: MapEvent) => {
            const p = placeMap.get(e.fromPlaceId);
            return p ? [p.lng, p.lat, 0] : [0, 0, 0];
          },
          getTargetPosition: (e: MapEvent) => {
            const p = placeMap.get(e.toPlaceId);
            return p ? [p.lng, p.lat, 0] : [0, 0, 0];
          },
          getSourceColor: [155, 44, 31, 235], // Seal red
          getTargetColor: [176, 141, 87, 235], // Gold/ochre
          getWidth: 3.5,
          getHeight: 0.32,
          pickable: true,
          onHover: (info) => {
            if (info.object) {
              const ev = info.object as MapEvent;
              const f = placeMap.get(ev.fromPlaceId)?.name || '未知起点';
              const t = placeMap.get(ev.toPlaceId)?.name || '未知终点';
              setTooltipInfo({
                x: info.x,
                y: info.y,
                title: `${ev.type}：${f} → ${t}`,
                subtitle: `年代：${ev.yearStart}${
                  ev.yearEnd !== ev.yearStart ? '–' + ev.yearEnd : ''
                } 年`,
                note: ev.note,
                regionId: ev.regionId,
              });
            } else {
              setTooltipInfo(null);
            }
          },
          onClick: (info) => {
            if (info.object && (info.object as MapEvent).regionId) {
              onOpenEvidence?.((info.object as MapEvent).regionId);
            }
          },
        })
      );
    }

    // 3. 3D Scatterplot Layer (Place Nodes)
    const filteredPlaces =
      viewMode === 'repo'
        ? places.filter((p) => p.kind === 'repository')
        : places;

    layers.push(
      new ScatterplotLayer({
        id: 'deck-scatter-layer',
        data: filteredPlaces,
        getPosition: (d: MapPlace) => [d.lng, d.lat, 0],
        getRadius: (d: MapPlace) => (d.kind === 'repository' ? 28000 : 18000),
        radiusMinPixels: 6,
        radiusMaxPixels: 14,
        getFillColor: (d: MapPlace) => {
          if (d.confidence === 'explicit') return [155, 44, 31, 245];
          if (d.confidence === 'verified') return [31, 27, 23, 245];
          return [176, 141, 87, 245];
        },
        getLineColor: [255, 254, 251, 255],
        lineWidthMinPixels: 2,
        pickable: true,
        onHover: (info) => {
          if (info.object) {
            const p = info.object as MapPlace;
            setTooltipInfo({
              x: info.x,
              y: info.y,
              title: p.name + (p.alias ? ` (${p.alias})` : ''),
              subtitle: `${p.admin || '清代政区'} ${p.year ? '· ' + p.year + '年' : ''}`,
              confidence:
                p.confidence === 'explicit'
                  ? '原文直接记载'
                  : p.confidence === 'verified'
                  ? '学者核定'
                  : '智能体推测待核',
              basis: p.basis,
              note: p.note,
              regionId: p.regionId,
            });
          } else {
            setTooltipInfo(null);
          }
        },
        onClick: (info) => {
          if (info.object) {
            const p = info.object as MapPlace;
            setActivePlaceId(p.id);
            onSelectPlace?.(p);
          }
        },
      })
    );

    overlay.setProps({ layers });
  }, [places, events, imageRegions, currentYear, viewMode]);

  // 4. Native HTML DOM Markers for Crisp CJK Typography & Rich Archival Content
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear previous DOM markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    if (labelMode === 'hidden') return;

    const filteredPlaces =
      viewMode === 'repo'
        ? places.filter((p) => p.kind === 'repository')
        : places;

    // Smart pixel-offset dispersion for nearby Jiangnan nodes (Qingjiangpu, Yangzhou/Nanking, Shanghai)
    const getOffsetForPlace = (p: MapPlace, idx: number): [number, number] => {
      if (p.id === 'PLC-KAW-02') return [14, -22]; // 清江浦：左上偏
      if (p.id === 'PLC-KAW-03') return [14, 4];   // 扬州与江宁：正右偏
      if (p.id === 'PLC-KAW-04') return [14, 26];  // 上海：右下偏
      if (p.id === 'PLC-DEMO-01') return [14, -14]; // 多伦诺尔：右上偏
      return [14, (idx % 2 === 0 ? -6 : 8)];
    };

    filteredPlaces.forEach((p, idx) => {
      const reg = imageRegions.find((r) => r.id === p.regionId);
      const isSelected = p.id === activePlaceId;
      const el = document.createElement('div');
      el.className = 'pointer-events-auto cursor-pointer select-none transition-transform hover:z-40';

      const dotColor =
        p.confidence === 'explicit'
          ? '#9b2c1f'
          : p.confidence === 'verified'
          ? '#1f1b17'
          : '#b08d57';

      if (labelMode === 'compact') {
        el.innerHTML = `
          <div style="
            display:inline-flex;align-items:center;gap:5px;
            background:${isSelected ? '#1f1b17' : 'rgba(252,250,245,0.95)'};
            color:${isSelected ? '#ffffff' : '#1f1b17'};
            border:1.5px solid ${isSelected ? '#9b2c1f' : '#c8bfb0'};
            border-radius:3px;padding:3px 7px;
            font-family:'Noto Serif SC','Songti SC',serif;
            font-size:11.5px;font-weight:600;
            box-shadow:0 2px 6px rgba(31,27,23,0.16);
            white-space:nowrap;
          ">
            <span style="width:7px;height:7px;border-radius:999px;background:${dotColor};display:inline-block"></span>
            <span>${p.name.split('（')[0]}</span>
            ${p.year ? `<span style="font-family:monospace;font-size:10px;opacity:0.8">${p.year}</span>` : ''}
          </div>
        `;
      } else {
        // Rich mode: Shows Place Name + Year + Historical/Archival Content Snippet + Direct Evidence Link
        const shortNote = (p.note || p.basis || '')
          .replace(/^魏特夫\s*/, '')
          .slice(0, 34);
        el.innerHTML = `
          <div style="
            max-width:235px;
            background:${isSelected ? '#fffdf8' : 'rgba(252,250,245,0.96)'};
            color:#1f1b17;
            border:${isSelected ? '2px solid #9b2c1f' : '1px solid #b8ae9e'};
            border-left:3.5px solid ${dotColor};
            border-radius:3px;
            padding:5px 8px;
            box-shadow:0 3px 10px rgba(31,27,23,0.18);
            backdrop-filter:blur(4px);
          ">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
              <span style="font-family:'Noto Serif SC','Songti SC',serif;font-size:12px;font-weight:700;color:#1f1b17;line-height:1.25;">
                ${p.name}
              </span>
              ${
                p.year
                  ? `<span style="font-family:monospace;font-size:10px;background:#eeeae1;color:#9b2c1f;padding:1px 4px;border-radius:2px;font-weight:600;flex-shrink:0;">${p.year}年</span>`
                  : ''
              }
            </div>
            <div style="font-size:10.5px;color:#4a433a;margin-top:3px;line-height:1.35;">
              ${shortNote ? `${shortNote}…` : p.admin || '清代历史地理节点'}
            </div>
            ${
              reg
                ? `<div data-action="open-evidence" style="margin-top:4px;display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:#9b2c1f;background:rgba(155,44,31,0.08);padding:1px 5px;border-radius:2px;">
                     <span>📄 ${reg.label.split('·')[0].trim()} 原图证据 →</span>
                   </div>`
                : ''
            }
          </div>
        `;
      }

      el.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const target = ev.target as HTMLElement;
        if (target.closest('[data-action="open-evidence"]') && p.regionId) {
          onOpenEvidence?.(p.regionId);
          return;
        }
        setActivePlaceId(p.id);
        onSelectPlace?.(p);
      });

      const marker = new maplibregl.Marker({
        element: el,
        anchor: 'left',
        offset: getOffsetForPlace(p, idx),
      })
        .setLngLat([p.lng, p.lat])
        .addTo(map);

      markersRef.current.push(marker);
    });

    // In 'route' mode, also place midpoint event narrative badges along active routes
    if (viewMode === 'route') {
      const placeMap = new Map<string, MapPlace>();
      places.forEach((p) => placeMap.set(p.id, p));

      events
        .filter((e) => e.yearStart <= currentYear)
        .forEach((ev) => {
          const fromP = placeMap.get(ev.fromPlaceId);
          const toP = placeMap.get(ev.toPlaceId);
          if (!fromP || !toP) return;

          // Midpoint coordinate (skip trans-Pacific midpoint if zoomed on China, or place near coast)
          const midLng =
            Math.abs(fromP.lng - toP.lng) > 90
              ? fromP.lng + 12
              : (fromP.lng + toP.lng) / 2;
          const midLat =
            Math.abs(fromP.lng - toP.lng) > 90
              ? fromP.lat + 2
              : (fromP.lat + toP.lat) / 2;

          const badge = document.createElement('div');
          badge.className = 'pointer-events-auto cursor-pointer select-none';
          badge.innerHTML = `
            <div style="
              background:#9b2c1f;color:#ffffff;
              border:1px solid #fffefb;border-radius:999px;
              padding:2px 8px;font-size:10px;font-weight:600;
              box-shadow:0 2px 6px rgba(0,0,0,0.22);
              white-space:nowrap;
            ">
              📜 ${ev.yearStart}–${ev.yearEnd} ${ev.type}：${(ev.note || '').slice(0, 18)}…
            </div>
          `;
          badge.onclick = (e) => {
            e.stopPropagation();
            if (ev.regionId) onOpenEvidence?.(ev.regionId);
          };

          const routeMarker = new maplibregl.Marker({
            element: badge,
            anchor: 'center',
          })
            .setLngLat([midLng, midLat])
            .addTo(map);

          markersRef.current.push(routeMarker);
        });
    }
  }, [places, events, imageRegions, currentYear, viewMode, labelMode, activePlaceId]);

  const togglePitch = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextPitch = pitch === 0 ? 52 : pitch === 52 ? 30 : 0;
    map.easeTo({ pitch: nextPitch, duration: 700 });
    setPitch(nextPitch);
  };

  const flyToPlace = (p: MapPlace) => {
    const map = mapRef.current;
    setActivePlaceId(p.id);
    onSelectPlace?.(p);
    if (!map) return;
    map.flyTo({
      center: [p.lng, p.lat],
      zoom: p.kind === 'repository' ? 5.2 : 5.8,
      pitch: 45,
      duration: 1100,
    });
  };

  const resetChinaView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [115.5, 36.2],
      zoom: 4.3,
      pitch: 42,
      bearing: -4,
      duration: 900,
    });
    setPitch(42);
  };

  const resetGlobalView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({
      center: [165.0, 34.0],
      zoom: 1.8,
      pitch: 25,
      bearing: 0,
      duration: 1000,
    });
    setPitch(25);
  };

  const activePlace =
    places.find((p) => p.id === activePlaceId) || places[0] || null;
  const activeRegion = activePlace
    ? imageRegions.find((r) => r.id === activePlace.regionId) || null
    : null;

  return (
    <div className="relative h-[620px] w-full select-none overflow-hidden rounded-[4px] border border-[var(--line)] bg-[#eeeae1]">
      <div ref={containerRef} className="h-full w-full" />

      {/* Top-Left 3D Viewport & Content Label Mode Controls */}
      <div className="absolute top-3 left-3 z-20 flex flex-wrap items-center gap-1.5 rounded-[3px] border border-[var(--line)] bg-[var(--sheet)]/95 px-2.5 py-1.5 shadow-sm backdrop-blur-xs">
        <span className="font-mono text-[10.5px] font-semibold text-[var(--seal)]">
          3D 时空史料图层
        </span>
        <span className="text-[var(--line)]">|</span>
        <button
          type="button"
          onClick={() =>
            setLabelMode((m) =>
              m === 'rich' ? 'compact' : m === 'compact' ? 'hidden' : 'rich'
            )
          }
          className="rounded bg-[#1f1b17] px-2 py-0.5 text-[11px] font-medium text-white hover:bg-[#36302a]"
          title="切换地图上的史料内容卡片显示密度"
        >
          {labelMode === 'rich'
            ? '📇 史实详情卡 (显示文献内容)'
            : labelMode === 'compact'
            ? '🏷️ 精简地名签'
            : '👁️ 隐藏标签'}
        </button>
        <button
          type="button"
          onClick={togglePitch}
          className="rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
        >
          倾角: <span className="font-mono">{pitch}°</span>
        </button>
        <button
          type="button"
          onClick={resetChinaView}
          className="rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
        >
          🇨🇳 聚焦清代疆域
        </button>
        <button
          type="button"
          onClick={resetGlobalView}
          className="rounded border border-[var(--line)] bg-white px-2 py-0.5 text-[11px] text-[var(--ink-secondary)] hover:text-[var(--ink)]"
        >
          🌐 跨洋馆藏全图
        </button>
      </div>

      {/* Quick Place Navigation Pills Bar */}
      <div className="absolute top-13 left-3 z-20 flex max-w-[88%] flex-wrap items-center gap-1.5">
        {places.map((p) => {
          const isCurr = p.id === activePlace?.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => flyToPlace(p)}
              className={`rounded-[3px] border px-2 py-1 text-[11px] font-medium shadow-xs transition ${
                isCurr
                  ? 'border-[#9b2c1f] bg-[#9b2c1f] text-white'
                  : 'border-[#dcd5c9] bg-[#fcfaf5]/95 text-[#1f1b17] hover:border-[#1f1b17]'
              }`}
            >
              📍 {p.name.split('（')[0]}
              {p.year ? ` (${p.year})` : ''}
            </button>
          );
        })}
      </div>

      {/* Bottom-Left Active Place Historical & Archival Evidence Card */}
      {activePlace && (
        <div className="pointer-events-auto absolute bottom-3 left-3 z-20 max-w-md rounded-[4px] border border-[#1f1b17] bg-[#fcfaf5]/96 p-3.5 shadow-lg backdrop-blur-xs">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded bg-[#9b2c1f] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">
                  {activePlace.year ? `${activePlace.year}年` : '清代节点'}
                </span>
                <h4 className="font-serif text-sm font-bold text-[#1f1b17]">
                  {activePlace.name}
                </h4>
              </div>
              {activePlace.alias && (
                <div className="mt-0.5 font-mono text-[10.5px] text-[#7a7166]">
                  西文/古称对照：{activePlace.alias} · {activePlace.admin}
                </div>
              )}
            </div>
          </div>

          <p className="mt-2 text-xs leading-relaxed text-[#2c2620]">
            <strong>文献记载与史实内容：</strong>
            {activePlace.note || activePlace.basis}
          </p>

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#e5dfd3] pt-2 text-[11px]">
            <span className="text-[#7a7166]">
              比定依据：{activePlace.basis.slice(0, 32)}
            </span>
            {activeRegion && (
              <button
                type="button"
                onClick={() => onOpenEvidence?.(activeRegion.id)}
                className="rounded-[2px] bg-[#1f1b17] px-2.5 py-1 text-[11px] font-medium text-white hover:bg-[#9b2c1f]"
              >
                打开原件证据：{activeRegion.label.split('·')[0].trim()} →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Hover Tooltip Card */}
      {tooltipInfo && (
        <div
          style={{
            left: `${Math.min(tooltipInfo.x + 14, 520)}px`,
            top: `${Math.max(tooltipInfo.y - 10, 60)}px`,
          }}
          className="pointer-events-auto absolute z-30 max-w-xs rounded-[3px] border border-[var(--ink)] bg-[var(--sheet)] p-3 text-xs shadow-lg"
        >
          <div className="font-serif font-semibold text-[var(--ink)]">
            {tooltipInfo.title}
          </div>
          {tooltipInfo.subtitle && (
            <div className="mt-1 text-[11px] text-[var(--ink-muted)]">
              {tooltipInfo.subtitle}
            </div>
          )}
          {tooltipInfo.note && (
            <div className="mt-1.5 rounded bg-[#f6f4ef] p-1.5 text-[11px] leading-relaxed text-[#1f1b17]">
              {tooltipInfo.note}
            </div>
          )}
          {tooltipInfo.basis && (
            <div className="mt-1 text-[10.5px] text-[var(--ink-secondary)]">
              坐标依据：{tooltipInfo.basis}
            </div>
          )}
          {tooltipInfo.regionId && (
            <button
              type="button"
              onClick={() => onOpenEvidence?.(tooltipInfo.regionId!)}
              className="mt-2 block rounded-[2px] bg-[var(--ink)] px-2 py-1 text-[10px] text-white hover:bg-zinc-800"
            >
              在阅读台打开对应原图 →
            </button>
          )}
        </div>
      )}

      {/* Bottom-Right Hint */}
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-[2px] bg-[var(--ink)]/85 px-2.5 py-1 font-mono text-[10px] text-white backdrop-blur-xs">
        点击上方地名胶囊可一键三维巡航 · 点击卡片直接调阅手稿原件
      </div>
    </div>
  );
};
