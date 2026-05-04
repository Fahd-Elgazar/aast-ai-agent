import GraphView from "./GraphView";

export default function GraphVisualizer({ graphData }: any) {
  if (!graphData) {
    return (
      <div style={{ height: "600px", color: "white" }}>
        No graph yet...
      </div>
    );
  }

  return (
    <div style={{ height: "600px", background: "#fff" }}>
      <GraphView data={graphData} />
    </div>
  );
}