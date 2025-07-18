"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import { Play, Pause, RotateCcw, Server, Database, Users, Zap, Activity, Clock } from "lucide-react"

interface MetricData {
  timestamp: string
  requests: number
  cacheHits: number
  cacheMisses: number
  pods: number
  cpuUsage: number
  responseTime: number
  activeUsers: number
}

interface LogEntry {
  timestamp: string
  level: "INFO" | "WARN" | "ERROR" | "CRITICAL"
  component: "API" | "CACHE" | "K8S" | "LB" | "INFRA"
  message: string
}

// Helper function to format large numbers for display
const formatNumber = (num: number): string => {
  if (num >= 10000000) { // 1 crore = 10 million
    return `${(num / 10000000).toFixed(1)} Cr`
  } else if (num >= 100000) { // 1 lakh = 100,000
    return `${(num / 100000).toFixed(1)} L`
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

export default function HotstarScalingSimulation() {
  const [isRunning, setIsRunning] = useState(false)
  const [currentLoad, setCurrentLoad] = useState(150000) // Start at 150K requests/sec (realistic base load)
  const [metrics, setMetrics] = useState<MetricData[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [pods, setPods] = useState(50) // Start with more pods for high baseline
  const [cacheHitRate, setCacheHitRate] = useState(92) // Higher cache hit rate needed at scale
  const intervalRef = useRef<NodeJS.Timeout>()

  const generateMetrics = () => {
    const timestamp = new Date().toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })

    // Simulate realistic IPL scaling behavior
    const baseRequests = currentLoad
    const requests = baseRequests + Math.random() * 50000 // Traffic can vary by ±50K requests/sec

    // Cache behavior - critical at IPL scale, slight degradation under extreme load
    const hitRate = Math.max(88, cacheHitRate - (currentLoad / 1000000) * 5) // More stable cache at scale
    const cacheHits = Math.floor(requests * (hitRate / 100))
    const cacheMisses = Math.floor(requests - cacheHits)

    // Pod scaling logic for massive IPL traffic
    const targetPods = Math.ceil(requests / 3000) // Each pod handles ~3K requests/sec
    const newPods = Math.min(Math.max(50, targetPods), 2500) // Min 50, max 2500 pods (realistic for IPL)
    setPods(newPods)

    // CPU usage based on load vs capacity
    const cpuUsage = Math.min(95, (requests / (newPods * 3000)) * 100) // Higher capacity per pod

    // Response time increases dramatically with load at this scale
    const baseResponseTime = 45 // Optimized base response time
    const loadFactor = Math.max(1, requests / 200000) // Scale factor adjusted for high traffic
    const cacheFactor = hitRate / 100
    const responseTime = baseResponseTime * loadFactor * (2.5 - cacheFactor)

    // Calculate active users - at peak IPL can reach 85 crore (850 million)
    // Assuming each user generates ~3-5 requests per second on average
    const activeUsers = Math.floor(requests / 3.5) // More realistic user-to-request ratio

    const newMetric: MetricData = {
      timestamp,
      requests: Math.floor(requests),
      cacheHits,
      cacheMisses,
      pods: newPods,
      cpuUsage: Math.floor(cpuUsage),
      responseTime: Math.floor(responseTime),
      activeUsers,
    }

    setMetrics((prev) => [...prev.slice(-19), newMetric])

    // Generate logs based on events
    const newLogs: LogEntry[] = []

    if (newPods !== pods) {
      newLogs.push({
        timestamp,
        level: newPods > pods ? "INFO" : "WARN",
        component: "K8S",
        message: `Scaling ${newPods > pods ? "up" : "down"} to ${newPods} pods (was ${pods})`,
      })
    }

    if (cpuUsage > 80) {
      newLogs.push({
        timestamp,
        level: "WARN",
        component: "K8S",
        message: `High CPU usage: ${Math.floor(cpuUsage)}%`,
      })
    }

    if (hitRate < 90) {
      newLogs.push({
        timestamp,
        level: "WARN",
        component: "CACHE",
        message: `Cache hit rate dropped to ${Math.floor(hitRate)}% (critical at IPL scale)`,
      })
    }

    if (responseTime > 150) {
      newLogs.push({
        timestamp,
        level: "ERROR",
        component: "API",
        message: `High response time: ${Math.floor(responseTime)}ms`,
      })
    }

    if (requests > 500000) {
      newLogs.push({
        timestamp,
        level: "INFO",
        component: "LB",
        message: `High traffic detected: ${Math.floor(requests/1000)}K req/s`,
      })
    }

    if (requests > 2000000) {
      newLogs.push({
        timestamp,
        level: "CRITICAL",
        component: "INFRA",
        message: `PEAK IPL TRAFFIC: ${Math.floor(requests/1000000)}M req/s - ${Math.floor(activeUsers/10000000)} crore users`,
      })
    }

    if (newLogs.length > 0) {
      setLogs((prev) => [...newLogs, ...prev.slice(0, 49)])
    }
  }

  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(generateMetrics, 1000)
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isRunning, currentLoad, pods, cacheHitRate])

  const startSimulation = () => setIsRunning(true)
  const stopSimulation = () => setIsRunning(false)
  const resetSimulation = () => {
    setIsRunning(false)
    setMetrics([])
    setLogs([])
    setPods(50) // Reset to baseline pod count
    setCurrentLoad(150000) // Reset to baseline 150K requests/sec
  }

  const simulateTrafficSpike = () => {
    setCurrentLoad(3000000) // Simulate IPL Final - 3 million requests/sec (peak traffic, 85 crore users)
    setTimeout(() => setCurrentLoad(800000), 15000) // Return to high normal traffic after 15s
  }

  const currentMetric = metrics[metrics.length - 1]
  const cacheData = currentMetric
    ? [
        { name: "Cache Hits", value: currentMetric.cacheHits, color: "#10b981" },
        { name: "Cache Misses", value: currentMetric.cacheMisses, color: "#ef4444" },
      ]
    : []

  return (
    <div className="min-h-screen bg-background relative">
      {/* Background pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5"></div>
      
      <div className="relative z-10 p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6 lg:space-y-8">
          {/* Header */}
          <div className="text-center space-y-3 py-8">
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
              Hotstar Scaling Simulation
            </h1>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              Interactive demo simulating real IPL traffic - up to 85 crore users and 3M requests/sec
            </p>
          </div>

        {/* Control Panel */}
        <Card className="vercel-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-500" />
              Load Testing Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3 sm:gap-4">
            <Button onClick={startSimulation} disabled={isRunning} className="flex items-center gap-2">
              <Play className="w-4 h-4" />
              Start Simulation
            </Button>
            <Button
              onClick={stopSimulation}
              disabled={!isRunning}
              variant="outline"
              className="flex items-center gap-2 bg-transparent"
            >
              <Pause className="w-4 h-4" />
              Pause
            </Button>
            <Button onClick={resetSimulation} variant="outline" className="flex items-center gap-2 bg-transparent">
              <RotateCcw className="w-4 h-4" />
              Reset
            </Button>
            <Button onClick={simulateTrafficSpike} disabled={!isRunning} variant="destructive">
              Simulate IPL Final Traffic 🏏
            </Button>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm font-medium">Current Load:</span>
              <Badge variant={currentLoad > 8000 ? "destructive" : currentLoad > 5000 ? "secondary" : "default"}>
                {currentLoad.toLocaleString()} req/s
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentMetric ? formatNumber(currentMetric.activeUsers) : "0"}</div>
              <p className="text-xs text-muted-foreground">Peak: 85 Cr during IPL finals</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Kubernetes Pods</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(pods)}</div>
              <p className="text-xs text-muted-foreground">Max: 2.5K pods during peak</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cache Hit Rate</CardTitle>
              <Database className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {currentMetric
                  ? Math.floor((currentMetric.cacheHits / (currentMetric.cacheHits + currentMetric.cacheMisses)) * 100)
                  : 0}
                %
              </div>
              <Progress
                value={
                  currentMetric
                    ? (currentMetric.cacheHits / (currentMetric.cacheHits + currentMetric.cacheMisses)) * 100
                    : 0
                }
                className="mt-2"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{currentMetric?.responseTime || 0}ms</div>
              <p className="text-xs text-muted-foreground">Critical for user experience</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Logs */}
        <Tabs defaultValue="metrics" className="space-y-4 lg:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1">
            <TabsTrigger value="metrics" className="text-xs sm:text-sm">System Metrics</TabsTrigger>
            <TabsTrigger value="cache" className="text-xs sm:text-sm">Cache Performance</TabsTrigger>
            <TabsTrigger value="scaling" className="text-xs sm:text-sm">Auto Scaling</TabsTrigger>
            <TabsTrigger value="logs" className="text-xs sm:text-sm">System Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="metrics" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Requests per Second</CardTitle>
                  <CardDescription>Real-time traffic load</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="timestamp" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--card-foreground))'
                        }} 
                      />
                      <Line 
                        type="monotone" 
                        dataKey="requests" 
                        stroke="#3b82f6" 
                        strokeWidth={2}
                        dot={false}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-in-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Response Time vs CPU Usage</CardTitle>
                  <CardDescription>Performance correlation</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={metrics} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="timestamp" stroke="hsl(var(--muted-foreground))" />
                      <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" label={{ value: 'Response Time (ms)', angle: -90, position: 'insideLeft' }} />
                      <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" label={{ value: 'CPU Usage (%)', angle: 90, position: 'insideRight' }} />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--card-foreground))'
                        }} 
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="responseTime"
                        stroke="#ef4444"
                        strokeWidth={2}
                        name="Response Time (ms)"
                        dot={false}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-in-out"
                      />
                      <Line 
                        yAxisId="right"
                        type="monotone" 
                        dataKey="cpuUsage" 
                        stroke="#f59e0b" 
                        strokeWidth={2} 
                        name="CPU Usage (%)"
                        dot={false}
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-in-out"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="cache" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Cache Hit vs Miss Ratio</CardTitle>
                  <CardDescription>Current cache performance</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={cacheData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-in-out"
                      >
                        {cacheData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--card-foreground))'
                        }} 
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Cache Performance Over Time</CardTitle>
                  <CardDescription>Hits vs misses trend</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={metrics} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="timestamp" stroke="hsl(var(--muted-foreground))" />
                      <YAxis stroke="hsl(var(--muted-foreground))" />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))', 
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '6px',
                          color: 'hsl(var(--card-foreground))'
                        }} 
                      />
                      <Bar 
                        dataKey="cacheHits" 
                        stackId="a" 
                        fill="#10b981" 
                        name="Cache Hits"
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-in-out"
                      />
                      <Bar 
                        dataKey="cacheMisses" 
                        stackId="a" 
                        fill="#ef4444" 
                        name="Cache Misses"
                        isAnimationActive={true}
                        animationDuration={300}
                        animationEasing="ease-in-out"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="scaling" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Kubernetes Auto Scaling</CardTitle>
                <CardDescription>Pod count vs load correlation</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <LineChart data={metrics} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="timestamp" stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="left" stroke="hsl(var(--muted-foreground))" />
                    <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--muted-foreground))" />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                        color: 'hsl(var(--card-foreground))'
                      }} 
                    />
                    <Line
                      yAxisId="left"
                      type="monotone"
                      dataKey="requests"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Requests/s"
                      dot={false}
                      isAnimationActive={true}
                      animationDuration={300}
                      animationEasing="ease-in-out"
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="pods"
                      stroke="#10b981"
                      strokeWidth={3}
                      name="Pod Count"
                      dot={false}
                      isAnimationActive={true}
                      animationDuration={300}
                      animationEasing="ease-in-out"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  System Logs
                </CardTitle>
                <CardDescription>Real-time system events and alerts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      No logs yet. Start the simulation to see system events.
                    </p>
                  ) : (
                    logs.map((log, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Badge
                          variant={
                            log.level === "ERROR" ? "destructive" : log.level === "WARN" ? "secondary" : "default"
                          }
                          className="text-xs"
                        >
                          {log.level}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {log.component}
                        </Badge>
                        <div className="flex-1">
                          <p className="text-sm">{log.message}</p>
                          <p className="text-xs text-muted-foreground">{log.timestamp}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Architecture Overview */}
        <Card>
          <CardHeader>
            <CardTitle>How It Works: Hotstar's Scaling Architecture</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Database className="w-5 h-5 text-blue-500" />
                  API Caching Layer
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Redis/Memcached for frequently accessed data</li>
                  <li>• CDN caching for static content and video segments</li>
                  <li>• Application-level caching for API responses</li>
                  <li>• Cache invalidation strategies for live content</li>
                </ul>
              </div>
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Server className="w-5 h-5 text-green-500" />
                  Kubernetes Auto Scaling
                </h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Horizontal Pod Autoscaler (HPA) based on CPU/memory</li>
                  <li>• Custom metrics scaling (requests per second)</li>
                  <li>• Cluster autoscaling for node management</li>
                  <li>• Predictive scaling for known traffic patterns</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </div>
  )
}
