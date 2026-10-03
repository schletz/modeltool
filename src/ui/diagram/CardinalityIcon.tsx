import type { Cardinality } from '../../domain/model/common';
import { cardinalityShapes } from './symbols/crowFootShapes';

/** Small preview of a crow's foot symbol (entity border on the left) for buttons. */
export function CardinalityIcon({ cardinality }: { cardinality: Cardinality }) {
  return (
    <svg viewBox="-3 -11 32 22" width={32} height={22} className="cardinality-icon" aria-hidden>
      <line x1={-2} y1={-10} x2={-2} y2={10} className="icon-border" />
      <line x1={0} y1={0} x2={30} y2={0} />
      {cardinalityShapes(cardinality).map((s, i) =>
        s.type === 'line' ? <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} /> : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />,
      )}
    </svg>
  );
}
