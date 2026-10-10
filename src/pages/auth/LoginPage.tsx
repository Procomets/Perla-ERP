import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../config/firebase';

import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/erp/dashboard');
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else {
        setError(err.message || 'Authentication failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#111111] font-sans selection:bg-gray-300 selection:text-black">
      {/* Left Side - Visual/Brand (Hidden on small screens) */}
      <div className="hidden md:flex flex-1 relative flex-col justify-between p-12 text-white bg-black">
        {/* Background Image / Gradient */}
        <div 
          className="absolute inset-0 opacity-40 mix-blend-luminosity pointer-events-none"
          style={{ 
            backgroundImage: 'url("/factory-bg.jpg")',
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent pointer-events-none" />
        
        <div className="relative z-10 flex flex-col items-start">
          <button 
            onClick={() => navigate('/')} 
            className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors mb-8 text-sm group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
            <span className="text-xl font-bold tracking-wide">Perla Textiles Processor</span>
          </button>
          
          
        </div>

        <div className="relative z-10 mb-8">
          <p className="text-xs text-gray-400 mb-2 uppercase tracking-wider">Enterprise Resource Planning</p>
          <p className="text-sm text-gray-500">© Procomets Solutions  {new Date().getFullYear()}</p>
        </div>
      </div>

      {/* Right Side - Auth Form */}
      <div className="flex-1 bg-white flex flex-col justify-center p-8 sm:p-16 lg:p-24 relative overflow-y-auto">
        <div className="max-w-md w-full mx-auto space-y-8">
          
          <div className="md:hidden flex items-center gap-3 mb-8">
            <span className="text-lg font-bold tracking-wide text-[#111111]">Perla Textiles™</span>
          </div>

          <div>
            <h2 className="text-4xl sm:text-5xl font-medium tracking-tight text-[#111111] mb-2 leading-tight">
              Welcome, login to your account.
            </h2>
          </div>

          {error && (
            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-md border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">Email Address:</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#F4F7FC] border-transparent focus:border-black focus:bg-white focus:ring-0 rounded-3xl px-5 py-4 text-sm transition-colors"
                placeholder="name@domain.com"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-500 mb-2">Password:</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-[#F4F7FC] border-transparent focus:border-black focus:bg-white focus:ring-0 rounded-3xl px-5 py-4 text-sm transition-colors"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-start pt-4">
              <button
                type="submit"
                disabled={loading}
                className="bg-[#111111] hover:bg-black text-white rounded-full px-8 py-4 text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {loading ? 'Processing...' : 'Sign In Here'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
