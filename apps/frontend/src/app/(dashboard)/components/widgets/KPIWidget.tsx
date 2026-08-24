import React from 'react';

interface KPIWidgetProps {
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

export const KPIWidget: React.FC<KPIWidgetProps> = ({ data, attribute }) => {
  const val = typeof data === 'number' ? data : null;
  const attrLabel = getAttributeLabel(attribute);

  return (
    <div className="w-full h-full flex flex-col items-center justify-center p-2 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
      <span className="text-4xl font-extrabold tracking-tight text-primary drop-shadow-sm">
        {val !== null ? val.toFixed(1) : '--'}
      </span>
      <span className="text-[10px] font-bold text-slate-400 capitalize mt-1 text-center">
        {attrLabel}
      </span>
    </div>
  );
};
