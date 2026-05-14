interface GraphViewProps {
  data: any;
}

export default function GraphView({ data }: GraphViewProps) {
  return (
    <div style={{ padding: "20px", overflow: "auto", height: "100%" }}>
      <h2 style={{ color: "#000", marginBottom: "15px" }}>
        Graph Visualization
      </h2>

      <pre
        style={{
          background: "#f4f4f4",
          padding: "15px",
          borderRadius: "8px",
          fontSize: "14px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
