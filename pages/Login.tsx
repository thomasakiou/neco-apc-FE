import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotification } from '../context/NotificationContext';

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const { showNotification } = useNotification();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const from = (location.state as any)?.from?.pathname || '/admin/dashboard';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      showNotification('Please enter both username and password', 'error');
      return;
    }

    setIsLoading(true);
    try {
      await login(username, password);
      showNotification('Login successful', 'success');
      navigate(from, { replace: true });
    } catch (error: any) {
      showNotification(error.message || 'Login failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen w-full flex-col bg-background-light overflow-hidden">
      <div className="flex h-full w-full">
        {/* Left Side - Form */}
        <div className="flex w-full flex-col items-center justify-center lg:w-1/2 bg-white z-10">
          <form onSubmit={handleLogin} className="flex w-full max-w-md flex-col items-start gap-8 p-8">
            <div className="flex flex-col items-start gap-3 self-stretch">
              <div className="flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-lg bg-primary text-white">
                  <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>local_library</span>
                </div>
                <span className="text-xl font-bold text-slate-800">NECO APCIC</span>
              </div>
              <h1 className="text-slate-900 text-4xl font-black leading-tight tracking-[-0.033em]">Sign in to your account</h1>
              <p className="text-base font-normal text-slate-600">Welcome back! Please enter your details.</p>
            </div>

            <div className="flex w-full flex-col items-stretch gap-4">
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-slate-900 text-base font-medium leading-normal pb-2">Username</p>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 border border-slate-300 bg-white focus:border-primary focus:ring-primary h-14 placeholder:text-slate-400 p-[15px] text-base"
                  placeholder="Enter your username"
                  disabled={isLoading}
                />
              </label>
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-slate-900 text-base font-medium leading-normal pb-2">Password</p>
                <div className="flex w-full flex-1 items-stretch relative">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 border border-slate-300 bg-white focus:border-primary focus:ring-primary h-14 placeholder:text-slate-400 p-[15px] pr-12 text-base"
                    placeholder="Enter your password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                  />
                </div>
              </label>
            </div>

            <div className="flex w-full flex-col gap-3 pt-2">
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-primary text-white text-base font-bold hover:bg-primary-hover transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </div>
                ) : (
                  'Sign In'
                )}
              </button>
            </div>

            <div className="w-full text-center">
              <p className="text-xs text-slate-500">© 2026 NECO. All rights reserved.</p>
            </div>
          </form>
        </div>

        {/* Right Side - Image */}
        <div className="hidden w-1/2 items-center justify-center bg-primary/5 lg:flex relative">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-primary/30"></div>
          <div className="w-full max-w-md p-8 relative z-10 flex flex-col items-center gap-6">
            <img
              className="w-full h-auto rounded-xl object-cover shadow-2xl ring-1 ring-slate-900/10"
              src="/images/neco.png"
              alt="NECO Logo"
            />
            <h2 className="text-3xl font-bold text-slate-800 tracking-tight text-center">NECO APCIC MANAGER</h2>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;