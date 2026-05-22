import Navbar from '../components/Navbar';
import HeroSection from '../components/HeroSection';
import ComparisonSection from '../components/ComparisonSection';
import HowItWorksSection from '../components/HowItWorksSection';
import ProductSection from '../components/ProductSection';
import AISection from '../components/AISection';
import ResearchSection from '../components/ResearchSection';
import CTASection from '../components/CTASection';
import Footer from '../components/Footer';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex flex-col w-full bg-background min-h-screen">
        <HeroSection />
        <div className="gradient-divider" />
        <ComparisonSection />
        <div className="gradient-divider" />
        <HowItWorksSection />
        <div className="gradient-divider" />
        <ProductSection />
        <div className="gradient-divider" />
        <AISection />
        <div className="gradient-divider" />
        <ResearchSection />
        <div className="gradient-divider" />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
