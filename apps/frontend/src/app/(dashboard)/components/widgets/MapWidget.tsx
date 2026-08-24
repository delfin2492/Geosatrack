import React from 'react';
import { MapPin } from 'lucide-react';

interface MapWidgetProps {
  data: any;
  getBackendUrl: () => string;
}

export const MapWidget: React.FC<MapWidgetProps> = ({ data, getBackendUrl }) => {
  const mapData = data || {};
  const asset = mapData.asset || {};
  const zone = asset.zone || {};
  const attrs = mapData.attributes || [];

  if (!asset.planX || !asset.planY || !zone.floorPlanUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-slate-900/5 rounded">
        <MapPin className="w-8 h-8 text-slate-400 mb-2" />
        <span className="text-xs text-muted-foreground">Asset position or Floorplan unavailable</span>
      </div>
    );
  }

  const posX = (asset.planX / zone.width) * 100;
  const posY = (asset.planY / zone.height) * 100;

  return (
    <div className="w-full h-full flex flex-col justify-between p-2 relative overflow-hidden bg-slate-100 rounded-lg">
      <div className="flex-1 w-full relative overflow-hidden bg-white border rounded border-slate-200">
        <img
          src={`${getBackendUrl()}${zone.floorPlanUrl}`}
          alt="Floorplan"
          className="w-full h-full object-contain opacity-80"
        />
        <div
          className="absolute w-3.5 h-3.5 bg-blue-600 rounded-full border-2 border-white shadow -translate-x-1/2 -translate-y-1/2 flex items-center justify-center"
          style={{ left: `${posX}%`, top: `${posY}%` }}
        >
          <div className="absolute w-6 h-6 bg-blue-500 rounded-full animate-ping opacity-30" />
        </div>
      </div>

      {attrs.length > 0 && (
        <div className="absolute bottom-4 left-4 bg-slate-900/90 text-white rounded p-1.5 flex flex-col gap-0.5 text-[9px] max-w-[100px] shadow z-10 backdrop-blur-sm">
          <span className="font-bold border-b border-slate-700 pb-0.5 mb-0.5 truncate">{asset.name}</span>
          {attrs.map((at: any, idx: number) => (
            <div key={idx} className="flex justify-between gap-2">
              <span className="capitalize text-slate-400">{at.attr}:</span>
              <span className="font-mono font-bold text-blue-400">{at.value !== null ? at.value.toFixed(1) : '--'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
