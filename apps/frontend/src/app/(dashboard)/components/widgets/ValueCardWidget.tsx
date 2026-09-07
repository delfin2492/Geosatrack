import React from 'react';
import { Clock } from 'lucide-react';

interface ValueCardWidgetProps {
  data: number | { value: number | null; timestamp?: string } | null;
  attribute: string;
  widget?: any;
  primaryAccentColor?: string;
}

const getAttributeLabel = (value: string) => {
  const mapping: Record<string, string> = {
    temperature: 'Temperature (°C)',
    humidity: 'Humidity (%)',
    battery: 'Battery (V)',
    rssi: 'RSSI (dBm)',
    rssi_anchor1: 'RSSI Anchor 1 (dBm)',
    rssi_anchor2: 'RSSI Anchor 2 (dBm)',
    rssi_anchor3: 'RSSI Anchor 3 (dBm)',
    rssi_anchor4: 'RSSI Anchor 4 (dBm)'
  };
  return mapping[value] || value;
};

export const ValueCardWidget: React.FC<ValueCardWidgetProps> = ({ data, attribute, widget, primaryAccentColor }) => {
  let val: number | null = null;
  let timestampStr: string | undefined = undefined;

  if (typeof data === 'number') {
    val = data;
  } else if (data && typeof data === 'object') {
    val = typeof data.value === 'number' ? data.value : null;
    timestampStr = data.timestamp;
  }

  const decimals = widget?.config?.decimals !== undefined ? Math.max(0, Number(widget.config.decimals)) : 1;
  const attrKey = attribute || widget?.config?.attribute || '';
  const attrLabel = getAttributeLabel(attrKey);

  // Format timestamp cleanly
  const formatTimestamp = (ts?: string) => {
    if (!ts) return null;
    try {
      const d = new Date(ts);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch (e) {
      return null;
    }
  };

  const formattedTime = formatTimestamp(timestampStr);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-3 bg-card rounded-xl border border-border relative overflow-hidden shadow-2xs">
      <span className="text-3xl font-extrabold text-foreground tracking-tight">
        {val !== null ? val.toFixed(decimals) : '--'}
      </span>
      <span className="text-xs font-bold text-slate-400 capitalize mt-1 text-center">
        {attrLabel}
      </span>

      {formattedTime && (
        <div className="flex items-center gap-1 mt-2 text-[10px] font-semibold text-slate-400 dark:text-slate-500">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Updated: {formattedTime}</span>
        </div>
      )}
    </div>
  );
};
