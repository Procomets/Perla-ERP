import React from 'react';
import {
  ArrowRight,
  Search,
  Settings,
  Target,
  BarChart,
  Box,
  MapPin,
  Calendar,
  LogIn
} from 'lucide-react';
import { Button } from '../../components/ui/Button';

interface LandingPageProps {
  onOpenLogin: () => void;
  onNavigateErp: () => void;
  isLoggedIn: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onOpenLogin, onNavigateErp, isLoggedIn }) => {
  return (
    <div className="min-h-screen bg-white text-[#111827] font-sans selection:bg-[#1C2B4B] selection:text-white">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-[1400px] mx-auto w-full">
        <div className="text-xl font-bold text-[#1C2B4B] tracking-tight">
          Perla Textiles Processor
        </div>
        
        <div className="hidden md:flex items-center space-x-8 text-xs font-semibold tracking-wide uppercase">
          <a href="#about" className="hover:text-blue-600 transition">About</a>
          <a href="#features" className="hover:text-blue-600 transition">Features</a>
          <a href="#testimonial" className="hover:text-blue-600 transition">Testimonial</a>
          <a href="#locations" className="hover:text-blue-600 transition">Locations</a>
        </div>

        <div>
          <button 
            onClick={onOpenLogin}
            className="text-xs font-bold uppercase tracking-wider flex items-center gap-2 hover:text-blue-600 transition"
          >
            LOGIN TO ERP <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="px-4 sm:px-6 mt-4 max-w-[1400px] mx-auto">
        <div className="relative rounded-sm overflow-hidden bg-[#1C2B4B] h-[600px] flex flex-col justify-end p-8 sm:p-12">
          {/* Background overlay/image placeholder */}
          <div 
            className="absolute inset-0 opacity-40 mix-blend-overlay"
            style={{ 
              backgroundImage: 'url("/factory-bg.jpg")',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
          />
          
          <div className="relative z-10 w-full flex flex-col lg:flex-row justify-between items-end gap-12">
            <h1 className="text-7xl sm:text-9xl lg:text-[12rem] font-bold text-white leading-none tracking-tighter">
              PERLA
            </h1>
            
            {/* Tracking Widget */}
            <div className="bg-white p-6 sm:p-8 w-full max-w-md shadow-2xl">
              <h3 className="text-sm font-bold uppercase tracking-wider mb-6">Track Your Batch</h3>
              
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Batch Number</label>
                  <input 
                    type="text" 
                    placeholder="Enter batch number" 
                    className="w-full border-b border-slate-200 pb-2 text-sm focus:outline-none focus:border-[#1C2B4B] transition"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Customer</label>
                    <div className="flex items-center gap-2 text-sm border-b border-slate-200 pb-2">
                      <MapPin className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">Select</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Schedule Date</label>
                    <div className="flex items-center gap-2 text-sm border-b border-slate-200 pb-2">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="text-slate-400">dd / mm / yyyy</span>
                    </div>
                  </div>
                </div>

                <button className="bg-[#1C2B4B] text-white text-xs font-bold uppercase tracking-wider py-3 px-6 flex items-center gap-2 mt-4 hover:bg-blue-900 transition">
                  Search <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 px-6 max-w-[1400px] mx-auto border-b border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-4">
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight mb-6">About Perla</h2>
            <div className="aspect-[4/3] bg-slate-100 mb-6 overflow-hidden">
              <img 
                src="/factory-bg.jpg" 
                alt="Team" 
                className="w-full h-full object-cover grayscale opacity-90"
              />
            </div>
            <div className="grid grid-cols-3 gap-4 text-center border-t border-b border-slate-200 py-6">
              <div>
                <div className="text-xl font-bold">100%</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Quality Fastness</div>
              </div>
              <div className="border-l border-slate-200">
                <div className="text-xl font-bold">5M+</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Pcs Processed</div>
              </div>
              <div className="border-l border-slate-200">
                <div className="text-xl font-bold">98%+</div>
                <div className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">On-time delivery</div>
              </div>
            </div>
          </div>
          
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div>
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-4">[Est. Since 2010]</div>
              <p className="text-xl sm:text-2xl text-slate-600 font-light leading-relaxed max-w-2xl">
                Discover how to unlock unparalleled operational efficiency. Achieve significant cost savings, and make smarter, data-driven business decisions that propel your textile organization forward.
              </p>
            </div>
            <div className="aspect-video bg-slate-100 mt-12 overflow-hidden">
              <img 
                src="/factory-bg.jpg" 
                alt="Operations" 
                className="w-full h-full object-cover grayscale opacity-90"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 px-6 max-w-[1400px] mx-auto">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-8">[Features]</div>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight max-w-3xl leading-none">
            TRANSFORM YOUR <br/>TEXTILE OPERATIONS
          </h2>
          <p className="text-sm text-slate-500 max-w-xs">
            Designed to enhance every aspect of your processing chain, ensuring efficiency and effectiveness at every turn.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          {/* Feature 1 */}
          <div className="col-span-1 md:col-span-2 row-span-2">
            <div className="aspect-[16/9] bg-slate-100 mb-6 overflow-hidden">
              <img 
                src="/factory-bg.jpg" 
                alt="Automated Processes" 
                className="w-full h-full object-cover grayscale opacity-90"
              />
            </div>
          </div>
          
          {/* Feature 2 */}
          <div className="border-t border-slate-200 pt-6">
            <Settings className="w-8 h-8 mb-6 text-[#1C2B4B]" />
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Automated Processes</h4>
            <p className="text-sm text-slate-500 mb-6">Streamline workflows with automation for order processing and reporting.</p>
            <button className="bg-[#1C2B4B] text-white text-[10px] font-bold uppercase tracking-wider py-2 px-4 flex items-center gap-2">
              Learn More <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Feature 3 */}
          <div className="border-t border-slate-200 pt-6">
            <Target className="w-8 h-8 mb-6 text-[#1C2B4B]" />
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Batch Tracking</h4>
            <p className="text-sm text-slate-500 mb-6">Know exactly where your garments are at every step of the journey.</p>
            <button className="bg-[#1C2B4B] text-white text-[10px] font-bold uppercase tracking-wider py-2 px-4 flex items-center gap-2">
              Learn More <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Feature 4 */}
          <div className="border-t border-slate-200 pt-6">
            <BarChart className="w-8 h-8 mb-6 text-[#1C2B4B]" />
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Scalable Solutions</h4>
            <p className="text-sm text-slate-500 mb-6">Adapt and grow your business without worrying about your operations.</p>
            <button className="bg-[#1C2B4B] text-white text-[10px] font-bold uppercase tracking-wider py-2 px-4 flex items-center gap-2">
              Learn More <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Feature 5 */}
          <div className="border-t border-slate-200 pt-6">
            <Box className="w-8 h-8 mb-6 text-[#1C2B4B]" />
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Nationwide Delivery</h4>
            <p className="text-sm text-slate-500 mb-6">Optimized shipping available nationwide for quick deliveries from local warehouses.</p>
            <button className="bg-[#1C2B4B] text-white text-[10px] font-bold uppercase tracking-wider py-2 px-4 flex items-center gap-2">
              Learn More <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section id="testimonial" className="py-24 px-6 max-w-[1400px] mx-auto text-center border-t border-slate-200">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-12">[Testimonial]</div>
        <h3 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight max-w-4xl mx-auto leading-tight text-[#1C2B4B]">
          "We've optimized our processing chain, reducing delays and ensuring timely delivery for your critical batches."
        </h3>
        <div className="mt-12">
          <div className="text-xs font-bold uppercase tracking-wider">Jain Smith</div>
          <div className="text-xs text-slate-500 mt-1">Operations Lead, Textiles</div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-[#1C2B4B] text-white py-24 px-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="text-[10px] font-bold text-blue-300/50 uppercase tracking-wider mb-8">[How it works]</div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-medium tracking-tight mb-8">
                SMOOTH AND HASSLE-FREE.
              </h2>
              <p className="text-blue-100/80 text-sm max-w-md mb-10">
                This improvement makes order creation, tracking, and final delivery not only more efficient but also incredibly user-friendly, ensuring that every step is smooth and hassle-free.
              </p>
              <button className="bg-white text-[#1C2B4B] text-[10px] font-bold uppercase tracking-wider py-3 px-6 flex items-center gap-2">
                Contact Now <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-0">
              <div className="flex gap-8 border-b border-blue-800/50 py-8">
                <div className="text-sm text-blue-300/50">Step 1</div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider mb-2">Sign Up & Integrate</h4>
                  <p className="text-sm text-blue-100/60">Create an account and integrate your existing systems to begin.</p>
                </div>
              </div>
              <div className="flex gap-8 border-b border-blue-800/50 py-8">
                <div className="text-sm text-blue-300/50">Step 2</div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider mb-2">Automate Operations</h4>
                  <p className="text-sm text-blue-100/60">Use automation to streamline workflows and improve efficiency.</p>
                </div>
              </div>
              <div className="flex gap-8 py-8">
                <div className="text-sm text-blue-300/50">Step 3</div>
                <div>
                  <h4 className="text-sm font-bold uppercase tracking-wider mb-2">Track Batches In Real-Time</h4>
                  <p className="text-sm text-blue-100/60 mb-6">Monitor every batch's status with live updates.</p>
                  <div className="aspect-[21/9] bg-blue-900/50 overflow-hidden">
                    <img 
                      src="/factory-bg.jpg" 
                      alt="Tracking" 
                      className="w-full h-full object-cover opacity-80 mix-blend-luminosity"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-24 px-6 max-w-[1400px] mx-auto border-b border-slate-200">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-12">[Benefits]</div>
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight max-w-3xl mb-20 text-center mx-auto text-[#1C2B4B]">
          Unlock operational efficiency, cost savings, and smarter business decisions.
        </h2>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-12">
          <div className="border-t border-slate-200 pt-8">
            <div className="w-12 h-12 border border-slate-200 flex items-center justify-center mb-6">
              <div className="w-6 h-6 border border-slate-400 rotate-45" />
            </div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Cost Savings</h4>
            <p className="text-xs text-slate-500">Reduce operational costs with smarter processing management.</p>
          </div>
          <div className="border-t border-slate-200 pt-8">
            <div className="w-12 h-12 border border-slate-200 flex items-center justify-center mb-6">
              <div className="w-6 h-6 border border-slate-400 rounded-full" />
            </div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Faster Processing</h4>
            <p className="text-xs text-slate-500">Leverage optimized workflows to save time and meet deadlines.</p>
          </div>
          <div className="border-t border-slate-200 pt-8">
            <div className="w-12 h-12 border border-slate-200 flex items-center justify-center mb-6">
              <div className="w-6 h-6 border border-slate-400" />
            </div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Improved Communication</h4>
            <p className="text-xs text-slate-500">Easily share real-time updates with your team and partners.</p>
          </div>
          <div className="border-t border-slate-200 pt-8">
            <div className="w-12 h-12 border border-slate-200 flex items-center justify-center mb-6">
              <div className="w-6 h-6 border-t border-l border-slate-400" />
            </div>
            <h4 className="text-sm font-bold uppercase tracking-wider mb-3">Scalable</h4>
            <p className="text-xs text-slate-500">Whether you're a small business or an enterprise, scale as you grow.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-6 max-w-[1400px] mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mb-16">
          <h2 className="text-7xl sm:text-9xl font-bold text-[#1C2B4B] tracking-tighter leading-none">
            PERLA
          </h2>
          
          <div className="flex gap-16 text-xs text-slate-500">
            <div className="space-y-2">
              <div className="font-bold uppercase tracking-wider text-[#1C2B4B] mb-4">India</div>
              <p>Thirumudivakkam, Chennai</p>
              <p>Tamil Nadu, 600132</p>
            </div>
            <div className="space-y-2">
              <div className="font-bold uppercase tracking-wider text-[#1C2B4B] mb-4">Contact</div>
              <p>info@perlatextiles.com</p>
              <p>+91 98400 12345</p>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 border-t border-slate-200 pt-8">
          <div className="flex gap-6 mb-4 sm:mb-0">
            <a href="#about" className="hover:text-[#1C2B4B]">About</a>
            <a href="#features" className="hover:text-[#1C2B4B]">Features</a>
            <a href="#impact" className="hover:text-[#1C2B4B]">Impact</a>
            <a href="#benefits" className="hover:text-[#1C2B4B]">Benefits</a>
          </div>
          <div className="flex gap-6">
            <a href="#" className="hover:text-[#1C2B4B]">SEE MAPS ↗</a>
            <a href="#" className="hover:text-[#1C2B4B]">VIEW DIRECTIONS ↗</a>
            <a href="#" className="hover:text-[#1C2B4B]">EXPLORE MORE ↗</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

