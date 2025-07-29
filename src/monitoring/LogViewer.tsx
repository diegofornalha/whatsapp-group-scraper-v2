import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Search, Filter, Download, RefreshCw, AlertCircle,
  Info, AlertTriangle, XCircle, ChevronDown, ChevronRight,
  Clock, Tag, FileText, Copy, Trash2
} from 'lucide-react';
import { Logger, LogEntry, LogLevel } from './Logger';

interface LogViewerProps {
  logger: Logger;
  maxLogs?: number;
  autoScroll?: boolean;
  showSearch?: boolean;
  showFilters?: boolean;
  refreshInterval?: number;
}

interface LogFilter {
  levels: LogLevel[];
  searchTerm: string;
  context?: string;
  startTime?: Date;
  endTime?: Date;
}

const LogLevelIcon: React.FC<{ level: LogLevel }> = ({ level }) => {
  switch (level) {
    case LogLevel.DEBUG:
      return <FileText className="w-4 h-4 text-gray-500" />;
    case LogLevel.INFO:
      return <Info className="w-4 h-4 text-blue-500" />;
    case LogLevel.WARN:
      return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case LogLevel.ERROR:
      return <XCircle className="w-4 h-4 text-red-500" />;
    case LogLevel.CRITICAL:
      return <AlertCircle className="w-4 h-4 text-red-700" />;
  }
};

const LogEntryRow: React.FC<{ 
  entry: LogEntry; 
  expanded: boolean;
  onToggle: () => void;
}> = ({ entry, expanded, onToggle }) => {
  const levelColors = {
    [LogLevel.DEBUG]: 'bg-gray-50 hover:bg-gray-100',
    [LogLevel.INFO]: 'bg-blue-50 hover:bg-blue-100',
    [LogLevel.WARN]: 'bg-yellow-50 hover:bg-yellow-100',
    [LogLevel.ERROR]: 'bg-red-50 hover:bg-red-100',
    [LogLevel.CRITICAL]: 'bg-red-100 hover:bg-red-200'
  };

  const handleCopy = () => {
    const logText = JSON.stringify(entry, null, 2);
    navigator.clipboard.writeText(logText);
  };

  return (
    <div className={`${levelColors[entry.level]} transition-colors`}>
      <div 
        className="px-4 py-2 cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5">
            {expanded ? 
              <ChevronDown className="w-4 h-4 text-gray-400" /> : 
              <ChevronRight className="w-4 h-4 text-gray-400" />
            }
          </div>
          <LogLevelIcon level={entry.level} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-4 text-sm">
              <span className="text-gray-600">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              {entry.context && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-700 rounded text-xs">
                  {entry.context}
                </span>
              )}
              {entry.correlationId && (
                <span className="text-xs text-gray-500">
                  ID: {entry.correlationId}
                </span>
              )}
            </div>
            <p className="text-gray-900 mt-1 break-words">{entry.message}</p>
            {entry.error && !expanded && (
              <p className="text-red-600 text-sm mt-1">
                Error: {entry.error.message}
              </p>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            className="p-1.5 hover:bg-white rounded transition-colors"
            title="Copy log entry"
          >
            <Copy className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="px-4 pb-3 pl-14 space-y-3 border-t border-gray-200/50">
          {entry.metadata && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-1">Metadata</h4>
              <pre className="text-xs bg-white p-2 rounded border border-gray-200 overflow-x-auto">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </div>
          )}
          
          {entry.error && (
            <div>
              <h4 className="text-sm font-medium text-red-700 mb-1">Error Details</h4>
              <div className="bg-white p-2 rounded border border-red-200">
                <p className="text-sm text-red-600">{entry.error.message}</p>
                {entry.error.stack && (
                  <pre className="text-xs text-gray-600 mt-2 overflow-x-auto">
                    {entry.error.stack}
                  </pre>
                )}
              </div>
            </div>
          )}

          {entry.source && (
            <div className="text-xs text-gray-500">
              Source: {entry.source}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const LogViewer: React.FC<LogViewerProps> = ({
  logger,
  maxLogs = 1000,
  autoScroll = true,
  showSearch = true,
  showFilters = true,
  refreshInterval = 1000
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<LogFilter>({
    levels: [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL],
    searchTerm: ''
  });
  const [isLive, setIsLive] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    const recentLogs = await logger.getRecentLogs(maxLogs);
    setLogs(recentLogs);
  }, [logger, maxLogs]);

  useEffect(() => {
    // Initial fetch
    fetchLogs();

    // Set up live updates
    const handleNewLog = (entry: LogEntry) => {
      if (isLive) {
        setLogs(prev => [...prev.slice(-(maxLogs - 1)), entry]);
      }
    };

    logger.on('log', handleNewLog);

    // Periodic refresh if not live
    let interval: NodeJS.Timeout | null = null;
    if (!isLive && refreshInterval > 0) {
      interval = setInterval(fetchLogs, refreshInterval);
    }

    return () => {
      logger.off('log', handleNewLog);
      if (interval) clearInterval(interval);
    };
  }, [logger, isLive, fetchLogs, maxLogs, refreshInterval]);

  useEffect(() => {
    // Apply filters
    let filtered = logs;

    // Level filter
    filtered = filtered.filter(log => filter.levels.includes(log.level));

    // Search filter
    if (filter.searchTerm) {
      const term = filter.searchTerm.toLowerCase();
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(term) ||
        log.context?.toLowerCase().includes(term) ||
        JSON.stringify(log.metadata).toLowerCase().includes(term)
      );
    }

    // Context filter
    if (filter.context) {
      filtered = filtered.filter(log => 
        log.context?.toLowerCase().includes(filter.context.toLowerCase())
      );
    }

    // Time filter
    if (filter.startTime) {
      filtered = filtered.filter(log => log.timestamp >= filter.startTime!);
    }
    if (filter.endTime) {
      filtered = filtered.filter(log => log.timestamp <= filter.endTime!);
    }

    setFilteredLogs(filtered);
  }, [logs, filter]);

  useEffect(() => {
    // Auto-scroll
    if (autoScroll && isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, isLive]);

  const toggleExpanded = (index: number) => {
    setExpandedLogs(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const clearLogs = () => {
    setLogs([]);
    setExpandedLogs(new Set());
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(filteredLogs, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `logs-${new Date().toISOString()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const levelStats = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<LogLevel, number>);

  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Log Viewer</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsLive(!isLive)}
              className={`px-3 py-1.5 rounded flex items-center gap-2 text-sm font-medium transition-colors ${
                isLive 
                  ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLive ? 'animate-spin' : ''}`} />
              {isLive ? 'Live' : 'Paused'}
            </button>
            <button
              onClick={exportLogs}
              className="px-3 py-1.5 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
              title="Export logs"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={clearLogs}
              className="px-3 py-1.5 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              title="Clear logs"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        {(showSearch || showFilters) && (
          <div className="space-y-3">
            {showSearch && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search logs..."
                  value={filter.searchTerm}
                  onChange={(e) => setFilter(prev => ({ ...prev, searchTerm: e.target.value }))}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {showFilters && (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">Levels:</span>
                  <div className="flex gap-1">
                    {[
                      { level: LogLevel.DEBUG, label: 'D', color: 'gray' },
                      { level: LogLevel.INFO, label: 'I', color: 'blue' },
                      { level: LogLevel.WARN, label: 'W', color: 'yellow' },
                      { level: LogLevel.ERROR, label: 'E', color: 'red' },
                      { level: LogLevel.CRITICAL, label: 'C', color: 'purple' }
                    ].map(({ level, label, color }) => (
                      <button
                        key={level}
                        onClick={() => {
                          setFilter(prev => ({
                            ...prev,
                            levels: prev.levels.includes(level)
                              ? prev.levels.filter(l => l !== level)
                              : [...prev.levels, level]
                          }));
                        }}
                        className={`px-2 py-1 text-xs font-medium rounded transition-colors ${
                          filter.levels.includes(level)
                            ? `bg-${color}-100 text-${color}-700 hover:bg-${color}-200`
                            : 'bg-gray-100 text-gray-400 hover:bg-gray-200'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <input
                  type="text"
                  placeholder="Filter by context..."
                  value={filter.context || ''}
                  onChange={(e) => setFilter(prev => ({ ...prev, context: e.target.value }))}
                  className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-600">
          <span>Total: {logs.length}</span>
          <span>Filtered: {filteredLogs.length}</span>
          {Object.entries(levelStats).map(([level, count]) => (
            <span key={level}>
              {LogLevel[Number(level)]}: {count}
            </span>
          ))}
        </div>
      </div>

      {/* Log List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
      >
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {filter.searchTerm || filter.context || filter.levels.length < 5
              ? 'No logs match the current filters'
              : 'No logs to display'}
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredLogs.map((log, index) => (
              <LogEntryRow
                key={index}
                entry={log}
                expanded={expandedLogs.has(index)}
                onToggle={() => toggleExpanded(index)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};