import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import type { GraphData, GraphNode, GraphLink } from "../types";

interface GraphVisualizerProps {
  data: GraphData;
}

const GraphVisualizer: React.FC<GraphVisualizerProps> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || !data || !data.nodes) return;

    const width = Math.max(300, containerRef.current.clientWidth);
    const height = Math.max(300, containerRef.current.clientHeight);

    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current).attr("viewBox", [0, 0, width, height]);

    const simulation = d3.forceSimulation<GraphNode>(data.nodes)
      .force("link", d3.forceLink<GraphNode, GraphLink>(data.links).id(d => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-320))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collide", d3.forceCollide().radius(40));

    // glow filter
    const defs = svg.append("defs");
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "2.5").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    const link = svg.append("g")
      .attr("stroke", "#9CA3AF")
      .attr("stroke-opacity", 0.6)
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke-width", d => Math.sqrt(d.value || 1) * 2);

    const node = svg.append("g")
      .attr("stroke", "#fff")
      .attr("stroke-width", 1.2)
      .selectAll("g")
      .data(data.nodes)
      .join("g")
      .call(
        d3.drag<SVGGElement, GraphNode>()
          .on("start", dragstarted)
          .on("drag", dragged)
          .on("end", dragended) as any
      );

    node.append("circle")
      .attr("r", d => (d.group === 1 ? 28 : d.group === 2 ? 18 : 12))
      .attr("fill", d => {
        if (d.group === 1) return "#D4AF37";
        if (d.group === 2) return "#3B82F6";
        return "#60A5FA";
      })
      .style("filter", "url(#glow)");

    node.append("text")
      .text(d => d.label || d.id)
      .attr("y", d => (d.group === 1 ? 36 : 28))
      .attr("text-anchor", "middle")
      .attr("fill", "#F3F4F6")
      .style("font-size", d => (d.group === 1 ? "14px" : "10px"))
      .style("font-weight", "600")
      .style("pointer-events", "none");

    simulation.on("tick", () => {
      link
        .attr("x1", d => (d.source as any).x)
        .attr("y1", d => (d.source as any).y)
        .attr("x2", d => (d.target as any).x)
        .attr("y2", d => (d.target as any).y);

      node.attr("transform", d => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: any, d: any) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: any, d: any) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    return () => simulation.stop();
  }, [data]);

  return (
    <div ref={containerRef} className="w-full h-full relative bg-navy-900 rounded-lg shadow-inner border border-navy-800">
      <svg ref={svgRef} className="w-full h-full block"></svg>
    </div>
  );
};

export default GraphVisualizer;
