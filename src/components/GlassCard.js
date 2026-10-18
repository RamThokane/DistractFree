import React from 'react';
import Card from './ui/Card';

/**
 * Legacy name kept so existing pages keep working; renders the shared Card.
 * New code should import { Card } from './ui'.
 */
const GlassCard = ({ children, className = '', hover = false, padding = 'p-6', onClick, ...props }) => (
  <Card
    padding={padding}
    interactive={hover || !!onClick}
    onClick={onClick}
    className={className}
    {...props}
  >
    {children}
  </Card>
);

export default GlassCard;
