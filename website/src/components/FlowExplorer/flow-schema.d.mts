export type L = { en: string; it: string };
export type Flow = {
  id: string;
  title: L;
  nodes: { id: string; label: L; x: number; y: number }[];
  edges: { from: string; to: string }[];
  steps: { title: L; body: L; highlight: string[] }[];
};
export function validateFlow(flow: unknown): string[];
