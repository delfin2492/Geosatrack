import React from 'react';
import { MapPin, Layers, Globe } from 'lucide-react';
import FloorMap from '../../../components/FloorMap';
import { getAssetMarkerIcon } from '../../../lib/icon-utils';

interface MapWidgetProps {
  data: any;
  widget?: any;
  allAssets?: any[];
  dbAssetTypes?: any[];
  primaryAccentColor?: string;
  getBackendUrl: () => string;
  zones?: any[];
}

const getAttributeIcon = (attrName: string) => {
  const n = (attrName || '').toLowerCase();
  if (n.includes('temp')) return '🌡️';
  if (n.includes('hum')) return '💧';
  if (n.includes('batt') || n.includes('volt')) return '🔋';
  if (n.includes('rssi')) return '📶';
  if (n.includes('co2')) return '☁️';
  return '📊';
};

const getAttributeUnit = (attrName: string) => {
  const n = (attrName || '').toLowerCase();
  if (n.includes('temp')) return '°C';
  if (n.includes('hum')) return '%';
  if (n.includes('batt') || n.includes('volt')) return 'V';
  if (n.includes('rssi')) return 'dBm';
  if (n.includes('co2')) return 'ppm';
  return '';
};

const getThresholdColor = (val: number, thresholdsList?: { color: string; value: number }[], fallbackColor = '#10b981') => {
  if (!thresholdsList || thresholdsList.length === 0) return fallbackColor;
  const sorted = [...thresholdsList].sort((a, b) => b.value - a.value);
  for (const t of sorted) {
    if (val >= t.value) return t.color;
  }
  return thresholdsList[thresholdsList.length - 1]?.color || fallbackColor;
};

const getLatestAssetAttributeValue = (a: any, targetAttr: string, mapData: any) => {
  if (!a || !targetAttr) return null;
  const normAttr = String(targetAttr || '').toLowerCase();

  // 1. Check fetched telemetry data for this asset
  if (mapData?.telemetryByAsset?.[a.id]?.[normAttr] !== undefined && mapData?.telemetryByAsset?.[a.id]?.[normAttr] !== null) {
    return mapData.telemetryByAsset[a.id][normAttr];
  }

  // 2. Check matchedAttr in a.attributes or mapData.attributes
  const attrs = a.attributes || (a.id === mapData.asset?.id ? mapData.attributes : []) || [];
  const matchedAttr = attrs.find((at: any) => String(at.attr || '').toLowerCase() === normAttr);
  if (matchedAttr && matchedAttr.value !== null && matchedAttr.value !== undefined && matchedAttr.value !== '') {
    return matchedAttr.value;
  }

  // 3. Check tag properties
  if (a.tag) {
    if (a.tag[targetAttr] !== undefined && a.tag[targetAttr] !== null) {
      return a.tag[targetAttr];
    }
    if (a.tag[normAttr] !== undefined && a.tag[normAttr] !== null) {
      return a.tag[normAttr];
    }
  }

  // 4. Check description JSON registered attributes
  if (a.description) {
    try {
      const desc = JSON.parse(a.description);
      const registered = desc.attributes || [];
      const found = registered.find((at: any) => String(at.name || '').toLowerCase() === normAttr);
      if (found && found.value !== undefined && found.value !== null && found.value !== '') {
        return found.value;
      }
    } catch (e) { }
  }

  return null;
};

const computeRssiPosition = (asset: any, zoneAnchors: any[]): { x: number; y: number } | null => {
  let rssiList: { x: number; y: number; rssi: number; anchorName: string }[] = [];

  try {
    if (asset.description && asset.description.startsWith('{')) {
      const desc = JSON.parse(asset.description);
      const attrs: any[] = desc.attributes || [];
      attrs.forEach((attr: any) => {
        if (attr.name.startsWith('rssi_') && attr.value !== undefined && attr.value !== null && attr.value !== '') {
          const rssiVal = Number(attr.value);
          if (!isNaN(rssiVal)) {
            const anchorId = attr.name.replace('rssi_', '');
            const matchedAnchor = zoneAnchors.find(
              (an: any) =>
                an.id === anchorId ||
                an.name.toLowerCase().replace(/\s+/g, '_') === anchorId.toLowerCase() ||
                an.name.toLowerCase().includes(anchorId.toLowerCase())
            );
            if (matchedAnchor) {
              rssiList.push({ x: matchedAnchor.x, y: matchedAnchor.y, rssi: rssiVal, anchorName: matchedAnchor.name });
            }
          }
        }
      });
    }
  } catch (e) {}

  if (rssiList.length === 0 && asset.tag?.signals) {
    try {
      const sigs = JSON.parse(asset.tag.signals);
      if (Array.isArray(sigs)) {
        sigs.forEach((s: any) => {
          if (s.rssi !== undefined && s.rssi !== null) {
            const matchedAnchor = zoneAnchors.find(
              (an: any) =>
                an.id === s.anchorId ||
                an.name === s.anchorName ||
                an.name.toLowerCase().includes((s.anchorName || '').toLowerCase())
            );
            if (matchedAnchor) {
              rssiList.push({ x: matchedAnchor.x, y: matchedAnchor.y, rssi: Number(s.rssi), anchorName: matchedAnchor.name });
            }
          }
        });
      }
    } catch (e) {}
  }

  if (rssiList.length === 0) return null;

  rssiList.sort((a, b) => b.rssi - a.rssi);
  const top = rssiList.slice(0, 3);

  let exponent = 2.0;
  if (top.length > 1) {
    const delta = top[0].rssi - top[1].rssi;
    if (delta <= 3) exponent = 2.0;
    else if (delta >= 15) exponent = 6.0;
    else exponent = 2.0 + ((delta - 3) / 12) * 4.0;
  } else if (top.length === 1) {
    exponent = 6.0;
  }

  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  top.forEach((item) => {
    const normalizedRssi = Math.max(-100, Math.min(-30, item.rssi));
    const weight = Math.pow(normalizedRssi + 100, exponent);
    weightedX += item.x * weight;
    weightedY += item.y * weight;
    totalWeight += weight;
  });

  if (totalWeight <= 0) return null;
  return { x: weightedX / totalWeight, y: weightedY / totalWeight };
};

export const MapWidget: React.FC<MapWidgetProps> = ({
  data,
  widget,
  allAssets = [],
  dbAssetTypes = [],
  primaryAccentColor = '#10b981',
  getBackendUrl,
  zones = []
}) => {
  const [selectedMapAssetId, setSelectedMapAssetId] = React.useState<string | null>(null);


  const mapData = data || {};
  const asset = mapData.asset || {};
  const zone = asset.zone || {};

  const config = widget?.config || {};
  const mapType = config.mapType || (widget?.type === 'gis_map' ? 'gis' : 'rtls'); // 'rtls' | 'gis'
  const showLabels = config.showLabels ?? true;
  const showUnits = config.showUnits ?? true;
  const targetAttribute = config.attribute || 'humidity';
  const assetType = config.assetType || '';
  const allAssetsOfType = config.allAssetsOfType ?? true;
  const thresholds = config.thresholds || [];

  // Filter assets by assetType if allAssetsOfType is enabled
  let filteredAssets = allAssets;
  if (assetType) {
    filteredAssets = allAssets.filter(a => String(a.type || '').toUpperCase() === String(assetType).toUpperCase());
  }

  if (mapType === 'gis') {
    // Mode GIS: OpenStreetMap / FloorMap GIS View
    const selectedAssetIds: string[] = config.selectedAssetIds || (config.assetId ? [config.assetId] : []);

    let baseList: any[] = [];
    if (allAssetsOfType) {
      baseList = filteredAssets.length > 0 ? filteredAssets : allAssets;
    } else if (selectedAssetIds.length > 0) {
      baseList = allAssets.filter((a: any) => selectedAssetIds.includes(a.id));
    } else if (asset.id) {
      baseList = [asset];
    }

    const mapAssetsList = (baseList.length > 0 ? baseList : (asset.id ? [asset] : [])).map((a: any) => {
      const attrVal = getLatestAssetAttributeValue(a, targetAttribute, mapData);
      const unitStr = showUnits ? (getAttributeUnit(targetAttribute) ? ` ${getAttributeUnit(targetAttribute)}` : '') : '';

      let attrDisplay = '--';
      if (attrVal !== null && attrVal !== undefined) {
        const valFormatted = typeof attrVal === 'number' ? attrVal.toFixed(1) : attrVal;
        attrDisplay = `${valFormatted}${unitStr}`;
      }

      const labelText = showLabels ? `${a.name}: ${attrDisplay}` : attrDisplay;

      let thresholdColor: string | undefined = undefined;
      if (attrVal !== null && attrVal !== undefined && typeof attrVal === 'number' && thresholds && thresholds.length > 0) {
        thresholdColor = getThresholdColor(attrVal, thresholds, primaryAccentColor);
      }

      return {
        id: a.id,
        name: labelText,
        meshLabel: labelText,
        attributeVal: attrVal,
        type: a.type || 'MESH_EYE_SENSOR',
        status: 'static' as const,
        x: a.planX || 10,
        y: a.planY || 10,
        locationName: a.locationName || '',
        lat: a.latitude || a.lat || -6.2088,
        lon: a.longitude || a.lon || 106.8456,
        latitude: a.latitude || a.lat || -6.2088,
        longitude: a.longitude || a.lon || 106.8456,
        tag: a.tag || null,
        color: thresholdColor,
        pinColor: thresholdColor
      };
    });

    return (
      <div className="w-full h-full relative overflow-hidden rounded-lg border border-border bg-card flex flex-col">
        {/* Header Tag */}
        <div className="flex-1 w-full h-full relative z-10">
          <FloorMap
            assets={mapAssetsList}
            anchors={[]}
            selectedAssetId={selectedMapAssetId}
            onSelectAsset={(a) => setSelectedMapAssetId(a ? (selectedMapAssetId === a.id ? null : a.id) : null)}
            disableClustering={true}
            readOnly={false}
            hideMarkerOutline={true}
            primaryAccentColor={primaryAccentColor}
            thresholds={thresholds}
            targetAttribute={targetAttribute}
            showUnits={showUnits}
          />
        </div>
      </div>
    );
  }

  // Mode RTLS: 2D Floorplan Image with Anchors and Mesh Assets
  const isAllAssets = widget.config?.allAssetsOfType ?? true;
  const selectedAssetIds: string[] = widget.config?.selectedAssetIds || (widget.config?.assetId ? [widget.config.assetId] : []);
  
  let currentZone = data?.asset?.zone || {};
  if (widget.config?.zoneId && zones) {
    const explicitZone = zones.find((z: any) => z.id === widget.config.zoneId);
    if (explicitZone) currentZone = explicitZone;
  }
  if ((!currentZone || !currentZone.floorPlanUrl) && zones && zones.length > 0) {
    currentZone = zones[0];
  }

  if (!currentZone.floorPlanUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center bg-secondary/20 rounded-lg border border-dashed border-border select-none">
        <MapPin className="w-8 h-8 text-muted-foreground/50 mb-2" />
        <span className="text-xs font-semibold text-muted-foreground">Floorplan unavailable</span>
        <span className="text-[10px] text-muted-foreground/70 mt-1">Select a Denah or ensure asset has a zone</span>
      </div>
    );
  }

  const activeZoneId = widget.config?.zoneId || currentZone.id;
  const zoneW = currentZone.width || 100;
  const zoneH = currentZone.height || 100;

  // Gather anchors for this zone
  const zoneAnchors: any[] = currentZone.anchors || (allAssets || []).filter(
    (a: any) => a.type === 'ANCHOR' && (a.zoneId === activeZoneId || a.zone?.id === activeZoneId)
  );

  // Gather mesh/display assets for this zone
  const zoneAssets: any[] = (allAssets || []).filter(
    (a: any) =>
      a.type !== 'ANCHOR' &&
      !a.type?.startsWith('AGENT_') &&
      (a.zoneId === activeZoneId || a.zone?.id === activeZoneId || (currentZone.assets && currentZone.assets.some((za: any) => za.id === a.id)))
  );

  // Filter assets if assetType or selectedAssetIds specified
  let displayAssets = zoneAssets;
  if (widget.config?.assetType) {
    displayAssets = displayAssets.filter((a: any) => String(a.type || '').toUpperCase() === String(widget.config.assetType).toUpperCase());
  }
  if (!isAllAssets && selectedAssetIds.length > 0) {
    displayAssets = displayAssets.filter((a: any) => selectedAssetIds.includes(a.id));
  }

  return (
    <div className="w-full h-full flex flex-col justify-between p-2 relative overflow-hidden bg-secondary/10 rounded-lg border border-border select-none">
      {/* Header Tag */}
      <div className="absolute top-3 left-3 z-20 bg-card/95 backdrop-blur-md border border-border/80 px-2.5 py-1 rounded-lg text-[10px] font-bold text-foreground flex items-center gap-1.5 shadow-sm">
        <Layers className="w-3.5 h-3.5 text-primary" />
        <span>RTLS Denah 2D ({currentZone.name || 'Floorplan'})</span>
      </div>

      <div className="flex-1 w-full relative overflow-hidden bg-card border rounded-lg border-border" onClick={() => setSelectedMapAssetId(null)}>
        {/* Floorplan Background Image */}
        <img
          src={`${getBackendUrl()}${currentZone.floorPlanUrl}`}
          alt="Floorplan"
          className="w-full h-full object-contain opacity-90"
        />


        {/* Anchor Markers */}
        {zoneAnchors.map((anchor: any) => {
          const anchorX = anchor.x !== undefined ? Number(anchor.x) : Number(anchor.planX || 0);
          const anchorY = anchor.y !== undefined ? Number(anchor.y) : Number(anchor.planY || 0);
          const pctX = (anchorX / zoneW) * 100;
          const pctY = ((zoneH - anchorY) / zoneH) * 100;

          const markerIconInfo = getAssetMarkerIcon('ANCHOR', anchor.name, dbAssetTypes);
          const anchorStatus = anchor.status || 'offline';
          const isOnline = anchorStatus === 'online' || anchorStatus === 'active';
          const statusColor = isOnline ? '#10b981' : '#ef4444';

          return (
            <div
              key={`anchor-${anchor.id}`}
              className="absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group cursor-pointer transition-all duration-300 z-10"
              style={{ left: `${pctX}%`, top: `${pctY}%` }}
            >
              {/* Name Tag Badge */}
              <div className="bg-white/95 dark:bg-slate-900/95 text-slate-800 dark:text-slate-100 border border-slate-200/80 dark:border-slate-700 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap mb-0.5 transition-all">
                {anchor.name}
              </div>

              {/* Pin */}
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={markerIconInfo.color} width="32" height="32" className="drop-shadow-md">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#ffffff" strokeWidth="1.5" />
                </svg>
                <div
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 text-white flex items-center justify-center z-10"
                  dangerouslySetInnerHTML={{ __html: markerIconInfo.svg }}
                />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-white shadow-xs z-20" style={{ backgroundColor: statusColor }}>
                  {isOnline && <div className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-60" />}
                </div>
              </div>
              <div className="w-4 h-1 bg-black/20 rounded-full blur-[1px] -mt-1" />
            </div>
          );
        })}

        {/* Mesh Asset Markers */}
        {displayAssets.map((asset: any) => {
          const rssiPos = computeRssiPosition(asset, zoneAnchors);
          let posX = asset.planX !== null && asset.planX !== undefined ? Number(asset.planX) : zoneW / 2;
          let posY = asset.planY !== null && asset.planY !== undefined ? Number(asset.planY) : zoneH / 2;

          if (rssiPos) {
            posX = rssiPos.x;
            posY = rssiPos.y;
          }

          const pctX = (posX / zoneW) * 100;
          const pctY = ((zoneH - posY) / zoneH) * 100;

          const isSelected = selectedMapAssetId === asset.id;
          const markerIconInfo = getAssetMarkerIcon(asset.type || 'MESH_EYE_SENSOR', asset.name, dbAssetTypes);
          const isOnline = (() => {
            if (asset.tag?.lastSeen) {
              const diffMs = Date.now() - new Date(asset.tag.lastSeen).getTime();
              return diffMs < 300000;
            }
            return asset.status === 'moving' || asset.status === 'static';
          })();
          const statusColor = isOnline ? '#10b981' : '#ef4444';

          const val = getLatestAssetAttributeValue(asset, targetAttribute, mapData);
          const unit = showUnits ? getAttributeUnit(targetAttribute) : '';
          const attrValFormatted = val !== null && val !== undefined ? (typeof val === 'number' ? val.toFixed(1) : val) : '--';

          // Evaluate Threshold Exceeded status
          let thresholdStatusText = 'Normal';
          let thresholdStatusColor = '#10b981';
          let isThresholdExceeded = false;

          if (val !== null && val !== undefined && typeof val === 'number' && thresholds && thresholds.length > 0) {
            const sortedThresholds = [...thresholds].sort((a: any, b: any) => b.value - a.value);
            const highest = sortedThresholds[0];
            if (highest && val >= highest.value) {
              isThresholdExceeded = true;
              thresholdStatusText = `Melebihi Threshold (≥ ${highest.value}${unit ? ' ' + unit : ''})`;
              thresholdStatusColor = highest.color || '#ef4444';
            } else {
              const matched = sortedThresholds.find((t: any) => val >= t.value);
              if (matched) {
                if (matched.value > 0) {
                  isThresholdExceeded = true;
                  thresholdStatusText = `Melebihi Threshold (≥ ${matched.value}${unit ? ' ' + unit : ''})`;
                }
                thresholdStatusColor = matched.color || '#10b981';
              }
            }
          }

          // Format last update date & time
          const lastSeenDate = asset.tag?.lastSeen ? new Date(asset.tag.lastSeen) : new Date();
          const formattedDateStr = lastSeenDate.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
          const formattedTimeStr = lastSeenDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

          const pinFillColor = isSelected ? primaryAccentColor : markerIconInfo.color;

          return (
            <div
              key={`mesh-${asset.id}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedMapAssetId(isSelected ? null : asset.id);
              }}
              className={`absolute -translate-x-1/2 -translate-y-full flex flex-col items-center group cursor-pointer transition-all duration-300 ${
                isSelected ? 'z-30 scale-110' : 'z-15 hover:scale-105'
              }`}
              style={{ left: `${pctX}%`, top: `${pctY}%` }}
            >
              {/* White Background Label Badge (Highlight with Primary Accent when selected) */}
              <div
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold shadow-md whitespace-nowrap mb-0.5 transition-all flex items-center gap-1 border ${
                  isSelected ? 'ring-2 scale-110 shadow-lg' : 'border-slate-200 dark:border-slate-700'
                }`}
                style={{
                  backgroundColor: isSelected ? primaryAccentColor : '#ffffff',
                  color: isSelected ? '#ffffff' : '#1e293b',
                  borderColor: isSelected ? primaryAccentColor : '#cbd5e1',
                  boxShadow: isSelected ? `0 0 12px ${primaryAccentColor}66` : undefined
                }}
              >
                <span>{asset.name}</span>
                <span className={isSelected ? 'opacity-60' : 'text-slate-400'}>:</span>
                <span className="font-mono font-extrabold">
                  {attrValFormatted}{unit ? ` ${unit}` : ''}
                </span>
              </div>

              {/* Pin Icon (Highlights with Primary Accent when selected) */}
              <div className="relative w-8 h-8 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill={pinFillColor} width="32" height="32" className="drop-shadow-md transition-all">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" stroke="#ffffff" strokeWidth="1.5" />
                </svg>
                <div
                  className="absolute top-1.5 left-1/2 -translate-x-1/2 text-white flex items-center justify-center z-10"
                  dangerouslySetInnerHTML={{ __html: markerIconInfo.svg }}
                />
                <div className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full border border-white shadow-xs z-20" style={{ backgroundColor: statusColor }}>
                  {isOnline && <div className="absolute inset-0 rounded-full animate-ping bg-emerald-400 opacity-60" />}
                </div>
              </div>
              <div className="w-4 h-1 bg-black/20 rounded-full blur-[1px] -mt-1" />

              {/* Card Popover (Displays ONLY when asset marker is clicked) */}
              {isSelected && (
                <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white rounded-xl p-2.5 flex flex-col gap-1.5 text-[10px] min-w-[170px] shadow-xl z-40 backdrop-blur-md border border-slate-700/80 animate-in fade-in duration-150 whitespace-nowrap">
                  <div className="font-bold border-b border-slate-700 pb-1 text-slate-100 text-xs flex justify-between items-center gap-2">
                    <span>{asset.name}</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-md font-mono" style={{ backgroundColor: thresholdStatusColor + '33', color: thresholdStatusColor }}>
                      {isThresholdExceeded ? '⚠️ Warning' : '✓ Normal'}
                    </span>
                  </div>
                  <div className="space-y-1 text-slate-300">
                    <div className="flex justify-between items-center gap-2">
                      <span className="text-slate-400">Last Update:</span>
                      <span className="font-mono font-semibold">{formattedDateStr} {formattedTimeStr}</span>
                    </div>
                    <div className="flex justify-between items-center gap-2 pt-0.5 border-t border-slate-800">
                      <span className="text-slate-400">Threshold:</span>
                      <span className="font-semibold" style={{ color: thresholdStatusColor }}>
                        {thresholdStatusText}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
