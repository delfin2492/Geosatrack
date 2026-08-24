import React, { useState, useEffect, useRef } from 'react';

interface ChartWidgetProps {
  widgetId: string;
  data: any[];
  rangeInfo: { range: string, startDate?: string, endDate?: string };
  setWidgetRange: (widgetId: string, range: string) => void;
  updateCustomRange: (widgetId: string, field: 'startDate' | 'endDate', val: string) => void;
}

const SVGChart: React.FC<{ results: any[], rangeType: string }> = ({ results, rangeType }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 450, height: 180 });
  const [hoverInfo, setHoverInfo] = useState<{
    x: number;
    time: number;
    points: { attr: string; value: number; color: string }[];
  } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: width || 450,
          height: Math.max(height - 24, 140)
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  if (!results || results.length === 0) return <div className="text-xs text-muted-foreground">No chart data</div>;

  const { width, height } = dimensions;
  const paddingLeft = 45;
  const paddingRight = 15;
  const paddingTop = 20;
  const paddingBottom = 30;

  let allPoints: any[] = [];
  results.forEach(r => {
    if (Array.isArray(r.data)) {
      allPoints = [...allPoints, ...r.data];
    }
  });

  if (allPoints.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground bg-slate-950/20 rounded">
        Waiting for telemetry log entries...
      </div>
    );
  }

  const minVal = Math.min(...allPoints.map(p => p.value));
  const maxVal = Math.max(...allPoints.map(p => p.value));
  const valRange = maxVal - minVal || 1;

  const timestamps = allPoints.map(p => new Date(p.timestamp).getTime());
  const minTime = Math.min(...timestamps);
  const maxTime = Math.max(...timestamps);
  const timeRange = maxTime - minTime || 1;

  const lineColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444'];
  const fillColors = [
    'rgba(16, 185, 129, 0.08)',
    'rgba(59, 130, 246, 0.08)',
    'rgba(245, 158, 11, 0.08)',
    'rgba(239, 68, 68, 0.08)'
  ];

  const getUnit = (attrName: string) => {
    const n = attrName.toLowerCase();
    if (n.startsWith('rssi')) return 'dBm';
    if (n.includes('temperature') || n.includes('temp')) return '°C';
    if (n.includes('humidity') || n.includes('hum')) return '%';
    if (n.includes('battery') || n.includes('voltage') || n.includes('volt')) return 'V';
    if (n.includes('co2') || n.includes('co')) return 'ppm';
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

  const unitLabel = results[0] ? getUnit(results[0].attr) : '';

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
    <div ref={containerRef} className="w-full h-full flex flex-col p-1 justify-between bg-transparent rounded-lg relative overflow-hidden">
      {hoverInfo && (
        <div 
          className="absolute z-30 bg-popover/95 border border-border text-popover-foreground text-[9px] rounded shadow-md p-1.5 pointer-events-none flex flex-col gap-1 min-w-[120px] backdrop-blur-sm transition-all duration-75"
          style={{
            left: `${(hoverInfo.x / width) * 100}%`,
            top: '10%',
            transform: hoverInfo.x > width / 2 ? 'translateX(-105%)' : 'translateX(5%)'
          }}
        >
          <div className="font-bold border-b border-border pb-0.5 mb-0.5 text-slate-500 dark:text-slate-400">
            {new Date(hoverInfo.time).toLocaleTimeString()}
          </div>
          {hoverInfo.points.map((pt, idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: pt.color }} />
                <span className="truncate max-w-[100px] font-semibold">{pt.attr}:</span>
              </div>
              <span className="font-bold font-mono">{pt.value.toFixed(1)}</span>
            </div>
          ))}
        </div>
      )}

      <svg 
        viewBox={`0 0 ${width} ${height}`} 
        style={{ width: '100%', height: `${height}px` }}
        className="overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {unitLabel && (
          <text
            x={12}
            y={(height - paddingTop - paddingBottom) / 2 + paddingTop}
            transform={`rotate(-90 12 ${(height - paddingTop - paddingBottom) / 2 + paddingTop})`}
            textAnchor="middle"
            className="fill-slate-500 dark:fill-slate-400 font-extrabold text-[9px]"
          >
            {unitLabel}
          </text>
        )}

        {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
          const y = paddingTop + (1 - ratio) * (height - paddingTop - paddingBottom);
          const val = minVal + ratio * valRange;
          return (
            <g key={idx}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="currentColor"
                className="text-slate-200 dark:text-slate-800"
                strokeWidth="0.5"
                strokeDasharray="4 4"
                opacity="0.6"
              />
              <text
                x={paddingLeft - 8}
                y={y + 3}
                textAnchor="end"
                className="fill-slate-600 dark:fill-slate-300 font-bold text-[8px]"
              >
                {val.toFixed(1)}
              </text>
            </g>
          );
        })}

        {[0, 0.5, 1].map((ratio, idx) => {
          const x = paddingLeft + ratio * (width - paddingLeft - paddingRight);
          const timeVal = minTime + ratio * timeRange;
          return (
            <g key={idx}>
              <line
                x1={x}
                y1={height - paddingBottom}
                x2={x}
                y2={height - paddingBottom + 4}
                stroke="currentColor"
                className="text-slate-300 dark:text-slate-700"
                strokeWidth="1"
              />
              <text
                x={x}
                y={height - paddingBottom + 14}
                textAnchor="middle"
                className="fill-slate-600 dark:fill-slate-300 font-bold text-[8px]"
              >
                {formatTimeLabel(timeVal)}
              </text>
            </g>
          );
        })}

        {results.map((r, sIdx) => {
          if (!Array.isArray(r.data) || r.data.length === 0) return null;
          
          const coordPoints = r.data.map((p: any) => {
            const t = new Date(p.timestamp).getTime();
            const x = paddingLeft + ((t - minTime) / timeRange) * (width - paddingLeft - paddingRight);
            const y = paddingTop + (1 - (p.value - minVal) / valRange) * (height - paddingTop - paddingBottom);
            return { x, y };
          });

          if (coordPoints.length === 0) return null;

          const strokeColor = lineColors[sIdx % lineColors.length];
          const fillColor = fillColors[sIdx % fillColors.length];

          const ptsStr = coordPoints.map((p: any) => `${p.x},${p.y}`).join(' ');

          const areaPathStr = [
            `M ${coordPoints[0].x},${coordPoints[0].y}`,
            ...coordPoints.slice(1).map((p: any) => `L ${p.x},${p.y}`),
            `L ${coordPoints[coordPoints.length - 1].x},${height - paddingBottom}`,
            `L ${coordPoints[0].x},${height - paddingBottom}`,
            'Z'
          ].join(' ');

          return (
            <g key={sIdx}>
              <path d={areaPathStr} fill={fillColor} stroke="none" className="transition-all duration-300" />
              
              {coordPoints.length > 1 ? (
                <polyline
                  fill="none"
                  stroke={strokeColor}
                  strokeWidth="2.5"
                  points={ptsStr}
                  className="transition-all duration-300"
                />
              ) : (
                <circle cx={coordPoints[0].x} cy={coordPoints[0].y} r="3.5" fill={strokeColor} />
              )}
            </g>
          );
        })}

        {hoverInfo && (
          <g>
            <line
              x1={hoverInfo.x}
              y1={paddingTop}
              x2={hoverInfo.x}
              y2={height - paddingBottom}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            {results.map((r, sIdx) => {
              if (!Array.isArray(r.data) || r.data.length === 0) return null;
              const closest = r.data.reduce((prev: any, curr: any) => {
                return Math.abs(new Date(curr.timestamp).getTime() - hoverInfo.time) < Math.abs(new Date(prev.timestamp).getTime() - hoverInfo.time) ? curr : prev;
              });
              
              if (closest) {
                const y = paddingTop + (1 - (closest.value - minVal) / valRange) * (height - paddingTop - paddingBottom);
                return (
                  <circle 
                    key={sIdx} 
                    cx={hoverInfo.x} 
                    cy={y} 
                    r="4" 
                    fill={lineColors[sIdx % lineColors.length]} 
                    stroke="white" 
                    strokeWidth="1.5" 
                  />
                );
              }
              return null;
            })}
          </g>
        )}
      </svg>

      <div className="flex gap-4 justify-center items-center flex-wrap pt-1 border-t border-border mt-1">
        {results.map((r, sIdx) => (
          <div key={sIdx} className="flex items-center gap-1.5 text-[9px] font-bold text-slate-600 dark:text-slate-300 capitalize">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lineColors[sIdx % lineColors.length] }} />
            {r.attr}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChartWidget: React.FC<ChartWidgetProps> = ({
  widgetId,
  data,
  rangeInfo,
  setWidgetRange,
  updateCustomRange
}) => {
  return (
    <div className="w-full h-full flex flex-col justify-between">
      {/* Range Filter Toolbar */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-700/20 shrink-0 text-[10px] select-none">
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'realtime', label: 'LIVE' },
            { key: '1h', label: '1H' },
            { key: '24h', label: '1D' },
            { key: '7d', label: '1W' },
            { key: '30d', label: '1M' },
            { key: '1y', label: '1Y' },
            { key: 'custom', label: 'Custom' }
          ].map((p: any) => {
            const isActive = rangeInfo.range === p.key;
            return (
              <button
                key={p.key}
                onClick={() => setWidgetRange(widgetId, p.key)}
                className={`px-1.5 py-0.5 rounded font-extrabold uppercase transition-all cursor-pointer text-[9px] ${isActive ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30 border border-transparent'}`}
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
              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 max-w-[85px] outline-none text-[8px] font-bold text-slate-300"
            />
            <span className="text-slate-500 font-extrabold">-</span>
            <input
              type="date"
              value={rangeInfo.endDate || ''}
              onChange={(e) => updateCustomRange(widgetId, 'endDate', e.target.value)}
              className="bg-slate-900 border border-slate-700 rounded px-1 py-0.5 max-w-[85px] outline-none text-[8px] font-bold text-slate-300"
            />
          </div>
        )}
      </div>

      {/* Chart SVG */}
      <div className="flex-1 w-full relative pt-2">
        <SVGChart results={data} rangeType={rangeInfo.range} />
      </div>
    </div>
  );
};
