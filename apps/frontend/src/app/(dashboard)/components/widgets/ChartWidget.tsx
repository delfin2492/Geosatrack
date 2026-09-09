import React, { useState, useEffect, useRef } from 'react';

interface ChartWidgetProps {
  widgetId: string;
  data: any[];
  widgetConfig?: any;
  rangeInfo: { range: string; startDate?: string; endDate?: string };
  setWidgetRange: (widgetId: string, range: string) => void;
  updateCustomRange: (widgetId: string, field: 'startDate' | 'endDate', val: string) => void;
}

const lineColors = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4'];

const getSmoothPath = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return '';
  if (points.length === 2) return `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)},${points[1].y.toFixed(1)}`;

  let d = `M ${points[0].x.toFixed(1)},${points[0].y.toFixed(1)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? i : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
};

const SVGChart: React.FC<{ widgetId: string; results: any[]; rangeType: string; widgetConfig?: any }> = ({ widgetId, results, rangeType, widgetConfig = {} }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 450, height: 220 });
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    time: number;
    points: { attr: string; value: number; color: string }[];
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        if (width && height) {
          setDimensions({
            width: Math.max(width, 200),
            height: Math.max(height, 120)
          });
        }
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  if (!results || results.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground font-medium">
        No chart data available
      </div>
    );
  }

  let allPoints: any[] = [];
  results.forEach(r => {
    if (Array.isArray(r.data)) {
      allPoints = [...allPoints, ...r.data];
    }
  });

  if (allPoints.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-muted/20 rounded-lg p-4 font-mono">
        Waiting for telemetry logs...
      </div>
    );
  }

  const showLegend = widgetConfig?.showLegend !== false;
  const legendHeight = showLegend ? 28 : 0;
  const chartHeight = Math.max(80, dimensions.height - legendHeight);
  const width = dimensions.width;

  const paddingLeft = 50;
  const paddingRight = 10;
  const paddingTop = 16;
  const paddingBottom = 22;

  const yMinCustom = widgetConfig?.yAxisAutoMin === false && widgetConfig?.yAxisMin !== undefined && widgetConfig?.yAxisMin !== '' ? Number(widgetConfig.yAxisMin) : null;
  const yMaxCustom = widgetConfig?.yAxisAutoMax === false && widgetConfig?.yAxisMax !== undefined && widgetConfig?.yAxisMax !== '' ? Number(widgetConfig.yAxisMax) : null;

  const minVal = yMinCustom !== null ? yMinCustom : Math.min(...allPoints.map(p => p.value));
  const maxVal = yMaxCustom !== null ? yMaxCustom : Math.max(...allPoints.map(p => p.value));
  const valRange = maxVal - minVal || 1;

  const timestamps = allPoints.map(p => new Date(p.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  const getUnit = (item: any) => {
    if (item?.unit) return item.unit;
    const attrName = item?.attr || '';
    const n = attrName.toLowerCase();
    if (n.startsWith('rssi')) return 'dBm';
    if (n.includes('temperature') || n.includes('temp')) return '°C';
    if (n.includes('humidity') || n.includes('hum')) return '%';
    if (n.includes('battery') || n.includes('voltage') || n.includes('volt')) return 'V';
    if (n.includes('co2') || n.includes('co')) return 'ppm';
    if (n.includes('pressure') || n.includes('pres')) return 'hPa';
    if (n.includes('speed') || n.includes('velocity')) return 'm/s';
    if (n.includes('flow')) return 'L/min';
    return '';
  };

  const formatTimeLabel = (timestamp: number) => {
    const d = new Date(timestamp);
    const pad = (n: number) => n.toString().padStart(2, '0');
    if (rangeType === '1h' || rangeType === 'realtime') {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    }
    if (rangeType === '1d' || rangeType === '24h') {
      return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const unitLabel = results[0] ? getUnit(results[0]) : '';

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * width;

    if (svgX < paddingLeft || svgX > width - paddingRight) {
      setHoverInfo(null);
      return;
    }

    const pct = (svgX - paddingLeft) / (width - paddingLeft - paddingRight);
    const hoverTime = minTime + pct * timeRange;

    const hoverPoints: { attr: string; value: number; color: string }[] = [];
    let closestTimestamp: number = hoverTime;

    results.forEach((r, sIdx) => {
      if (!Array.isArray(r.data) || r.data.length === 0) return;

      let closestPoint = r.data[0];
      let minDiff = Math.abs(new Date(closestPoint.timestamp).getTime() - hoverTime);

      for (let i = 1; i < r.data.length; i++) {
        const diff = Math.abs(new Date(r.data[i].timestamp).getTime() - hoverTime);
        if (diff < minDiff) {
          minDiff = diff;
          closestPoint = r.data[i];
        }
      }

      if (closestPoint) {
        hoverPoints.push({
          attr: r.attr,
          value: closestPoint.value,
          color: lineColors[sIdx % lineColors.length]
        });
        closestTimestamp = new Date(closestPoint.timestamp).getTime();
      }
    });

    if (hoverPoints.length > 0) {
      const bestX = paddingLeft + ((closestTimestamp - minTime) / timeRange) * (width - paddingLeft - paddingRight);
      setHoverInfo({
        x: bestX,
        time: closestTimestamp,
        points: hoverPoints
      });
    } else {
      setHoverInfo(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverInfo(null);
  };

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col justify-between bg-transparent relative overflow-hidden select-none">
      {/* Floating Hover Tooltip */}
      {hoverInfo && (
        <div
          className="absolute z-30 bg-slate-900/95 text-white dark:bg-slate-100 dark:text-slate-900 text-xs rounded-lg shadow-xl p-2 pointer-events-none flex flex-col gap-1 min-w-[130px] backdrop-blur-md transition-all duration-75 border border-slate-700/50"
          style={{
            left: `${(hoverInfo.x / width) * 100}%`,
            top: '8%',
            transform: hoverInfo.x > width / 2 ? 'translateX(-105%)' : 'translateX(5%)'
          }}
        >
          <div className="font-bold font-mono border-b border-white/20 dark:border-black/20 pb-1 mb-0.5 text-slate-300 dark:text-slate-600 flex items-center justify-between">
            <span>{new Date(hoverInfo.time).toLocaleTimeString()}</span>
            <span className="text-[9px] opacity-75">{new Date(hoverInfo.time).toLocaleDateString([], { month: 'short', day: 'numeric' })}</span>
          </div>
          {hoverInfo.points.map((pt, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 truncate">
                <span className="w-2 h-2 rounded-full shrink-0 shadow-2xs" style={{ backgroundColor: pt.color }} />
                <span className="truncate max-w-[100px] font-semibold capitalize text-xs">{pt.attr}:</span>
              </div>
              <span className="font-bold font-mono text-xs">{pt.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Main SVG Graph */}
      <div className="flex-1 w-full relative min-h-0">
        <svg
          viewBox={`0 0 ${width} ${chartHeight}`}
          className="w-full h-full overflow-visible cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {results.map((_, sIdx) => {
              const color = lineColors[sIdx % lineColors.length];
              return (
                <linearGradient key={sIdx} id={`chart-grad-${widgetId}-${sIdx}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={color} stopOpacity="0.0" />
                </linearGradient>
              );
            })}
          </defs>

          {/* Standalone Dynamic Unit Label (Centered Vertically on Far Left of Y-Axis) */}
          {unitLabel && (
            <text
              x={9}
              y={paddingTop + (chartHeight - paddingTop - paddingBottom) / 2}
              textAnchor="middle"
              className="fill-slate-700 dark:fill-slate-200 font-extrabold text-[12px]"
            >
              {unitLabel}
            </text>
          )}

          {/* Y-Axis Grid Lines & Values */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
            const y = paddingTop + (1 - ratio) * (chartHeight - paddingTop - paddingBottom);
            const val = minVal + ratio * valRange;
            return (
              <g key={idx}>
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="0.8"
                  strokeDasharray="3 3"
                  opacity="0.6"
                />
                <text
                  x={paddingLeft - 6}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-slate-700 dark:fill-slate-200 font-mono font-bold text-[11px]"
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* X-Axis Ticks & Labels */}
          {[0, 0.5, 1].map((ratio, idx) => {
            const x = paddingLeft + ratio * (width - paddingLeft - paddingRight);
            const timeVal = minTime + ratio * timeRange;
            const textAnchor = idx === 0 ? 'start' : idx === 2 ? 'end' : 'middle';
            return (
              <g key={idx}>
                <line
                  x1={x}
                  y1={chartHeight - paddingBottom}
                  x2={x}
                  y2={chartHeight - paddingBottom + 4}
                  stroke="currentColor"
                  className="text-border"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={chartHeight - paddingBottom + 15}
                  textAnchor={textAnchor}
                  className="fill-slate-700 dark:fill-slate-200 font-mono font-bold text-[10px]"
                >
                  {formatTimeLabel(timeVal)}
                </text>
              </g>
            );
          })}

          {/* Series Smooth Lines & Area Paths */}
          {results.map((r, sIdx) => {
            if (!Array.isArray(r.data) || r.data.length === 0) return null;

            const coordPoints = r.data.map((p: any) => {
              const t = new Date(p.timestamp).getTime();
              const x = paddingLeft + ((t - minTime) / timeRange) * (width - paddingLeft - paddingRight);
              const y = paddingTop + (1 - (p.value - minVal) / valRange) * (chartHeight - paddingTop - paddingBottom);
              return { x, y };
            });

            if (coordPoints.length === 0) return null;

            const strokeColor = lineColors[sIdx % lineColors.length];
            const smoothLine = getSmoothPath(coordPoints);
            const areaPathStr = `${smoothLine} L ${coordPoints[coordPoints.length - 1].x.toFixed(1)},${(chartHeight - paddingBottom).toFixed(1)} L ${coordPoints[0].x.toFixed(1)},${(chartHeight - paddingBottom).toFixed(1)} Z`;

            return (
              <g key={sIdx}>
                {/* Area Gradient Fill */}
                <path d={areaPathStr} fill={`url(#chart-grad-${widgetId}-${sIdx})`} stroke="none" className="transition-all duration-300" />

                {/* Smooth Bezier Line */}
                {coordPoints.length > 1 ? (
                  <path
                    d={smoothLine}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth="3.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-all duration-300"
                  />
                ) : (
                  <circle cx={coordPoints[0].x} cy={coordPoints[0].y} r="4" fill={strokeColor} />
                )}
              </g>
            );
          })}

          {/* Hover Active Indicator Line & Dots */}
          {hoverInfo && (
            <g className="animate-in fade-in duration-75">
              <line
                x1={hoverInfo.x}
                y1={paddingTop}
                x2={hoverInfo.x}
                y2={chartHeight - paddingBottom}
                stroke="#94a3b8"
                strokeWidth="1.2"
                strokeDasharray="3 3"
              />
              {results.map((r, sIdx) => {
                if (!Array.isArray(r.data) || r.data.length === 0) return null;
                const closest = r.data.reduce((prev: any, curr: any) => {
                  return Math.abs(new Date(curr.timestamp).getTime() - hoverInfo.time) < Math.abs(new Date(prev.timestamp).getTime() - hoverInfo.time) ? curr : prev;
                });

                if (closest) {
                  const y = paddingTop + (1 - (closest.value - minVal) / valRange) * (chartHeight - paddingTop - paddingBottom);
                  return (
                    <circle
                      key={sIdx}
                      cx={hoverInfo.x}
                      cy={y}
                      r="4.5"
                      fill="#ffffff"
                      stroke={lineColors[sIdx % lineColors.length]}
                      strokeWidth="2.5"
                    />
                  );
                }
                return null;
              })}
            </g>
          )}
        </svg>
      </div>

      {/* Bottom Legend Pills */}
      {showLegend && (
        <div className="flex items-center justify-center gap-3 flex-wrap pt-1.5 border-t border-border/40 shrink-0 text-[10px]">
          {results.map((r, sIdx) => {
            const color = lineColors[sIdx % lineColors.length];
            return (
              <div key={sIdx} className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-200 bg-muted/40 px-2.5 py-0.5 rounded-full border border-border/50 shadow-2xs">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                <span className="capitalize">{r.attr}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  widgetId,
  data,
  widgetConfig = {},
  rangeInfo,
  setWidgetRange,
  updateCustomRange
}) => {
  return (
    <div className="w-full h-full flex flex-col justify-between p-2 select-none">
      {/* Range Filter Toolbar */}
      <div className="flex items-center justify-between pb-1.5 border-b border-border/40 shrink-0 text-[10px] gap-2">
        <div className="flex items-center gap-1 flex-wrap">
          {[
            { key: 'realtime', label: 'LIVE' },
            { key: '1h', label: '1H' },
            { key: '24h', label: '1D' },
            { key: '7d', label: '1W' },
            { key: '30d', label: '1M' },
            { key: '1y', label: '1Y' },
            { key: 'custom', label: 'CUSTOM' }
          ].map((p: any) => {
            const isActive = rangeInfo.range === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setWidgetRange(widgetId, p.key)}
                className={`px-2 py-0.5 rounded-md font-extrabold uppercase transition-all cursor-pointer text-[9px] tracking-wider ${isActive
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-transparent'
                  }`}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Custom Date Inputs */}
        {rangeInfo.range === 'custom' && (
          <div className="flex items-center gap-1 shrink-0 animate-in fade-in slide-in-from-top-1 duration-150">
            <input
              type="date"
              value={rangeInfo.startDate || ''}
              onChange={(e) => updateCustomRange(widgetId, 'startDate', e.target.value)}
              className="bg-background border border-border rounded px-1.5 py-0.5 max-w-[95px] outline-none text-[9px] font-bold text-foreground"
            />
            <span className="text-muted-foreground font-extrabold">-</span>
            <input
              type="date"
              value={rangeInfo.endDate || ''}
              onChange={(e) => updateCustomRange(widgetId, 'endDate', e.target.value)}
              className="bg-background border border-border rounded px-1.5 py-0.5 max-w-[95px] outline-none text-[9px] font-bold text-foreground"
            />
          </div>
        )}
      </div>

      {/* Chart SVG */}
      <div className="flex-1 w-full relative pt-1 min-h-0">
        <SVGChart widgetId={widgetId} results={data} rangeType={rangeInfo.range} widgetConfig={widgetConfig} />
      </div>
    </div>
  );
};;
