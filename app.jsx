import { useState } from 'react';

// --- Reusable Components ---

const GlassCard = ({ children, className = '' }) => (
  <div className={`bg-white/75 backdrop-blur-xl border border-white/50 shadow-sm hover:shadow-md transition-all duration-300 rounded-2xl ${className}`}>
    {children}
  </div>
);

const AccordionItem = ({ title, subtitle, icon, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <GlassCard className="overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6] focus-visible:ring-offset-2"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-[#3B82F6] flex items-center justify-center font-bold text-lg">
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-[#0A1628] text-lg">{title}</h3>
            <p className="text-sm text-slate-500">{subtitle}</p>
          </div>
        </div>
        <svg 
          className={`w-5 h-5 text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      <div 
        className={`overflow-hidden transition-all duration-300 ease-in-out ${isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
      >
        <div className="p-6 pt-0 text-slate-600 leading-relaxed border-t border-slate-100 mt-2">
          {children}
        </div>
      </div>
    </GlassCard>
  );
};

// --- Main App Component ---

export default function App() {
  const [formData, setFormData] = useState({ name: '', email: '', goal: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    // TODO: Integrate Supabase here
    // const { data, error } = await supabase.from('contacts').insert([formData]);
    setTimeout(() => {
      alert('Message sent securely! (Supabase integration pending)');
      setIsSubmitting(false);
      setFormData({ name: '', email: '', goal: '' });
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#0A1628] font-sans antialiased selection:bg-[#3B82F6] selection:text-white">
      
      {/* Navigation */}
      <header className="fixed top-0 w-full z-50 bg-white/75 backdrop-blur-xl border-b border-slate-200/50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#" className="text-xl font-bold tracking-tight text-[#0A1628]">
            Alvin Silva<span className="text-[#3B82F6]">.</span>
          </a>
          <nav className="hidden md:flex gap-8 text-sm font-medium text-slate-600">
            <a href="#impact" className="hover:text-[#3B82F6] transition-colors">Impact</a>
            <a href="#capabilities" className="hover:text-[#3B82F6] transition-colors">Capabilities</a>
            <a href="#portfolio" className="hover:text-[#3B82F6] transition-colors">Portfolio</a>
            <a href="#contact" className="hover:text-[#3B82F6] transition-colors">Contact</a>
          </nav>
          <a 
            href="#contact" 
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#3B82F6] rounded-lg hover:bg-blue-600 transition shadow-sm"
          >
            Let's Talk
          </a>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 text-[#3B82F6] text-xs font-semibold uppercase tracking-wide mb-6 border border-blue-100">
            Systems Architect & Resilience Strategist
          </div>
          <h1 className="text-4xl md:text-6xl font-bold leading-tight text-[#0A1628] mb-6">
            18+ years, 15 countries, ₱190M in climate-smart programs —{' '}
            <span className="text-[#3B82F6]">delivering resilience you can measure.</span>
          </h1>
          <p className="text-lg md:text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            What sets me apart: measurable outcomes, not just credentials. I integrate seven disciplines into one framework to help governments, NGOs, and private sectors build sustainable, future-proof systems.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="#contact" 
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-white bg-[#3B82F6] rounded-xl hover:bg-blue-600 transition shadow-lg shadow-blue-500/20"
            >
              Let’s design a solution for your challenge
            </a>
            <a 
              href="#portfolio" 
              className="inline-flex items-center justify-center px-6 py-3 text-base font-semibold text-[#0A1628] bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition"
            >
              View the Evidence Pack
            </a>
          </div>
        </div>
      </section>

      {/* Impact Metrics Grid */}
      <section id="impact" className="py-16 bg-white border-y border-slate-100">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-2">Evidence Pack</h2>
            <p className="text-2xl font-semibold text-[#0A1628]">18+ years · 15 countries · ₱190M projects · 30+ institutions</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
            {[
              { value: '18+', label: 'Years Experience' },
              { value: '15', label: 'Countries Across 3 Continents' },
              { value: '₱190M', label: 'Climate-Smart Funding Delivered' },
              { value: '50K+', label: 'Households Reached' }
            ].map((metric, idx) => (
              <GlassCard key={idx} className="text-center p-6">
                <div className="text-3xl md:text-4xl font-bold text-[#3B82F6] mb-2">{metric.value}</div>
                <div className="text-sm font-medium text-slate-600">{metric.label}</div>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities (Progressive Disclosure) */}
      <section id="capabilities" className="py-20 px-6">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-[#0A1628] mb-4 text-center">Seven Disciplines, One Systems View</h2>
          <p className="text-center text-slate-600 mb-12">Tailored strategic planning for diverse institutional needs.</p>
          
          <div className="space-y-4">
            <AccordionItem icon="E" title="Executive & Government Lens" subtitle="Policy influence & national resilience strategies">
              <p className="mb-3">Facilitated 20+ strategic plans for governments and private sector organizations. Inputs directly adopted into national resilience strategies in the Philippines, ensuring long-term viability and measurable ROI.</p>
              <ul className="list-disc list-inside space-y-1 text-sm">
                <li>100% project completion rate with documented outcomes.</li>
                <li>Strategic alignment with BIRD 2026–2035 roadmaps.</li>
              </ul>
            </AccordionItem>

            <AccordionItem icon="N" title="NGO & Development Lens" subtitle="Community resilience & livelihood interventions">
              <p>Partnered with UNICEF, UNDP, and major Philippine agencies to design programs that improve resilience for 50,000+ households. Focus on scalable, community-driven outcomes.</p>
            </AccordionItem>

            <AccordionItem icon="A" title="Academia & Research Lens" subtitle="Published frameworks & intellectual property">
              <p>10+ published frameworks and intellectual property contributions to resilience planning. Active lectures and research collaborations with 5+ universities across the globe.</p>
            </AccordionItem>
          </div>
        </div>
      </section>

      {/* Portfolio Teaser */}
      <section id="portfolio" className="py-20 px-6 bg-slate-50">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-[#0A1628] flex items-center gap-2">
              <span className="w-2 h-8 bg-[#3B82F6] rounded-full"></span> Featured Case Studies
            </h2>
            <a href="/portfolio" className="text-[#3B82F6] font-semibold hover:underline text-sm">View all projects →</a>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <GlassCard className="p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-blue-50 text-[#3B82F6] text-xs font-bold rounded uppercase">Climate Resilience</span>
                <span className="text-slate-400 text-xs">• UNICEF Partnership</span>
              </div>
              <h3 className="text-xl font-bold text-[#0A1628] mb-3">₱190M Climate-Smart Program Design</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">Partnered with UNICEF to design and deliver a comprehensive climate-smart program that improved systemic resilience and livelihood security for over 50,000 households.</p>
            </GlassCard>
            <GlassCard className="p-8">
              <div className="flex items-center gap-2 mb-4">
                <span className="px-2 py-1 bg-blue-50 text-[#3B82F6] text-xs font-bold rounded uppercase">Strategic Planning</span>
                <span className="text-slate-400 text-xs">• BIRD 2026-2035</span>
              </div>
              <h3 className="text-xl font-bold text-[#0A1628] mb-3">Bangsamoro Investment Roadmap</h3>
              <p className="text-slate-600 mb-6 leading-relaxed">Applying systems mapping to surface the vital few metrics that drive 80% of strategic growth, positioning the region as a hub for ethical and sustainable investment.</p>
            </GlassCard>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 px-6 bg-[#0A1628] text-white">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold mb-4">Let’s design a solution for your challenge.</h2>
            <p className="text-slate-300">Share your goals and I’ll respond within one business day.</p>
          </div>
          
          <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="name" className="block text-sm font-semibold text-slate-200 mb-1">Full Name</label>
                <input 
                  type="text" id="name" required 
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-white placeholder-slate-400 focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none transition" 
                  placeholder="Jane Doe" 
                />
              </div>
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-200 mb-1">Work Email</label>
                <input 
                  type="email" id="email" required 
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-white placeholder-slate-400 focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none transition" 
                  placeholder="jane@organization.org" 
                />
              </div>
            </div>
            
            <div>
              <label htmlFor="goal" className="block text-sm font-semibold text-slate-200 mb-1">Your goal and timeline</label>
              <textarea 
                id="goal" rows="4" required 
                value={formData.goal}
                onChange={(e) => setFormData({...formData, goal: e.target.value})}
                className="w-full rounded-lg border border-slate-600 bg-slate-800/50 p-3 text-white placeholder-slate-400 focus:border-[#3B82F6] focus:ring-2 focus:ring-[#3B82F6]/20 outline-none transition" 
                placeholder="e.g., Scale our climate resilience program to 3 new provinces by Q3 2027"
              ></textarea>
            </div>

            <div className="flex items-start gap-2 text-xs text-slate-400">
              <svg className="w-5 h-5 text-[#3B82F6] flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Your information is private — no data stored on this site. Submissions are routed securely and deleted after initial response.</span>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-[#3B82F6] hover:bg-blue-600 disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition shadow-lg shadow-blue-500/25"
            >
              {isSubmitting ? 'Sending...' : 'Send Message'}
            </button>
          </form>
          
          <p className="text-center text-slate-400 text-sm mt-8">Trusted by 30+ institutions worldwide, including UNICEF, UNDP, and Philippine government agencies.</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0A1628] border-t border-slate-800 py-8 text-center text-slate-500 text-sm">
        <p>&copy; 2026 Alvin Silva / ASilva Innovations. All rights reserved.</p>
      </footer>

    </div>
  );
}
