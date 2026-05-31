"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  RefreshCw,
  Users,
  Building2,
  MessageSquare,
  ExternalLink,
  Crown,
  Target,
} from "lucide-react";
import { OrgChartNode, OrgChartRelationship } from "@/lib/linkedin/company-research";

interface OrganizationalChartProps {
  nodes: OrgChartNode[];
  relationships: OrgChartRelationship[];
  companyName: string;
  width?: number;
  height?: number;
  onNodeClick?: (node: OrgChartNode) => void;
  onConnectRequest?: (node: OrgChartNode) => void;
}

interface HierarchyNode extends d3.HierarchyNode<OrgChartNode> {
  x: number;
  y: number;
}

export function OrganizationalChart({
  nodes,
  relationships,
  companyName,
  width = 1200,
  height = 800,
  onNodeClick,
  onConnectRequest,
}: OrganizationalChartProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNode, setSelectedNode] = useState<OrgChartNode | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [levelFilter, setLevelFilter] = useState<string>("");
  const [zoom, setZoom] = useState<number>(1);
  const [viewMode, setViewMode] = useState<"hierarchy" | "departments">("hierarchy");

  // Build hierarchy from flat nodes and relationships
  const hierarchyData = React.useMemo(() => {
    if (!nodes.length) return null;

    // Find root nodes (managers without managers)
    const childIds = new Set(relationships.map(r => r.reportId));
    const rootNodes = nodes.filter(n => !childIds.has(n.id));

    // If no clear hierarchy, use hiring managers as roots
    const roots = rootNodes.length > 0 ? rootNodes : nodes.filter(n => n.isHiringManager);

    // Build tree structure
    const buildTree = (parentId: string): any => {
      const parent = nodes.find(n => n.id === parentId);
      if (!parent) return null;

      const children = relationships
        .filter(r => r.managerId === parentId)
        .map(r => buildTree(r.reportId))
        .filter(Boolean);

      return {
        ...parent,
        children: children.length > 0 ? children : undefined,
      };
    };

    // Handle multiple root nodes
    if (roots.length === 1) {
      return buildTree(roots[0].id);
    } else {
      // Create virtual root for multiple managers
      return {
        id: 'virtual-root',
        name: companyName,
        title: 'Company',
        department: 'Leadership',
        level: 'executive',
        isHiringManager: false,
        children: roots.map(root => buildTree(root.id)).filter(Boolean),
      };
    }
  }, [nodes, relationships, companyName]);

  // Filter nodes based on selected filters
  const filteredNodes = React.useMemo(() => {
    return nodes.filter(node => {
      if (departmentFilter && node.department !== departmentFilter) return false;
      if (levelFilter && node.level !== levelFilter) return false;
      return true;
    });
  }, [nodes, departmentFilter, levelFilter]);

  // Get unique departments and levels for filters
  const departments = Array.from(new Set(nodes.map(n => n.department))).sort();
  const levels = Array.from(new Set(nodes.map(n => n.level))).sort();

  useEffect(() => {
    if (!svgRef.current || !hierarchyData || filteredNodes.length === 0) return;

    // Clear previous visualization
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current);
    const g = svg.append("g");

    // Set up zoom behavior
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
        setZoom(event.transform.k);
      });

    svg.call(zoomBehavior);

    if (viewMode === "hierarchy") {
      renderHierarchicalView(g, hierarchyData, width, height);
    } else {
      renderDepartmentalView(g, filteredNodes, width, height);
    }

    return () => {
      svg.on(".zoom", null);
    };
  }, [hierarchyData, filteredNodes, viewMode, departmentFilter, levelFilter, width, height]);

  const renderHierarchicalView = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    data: any,
    width: number,
    height: number
  ) => {
    // Create tree layout
    const treeLayout = d3.tree<any>().size([width - 100, height - 100]);
    const root = d3.hierarchy(data);
    treeLayout(root);

    // Draw links
    const links = g.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("d", d3.linkVertical<any, any>()
        .x(d => d.x + 50)
        .y(d => d.y + 50))
      .attr("stroke", "#999")
      .attr("stroke-width", 2)
      .attr("fill", "none")
      .attr("stroke-opacity", 0.6);

    // Draw nodes
    const nodeGroups = g.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d: any) => `translate(${d.x + 50},${d.y + 50})`)
      .style("cursor", "pointer")
      .on("click", function(event, d: any) {
        event.stopPropagation();
        if (d.data.id !== 'virtual-root') {
          setSelectedNode(d.data);
          onNodeClick?.(d.data);
        }
      });

    // Add node circles
    nodeGroups.append("circle")
      .attr("r", (d: any) => {
        if (d.data.id === 'virtual-root') return 25;
        return d.data.isHiringManager ? 20 : 15;
      })
      .attr("fill", (d: any) => {
        if (d.data.id === 'virtual-root') return "#3b82f6";
        if (d.data.connectionDegree === 1) return "#10b981";
        if (d.data.connectionDegree === 2) return "#f59e0b";
        return "#6b7280";
      })
      .attr("stroke", "#fff")
      .attr("stroke-width", 2);

    // Add hiring manager crown
    nodeGroups.filter((d: any) => d.data.isHiringManager && d.data.id !== 'virtual-root')
      .append("text")
      .attr("text-anchor", "middle")
      .attr("y", -25)
      .attr("font-size", "12px")
      .text("👑");

    // Add node labels
    nodeGroups.append("text")
      .attr("dy", ".35em")
      .attr("text-anchor", "middle")
      .attr("font-size", "10px")
      .attr("font-weight", "500")
      .text((d: any) => {
        if (d.data.id === 'virtual-root') return d.data.name;
        return d.data.name.split(' ').map((n: string) => n[0]).join('');
      });

    // Add title on hover
    nodeGroups.append("title")
      .text((d: any) => {
        if (d.data.id === 'virtual-root') return d.data.name;
        return `${d.data.name}\n${d.data.title}\n${d.data.department}`;
      });
  };

  const renderDepartmentalView = (
    g: d3.Selection<SVGGElement, unknown, null, undefined>,
    nodes: OrgChartNode[],
    width: number,
    height: number
  ) => {
    // Group nodes by department
    const departmentGroups = d3.group(nodes, d => d.department);
    const departments = Array.from(departmentGroups.keys());

    const departmentWidth = width / Math.max(departments.length, 1);
    const departmentHeight = height - 100;

    departments.forEach((department, deptIndex) => {
      const deptNodes = departmentGroups.get(department) || [];
      const deptX = deptIndex * departmentWidth + 50;

      // Department header
      g.append("text")
        .attr("x", deptX + departmentWidth / 2)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .attr("font-size", "16px")
        .attr("font-weight", "bold")
        .attr("fill", "#374151")
        .text(department);

      // Department background
      g.append("rect")
        .attr("x", deptX + 10)
        .attr("y", 50)
        .attr("width", departmentWidth - 20)
        .attr("height", departmentHeight)
        .attr("fill", "#f9fafb")
        .attr("stroke", "#e5e7eb")
        .attr("stroke-width", 1)
        .attr("rx", 8);

      // Position nodes within department
      const nodesPerRow = Math.ceil(Math.sqrt(deptNodes.length));
      const nodeSpacing = (departmentWidth - 40) / Math.max(nodesPerRow, 1);

      deptNodes.forEach((node, nodeIndex) => {
        const row = Math.floor(nodeIndex / nodesPerRow);
        const col = nodeIndex % nodesPerRow;
        const nodeX = deptX + 30 + col * nodeSpacing;
        const nodeY = 80 + row * 80;

        const nodeGroup = g.append("g")
          .attr("transform", `translate(${nodeX},${nodeY})`)
          .style("cursor", "pointer")
          .on("click", function(event) {
            event.stopPropagation();
            setSelectedNode(node);
            onNodeClick?.(node);
          });

        // Node circle
        nodeGroup.append("circle")
          .attr("r", node.isHiringManager ? 20 : 15)
          .attr("fill", node.connectionDegree === 1 ? "#10b981" :
                       node.connectionDegree === 2 ? "#f59e0b" : "#6b7280")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2);

        // Hiring manager crown
        if (node.isHiringManager) {
          nodeGroup.append("text")
            .attr("text-anchor", "middle")
            .attr("y", -25)
            .attr("font-size", "12px")
            .text("👑");
        }

        // Node initials
        nodeGroup.append("text")
          .attr("dy", ".35em")
          .attr("text-anchor", "middle")
          .attr("font-size", "10px")
          .attr("font-weight", "500")
          .text(node.name.split(' ').map(n => n[0]).join(''));

        // Node title
        nodeGroup.append("title")
          .text(`${node.name}\n${node.title}\n${node.department}`);
      });
    });
  };

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
  };

  const handleExport = () => {
    if (!svgRef.current) return;
    const svgData = new XMLSerializer().serializeToString(svgRef.current);
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${companyName}-org-chart.svg`;
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
                <SelectItem value="hierarchy">
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4" />
                    Hierarchy
                  </div>
                </SelectItem>
                <SelectItem value="departments">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    Departments
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Department Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Department:</span>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All departments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All departments</SelectItem>
                {departments.map(dept => (
                  <SelectItem key={dept} value={dept}>{dept}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Level Filter */}
          <div className="flex items-center gap-2">
            <span className="text-sm">Level:</span>
            <Select value={levelFilter} onValueChange={setLevelFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="All levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All levels</SelectItem>
                {levels.map(level => (
                  <SelectItem key={level} value={level}>
                    {level.replace(/([A-Z])/g, ' $1').trim()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={handleZoomIn} aria-label="Zoom in">
              <ZoomIn className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleZoomOut} aria-label="Zoom out">
              <ZoomOut className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset} aria-label="Reset zoom and selection">
              <Maximize2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 ml-auto">
            <Button variant="outline" size="icon" onClick={handleExport} aria-label="Export chart as SVG">
              <Download className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleReset} aria-label="Refresh chart">
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
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
          role="img"
          aria-label={`Organizational chart for ${companyName} showing ${filteredNodes.length} employees`}
          aria-describedby="org-chart-description"
        >
          <desc id="org-chart-description">
            Interactive organizational chart displaying company hierarchy and reporting relationships.
            Use the controls above to filter by department or seniority level.
            Click on nodes to view detailed employee information.
          </desc>
        </svg>
      </Card>

      {/* Selected Node Details */}
      {selectedNode && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage
                  src={selectedNode.profilePicture}
                  alt={`Profile picture of ${selectedNode.name}`}
                />
                <AvatarFallback>
                  {selectedNode.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-2">
                  <span>{selectedNode.name}</span>
                  {selectedNode.isHiringManager && (
                    <Badge variant="default">
                      <Crown className="h-3 w-3 mr-1" />
                      Hiring Manager
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{selectedNode.title}</p>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <span className="text-sm text-muted-foreground">Department</span>
                <p className="font-medium">{selectedNode.department}</p>
              </div>
              <div>
                <span className="text-sm text-muted-foreground">Level</span>
                <Badge variant="outline">
                  {selectedNode.level.replace(/([A-Z])/g, ' $1').trim()}
                </Badge>
              </div>
              {selectedNode.connectionDegree && (
                <div>
                  <span className="text-sm text-muted-foreground">Connection</span>
                  <Badge variant={
                    selectedNode.connectionDegree === 1 ? "default" : "secondary"
                  }>
                    {selectedNode.connectionDegree === 1 ? "1st degree" :
                     selectedNode.connectionDegree === 2 ? "2nd degree" : "3rd+ degree"}
                  </Badge>
                </div>
              )}
              <div>
                <span className="text-sm text-muted-foreground">Actions</span>
                <div className="flex gap-1 mt-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          onClick={() => onConnectRequest?.(selectedNode)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Connect on LinkedIn</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button size="icon" variant="outline" className="h-8 w-8">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>View LinkedIn Profile</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Legend */}
      <Card className="p-4">
        <h3 className="font-semibold mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>1st Degree Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span>2nd Degree Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-gray-500" />
            <span>No Connection</span>
          </div>
          <div className="flex items-center gap-2">
            <Crown className="h-4 w-4" />
            <span>Hiring Manager</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
            <span>Larger circle = Manager</span>
          </div>
        </div>
      </Card>
    </div>
  );
}