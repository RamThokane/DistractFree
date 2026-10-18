import React from 'react';
import { Skeleton } from './ui';

const SHAPES = {
  card: { height: 160, radius: 10 },
  line: { height: 16 },
  circle: { height: 80, width: 80, radius: '50%' },
  stat: { height: 112, radius: 10 },
};

/** Legacy API (variant + count) over the shared Skeleton. */
const LoadingSkeleton = ({ variant = 'card', count = 1 }) => (
  <>
    {Array.from({ length: count }, (_, i) => {
      const s = SHAPES[variant] || SHAPES.card;
      return <Skeleton key={i} width={s.width || '100%'} height={s.height} radius={s.radius} className="block" />;
    })}
  </>
);

export default LoadingSkeleton;
