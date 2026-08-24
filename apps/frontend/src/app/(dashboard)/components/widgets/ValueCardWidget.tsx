import React from 'react';

interface ValueCardWidgetProps {
  data: number | null;
  attribute: string;
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

export const ValueCardWidget: React.FC<ValueCardWidgetProps> = ({ data, attribute }) => {
  const val = typeof data === 'number' ? data : null;
  const attrLabel = getAttributeLabel(attribute);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <span className="text-3xl font-bold text-slate-700 dark:text-slate-200">
        {val !== null ? val.toFixed(1) : '--'}
      </span>
      <span className="text-[10px] font-bold text-slate-400 capitalize mt-1 text-center">
        {attrLabel}
      </span>
    </div>
  );
};
