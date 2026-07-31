'use client';

import React, { useState } from 'react';
import { useSocket } from '../../context/SocketContext';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { 
  Table, 
  TableHeader, 
  TableBody, 
  TableRow, 
  TableHead, 
  TableCell 
} from '../../components/ui/table';
import { 
  TrendingUp, 
  Calendar, 
  Filter, 
  Thermometer, 
  Battery, 
  Wifi 
} from 'lucide-react';

export default function InsightsPage() {
  const { telemetryLogs, assets } = useSocket();
  const [selectedAssetId, setSelectedAssetId] = useState<string>('forklift-1');
  const [timeRange, setTimeRange] = useState<string>('1h');

  // Simulated chart data
  const selectedAsset = assets.find(a => a.id === selectedAssetId);

  return (
    <div className="space-y-6">
      
      {/* FILTER HEADER CARD */}
      <Card>
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-primary/10 border border-primary/20 rounded-lg flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-primary glow-text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Historical Insights & Analytics</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Inspect past telemetry charts and TimescaleDB hypertable logs.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex gap-3 text-xs font-semibold">
            <div className="flex items-center gap-2 bg-secondary/35 border border-border px-3 py-2 rounded-lg">
              <Filter className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={selectedAssetId}
                onChange={(e) => setSelectedAssetId(e.target.value)}
                className="bg-transparent text-foreground focus:outline-none text-xs font-semibold"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 bg-secondary/35 border border-border px-3 py-2 rounded-lg">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="bg-transparent text-foreground focus:outline-none text-xs font-semibold"
              >
                <option value="1h">Last 1 Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* HISTORIC SENSOR CHARTS MOCKUP (High Aesthetics CSS/SVG) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* TEMPERATURE CHART */}
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between border-b">
            <CardTitle className="text-cyan-400 flex items-center gap-1.5">
              <Thermometer className="h-4 w-4" />
              Temperature Trend (°C)
            </CardTitle>
            <Badge variant="secondary" className="text-cyan-400 border-cyan-500/25 bg-cyan-500/10">
              Live: {selectedAsset?.tag?.temperature ?? '--'} °C
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            {/* SVG Line Chart */}
            <div className="h-40 w-full bg-black/40 rounded-lg relative flex items-end p-2 border border-border/30">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M 0 60 Q 20 40 40 70 T 80 30 T 100 50"
                  fill="none"
                  stroke="rgba(6, 182, 212, 0.8)"
                  strokeWidth="2"
                  className="glow-text-primary"
                />
                <path
                  d="M 0 60 Q 20 40 40 70 T 80 30 T 100 50 L 100 100 L 0 100 Z"
                  fill="url(#tempGradient)"
                  opacity="0.1"
                />
                <defs>
                  <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#06b6d4" />
                    <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-2 left-2 text-[8px] text-muted-foreground/60 font-mono">Max: 30°C</div>
              <div className="absolute bottom-2 left-2 text-[8px] text-muted-foreground/60 font-mono">Min: 18°C</div>
            </div>
          </CardContent>
        </Card>

        {/* BATTERY LEVEL CHART */}
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between border-b">
            <CardTitle className="text-emerald-400 flex items-center gap-1.5">
              <Battery className="h-4 w-4" />
              Battery Voltage Trend (V)
            </CardTitle>
            <Badge variant="secondary" className="text-emerald-400 border-emerald-500/25 bg-emerald-500/10">
              Live: {selectedAsset?.tag?.battery ?? '--'} V
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            {/* SVG Line Chart */}
            <div className="h-40 w-full bg-black/40 rounded-lg relative flex items-end p-2 border border-border/30">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M 0 10 Q 20 15 40 18 T 80 25 T 100 30"
                  fill="none"
                  stroke="rgba(16, 185, 129, 0.8)"
                  strokeWidth="2"
                />
                <path
                  d="M 0 10 Q 20 15 40 18 T 80 25 T 100 30 L 100 100 L 0 100 Z"
                  fill="url(#batGradient)"
                  opacity="0.1"
                />
                <defs>
                  <linearGradient id="batGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-2 left-2 text-[8px] text-muted-foreground/60 font-mono">Max: 3.3V</div>
              <div className="absolute bottom-2 left-2 text-[8px] text-muted-foreground/60 font-mono">Min: 2.5V</div>
            </div>
          </CardContent>
        </Card>

        {/* RSSI SIGNAL STRENGTH CHART */}
        <Card>
          <CardHeader className="py-3 flex flex-row items-center justify-between border-b">
            <CardTitle className="text-amber-400 flex items-center gap-1.5">
              <Wifi className="h-4 w-4" />
              RSSI Link Quality (dBm)
            </CardTitle>
            <Badge variant="secondary" className="text-amber-400 border-amber-500/25 bg-amber-500/10">
              Live: {selectedAsset?.tag?.rssi ?? '--'} dBm
            </Badge>
          </CardHeader>
          <CardContent className="pt-6">
            {/* SVG Line Chart */}
            <div className="h-40 w-full bg-black/40 rounded-lg relative flex items-end p-2 border border-border/30">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path
                  d="M 0 70 Q 20 50 40 85 T 80 40 T 100 65"
                  fill="none"
                  stroke="rgba(245, 158, 11, 0.8)"
                  strokeWidth="2"
                />
                <path
                  d="M 0 70 Q 20 50 40 85 T 80 40 T 100 65 L 100 100 L 0 100 Z"
                  fill="url(#rssiGradient)"
                  opacity="0.1"
                />
                <defs>
                  <linearGradient id="rssiGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute top-2 left-2 text-[8px] text-muted-foreground/60 font-mono">Max: -50 dBm</div>
              <div className="absolute bottom-2 left-2 text-[8px] text-muted-foreground/60 font-mono">Min: -90 dBm</div>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* TELEMETRY TABLE LOGS */}
      <Card className="overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-secondary/15 flex items-center justify-between text-xs">
          <span className="font-bold text-foreground">TimescaleDB Hypertable Logs ({selectedAsset?.name || 'Asset'})</span>
          <span className="text-[10px] text-muted-foreground font-mono">Updating frequency: 2s</span>
        </div>
        <div className="p-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Tag Node</TableHead>
                <TableHead>Temperature</TableHead>
                <TableHead>Humidity</TableHead>
                <TableHead>Voltage</TableHead>
                <TableHead>RSSI Strength</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {telemetryLogs.length > 0 ? (
                telemetryLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>{log.timestamp}</TableCell>
                    <TableCell className="font-bold text-primary">{log.tagId}</TableCell>
                    <TableCell className="text-foreground">{log.temperature} °C</TableCell>
                    <TableCell className="text-foreground">{log.humidity} %</TableCell>
                    <TableCell className="text-emerald-400">{log.battery} V</TableCell>
                    <TableCell className="text-amber-400">{log.rssi} dBm</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    No active telemetry data streaming. Start Simulator to view historical logs.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

    </div>
  );
}
