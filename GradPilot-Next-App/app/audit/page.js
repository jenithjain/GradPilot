'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';
import BackgroundWrapper from '@/components/BackgroundWrapper';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [levelFilter, setLevelFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [pagination, setPagination] = useState({ page: 1, total: 0, pages: 0 });

  // Fetch logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '50',
        ...(levelFilter && { level: levelFilter }),
        ...(categoryFilter && { category: categoryFilter }),
        ...(searchFilter && { search: searchFilter }),
      });

      console.log('[Audit] Fetching logs with params:', params.toString());
      const res = await fetch(`/api/audit/logs?${params}`);
      console.log('[Audit] Response status:', res.status);
      
      const data = await res.json();
      console.log('[Audit] Response data:', data);

      if (res.ok && data.success) {
        setLogs(data.logs || []);
        setPagination(data.pagination || { page: 1, total: 0, pages: 0 });
      } else {
        console.error('[Audit] Failed to fetch logs:', data.error || 'Unknown error');
        setLogs([]);
      }
    } catch (error) {
      console.error('[Audit] Failed to fetch logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch statistics
  const fetchStats = async () => {
    try {
      console.log('[Audit] Fetching stats...');
      const res = await fetch('/api/audit/stats');
      console.log('[Audit Stats] Response status:', res.status);
      
      const data = await res.json();
      console.log('[Audit Stats] Response data:', data);

      if (res.ok && data.success) {
        setStats(data.stats);
      } else {
        console.error('[Audit Stats] Failed to fetch stats:', data.error || 'Unknown error');
      }
    } catch (error) {
      console.error('[Audit Stats] Failed to fetch stats:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, levelFilter, categoryFilter, searchFilter]);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [levelFilter, categoryFilter, searchFilter]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const getLevelColor = (level) => {
    switch (level) {
      case 'critical': return 'bg-red-600';
      case 'error': return 'bg-red-500';
      case 'warn': return 'bg-yellow-500';
      default: return 'bg-blue-500';
    }
  };

  const getStatusColor = (status) => {
    if (status >= 500) return 'text-red-600';
    if (status >= 400) return 'text-yellow-600';
    if (status >= 300) return 'text-blue-600';
    return 'text-green-600';
  };

  return (
    <BackgroundWrapper>
      <div className="min-h-screen w-full">
        <div className="container mx-auto p-6 space-y-8 max-w-7xl pt-24">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-foreground ivy-font">Audit Logs</h1>
            <p className="text-muted-foreground ivy-font mt-1">
              Monitor all system activities, errors, and performance metrics
            </p>
          </div>
          <Button 
            onClick={() => { fetchLogs(); fetchStats(); }} 
            variant="outline"
            className="ivy-font gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground ivy-font">Total Logs (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-foreground ivy-font">{stats.total.last24h.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">Last 7d: {stats.total.last7d.toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground ivy-font">Errors (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-red-500 ivy-font">{stats.errors.last24h}</div>
                <p className="text-xs text-muted-foreground mt-1">Error rate: {stats.errors.rate}%</p>
              </CardContent>
            </Card>

            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground ivy-font">Unique Users (24h)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-500 ivy-font">{stats.users.unique24h}</div>
                <p className="text-xs text-muted-foreground mt-1">Active sessions</p>
              </CardContent>
            </Card>

            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground ivy-font">Avg Response Time</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold text-emerald-500 ivy-font">{stats.performance.avgResponseTime}ms</div>
                <p className="text-xs text-muted-foreground mt-1">Last 24 hours</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="logs" className="w-full">
          <TabsList className="bg-muted/50 border border-border/40">
            <TabsTrigger value="logs" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500 ivy-font">
              Logs
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500 ivy-font">
              Analytics
            </TabsTrigger>
            <TabsTrigger value="errors" className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-500 ivy-font">
              Recent Errors
            </TabsTrigger>
          </TabsList>

          {/* Logs Tab */}
          <TabsContent value="logs" className="space-y-4">
            {/* Filters */}
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Input
                    placeholder="Search logs..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="bg-background/50 border-border/40 ivy-font"
                  />
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="bg-background/50 border border-border/40 text-foreground rounded-md px-3 py-2 ivy-font"
                  >
                    <option value="">All Levels</option>
                    <option value="info">Info</option>
                    <option value="warn">Warning</option>
                    <option value="error">Error</option>
                    <option value="critical">Critical</option>
                  </select>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="bg-background/50 border border-border/40 text-foreground rounded-md px-3 py-2 ivy-font"
                  >
                    <option value="">All Categories</option>
                    <option value="api">API</option>
                    <option value="auth">Auth</option>
                    <option value="campaign">Campaign</option>
                    <option value="social">Social</option>
                    <option value="workflow">Workflow</option>
                    <option value="image">Image</option>
                  </select>
                  <Button
                    onClick={() => {
                      setLevelFilter('');
                      setCategoryFilter('');
                      setSearchFilter('');
                    }}
                    variant="outline"
                    className="ivy-font"
                  >
                    Clear Filters
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Logs Table */}
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardContent className="pt-6">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground ivy-font">Loading logs...</div>
                ) : logs.length === 0 ? (
                  <div className="text-center py-16 px-4">
                    <div className="max-w-md mx-auto">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">📊</span>
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-2 ivy-font">No Audit Logs Yet</h3>
                      <p className="text-muted-foreground ivy-font mb-6">
                        Audit logs will appear here when you:
                      </p>
                      <ul className="text-left text-sm text-muted-foreground space-y-2 mb-6 ivy-font">
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>Execute AI campaign workflows in the Dashboard</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>Run enrollment forecasting predictions</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>Perform student segmentation analysis</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-emerald-500 mt-0.5">•</span>
                          <span>Generate blockchain-verified forecasts</span>
                        </li>
                      </ul>
                      <a 
                        href="/dashboard" 
                        className="inline-block px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl ivy-font"
                      >
                        Go to Dashboard
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div
                        key={log._id}
                        className="bg-background/50 rounded-lg p-4 border border-border/40 hover:border-emerald-500/50 transition-colors"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge className={`${getLevelColor(log.level)} ivy-font`}>
                                {log.level.toUpperCase()}
                              </Badge>
                              <Badge variant="outline" className="border-border/40 text-muted-foreground ivy-font">
                                {log.category}
                              </Badge>
                              <span className={`font-mono font-bold ivy-font ${getStatusColor(log.statusCode)}`}>
                                {log.statusCode}
                              </span>
                              <span className="text-sm text-muted-foreground font-mono ivy-font">{log.method}</span>
                              <span className="text-sm text-foreground flex-1 truncate ivy-font">{log.path}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground ivy-font flex-wrap">
                              <span>{new Date(log.timestamp).toLocaleString()}</span>
                              <span>IP: {log.ip}</span>
                              {log.userEmail && <span>User: {log.userEmail}</span>}
                              {log.responseTime && <span>⏱️ {log.responseTime}ms</span>}
                            </div>
                            {log.error && (
                              <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded text-sm text-red-400 ivy-font">
                                <strong>Error:</strong> {log.error.message}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pagination */}
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border/40">
                    <div className="text-sm text-muted-foreground ivy-font">
                      Page {pagination.page} of {pagination.pages} ({pagination.total} total)
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        variant="outline"
                        className="ivy-font"
                      >
                        Previous
                      </Button>
                      <Button
                        onClick={() => setPage(page + 1)}
                        disabled={page >= pagination.pages}
                        variant="outline"
                        className="ivy-font"
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            {stats && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category Breakdown */}
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="ivy-font">Requests by Category (24h)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {stats.breakdowns.byCategory.map((item) => (
                          <div key={item._id} className="flex items-center justify-between">
                            <span className="text-foreground ivy-font">{item._id}</span>
                            <Badge variant="outline" className="border-border/40 ivy-font">
                              {item.count.toLocaleString()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Status Code Breakdown */}
                  <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                    <CardHeader>
                      <CardTitle className="ivy-font">Status Codes (24h)</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {stats.breakdowns.byStatusCode.map((item) => (
                          <div key={item._id} className="flex items-center justify-between">
                            <span className={`${getStatusColor(item._id)} ivy-font`}>{item._id}</span>
                            <Badge variant="outline" className="border-border/40 ivy-font">
                              {item.count.toLocaleString()}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Top Endpoints */}
                <Card className="border-border/40 backdrop-blur-sm bg-card/50">
                  <CardHeader>
                    <CardTitle className="ivy-font">Top Endpoints (24h)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stats.breakdowns.topEndpoints.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-background/50 rounded border border-border/20">
                          <span className="text-foreground font-mono text-sm flex-1 truncate ivy-font">{item._id}</span>
                          <div className="flex items-center gap-4">
                            <span className="text-muted-foreground text-sm ivy-font">{item.count} requests</span>
                            <Badge variant="outline" className="border-border/40 ivy-font">
                              {item.avgResponseTime?.toFixed(0)}ms avg
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Errors Tab */}
          <TabsContent value="errors" className="space-y-4">
            <Card className="border-border/40 backdrop-blur-sm bg-card/50">
              <CardHeader>
                <CardTitle className="ivy-font">Recent Errors</CardTitle>
                <CardDescription className="text-muted-foreground ivy-font">Last 10 error events</CardDescription>
              </CardHeader>
              <CardContent>
                {stats?.recentErrors.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground ivy-font">No recent errors 🎉</div>
                ) : (
                  <div className="space-y-2">
                    {stats?.recentErrors.map((error) => (
                      <div
                        key={error._id}
                        className="bg-red-500/10 border border-red-500/30 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-3">
                              <span className="font-mono font-bold text-red-500 ivy-font">{error.statusCode}</span>
                              <span className="text-sm text-foreground ivy-font">{error.path}</span>
                            </div>
                            <div className="text-xs text-muted-foreground ivy-font">
                              {new Date(error.timestamp).toLocaleString()} • IP: {error.ip}
                              {error.userEmail && ` • User: ${error.userEmail}`}
                            </div>
                            {error.error?.message && (
                              <div className="mt-2 text-sm text-red-400 ivy-font">
                                {error.error.message}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
    </BackgroundWrapper>
  );
}
