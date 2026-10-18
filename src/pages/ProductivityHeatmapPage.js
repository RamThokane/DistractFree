import React from 'react';
import PageTransition from '../components/PageTransition';
import ProductivityHeatmap from '../components/ProductivityHeatmap';

const ProductivityHeatmapPage = () => {
  return (
    <PageTransition>
      <div>
        <ProductivityHeatmap />
      </div>
    </PageTransition>
  );
};

export default ProductivityHeatmapPage;
