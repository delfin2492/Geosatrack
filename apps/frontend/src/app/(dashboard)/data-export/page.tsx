'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useSocket } from '../../context/SocketContext';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../lib/api';
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  Search,
  Pause,
  Play,
  RefreshCw,
  Boxes,
  Activity,
  ShieldAlert,
  CheckCircle2,
  Database,
  ArrowUpDown,
  FileJson,
  Radio,
  Clock
} from 'lucide-react';
import CustomSelect from '../../components/ui/CustomSelect';
import TreeTargetAssetAttributePicker from '../../components/TreeTargetAssetAttributePicker';

interface TelemetryRow {
  id: string;
  timestamp: string;
  assetId: string;
  assetName: string;
  assetType?: string;
  tagId: string;
  attribute: string;
  value: any;
  unit?: string;
  status?: string;
}

export default function DataExportPage() {
  const { socket, assets: contextAssets } = useSocket();
  const { token, tenantId } = useAuth();

  // State Filters
  const [fetchedAssets, setFetchedAssets] = useState<any[]>([]);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('all');
  const [selectedAttributes, setSelectedAttributes] = useState<string[]>(['all']);
  const [timeRange, setTimeRange] = useState<string>('24h');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Live Stream & Loading States
  const [isLiveStream, setIsLiveStream] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [logs, setLogs] = useState<TelemetryRow[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 25;

  const assetsList = fetchedAssets.length > 0 ? fetchedAssets : contextAssets;

  // 1. Fetch Assets List
  useEffect(() => {
    if (tenantId) {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      fetch(`${getApiUrl()}/assets`, { headers })
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) setFetchedAssets(data);
        })
        .catch(console.error);
    }
  }, [tenantId, token]);

  // 2. Fetch Telemetry Log History from API
  const fetchTelemetryHistory = async () => {
    if (!tenantId) return;
    setIsLoading(true);

    try {
      const headers: Record<string, string> = { 'x-tenant-id': tenantId };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      let startIso = startDate;
      let endIso = endDate;

      if (timeRange !== 'custom') {
        const now = new Date();
        endIso = now.toISOString();
        const start = new Date();

        if (timeRange === '1h') start.setHours(now.getHours() - 1);
        else if (timeRange === '24h') start.setHours(now.getHours() - 24);
        else if (timeRange === '7d') start.setDate(now.getDate() - 7);
        else if (timeRange === '30d') start.setDate(now.getDate() - 30);

        startIso = start.toISOString();
      }

      const params = new URLSearchParams();
      if (selectedAssetId !== 'all') params.append('assetId', selectedAssetId);
      if (selectedAttributes.length > 0 && !selectedAttributes.includes('all')) {
        params.append('attribute', selectedAttributes.join(','));
      }
      if (startIso) params.append('startDate', startIso);
      if (endIso) params.append('endDate', endIso);
      params.append('limit', '5000');

      const res = await fetch(`${getApiUrl()}/assets/telemetry/export?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setLogs(data);
        }
      }
    } catch (err) {
      console.error('Failed to fetch telemetry logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTelemetryHistory();
  }, [tenantId, token, selectedAssetId, selectedAttributes, timeRange, startDate, endDate]);

  // 3. Socket.io Realtime Telemetry Stream
  const isLiveRef = useRef(isLiveStream);
  useEffect(() => {
    isLiveRef.current = isLiveStream;
  }, [isLiveStream]);

  const normalizeAttrKey = (name: string): string => {
    if (!name) return '';
    const s = name.toLowerCase().replace(/[\s_()%-]+/g, '').trim();
    if (s === 'battery' || s === 'voltage' || s === 'batteryvoltage') return 'voltage';
    if (s === 'accelx' || s === 'accel_x') return 'accelx';
    if (s === 'accely' || s === 'accel_y') return 'accely';
    if (s === 'accelz' || s === 'accel_z') return 'accelz';
    return s;
  };

  useEffect(() => {
    if (!socket) return;

    const handleTelemetryNew = (telemetry: any) => {
      if (!isLiveRef.current) return;

      const tagId = telemetry.tagId || 'TAG_UNKNOWN';
      const matchedAsset = assetsList.find((a) => a.tagId === tagId || a.tag?.id === tagId);
      const assetName = matchedAsset?.name || `Tag [${tagId}]`;
      const assetType = matchedAsset?.type || 'SENSOR';
      const ts = telemetry.timestamp || new Date().toISOString();

      const newRows: TelemetryRow[] = [];
      const addRow = (attr: string, val: any, unit: string) => {
        if (val === null || val === undefined) return;
        let displayVal: any = val;
        if (typeof val === 'boolean') {
          displayVal = val ? 'true' : 'false';
        } else if (typeof val === 'number') {
          displayVal = val;
        } else {
          displayVal = String(val);
        }

        newRows.push({
          id: `${tagId}-${Date.now()}-${attr}-${Math.random()}`,
          timestamp: ts,
          assetId: matchedAsset?.id || '',
          assetName,
          assetType,
          tagId,
          attribute: attr,
          value: displayVal,
          unit,
          status: 'Normal'
        });
      };

      addRow('temperature', telemetry.temperature, '°C');
      addRow('humidity', telemetry.humidity, '%');
      if (telemetry.voltage !== undefined && telemetry.voltage !== null) {
        addRow('voltage', telemetry.voltage, 'mV');
      } else {
        addRow('battery', telemetry.battery, '%');
      }
      addRow('rssi', telemetry.rssi, 'dBm');
      addRow('accelX', telemetry.accelX ?? telemetry.accel_x, 'mg');
      addRow('accelY', telemetry.accelY ?? telemetry.accel_y, 'mg');
      addRow('accelZ', telemetry.accelZ ?? telemetry.accel_z, 'mg');
      addRow('pitch', telemetry.pitch, '°');
      addRow('roll', telemetry.roll, '°');

      if (telemetry.attributes && typeof telemetry.attributes === 'object') {
        Object.entries(telemetry.attributes).forEach(([k, v]) => {
          if (!['temperature', 'humidity', 'battery', 'voltage', 'rssi', 'accelx', 'accely', 'accelz', 'pitch', 'roll'].includes(normalizeAttrKey(k))) {
            addRow(k, v, '');
          }
        });
      }

      if (newRows.length > 0) {
        setLogs((prev) => [...newRows, ...prev].slice(0, 10000));
      }
    };

    socket.on('telemetryNew', handleTelemetryNew);
    return () => {
      socket.off('telemetryNew', handleTelemetryNew);
    };
  }, [socket, assetsList]);

  // 4. Filtering & Search Logic
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (selectedAssetId !== 'all' && log.assetId !== selectedAssetId) return false;
      if (selectedAttributes.length > 0 && !selectedAttributes.includes('all')) {
        const normLogAttr = normalizeAttrKey(log.attribute);
        const matchAttr = selectedAttributes.some((attr) => {
          const normSel = normalizeAttrKey(attr);
          return (
            normLogAttr === normSel ||
            normLogAttr.includes(normSel) ||
            normSel.includes(normLogAttr) ||
            log.attribute.toLowerCase().includes(attr.toLowerCase())
          );
        });
        if (!matchAttr) return false;
      }
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchName = log.assetName.toLowerCase().includes(q);
        const matchTag = log.tagId.toLowerCase().includes(q);
        const matchAttr = log.attribute.toLowerCase().includes(q);
        const matchVal = String(log.value).toLowerCase().includes(q);
        if (!matchName && !matchTag && !matchAttr && !matchVal) return false;
      }
      return true;
    });
  }, [logs, selectedAssetId, selectedAttributes, searchQuery]);

  // Paginator slice
  const totalPages = Math.ceil(filteredLogs.length / rowsPerPage) || 1;
  const paginatedLogs = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredLogs.slice(start, start + rowsPerPage);
  }, [filteredLogs, currentPage]);

  // Summary Metrics
  const summaryStats = useMemo(() => {
    const totalCount = filteredLogs.length;
    const uniqueAssets = new Set(filteredLogs.map((l) => l.assetName)).size;
    const alertCount = filteredLogs.filter((l) => l.status === 'Alert' || l.status === 'Warning').length;

    return { totalCount, uniqueAssets, alertCount };
  }, [filteredLogs]);

  // 5. CSV Export Handler
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) return;

    const headers = ['Timestamp', 'Asset Name', 'Tag ID', 'Asset Type', 'Attribute', 'Value', 'Unit', 'Status'];
    const csvRows = filteredLogs.map((l) => [
      `"${new Date(l.timestamp).toLocaleString('id-ID')}"`,
      `"${l.assetName}"`,
      `"${l.tagId}"`,
      `"${l.assetType || ''}"`,
      `"${l.attribute}"`,
      `"${typeof l.value === 'boolean' ? (l.value ? 'TRUE' : 'FALSE') : l.value}"`,
      `"${l.unit || ''}"`,
      `"${l.status || 'Normal'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `geomesh_telemetry_export_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 6. JSON Export Handler
  const handleExportJSON = () => {
    if (filteredLogs.length === 0) return;

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(filteredLogs, null, 2));
    const link = document.createElement('a');
    link.setAttribute('href', dataStr);
    link.setAttribute('download', `geomesh_telemetry_export_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-6 rounded-2xl border border-border bg-card shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <FileSpreadsheet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-foreground tracking-tight">Data Export & Telemetry Log</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export data telemetri historis (CSV / JSON) & pantau stream log real-time dari seluruh asset.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsLiveStream((prev) => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border transition-all cursor-pointer ${
              isLiveStream
                ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 border-amber-500/30 hover:bg-amber-500/20'
            }`}
          >
            {isLiveStream ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isLiveStream ? 'Live Stream Active' : 'Live Paused'}</span>
          </button>

          <button
            type="button"
            onClick={fetchTelemetryHistory}
            className="p-2 rounded-xl border border-border bg-card hover:bg-secondary/50 text-foreground transition-colors cursor-pointer"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-primary' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-500/10 text-blue-500 border border-blue-500/20">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Total Log Entries</p>
            <h3 className="text-xl font-mono font-extrabold mt-0.5">{summaryStats.totalCount.toLocaleString()}</h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-purple-500/10 text-purple-500 border border-purple-500/20">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Monitored Assets</p>
            <h3 className="text-xl font-mono font-extrabold mt-0.5">{summaryStats.uniqueAssets} Assets</h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl border border-border bg-card shadow-xs flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Alert Events</p>
            <h3 className="text-xl font-mono font-extrabold mt-0.5">{summaryStats.alertCount}</h3>
          </div>
        </div>
      </div>

      {/* Filter Control Bar */}
      <div className="p-4 rounded-2xl border border-border bg-card shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-border text-xs font-bold text-muted-foreground">
          <Filter className="w-4 h-4 text-primary" />
          <span>Filter Data & Range Tanggal</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Combined Tree Target Asset & Attribute Picker */}
          <div className="md:col-span-6">
            <TreeTargetAssetAttributePicker
              assets={assetsList}
              logs={logs}
              selectedAssetId={selectedAssetId}
              selectedAttribute={selectedAttributes}
              onChange={(assetId, attributes) => {
                setSelectedAssetId(assetId);
                setSelectedAttributes(attributes);
                setCurrentPage(1);
              }}
            />
          </div>

          {/* Time Range Custom Select */}
          <div className="md:col-span-3">
            <CustomSelect
              label="Rentang Waktu"
              value={timeRange}
              onChange={(val) => {
                setTimeRange(val);
                setCurrentPage(1);
              }}
              options={[
                { value: '1h', label: '1 Jam Terakhir', icon: Clock, badge: '1H' },
                { value: '24h', label: '24 Jam Terakhir', icon: Clock, badge: '24H' },
                { value: '7d', label: '7 Hari Terakhir', icon: Calendar, badge: '7D' },
                { value: '30d', label: '30 Hari Terakhir', icon: Calendar, badge: '30D' },
                { value: 'custom', label: 'Custom Date Range', icon: Filter, badge: 'Custom' },
              ]}
            />
          </div>

          {/* Search Input */}
          <div className="space-y-1 md:col-span-3">
            <label className="text-[11px] font-semibold text-muted-foreground">Cari Tag / Asset</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full text-xs font-semibold pl-9 pr-3 py-2.5 rounded-xl border border-border bg-secondary/20 text-foreground focus:outline-none focus:ring-1 focus:ring-primary h-[40px]"
              />
            </div>
          </div>
        </div>

        {/* Custom Date Range Pickers (if custom selected) */}
        {timeRange === 'custom' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-border/60 animate-in fade-in">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Tanggal Mulai (Start Date)</label>
              <input
                type="datetime-local"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-xl border border-border bg-secondary/20 text-foreground"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">Tanggal Selesai (End Date)</label>
              <input
                type="datetime-local"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs font-semibold p-2 rounded-xl border border-border bg-secondary/20 text-foreground"
              />
            </div>
          </div>
        )}
      </div>

      {/* Main Data Table */}
      <div className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs flex flex-col">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-emerald-500 animate-pulse" />
            <span className="text-xs font-bold">Telemetry Data Logs</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">
              Showing {paginatedLogs.length} of {filteredLogs.length} entries
            </span>
          </div>

          <span className="text-[11px] text-muted-foreground">
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-bold uppercase text-[10px] tracking-wider select-none">
              <tr>
                <th className="py-3 px-4">Waktu (Timestamp)</th>
                <th className="py-3 px-4">Nama Asset</th>
                <th className="py-3 px-4">Tag ID</th>
                <th className="py-3 px-4">Attribute</th>
                <th className="py-3 px-4">Nilai (Value)</th>
                <th className="py-3 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {paginatedLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <FileSpreadsheet className="w-8 h-8 opacity-40" />
                      <span className="text-xs font-semibold">Tidak ada log telemetri yang cocok dengan filter</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-secondary/30 transition-colors">
                    <td className="py-3 px-4 font-mono font-medium text-foreground/90 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit'
                      })}
                    </td>
                    <td className="py-3 px-4 font-bold text-foreground whitespace-nowrap">
                      {log.assetName}
                      {log.assetType && <span className="ml-1.5 text-[9px] font-normal text-muted-foreground">({log.assetType})</span>}
                    </td>
                    <td className="py-3 px-4 font-mono text-muted-foreground whitespace-nowrap">
                      {log.tagId}
                    </td>
                    <td className="py-3 px-4 font-semibold capitalize whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-md bg-secondary/60 text-foreground border border-border/50">
                        {log.attribute}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono font-extrabold text-foreground whitespace-nowrap">
                      {typeof log.value === 'boolean' || log.value === 'true' || log.value === 'false' ? (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${log.value === true || log.value === 'true' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30' : 'bg-rose-500/10 text-rose-600 border border-rose-500/30'}`}>
                          {log.value === true || log.value === 'true' ? 'TRUE' : 'FALSE'}
                        </span>
                      ) : typeof log.value === 'number' ? (
                        <span>{Number.isInteger(log.value) ? log.value : log.value.toFixed(2)}</span>
                      ) : (
                        <span>{String(log.value)}</span>
                      )}
                      {log.unit && <span className="text-muted-foreground text-[10px] ml-1">{log.unit}</span>}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'Alert' || log.status === 'Warning'
                            ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                            : 'bg-emerald-500/15 text-emerald-500 border border-emerald-500/30'
                        }`}
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {log.status || 'Normal'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginator Footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-border flex items-center justify-between text-xs bg-card">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 disabled:opacity-50 cursor-pointer font-semibold"
            >
              Previous
            </button>

            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }).map((_, idx) => {
                const pageNum = idx + 1;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      currentPage === pageNum ? 'bg-primary text-primary-foreground' : 'hover:bg-secondary/50'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-border bg-secondary/30 hover:bg-secondary/60 disabled:opacity-50 cursor-pointer font-semibold"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
