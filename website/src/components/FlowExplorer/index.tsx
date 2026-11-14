import React, {useMemo, useState} from 'react';
import clsx from 'clsx';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import {ReactFlow, Handle, MarkerType, Position, type Edge, type Node, type NodeProps} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type {Flow, L} from './flow-schema.mjs';
import styles from './styles.module.css';

const COPY = {
  en: {back: 'Back', next: 'Next', involved: 'Involved', stepOf: (n: number, t: number) => `Step ${n} of ${t}`},
  it: {back: 'Indietro', next: 'Avanti', involved: 'Coinvolti', stepOf: (n: number, t: number) => `Passo ${n} di ${t}`},
} as const;

// Must match the node width in styles.module.css.
const NODE_WIDTH = 104;

// Four handles per node so an edge can leave to the right (target further along the row)
// or from the bottom (target on a lower row), chosen from the node positions in the data.
function StepNode({data}: NodeProps) {
  return (
    <>
      <Handle id="l" type="target" position={Position.Left} isConnectable={false} />
      <Handle id="t" type="target" position={Position.Top} isConnectable={false} />
      {String(data.label)}
      <Handle id="r" type="source" position={Position.Right} isConnectable={false} />
      <Handle id="b" type="source" position={Position.Bottom} isConnectable={false} />
    </>
  );
}
const nodeTypes = {step: StepNode};

function Canvas({flow, locale, highlight}: {flow: Flow; locale: 'en' | 'it'; highlight: Set<string>}) {
  const nodes: Node[] = useMemo(
    () =>
      flow.nodes.map((n) => ({
        id: n.id,
        position: {x: n.x, y: n.y},
        type: 'step',
        data: {label: n.label[locale]},
        className: clsx(styles.node, highlight.has(n.id) ? styles.nodeOn : styles.nodeOff),
        draggable: false,
        selectable: false,
        connectable: false,
        deletable: false,
        focusable: false,
      })),
    [flow, locale, highlight],
  );
  const edges: Edge[] = useMemo(
    () =>
      flow.edges.map((e) => {
        const on = highlight.has(e.to);
        const color = on ? 'var(--ifm-color-primary)' : 'var(--ifm-color-emphasis-500)';
        const a = flow.nodes.find((n) => n.id === e.from)!;
        const b = flow.nodes.find((n) => n.id === e.to)!;
        const sideways = b.x >= a.x + NODE_WIDTH;
        return {
          sourceHandle: sideways ? 'r' : 'b',
          targetHandle: sideways ? 'l' : 't',
          markerEnd: {type: MarkerType.ArrowClosed, color, width: 18, height: 18},
          id: `${e.from}->${e.to}`,
          source: e.from,
          target: e.to,
          type: 'smoothstep',
          className: on ? styles.edgeOn : styles.edgeOff,
          focusable: false,
          selectable: false,
          deletable: false,
        };
      }),
    [flow, highlight],
  );
  return (
    <ReactFlow
      nodes={nodes}
      nodeTypes={nodeTypes}
      edges={edges}
      fitView
      fitViewOptions={{padding: 0.04, maxZoom: 1.1}}
      nodesDraggable={false}
      nodesConnectable={false}
      nodesFocusable={false}
      edgesFocusable={false}
      elementsSelectable={false}
      deleteKeyCode={null}
      selectionKeyCode={null}
      panOnDrag={false}
      panOnScroll={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      minZoom={0.1}
    />
  );
}

export default function FlowExplorer({flow}: {flow: Flow}): React.JSX.Element {
  const {i18n} = useDocusaurusContext();
  const locale: 'en' | 'it' = i18n.currentLocale === 'it' ? 'it' : 'en';
  const t = COPY[locale];
  const [index, setIndex] = useState(0);
  const total = flow.steps.length;
  const step = flow.steps[index];
  const highlight = useMemo(() => new Set(step.highlight), [step]);
  const label = (l: L) => l[locale];
  const involved = flow.nodes.filter((n) => highlight.has(n.id)).map((n) => label(n.label));

  return (
    <section className={styles.explorer} aria-label={label(flow.title)}>
      <div className={styles.scroller}>
        <div className={styles.canvas} aria-hidden="true">
          <BrowserOnly fallback={<div className={styles.placeholder} />}>
            {() => <Canvas flow={flow} locale={locale} highlight={highlight} />}
          </BrowserOnly>
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.progress} aria-hidden="true">
          {flow.steps.map((_, i) => (
            <span key={i} className={clsx(styles.tick, i === index && styles.tickNow, i < index && styles.tickDone)} />
          ))}
        </div>
        <div className={styles.live} aria-live="polite" aria-atomic="true">
          <p className={styles.counter}>
            <span aria-hidden="true">
              {index + 1} / {total}
            </span>
            <span className={styles.srOnly}>{t.stepOf(index + 1, total)}</span>
          </p>
          <h3 className={styles.title}>{label(step.title)}</h3>
          <p className={styles.body}>{label(step.body)}</p>
          <p className={styles.involved}>
            <span className={styles.involvedLabel}>{t.involved}:</span> {involved.join(', ')}
          </p>
        </div>
        <div className={styles.buttons}>
          <button type="button" className={styles.button} disabled={index === 0} onClick={() => setIndex(index - 1)}>
            {t.back}
          </button>
          <button
            type="button"
            className={clsx(styles.button, styles.buttonPrimary)}
            disabled={index === total - 1}
            onClick={() => setIndex(index + 1)}>
            {t.next}
          </button>
        </div>
      </div>
    </section>
  );
}
