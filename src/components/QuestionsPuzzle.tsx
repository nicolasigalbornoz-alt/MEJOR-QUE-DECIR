type Edge = "flat" | "tab" | "notch";

const items = [
  { icon: "pin", title: "De dónde son", description: "Provincia, ciudad, barrio." },
  { icon: "clock", title: "Situación del distrito", description: "Cómo ven su lugar." },
  { icon: "alert", title: "Problemas de la juventud", description: "Lo que enfrentan a diario." },
  { icon: "megaphone", title: "Necesidades", description: "Qué necesitan para crecer." },
  { icon: "chart", title: "Visión del país", description: "Qué tan optimistas son." },
  { icon: "calendar", title: "19 de septiembre", description: "Un día, todo el país." },
];

const colors = ["--seq-250", "--seq-350", "--seq-450", "--seq-500", "--seq-600", "--seq-700"];
const horizontalJoints = [[true, false], [false, true]];
const verticalJoints = [true, false, true];

function edgesFor(row: number, column: number) {
  const rows = 2;
  const columns = 3;
  const horizontal = (r: number, joint: number) => horizontalJoints[r][joint];
  const vertical = (c: number) => verticalJoints[c];

  return {
    top: row === 0 ? "flat" : vertical(column) ? "notch" : "tab",
    bottom: row === rows - 1 ? "flat" : vertical(column) ? "tab" : "notch",
    left: column === 0 ? "flat" : horizontal(row, column - 1) ? "notch" : "tab",
    right: column === columns - 1 ? "flat" : horizontal(row, column) ? "tab" : "notch",
  } satisfies Record<string, Edge>;
}

function piecePath(edges: Record<string, Edge>) {
  const segment = (kind: Edge, first: string, second: string, corner: string) => {
    if (kind === "flat") return `L${corner}`;
    return `L${first} A15,15 0 0,${kind === "tab" ? 1 : 0} ${second} L${corner}`;
  };

  return [
    "M0,0",
    segment(edges.top, "35,0", "65,0", "100,0"),
    segment(edges.right, "100,35", "100,65", "100,100"),
    segment(edges.bottom, "65,100", "35,100", "0,100"),
    segment(edges.left, "0,65", "0,35", "0,0"),
    "Z",
  ].join(" ");
}

function TopicIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    pin: <><path d="M20.42 4.58a5.4 5.4 0 0 0-7.65 0l-.77.78-.77-.78a5.4 5.4 0 0 0-7.65 0C1.46 6.7 1.33 10.28 4 13l8 8 8-8c2.67-2.72 2.54-6.3.42-8.42z" /></>,
    clock: <><circle cx="12" cy="12" r="10" /><path d="M12 8v4l3 3" /></>,
    alert: <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" /></>,
    megaphone: <><path d="m3 11 18-5v12L3 14v-3z" /><path d="M11.6 16.8 13 20l3-1-1.4-3.2" /></>,
    chart: <><path d="M2 12h4l2-8 4 16 2-8h8" /></>,
    calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
  };

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}

export function QuestionsPuzzle() {
  return (
    <div className="puzzle-grid puzzle-grid--compact">
      {items.map((item, index) => {
        const row = Math.floor(index / 3);
        const column = index % 3;
        const edges = edgesFor(row, column);

        return (
          <div className="puzzle-piece puzzle-piece--static" key={item.title}>
            <svg viewBox="0 0 100 100" aria-hidden="true">
              <path d={piecePath(edges)} fill={`var(${colors[index]})`} />
            </svg>
            <span className="puzzle-piece__label">
              <span className="puzzle-piece__icon"><TopicIcon name={item.icon} /></span>
              <b>{item.title}</b>
              <small>{item.description}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}
