"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import * as d3 from "d3";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Filter,
  Download,
  RefreshCw,
  Users,
  GitBranch,
  Target,
  Activity,
} from "lucide-react";
import { NetworkNode, NetworkLink, NetworkCluster } from "@/lib/linkedin/network-analysis";

interface NetworkVisualizationProps {
  nodes: NetworkNode[];
  links: NetworkLink[];
  clusters?: NetworkCluster[];
  width?: number;
  height?: number;
  onNodeClick?: (node: NetworkNode) => void;
  onLinkClick?: (link: NetworkLink) => void;
}

export function NetworkVisualization({
  nodes,
  links,
  clusters = [],
  width = 1200,
  height = 800,
  onNodeClick,
  onLinkClick,
}: NetworkVisualizationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);
  const [strengthThreshold, setStrengthThreshold] = useState<number>(0);
  const [viewMode, setViewMode] = useState<"network" | "cluster" | "strength">("network");
  const [zoom, setZoom] = useState<number>(1);

  // Filter nodes and links based on threshold
  const filteredData = useMemo(() => {
    const filteredNodes = nodes.filter(n => n.strength >= strengthThreshold);
    const filteredNodeIds = new Set(filteredNodes.map(n => n.id));
    const filteredLinks = links.filter(
      l => filteredNodeIds.has(l.source) && filteredNodeIds.has(l.target) && l.strength >= strengthThreshold
    );

    return { nodes: filteredNodes, links: filteredLinks };
  }, [nodes, links, strengthThreshold]);

  useEffect(() => {
    if (!svgRef.current) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);
    const g = svg.append("g");

    // Set up zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    // Color scale for clusters
    const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

    // Size scale for nodes based on strength
    const sizeScale = d3.scaleLinear()
      .domain([0, 100])
      .range([4, 20]);

    // Create force simulation
    const simulation = d3.forceSimulation(filteredData.nodes as any)
      .force("link", d3.forceLink(filteredData.links)
        .id((d: any) => d.id)
        .distance((d: any) => 100 - d.strength * 0.5)
        .strength((d: any) => d.strength / 100))
      .force("charge", d3.forceManyBody()
        .strength(-300)
        .distanceMax(500))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide().radius((d: any) => sizeScale(d.strength) + 5));

    // Add cluster forces if in cluster view
    if (viewMode === "cluster" && clusters.length > 0) {
      const clusterCenters = new Map<string, { x: number; y: number }>();
      const angleStep = (2 * Math.PI) / clusters.length;

      clusters.forEach((cluster, i) => {
        const angle = i * angleStep;
        clusterCenters.set(cluster.id, {
          x: width / 2 + Math.cos(angle) * 200,
          y: height / 2 + Math.sin(angle) * 200,
        });
      });

      simulation.force("cluster", d3.forceX<any>((d) => {
        const center = clusterCenters.get(d.cluster || "");
        return center ? center.x : width / 2;
      }).strength(0.5))
        .force("clusterY", d3.forceY<any>((d) => {
          const center = clusterCenters.get(d.cluster || "");
          return center ? center.y : height / 2;
        }).strength(0.5));
    }

    // Create link elements
    const link = g.append("g")
      .attr("class", "links")
      .selectAll("line")
      .data(filteredData.links)
      .enter().append("line")
      .attr("stroke", (d) => {
        if (viewMode === "strength") {
          return d3.interpolateRdYlGn(d.strength / 100);
        }
        return "#999";
      })
      .attr("stroke-opacity", (d) => 0.2 + (d.strength / 100) * 0.6)
      .attr("stroke-width", (d) => 1 + (d.strength / 100) * 3)
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onLinkClick) onLinkClick(d);
      })
      .on("mouseover", function() {
        d3.select(this).attr("stroke-opacity", 1);
      })
      .on("mouseout", function(event, d) {
        d3.select(this).attr("stroke-opacity", 0.2 + (d.strength / 100) * 0.6);
      });

    // Create node group
    const node = g.append("g")
      .attr("class", "nodes")
      .selectAll("g")
      .data(filteredData.nodes)
      .enter().append("g")
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
        if (onNodeClick) onNodeClick(d);
      });

    // Add circles for nodes
    node.append("circle")
      .attr("r", (d) => sizeScale(d.strength))
      .attr("fill", (d) => {
        if (d.type === "self") return "#3b82f6";
        if (viewMode === "cluster" && d.cluster) {
          return colorScale(d.cluster);
        }
        if (viewMode === "strength") {
          return d3.interpolateRdYlGn(d.strength / 100);
        }
        return d.type === "connection" ? "#10b981" : "#f59e0b";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("cursor", "pointer")
      .on("mouseover", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", sizeScale(d.strength) * 1.2);

        // Show tooltip
        const tooltip = d3.select("body").append("div")
          .attr("class", "network-tooltip")
          .style("position", "absolute")
          .style("background", "rgba(0, 0, 0, 0.8)")
          .style("color", "white")
          .style("padding", "8px")
          .style("border-radius", "4px")
          .style("font-size", "12px")
          .style("pointer-events", "none")
          .style("opacity", 0);

        tooltip.html(`
          <strong>${d.name}</strong><br/>
          ${d.headline || d.company || ""}<br/>
          Strength: ${d.strength}%
        `)
          .style("left", (event.pageX + 10) + "px")
          .style("top", (event.pageY - 10) + "px")
          .transition()
          .duration(200)
          .style("opacity", 1);
      })
      .on("mouseout", function(event, d) {
        d3.select(this)
          .transition()
          .duration(200)
          .attr("r", sizeScale(d.strength));

        d3.selectAll(".network-tooltip").remove();
      });

    // Add labels for important nodes
    node.filter((d) => d.type === "self" || d.strength > 70)
      .append("text")
      .attr("dx", (d) => sizeScale(d.strength) + 3)
      .attr("dy", ".35em")
      .text((d) => d.name)
      .style("font-size", "10px")
      .style("fill", "#4b5563")
      .style("pointer-events", "none");

    // Add drag behavior
    const dragBehavior = d3.drag<any, any>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    node.call(dragBehavior);

    // Update positions on tick
    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    // Highlight selected cluster
    if (selectedCluster) {
      node.selectAll("circle")
        .attr("opacity", (d) => d.cluster === selectedCluster ? 1 : 0.3);

      link.attr("opacity", (d: any) => {
        const sourceMatch = filteredData.nodes.find(n => n.id === d.source.id)?.cluster === selectedCluster;
        const targetMatch = filteredData.nodes.find(n => n.id === d.target.id)?.cluster === selectedCluster;
        return sourceMatch || targetMatch ? 0.6 : 0.1;
      });
    }

    return () => {
      simulation.stop();
      d3.selectAll(".network-tooltip").remove();
    };
  }, [filteredData, width, height, viewMode, clusters, selectedCluster, onNodeClick, onLinkClick]);

  const handleZoomIn = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleTo as any,
      zoom * 1.2
    );
  };

  const handleZoomOut = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().scaleTo as any,
      zoom / 1.2
    );
  };

  const handleReset = () => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().call(
      d3.zoom<SVGSVGElement, unknown>().transform as any,
      d3.zoomIdentity
    );
    setSelectedNode(null);
    setSelectedCluster(null);
  };

  const handleExport = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "network-visualization.svg";
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* View Mode */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">View:</span>
            <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="network">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4" />
                    Network
                  </div>
                </SelectItem>
                <SelectItem value="cluster">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Clusters
                  </div>
                </SelectItem>
                <SelectItem value="strength">
                  <div className="flex items-center gap-2">
                    <Activity className="h-4 w-4" />
                    Strength
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Strength Filter */}
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <Filter className="h-4 w-4" />
            <span className="text-sm">Min Strength:</span>
            <Slider
              value={[strengthThreshold]}
              onValueChange={([value]) => setStrengthThreshold(value)}
              min={0}
              max={100}
              step={10}
              className="flex-1"
            />
            <span className="text-sm font-medium w-12">{strengthThreshold}%</span>
          </div>

          {/* Cluster Filter */}
          {viewMode === "cluster" && clusters.length > 0 && (
            <Select value={selectedCluster || ""} onValueChange={setSelectedCluster}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All clusters" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All clusters</SelectItem>
                {clusters.map(cluster => (
                  <SelectItem key={cluster.id} value={cluster.id}>
                    {cluster.name} ({cluster.size})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              title="Reset View"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <Button
              variant="outline"
              size="icon"
              onClick={handleExport}
              title="Export SVG"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleReset}
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Visualization */}
      <Card className="overflow-hidden">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          className="w-full h-full bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800"
        />
      </Card>

      {/* Selected Node Info */}
      {selectedNode && (
        <Card className="p-4">
          <h3 className="font-semibold mb-2">Selected Connection</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <span className="text-sm text-muted-foreground">Name</span>
              <p className="font-medium">{selectedNode.name}</p>
            </div>
            {selectedNode.headline && (
              <div>
                <span className="text-sm text-muted-foreground">Title</span>
                <p className="font-medium">{selectedNode.headline}</p>
              </div>
            )}
            {selectedNode.company && (
              <div>
                <span className="text-sm text-muted-foreground">Company</span>
                <p className="font-medium">{selectedNode.company}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-muted-foreground">Strength</span>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full"
                    style={{ width: `${selectedNode.strength}%` }}
                  />
                </div>
                <span className="font-medium">{selectedNode.strength}%</span>
              </div>
            </div>
            {selectedNode.cluster && (
              <div>
                <span className="text-sm text-muted-foreground">Cluster</span>
                <Badge variant="outline">{selectedNode.cluster.replace(/_/g, " ")}</Badge>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Legend */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-blue-500" />
            <span>You</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span>Potential Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
            <span>Stronger connection (larger)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-full h-1 bg-gradient-to-r from-gray-300 to-gray-600" style={{ width: "40px" }} />
            <span>Link strength</span>
          </div>
        </div>
      </Card>
    </div>
  );
}