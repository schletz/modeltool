import type { MouseEvent } from 'react';
import type { Cardinality } from '../../../domain/model/common';
import type { Port } from '../../../domain/routing/geometry';
import { cardinalityShapes, sideRotation } from '../symbols/crowFootShapes';

interface CardinalitySymbolProps {
  port: Port;
  cardinality: Cardinality;
  onClick(event: MouseEvent): void;
  testId: string;
}

/** Crow's foot symbol at a line end, perpendicular to the node border; click cycles the cardinality. */
export function CardinalitySymbol({ port, cardinality, onClick, testId }: CardinalitySymbolProps) {
  return (
    <g
      transform={`translate(${port.point.x} ${port.point.y}) rotate(${sideRotation(port.side)})`}
      className="cardinality-symbol"
      data-testid={testId}
      data-cardinality={cardinality}
      onClick={onClick}
    >
      <rect x={2} y={-10} width={24} height={20} className="symbol-hit-area" />
      {cardinalityShapes(cardinality).map((s, i) =>
        s.type === 'line' ? (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} />
        ) : (
          <circle key={i} cx={s.cx} cy={s.cy} r={s.r} />
        ),
      )}
    </g>
  );
}
