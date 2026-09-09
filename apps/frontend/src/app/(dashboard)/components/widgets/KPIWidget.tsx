import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import {
  Thermometer,
  Droplets,
  Battery,
  Radio,
  Activity,
  Zap,
  MapPin,
  HardDrive,
  Boxes,
  SlidersHorizontal,
  Folder,
  Globe,
  Car,
  Cpu,
  Truck,
  Wrench,
  Wifi,
  Gauge,
  Lightbulb,
  DoorClosed,
  Building,
  Box,
  Monitor,
  ChevronDown,
  Check,
  Eye,
  EyeOff,
  Navigation,
  Layers,
  Database,
  Server,
  Anchor,
  Compass,
  Tag,
  Tv
} from 'lucide-react';

interface KPIWidgetProps {
  data: number | {
    value: number | null;
    timestamp?: string;
    series?: { timestamp: string; value: number }[];
    asset?: any;
  } | null;
  attribute: string;
  widget?: any;
  dbAssetTypes?: any[];
  primaryAccentColor?: string;
  onUpdateTimeframe?: (timeframe: string) => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  MapPin,
  HardDrive,
  Activity,
  Boxes,
  Sliders: SlidersHorizontal,
  SlidersHorizontal,
  Folder,
  Globe,
  Car,
  Cpu,
  Radio,
  Zap,
  Truck,
  Wrench,
  Battery,
  Tag,
  Tv,
  Navigation,
  Layers,
  Wifi,
  Database,
  Server,
  Anchor,
  Gauge,
  Compass,
  Eye,
  EyeOff,
  Lightbulb,
  DoorClosed,
  Building,
  Box,
  Monitor,
  Thermometer,
  Droplets
};

const getKpiIconAndColor = (assetObj: any, attrKey: string, dbAssetTypes: any[], accentColor: string) => {
  let IconComp: React.ElementType = Activity;
  let color = accentColor || '#10b981';

  if (assetObj) {
    const t = String(assetObj.type || assetObj.code || assetObj.assetType || '').toUpperCase();

    // 1. Check matching Asset Type in tenant Appearance & Asset Styling (dbAssetTypes)
    if (Array.isArray(dbAssetTypes) && dbAssetTypes.length > 0) {
      const matched = dbAssetTypes.find((x: any) =>
        (x.code && x.code.toUpperCase() === t) ||
        (x.name && x.name.toUpperCase() === t) ||
        (x.id && (x.id === assetObj.assetTypeId || x.id === assetObj.typeId))
      );

      if (matched) {
        let iconName = matched.icon || assetObj.icon;
        let iconComp = (iconName && ICON_MAP[iconName]) ? ICON_MAP[iconName] : null;
        if (!iconComp) {
          if (t === 'ANCHOR') iconComp = MapPin;
          else if (t === 'TAG' || t.includes('BLE')) iconComp = HardDrive;
          else if (t === 'MESH_EYE_SENSOR' || t.includes('SENSOR')) iconComp = Eye;
          else iconComp = Boxes;
        }
        return { IconComp: iconComp, color: matched.color || assetObj.color || color };
      }
    }

    // 2. Direct icon attached to asset object
    if (assetObj.icon && ICON_MAP[assetObj.icon]) {
      return { IconComp: ICON_MAP[assetObj.icon], color: assetObj.color || color };
    }

    // 3. Known built-in type fallbacks
    if (t === 'ANCHOR') return { IconComp: MapPin, color: assetObj.color || '#f43f5e' };
    if (t === 'TAG' || t.includes('BLE')) return { IconComp: HardDrive, color: assetObj.color || '#3b82f6' };
    if (t === 'MESH_EYE_SENSOR' || t.includes('SENSOR')) return { IconComp: Eye, color: assetObj.color || '#10b981' };
    if (t === 'FORKLIFT' || t.includes('CARGO') || t.includes('THINGS')) return { IconComp: Boxes, color: assetObj.color || '#d97706' };
    if (t === 'LIGHT' || t.includes('MACHINE')) return { IconComp: Lightbulb, color: assetObj.color || '#eab308' };
    if (t === 'BUILDING' || t.includes('ROOM') || t.includes('DOOR')) return { IconComp: Building, color: assetObj.color || '#8b5cf6' };
    if (t === 'CITY' || t.includes('WEATHER')) return { IconComp: Globe, color: assetObj.color || '#06b6d4' };
    if (t === 'CAR' || t.includes('VEHICLE') || t.includes('TRUCK')) return { IconComp: Car, color: assetObj.color || '#0284c7' };
    if (t.includes('TELTONIKA') || t.includes('CPU')) return { IconComp: Cpu, color: assetObj.color || '#6366f1' };
    if (t.includes('MQTT') || t.includes('RADIO')) return { IconComp: Radio, color: assetObj.color || '#8b5cf6' };

    // 4. Fallback by Asset Name
    const assetNameLower = (assetObj.name || '').toLowerCase();
    if (assetNameLower.includes('eye') || assetNameLower.includes('mesh')) return { IconComp: Eye, color: assetObj.color || color };
    if (assetNameLower.includes('lampu') || assetNameLower.includes('light')) return { IconComp: Lightbulb, color: assetObj.color || color };
    if (assetNameLower.includes('mobil') || assetNameLower.includes('car')) return { IconComp: Car, color: assetObj.color || color };
    if (assetNameLower.includes('door') || assetNameLower.includes('pintu')) return { IconComp: DoorClosed, color: assetObj.color || color };
    if (assetNameLower.includes('building') || assetNameLower.includes('gedung')) return { IconComp: Building, color: assetObj.color || color };
    if (assetNameLower.includes('forklift') || assetNameLower.includes('cargo')) return { IconComp: Boxes, color: assetObj.color || color };
    if (assetNameLower.includes('tag')) return { IconComp: HardDrive, color: assetObj.color || color };
    if (assetNameLower.includes('anchor')) return { IconComp: MapPin, color: assetObj.color || color };
  }

  // 5. Fallback by Attribute Key if no asset object is attached
  const k = (attrKey || '').toLowerCase();
  if (k === 'temperature') return { IconComp: Thermometer, color: accentColor || '#ef4444' };
  if (k === 'humidity') return { IconComp: Droplets, color: accentColor || '#06b6d4' };
  if (k === 'battery') return { IconComp: Battery, color: accentColor || '#10b981' };
  if (k.startsWith('rssi')) return { IconComp: Radio, color: accentColor || '#8b5cf6' };
  if (k.includes('co2')) return { IconComp: Activity, color: accentColor || '#10b981' };

  return { IconComp: Activity, color: accentColor || '#10b981' };
};

export const KPIWidget: React.FC<KPIWidgetProps> = ({ data, attribute, widget, dbAssetTypes = [], primaryAccentColor = '#10b981', onUpdateTimeframe }) => {
  let val: number | null = null;
  let series: { timestamp: string; value: number }[] = [];
  let assetObj: any = null;

  if (typeof data === 'number') {
    val = data;
  } else if (data && typeof data === 'object') {
    val = typeof data.value === 'number' ? data.value : null;
    series = Array.isArray(data.series) ? data.series : [];
    assetObj = data.asset;
  }

  const widgetConfig = widget?.config || {};
  const decimals = widgetConfig.decimals !== undefined ? Math.max(0, Number(widgetConfig.decimals)) : 0;
  const showValueAs = widgetConfig.showValueAs || 'Absolute';

  const [localTimeframe, setLocalTimeframe] = useState<string>(widgetConfig.timeframe || 'Hour');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [dropdownCoords, setDropdownCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [hoveredPoint, setHoveredPoint] = useState<{ value: number; timestamp?: string; x: number; y: number } | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (widgetConfig.timeframe) {
      setLocalTimeframe(widgetConfig.timeframe);
    }
  }, [widgetConfig.timeframe]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    const handleScrollOrResize = () => {
      if (isDropdownOpen) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isDropdownOpen]);

  const timeframeOptions = [
    { value: 'Hour', label: 'Hour', sub: '1h' },
    { value: 'Day', label: 'Day', sub: '24h' },
    { value: 'Week', label: 'Week', sub: '7d' },
    { value: 'Month', label: 'Month', sub: '30d' }
  ];

  const handleToggleDropdown = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isDropdownOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      const dropdownHeight = 165;
      const dropdownWidth = 135;
      const navbarOffset = 70;

      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top - navbarOffset;

      let top: number;
      if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
        top = rect.bottom + 4;
        if (top + dropdownHeight > window.innerHeight - 10) {
          top = Math.max(10, window.innerHeight - dropdownHeight - 10);
        }
      } else {
        top = rect.top - dropdownHeight - 4;
        if (top < navbarOffset) {
          top = rect.bottom + 4;
        }
      }

      let left = rect.right - dropdownWidth;
      if (left < 10) left = 10;
      if (left + dropdownWidth > window.innerWidth - 10) {
        left = window.innerWidth - dropdownWidth - 10;
      }

      setDropdownCoords({ top, left });
    }
    setIsDropdownOpen(!isDropdownOpen);
  };

  const handleSelectTimeframe = (val: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocalTimeframe(val);
    setIsDropdownOpen(false);
    if (onUpdateTimeframe) {
      onUpdateTimeframe(val);
    }
  };

  const attrKey = attribute || widgetConfig.attribute || 'temperature';

  const getAttributeUnit = (attrKeyName: string, customUnit?: string, targetAsset?: any) => {
    if (customUnit && customUnit.trim() !== '') return customUnit;
    if (targetAsset) {
      if (targetAsset.description && typeof targetAsset.description === 'string' && targetAsset.description.startsWith('{')) {
        try {
          const desc = JSON.parse(targetAsset.description);
          const matched = (desc.attributes || []).find((a: any) => a.name === attrKeyName || a.value === attrKeyName);
          if (matched && matched.unit) return matched.unit;
        } catch (e) {}
      }
      if (Array.isArray(targetAsset.attributes)) {
        const matched = targetAsset.attributes.find((a: any) => a.name === attrKeyName || a.value === attrKeyName);
        if (matched && matched.unit) return matched.unit;
      }
    }
    const k = (attrKeyName || '').toLowerCase();
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

  const unit = getAttributeUnit(attrKey, widgetConfig.unit, assetObj);

  // Compute Delta / Sub-value
  let deltaStr = '';
  if (series.length >= 2 && val !== null) {
    const firstVal = series[0].value;
    const diff = val - firstVal;
    if (showValueAs === 'Percentage') {
      const pct = firstVal !== 0 ? (diff / firstVal) * 100 : 0;
      deltaStr = pct >= 0 ? `+${pct.toFixed(1)}%` : `${pct.toFixed(1)}%`;
    } else {
      deltaStr = diff >= 0 ? `+${diff.toFixed(decimals)}` : `${diff.toFixed(decimals)}`;
    }
  } else if (val !== null) {
    deltaStr = `+${val.toFixed(decimals)}`;
  }

  // Downsample raw points for longer timeframes
  let rawItems: { value: number; timestamp?: string }[] = series.map(s => ({
    value: s.value,
    timestamp: s.timestamp
  }));

  if (rawItems.length < 2 && val !== null) {
    const now = Date.now();
    rawItems = [
      { value: val * 0.95, timestamp: new Date(now - 5 * 60000).toISOString() },
      { value: val * 0.98, timestamp: new Date(now - 4 * 60000).toISOString() },
      { value: val * 0.94, timestamp: new Date(now - 3 * 60000).toISOString() },
      { value: val * 1.02, timestamp: new Date(now - 2 * 60000).toISOString() },
      { value: val * 0.99, timestamp: new Date(now - 1 * 60000).toISOString() },
      { value: val, timestamp: new Date(now).toISOString() }
    ];
  }

  const targetPointCount = 28;
  let chartPoints: { value: number; timestamp?: string; x: number; y: number }[] = [];
  let linePath = '';
  let areaPath = '';

  if (rawItems.length >= 2) {
    let sampled: { value: number; timestamp?: string }[] = [];
    if (rawItems.length > targetPointCount) {
      const bucketSize = Math.ceil(rawItems.length / targetPointCount);
      for (let i = 0; i < rawItems.length; i += bucketSize) {
        const chunk = rawItems.slice(i, i + bucketSize);
        const avgVal = chunk.reduce((sum, v) => sum + v.value, 0) / chunk.length;
        const midTs = chunk[Math.floor(chunk.length / 2)]?.timestamp;
        sampled.push({ value: avgVal, timestamp: midTs });
      }
    } else {
      sampled = rawItems;
    }

    const values = sampled.map(s => s.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;

    const coords: string[] = [];
    chartPoints = sampled.map((item, idx) => {
      const x = (idx / (sampled.length - 1)) * 200;
      const y = 72 - ((item.value - min) / range) * 62;
      coords.push(`${x.toFixed(1)},${y.toFixed(1)}`);
      return {
        value: item.value,
        timestamp: item.timestamp,
        x,
        y
      };
    });

    linePath = `M ${coords.join(' L ')}`;
    areaPath = `${linePath} L 200,80 L 0,80 Z`;
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current || chartPoints.length === 0) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, mouseX / rect.width));
    const svgX = ratio * 200;

    let closest = chartPoints[0];
    let minDistance = Math.abs(chartPoints[0].x - svgX);
    for (let i = 1; i < chartPoints.length; i++) {
      const dist = Math.abs(chartPoints[i].x - svgX);
      if (dist < minDistance) {
        minDistance = dist;
        closest = chartPoints[i];
      }
    }
    setHoveredPoint(closest);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const formatTimestamp = (ts?: string) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return ts;
      const now = new Date();
      const isToday = d.toDateString() === now.toDateString();
      if (isToday) {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }
      return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } catch (e) {
      return ts;
    }
  };

  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 220, height: 160 });

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (let entry of entries) {
        setDimensions({
          width: entry.contentRect.width || 220,
          height: entry.contentRect.height || 160
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  const mainColor = primaryAccentColor || '#b91c1c';
  const { IconComp, color: iconColor } = getKpiIconAndColor(assetObj, attrKey, dbAssetTypes, mainColor);

  const displayVal = hoveredPoint ? hoveredPoint.value : val;

  // Proportional font and icon sizes based on widget dimensions
  const mainValueFontSize = Math.max(18, Math.min(dimensions.width * 0.14, dimensions.height * 0.28));
  const unitFontSize = Math.max(12, mainValueFontSize * 0.55);
  const iconSize = Math.max(14, Math.min(dimensions.width * 0.08, dimensions.height * 0.15, 28));
  const deltaFontSize = Math.max(10, Math.min(dimensions.width * 0.04, 14));

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col justify-between p-3 relative select-none">
      {/* Main Value Row */}
      <div className="flex items-baseline justify-between mt-1 z-10 shrink-0">
        <div className="flex items-center gap-2">
          {/* Asset Icon */}
          <IconComp style={{ width: `${iconSize}px`, height: `${iconSize}px`, color: iconColor }} className="shrink-0 transition-all duration-75" />

          {/* Main Numeric Value + Unit */}
          <div className="flex items-baseline gap-1">
            <span
              style={{ fontSize: `${mainValueFontSize}px` }}
              className="font-extrabold text-foreground tracking-tight transition-all duration-75 leading-none"
            >
              {displayVal !== null ? displayVal.toFixed(decimals) : '--'}
            </span>
            {unit && (
              <span
                style={{ fontSize: `${unitFontSize}px` }}
                className="font-light text-slate-500 dark:text-slate-400 transition-all duration-75 leading-none"
              >
                {unit}
              </span>
            )}
          </div>
        </div>

        {/* Delta / Sub-value or Hover timestamp indicator */}
        {hoveredPoint ? (
          <span
            style={{ fontSize: `${deltaFontSize}px` }}
            className="font-mono font-bold text-slate-500 dark:text-slate-400 animate-in fade-in duration-75"
          >
            {formatTimestamp(hoveredPoint.timestamp)}
          </span>
        ) : (
          deltaStr && (
            <span
              style={{ fontSize: `${deltaFontSize}px` }}
              className="font-bold text-slate-600 dark:text-slate-300 transition-all duration-75"
            >
              {deltaStr}
            </span>
          )
        )}
      </div>

      {/* Tall Sparkline Chart Section */}
      <div className="w-full flex-1 min-h-[90px] relative mt-2 overflow-hidden flex flex-col justify-end">
        {linePath ? (
          <>
            <svg
              ref={svgRef}
              viewBox="0 0 200 80"
              preserveAspectRatio="none"
              className="w-full h-full overflow-visible flex-1 cursor-crosshair"
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              onTouchMove={(e) => {
                if (e.touches[0]) {
                  const touch = e.touches[0];
                  const fakeEvent = { clientX: touch.clientX } as React.MouseEvent<SVGSVGElement>;
                  handleMouseMove(fakeEvent);
                }
              }}
            >
              <defs>
                <linearGradient id={`kpi-grad-${widget?.id || 'default'}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={mainColor} stopOpacity="0.35" />
                  <stop offset="100%" stopColor={mainColor} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Filled Area Gradient */}
              <path d={areaPath} fill={`url(#kpi-grad-${widget?.id || 'default'})`} />

              {/* Sparkline Line */}
              <path d={linePath} fill="none" stroke={mainColor} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

              {/* Active Hover Guide Line & Highlighted Dot */}
              {hoveredPoint && (
                <g className="animate-in fade-in duration-75">
                  <line
                    x1={hoveredPoint.x}
                    y1={0}
                    x2={hoveredPoint.x}
                    y2={80}
                    stroke={mainColor}
                    strokeWidth="1.2"
                    strokeDasharray="2 2"
                    opacity="0.8"
                  />
                  <circle
                    cx={hoveredPoint.x}
                    cy={hoveredPoint.y}
                    r="4.5"
                    fill="#ffffff"
                    stroke={mainColor}
                    strokeWidth="2.5"
                  />
                </g>
              )}
            </svg>

            {/* Hover Tooltip Badge */}
            {hoveredPoint && (
              <div
                className="absolute pointer-events-none z-20 bg-slate-900/90 text-white dark:bg-slate-100 dark:text-slate-900 backdrop-blur-md px-2 py-0.5 rounded-md shadow-lg border border-slate-700/50 flex flex-col items-center gap-0.5 transition-all duration-75"
                style={{
                  left: `${Math.min(82, Math.max(18, (hoveredPoint.x / 200) * 100))}%`,
                  top: `${Math.max(6, Math.min(60, (hoveredPoint.y / 80) * 100 - 30))}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                <div className="flex items-center gap-1 font-extrabold text-[11px] leading-none">
                  <span>{hoveredPoint.value.toFixed(decimals)}</span>
                  {unit && <span className="opacity-80 text-[10px] font-normal">{unit}</span>}
                </div>
                {hoveredPoint.timestamp && (
                  <span className="text-[8px] opacity-75 font-mono leading-none whitespace-nowrap">
                    {formatTimestamp(hoveredPoint.timestamp)}
                  </span>
                )}
              </div>
            )}
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[10px] text-muted-foreground font-mono">
            No history chart
          </div>
        )}

        {/* Interactive Timeframe Button */}
        <div className="absolute bottom-0 right-0 z-30">
          <button
            ref={buttonRef}
            type="button"
            onClick={handleToggleDropdown}
            className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-all cursor-pointer select-none active:scale-95 flex items-center gap-1 border border-border/60 bg-background/80 backdrop-blur-xs shadow-2xs"
            style={{ color: mainColor }}
            title="Select timeframe"
          >
            <span>{localTimeframe.toUpperCase()}</span>
            <ChevronDown className={`w-3 h-3 transition-transform duration-150 ${isDropdownOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {/* Portal Dropdown Menu attached to document.body - Never clipped by parent overflow! */}
      {isDropdownOpen && typeof window !== 'undefined' && ReactDOM.createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: `${dropdownCoords.top}px`,
            left: `${dropdownCoords.left}px`,
            width: '130px',
            zIndex: 99999
          }}
          className="bg-card border border-border/90 rounded-xl shadow-2xl overflow-hidden backdrop-blur-md animate-in fade-in zoom-in-95 duration-100 p-1 select-none"
        >
          <div className="text-[10px] font-bold text-muted-foreground uppercase px-2.5 py-1 tracking-wider border-b border-border/40">
            Timeframe
          </div>
          {timeframeOptions.map((opt) => {
            const isSelected = localTimeframe.toLowerCase() === opt.value.toLowerCase();
            return (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => handleSelectTimeframe(opt.value, e)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                  isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted text-foreground'
                }`}
                style={isSelected ? { color: mainColor } : undefined}
              >
                <span>{opt.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-muted-foreground font-mono">{opt.sub}</span>
                  {isSelected && <Check className="w-3.5 h-3.5" style={{ color: mainColor }} />}
                </div>
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};




