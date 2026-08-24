import React, { useState, useEffect, useRef } from 'react';

interface GaugeWidgetProps {
  value: number;
  attribute: string;
  widget?: any;
}

const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY - radius * Math.sin(angleInRadians)
  };
};

const getArcPath = (x: number, y: number, radius: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(x, y, radius, startAngle);
  const end = polarToCartesian(x, y, radius, endAngle);
  const largeArcFlag = startAngle - endAngle <= 180 ? "0" : "1";
  return [
    "M", start.x, start.y,
    "A", radius, radius, 0, largeArcFlag, 1, end.x, end.y
  ].join(" ");
};

const getSpeedometerConfig = (attributeName: string, value: number, widgetConfig: any) => {
  const attr = (attributeName || 'temperature').toLowerCase();

  let minVal = widgetConfig?.min ?? 0;
  let maxVal = widgetConfig?.max ?? 50;
  let unit = '°C';
  let ticks = [0, 15, 35, 50];
  let tickAngles = [180, 126, 54, 0];
  let colors = ['#10b981', '#eab308', '#ef4444']; // green, yellow, red

  if (attr === 'humidity') {
    if (widgetConfig?.min === undefined) minVal = 0;
    if (widgetConfig?.max === undefined) maxVal = 100;
    unit = '%';
    ticks = [0, 30, 70, 100];
    tickAngles = [180, 126, 54, 0];
    colors = ['#10b981', '#eab308', '#ef4444'];
  } else if (attr === 'battery') {
    if (widgetConfig?.min === undefined) minVal = 2.0;
    if (widgetConfig?.max === undefined) maxVal = 4.0;
    unit = 'V';
    ticks = [2.0, 2.8, 3.2, 4.0];
    tickAngles = [180, 108, 72, 0];
    colors = ['#ef4444', '#eab308', '#10b981']; // Red (low), Yellow, Green (high)
  } else if (attr === 'rssi' || attr.startsWith('rssi_')) {
    if (widgetConfig?.min === undefined) minVal = -100;
    if (widgetConfig?.max === undefined) maxVal = -30;
    unit = 'dBm';
    ticks = [-100, -85, -65, -30];
    tickAngles = [180, 141.4, 90, 0];
    colors = ['#ef4444', '#eab308', '#10b981']; // Red (low), Yellow, Green (high)
  } else {
    if (widgetConfig?.min === undefined) minVal = 0;
    if (widgetConfig?.max === undefined) maxVal = 100;
    unit = widgetConfig?.unit || '';
    ticks = [minVal, minVal + (maxVal - minVal) * 0.3, minVal + (maxVal - minVal) * 0.7, maxVal];
    tickAngles = [180, 126, 54, 0];
  }

  // Override thresholds if custom thresholds are defined in config
  if (widgetConfig?.thresholds && widgetConfig.thresholds.length > 0) {
    const sortedThresholds = [...widgetConfig.thresholds].sort((a: any, b: any) => a.value - b.value);
    ticks = [minVal, ...sortedThresholds.map((t: any) => t.value), maxVal].filter((v, i, a) => a.indexOf(v) === i);
    colors = sortedThresholds.map((t: any) => t.color);
    if (colors.length < ticks.length - 1) {
      // Fallback color for final segment if not enough colors
      colors.push('#cbd5e1');
    }
    tickAngles = ticks.map(t => {
      const pct = (t - minVal) / (maxVal - minVal || 1);
      return 180 - pct * 180;
    });
  }

  const val = Math.max(minVal, Math.min(maxVal, value));
  const pct = (val - minVal) / (maxVal - minVal || 1);
  const needleAngle = 180 - pct * 180;

  return { minVal, maxVal, unit, ticks, tickAngles, colors, val, needleAngle };
};

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({ value, attribute, widget }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(200);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setWidth(entry.contentRect.width || 200);
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const getDynamicFontSize = (baseSize: number) => {
    if (width > 220) return baseSize;
    if (width > 160) return baseSize * 0.8;
    return baseSize * 0.6;
  };

  const widgetConfig = widget?.config || {};
  const { minVal, maxVal, unit, ticks, tickAngles, colors, val, needleAngle } = getSpeedometerConfig(attribute, value, widgetConfig);

  const cx = 100;
  const cy = 100;
  const r = 70;

  // Generate segments dynamically
  const segments = [];
  for (let i = 0; i < tickAngles.length - 1; i++) {
    const startAngle = tickAngles[i] - (i === 0 ? 4 : 2);
    const endAngle = tickAngles[i + 1] + (i === tickAngles.length - 2 ? 4 : 2);
    const path = getArcPath(cx, cy, r, startAngle, endAngle);
    segments.push({
      key: i,
      path,
      color: colors[i] || '#cbd5e1'
    });
  }

  const needleAngleRad = (needleAngle * Math.PI) / 180.0;
  const baseAngle1 = (needleAngle + 90) * Math.PI / 180.0;
  const baseAngle2 = (needleAngle - 90) * Math.PI / 180.0;

  const pTip = polarToCartesian(cx, cy, 62, needleAngle);
  const pBase1 = { x: cx + 4.5 * Math.cos(baseAngle1), y: cy - 4.5 * Math.sin(baseAngle1) };
  const pBase2 = { x: cx + 4.5 * Math.cos(baseAngle2), y: cy - 4.5 * Math.sin(baseAngle2) };
  const pCenter = { x: cx - 10 * Math.cos(needleAngleRad), y: cy + 10 * Math.sin(needleAngleRad) };

  const needlePoints = `${pBase1.x},${pBase1.y} ${pTip.x},${pTip.y} ${pBase2.x},${pBase2.y} ${pCenter.x},${pCenter.y}`;

  const tickLines = ticks.map((t, idx) => {
    const angle = tickAngles[idx];
    const start = polarToCartesian(cx, cy, 76, angle);
    const end = polarToCartesian(cx, cy, 81, angle);

    let labelRadius = 53;
    if (idx === 0 || idx === ticks.length - 1) {
      labelRadius = 88;
    }
    const labelPos = polarToCartesian(cx, cy, labelRadius, angle);

    let yOffset = 3;
    let xOffset = 0;
    if (idx === 0) { xOffset = 4; yOffset = 4; }
    if (idx === ticks.length - 1) { xOffset = -4; yOffset = 4; }

    return {
      key: idx,
      x1: start.x,
      y1: start.y,
      x2: end.x,
      y2: end.y,
      lx: labelPos.x + xOffset,
      ly: labelPos.y + yOffset,
      label: t.toString()
    };
  });

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-between pb-1 select-none overflow-hidden">
      <svg viewBox="0 0 200 135" className="w-full max-h-[160px] overflow-visible">
        {segments.map(seg => (
          <path key={seg.key} d={seg.path} fill="none" stroke={seg.color} strokeWidth="12" strokeLinecap="round" />
        ))}

        {tickLines.map(t => (
          <g key={t.key}>
            <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#cbd5e1" strokeWidth="1.5" />
            <text x={t.lx} y={t.ly} textAnchor="middle" style={{ fontSize: `${getDynamicFontSize(9)}px` }} className="fill-slate-400 font-extrabold">
              {t.label}
            </text>
          </g>
        ))}

        <text x={cx} y={cy - 12} textAnchor="middle" style={{ fontSize: `${getDynamicFontSize(18)}px` }} className="fill-slate-800 dark:fill-slate-200 font-extrabold">
          {val.toFixed(1)}
        </text>

        <polygon points={needlePoints} fill="#cbd5e1" stroke="#94a3b8" strokeWidth="0.5" className="transition-all duration-500 ease-out" />
        <circle cx={cx} cy={cy} r="8" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1.5" />
      </svg>

      <span style={{ fontSize: `${getDynamicFontSize(13)}px` }} className="font-extrabold text-slate-500 mt-[-5px]">
        {unit}
      </span>
    </div>
  );
};
