import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapLibreOverlay } from '@deck.gl/maplibre';
import { ArcLayer, ScatterplotLayer, TextLayer } from '@deck.gl/layers';
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

  const [tooltipInfo, setTooltipInfo] = useState<{
    x: number;
    y: number;
    title: string;
    subtitle?: string;
    confidence?: string;
    basis?: string;
    regionId?: string;
  } | null>(null);

  const [pitch, setPitch] = useState<number>(45);

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
      center: [105.0, 36.5],
      zoom: 3.8,
      pitch: 45,
      bearing: -5,
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

  // Update Deck.gl Layers
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
          radiusPixels: 45,
          intensity: 1.2,
          threshold: 0.05,
        })
      );
    }

    // 2. 3D Arc Flow Layer (when in 'route' or default mode with active events)
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
          getSourceColor: [155, 44, 31, 230], // Seal red
          getTargetColor: [176, 141, 87, 230], // Gold/ochre
          getWidth: 3.5,
          getHeight: 0.35, // 3D Parabolic curve height
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
                } 年 · ${ev.note || ''}`,
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
        getRadius: (d: MapPlace) => (d.kind === 'repository' ? 32000 : 20000),
        getFillColor: (d: MapPlace) => {
          if (d.confidence === 'explicit') return [31, 27, 23, 240];
          if (d.confidence === 'verified') return [155, 44, 31, 240];
          return [176, 141, 87, 240];
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
              regionId: p.regionId,
            });
          } else {
            setTooltipInfo(null);
          }
        },
        onClick: (info) => {
          if (info.object) {
            onSelectPlace?.(info.object as MapPlace);
          }
        },
      })
    );

    // 4. Text Label Layer
    layers.push(
      new TextLayer({
        id: 'deck-text-layer',
        data: filteredPlaces,
        getPosition: (d: MapPlace) => [d.lng, d.lat, 0],
        getText: (d: MapPlace) => d.name,
        getSize: 12,
        getColor: [31, 27, 23, 240],
        getTextAnchor: 'start',
        getAlignmentBaseline: 'center',
        getPixelOffset: [12, 0],
        background: true,
        getBackgroundColor: [255, 254, 251, 220],
        backgroundPadding: [4, 2],
        fontFamily: 'Noto Serif SC, Songti SC, serif',
      })
    );

    overlay.setProps({ layers });
  }, [places, events, imageRegions, currentYear, viewMode]);

  const togglePitch = () => {
    const map = mapRef.current;
    if (!map) return;
    const nextPitch = pitch === 0 ? 55 : pitch === 55 ? 30 : 0;
    map.easeTo({ pitch: nextPitch, duration: 800 });
    setPitch(nextPitch);
  };

  const resetView = () => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [105.0, 36.5], zoom: 3.8, pitch: 45, bearing: -5, duration: 1000 });
    setPitch(45);
  };

  return (
    <div className="relative h-[560px] w-full select-none overflow-hidden rounded-[4px] border border-[var(--line)] bg-[#eeeae1]">
      <div ref={containerRef} className="h-full w-full" />

      {/* 3D Viewport Controls */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2 rounded-[3px] border border-[var(--line)] bg-[var(--sheet)]/90 px-3 py-1.5 backdrop-blur-xs">
        <span className="font-mono text-[11px] font-semibold text-[var(--seal)]">
          3D WEBGL ENGINE
        </span>
        <span className="text-[var(--line)]">|</span>
        <button
          type="button"
          onClick={togglePitch}
          className="text-xs text-[var(--ink-secondary)] hover:text-[var(--ink)]"
          title="切换倾角 (0° 平视 / 30° / 55° 3D透视)"
        >
          倾角: <span className="font-mono">{pitch}°</span>
        </button>
        <span className="text-[var(--line)]">|</span>
        <button
          type="button"
          onClick={resetView}
          className="text-xs text-[var(--ink-secondary)] hover:text-[var(--ink)]"
        >
          复位视角
        </button>
      </div>

      {/* Interactive Tooltip Card */}
      {tooltipInfo && (
        <div
          style={{
            left: `${tooltipInfo.x + 12}px`,
            top: `${tooltipInfo.y + 12}px`,
          }}
          className="pointer-events-auto absolute z-20 max-w-xs rounded-[3px] border border-[var(--ink)] bg-[var(--sheet)] p-3 text-xs shadow-lg transition-transform duration-75"
        >
          <div className="font-serif font-semibold text-[var(--ink)]">
            {tooltipInfo.title}
          </div>
          {tooltipInfo.subtitle && (
            <div className="mt-1 text-[11px] text-[var(--ink-muted)]">
              {tooltipInfo.subtitle}
            </div>
          )}
          {tooltipInfo.confidence && (
            <div className="mt-1 text-[11px]">
              <span className="text-[var(--seal)] font-medium">
                ● {tooltipInfo.confidence}
              </span>
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
              className="mt-2 block rounded-[2px] bg-[var(--ink)] px-2 py-0.5 text-[10px] text-white hover:bg-zinc-800"
            >
              在阅读台打开对应原图 →
            </button>
          )}
        </div>
      )}

      {/* Bottom Hint */}
      <div className="pointer-events-none absolute right-3 bottom-3 z-10 rounded-[2px] bg-[var(--ink)]/80 px-2 py-0.5 font-mono text-[10px] text-white backdrop-blur-xs">
        按住右键或 Ctrl 拖动可自由旋转与倾斜三维视角
      </div>
    </div>
  );
};
