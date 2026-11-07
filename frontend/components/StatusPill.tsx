export default function StatusPill({ value }: { value: string }) {
  const kind = value.startsWith("Partially") ? "Partially" : value || "Open";
  return <span className={`pill ${kind}`}>{value || "—"}</span>;
}
