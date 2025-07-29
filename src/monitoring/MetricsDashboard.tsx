import React, { useState, useEffect, useCallback } from 'react';
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import { 
  Activity, Cpu, HardDrive, Clock, AlertTriangle,
  TrendingUp, TrendingDown, Zap, Server, Database
} from 'lucide-react';
import { MetricsCollector, MetricsSnapshot, SystemMetrics } from './MetricsCollector';
import { PerformanceBottleneck } from './PerformanceMonitor';

interface MetricsDashboardProps {
  metricsCollector: MetricsCollector;
  refreshInterval?: number;
  showSystemMetrics?: boolean;
  showCustomMetrics?: boolean;
  maxDataPoints?: number;
}

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'normal' | 'warning' | 'critical';
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  unit,
  icon,
  trend,
  trendValue,
  status = 'normal'
}) => {
  const statusColors = {
    normal: 'bg-green-50 border-green-200',
    warning: 'bg-yellow-50 border-yellow-200',
    critical: 'bg-red-50 border-red-200'
  };

  const trendIcons = {
    up: <TrendingUp className="w-4 h-4 text-green-500" />,
    down: <TrendingDown className="w-4 h-4 text-red-500" />,
    stable: <Activity className="w-4 h-4 text-gray-500" />
  };

  return (
    <div className={`p-4 rounded-lg border ${statusColors[status]} transition-colors`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-gray-700">{title}</span>
        </div>
        {trend && (
          <div className="flex items-center gap-1">
            {trendIcons[trend]}
            {trendValue && (
              <span className="text-xs text-gray-600">{trendValue}</span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gray-900">{value}</span>
        {unit && <span className="text-sm text-gray-600">{unit}</span>}
      </div>
    </div>
  );
};

export const MetricsDashboard: React.FC<MetricsDashboardProps> = ({
  metricsCollector,
  refreshInterval = 5000,
  showSystemMetrics = true,
  showCustomMetrics = true,
  maxDataPoints = 50
}) => {
  const [snapshot, setSnapshot] = useState<MetricsSnapshot | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [bottlenecks, setBottlenecks] = useState<PerformanceBottleneck[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('cpu.usage');

  const fetchMetrics = useCallback(async () => {
    const newSnapshot = await metricsCollector.getSnapshot();
    setSnapshot(newSnapshot);

    // Update historical data
    setHistoricalData(prev => {
      const newData = [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        cpu: newSnapshot.systemMetrics.cpu.usage,
        memory: (newSnapshot.systemMetrics.memory.used / 
                 newSnapshot.systemMetrics.memory.total * 100).toFixed(2),
        heap: (newSnapshot.systemMetrics.memory.heapUsed / 
               newSnapshot.systemMetrics.memory.heapTotal * 100).toFixed(2),
        uptime: newSnapshot.systemMetrics.process.uptime
      }];

      // Keep only last N data points
      return newData.slice(-maxDataPoints);
    });
  }, [metricsCollector, maxDataPoints]);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, refreshInterval);

    // Subscribe to bottleneck events
    const handleBottlenecks = (detected: PerformanceBottleneck[]) => {
      setBottlenecks(detected);
    };

    metricsCollector.on('bottlenecksDetected', handleBottlenecks);

    return () => {
      clearInterval(interval);
      metricsCollector.off('bottlenecksDetected', handleBottlenecks);
    };
  }, [fetchMetrics, refreshInterval, metricsCollector]);

  if (!snapshot) {
    return (
      <div className="p-8 text-center">
        <div className="inline-flex items-center gap-2 text-gray-500">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-gray-900"></div>
          Loading metrics...
        </div>
      </div>
    );
  }

  const { systemMetrics } = snapshot;
  const cpuStatus = systemMetrics.cpu.usage > 80 ? 'critical' : 
                   systemMetrics.cpu.usage > 60 ? 'warning' : 'normal';
  const memoryPercent = (systemMetrics.memory.used / systemMetrics.memory.total * 100).toFixed(1);
  const memoryStatus = Number(memoryPercent) > 90 ? 'critical' :
                      Number(memoryPercent) > 70 ? 'warning' : 'normal';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Metrics Dashboard</h2>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Clock className="w-4 h-4" />
          Last updated: {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* System Metrics Cards */}
      {showSystemMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            title="CPU Usage"
            value={systemMetrics.cpu.usage.toFixed(1)}
            unit="%"
            icon={<Cpu className="w-5 h-5 text-blue-600" />}
            status={cpuStatus}
            trend="up"
            trendValue="+2.3%"
          />
          <MetricCard
            title="Memory Usage"
            value={memoryPercent}
            unit="%"
            icon={<HardDrive className="w-5 h-5 text-purple-600" />}
            status={memoryStatus}
            trend="stable"
          />
          <MetricCard
            title="Heap Memory"
            value={(systemMetrics.memory.heapUsed / 1024 / 1024).toFixed(0)}
            unit="MB"
            icon={<Database className="w-5 h-5 text-green-600" />}
            status="normal"
          />
          <MetricCard
            title="Uptime"
            value={(systemMetrics.process.uptime / 3600).toFixed(1)}
            unit="hours"
            icon={<Server className="w-5 h-5 text-orange-600" />}
            status="normal"
          />
        </div>
      )}

      {/* Performance Trends */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Performance Trends</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={historicalData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="timestamp" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="cpu" 
                stroke="#3B82F6" 
                name="CPU %"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="memory" 
                stroke="#8B5CF6" 
                name="Memory %"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="heap" 
                stroke="#10B981" 
                name="Heap %"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottlenecks Alert */}
      {bottlenecks.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">
              Performance Bottlenecks Detected
            </h3>
          </div>
          <div className="space-y-2">
            {bottlenecks.map((bottleneck, index) => (
              <div key={index} className="bg-white p-3 rounded border border-red-100">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-red-800">
                    {bottleneck.type.toUpperCase()} Bottleneck
                  </span>
                  <span className={`px-2 py-1 text-xs rounded ${
                    bottleneck.severity === 'critical' ? 'bg-red-600 text-white' :
                    bottleneck.severity === 'high' ? 'bg-orange-600 text-white' :
                    'bg-yellow-600 text-white'
                  }`}>
                    {bottleneck.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{bottleneck.description}</p>
                <div className="text-xs text-gray-600">
                  <p className="font-medium mb-1">Recommendations:</p>
                  <ul className="list-disc list-inside space-y-1">
                    {bottleneck.recommendations.slice(0, 2).map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Metrics */}
      {showCustomMetrics && snapshot.metrics.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-lg font-semibold mb-4">Application Metrics</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Metric selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Metric
              </label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from(new Set(snapshot.metrics.map(m => m.name))).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            {/* Metric visualization */}
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={snapshot.metrics
                    .filter(m => m.name === selectedMetric)
                    .slice(-10)
                    .map((m, i) => ({
                      name: `${i}`,
                      value: m.value
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="value" fill="#3B82F6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Quick Stats */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {systemMetrics.cpu.cores}
            </div>
            <div className="text-sm text-gray-600">CPU Cores</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {(systemMetrics.memory.total / 1024 / 1024 / 1024).toFixed(1)}GB
            </div>
            <div className="text-sm text-gray-600">Total Memory</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {systemMetrics.process.pid}
            </div>
            <div className="text-sm text-gray-600">Process ID</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">
              {systemMetrics.process.version}
            </div>
            <div className="text-sm text-gray-600">Node Version</div>
          </div>
        </div>
      </div>
    </div>
  );
};