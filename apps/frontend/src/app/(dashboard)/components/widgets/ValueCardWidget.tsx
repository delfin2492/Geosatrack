import React from 'react';
import { Clock } from 'lucide-react';

interface ValueCardWidgetProps {
  data: any;
  attribute: string;
  widget?: any;
  primaryAccentColor?: string;
}

const getAttributeUnit = (attrKey: string, customUnit?: string, assetObj?: any) => {
  if (customUnit && customUnit.trim() !== '') return customUnit;

  // 1. Try reading unit from asset's registered attributes JSON description
  if (assetObj) {
    if (assetObj.description && typeof assetObj.description === 'string' && assetObj.description.startsWith('{')) {
      try {
        const desc = JSON.parse(assetObj.description);
        const matched = (desc.attributes || []).find((a: any) => a.name === attrKey || a.value === attrKey);
        if (matched && matched.unit) return matched.unit;
      } catch (e) {}
    }
    if (Array.isArray(assetObj.attributes)) {
      const matched = assetObj.attributes.find((a: any) => a.name === attrKey || a.value === attrKey);
      if (matched && matched.unit) return matched.unit;
    }
  }

  // 2. Standard attribute unit lookups
  const k = (attrKey || '').toLowerCase();
  if (k === 'temperature' || k.includes('temp')) return '°C';
  if (k === 'humidity' || k.includes('humid')) return '%';
  if (k === 'voltage' || k.includes('volt')) return 'V';
  if (k === 'current' || k.includes('amp')) return 'A';
  if (k.includes('power') || k === 'watt') return 'W';
  if (k.includes('battery') || k === 'batt') return 'V';
  if (k.includes('rssi')) return 'dBm';
  if (k.includes('accel') || k.includes('acceleration')) return 'm/s²';
  if (k === 'pitch' || k === 'roll' || k === 'yaw') return '°';
  if (k.includes('speed') || k.includes('velocity')) return 'km/h';
  if (k.includes('pressure')) return 'hPa';
  if (k.includes('distance')) return 'm';
  if (k.includes('lux') || k.includes('luminance')) return 'lx';
  if (k.includes('co2')) return 'ppm';

  return '';
};

export const ValueCardWidget: React.FC<ValueCardWidgetProps> = ({ data, attribute, widget }) => {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = React.useState({ width: 200, height: 120 });

  React.useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 200,
          height: entry.contentRect.height || 120
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  let val: any = null;
  let timestampStr: string | undefined = undefined;
  let assetObj: any = null;

  if (typeof data === 'number' || typeof data === 'string' || typeof data === 'boolean') {
    val = data;
  } else if (data && typeof data === 'object') {
    val = data.value !== undefined ? data.value : null;
    timestampStr = data.timestamp;
    assetObj = data.asset;
  }

  const attrKey = attribute || widget?.config?.attribute || '';
  const unit = getAttributeUnit(attrKey, widget?.config?.unit, assetObj);

  // Format display value directly (string, boolean, number)
  const renderDisplayValue = (v: any) => {
    if (v === null || v === undefined || v === '') return '--';
    if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  const displayVal = renderDisplayValue(val);

  // Format timestamp cleanly with Date and Time
  const formatTimestamp = (ts?: string) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return null;
      const dateStr = d.toLocaleDateString([], { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `${dateStr} ${timeStr}`;
    } catch (e) {
      return null;
    }
  };

  const formattedTime = formatTimestamp(timestampStr);

  // Dynamic proportional font scaling based on container dimensions
  const valueFontSize = Math.max(16, Math.min(dimensions.width * 0.18, dimensions.height * 0.35));
  const unitFontSize = Math.max(10, valueFontSize * 0.42);
  const timeFontSize = Math.max(9, Math.min(dimensions.width * 0.05, 13));
  const clockIconSize = Math.max(10, Math.min(dimensions.width * 0.05, 14));

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center p-3 relative overflow-hidden select-none">
      <span
        style={{ fontSize: `${valueFontSize}px` }}
        className="font-extrabold text-foreground tracking-tight text-center break-words max-w-full leading-none transition-all duration-75"
      >
        {displayVal}
      </span>

      {unit && (
        <span
          style={{ fontSize: `${unitFontSize}px` }}
          className="font-bold text-slate-500 dark:text-slate-400 mt-1 text-center leading-none transition-all duration-75"
        >
          {unit}
        </span>
      )}

      {formattedTime && (
        <div
          style={{ fontSize: `${timeFontSize}px` }}
          className="flex items-center gap-1 mt-2 font-semibold text-slate-400 dark:text-slate-500 leading-none transition-all duration-75"
        >
          <Clock style={{ width: `${clockIconSize}px`, height: `${clockIconSize}px` }} className="shrink-0" />
          <span>Updated: {formattedTime}</span>
        </div>
      )}
    </div>
  );
};




