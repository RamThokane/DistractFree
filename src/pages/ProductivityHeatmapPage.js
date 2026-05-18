import React from 'react';
import PageTransition from '../components/PageTransition';
import ProductivityHeatmap from '../components/ProductivityHeatmap';

const ProductivityHeatmapPage = () => {
  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto pb-10">
        <ProductivityHeatmap />
      </div>
    </PageTransition>
  );
};

export default ProductivityHeatmapPage;
