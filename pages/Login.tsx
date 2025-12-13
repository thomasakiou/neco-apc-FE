import React from 'react';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex h-screen w-full flex-col bg-background-light overflow-hidden">
      <div className="flex h-full w-full">
        {/* Left Side - Form */}
        <div className="flex w-full flex-col items-center justify-center lg:w-1/2 bg-white z-10">
          <div className="flex w-full max-w-md flex-col items-start gap-8 p-8">
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
                <p className="text-slate-900 text-base font-medium leading-normal pb-2">Staff Number / Username</p>
                <input
                  className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 border border-slate-300 bg-white focus:border-primary focus:ring-primary h-14 placeholder:text-slate-400 p-[15px] text-base"
                  placeholder="Enter your staff number or username"
                />
              </label>
              <label className="flex flex-col min-w-40 flex-1">
                <p className="text-slate-900 text-base font-medium leading-normal pb-2">Password</p>
                <div className="flex w-full flex-1 items-stretch relative">
                  <input
                    className="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-lg text-slate-900 border border-slate-300 bg-white focus:border-primary focus:ring-primary h-14 placeholder:text-slate-400 p-[15px] pr-12 text-base"
                    placeholder="Enter your password"
                    type="password"
                  />
                  <button className="absolute right-0 top-0 h-full px-4 text-slate-400 hover:text-slate-600">
                    <span className="material-symbols-outlined">visibility</span>
                  </button>
                </div>
              </label>
              <a className="text-sm font-medium leading-normal self-end text-primary hover:text-primary-hover underline" href="#">Forgot Password?</a>
            </div>

            <div className="flex w-full flex-col gap-3 pt-2">
              <button
                onClick={() => navigate('/admin/dashboard')}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-primary text-white text-base font-bold hover:bg-primary-hover transition-colors shadow-sm"
              >
                Login as Admin
              </button>
              <button
                onClick={() => navigate('/staff/dashboard')}
                className="flex w-full cursor-pointer items-center justify-center overflow-hidden rounded-lg h-12 px-5 bg-slate-100 text-slate-700 text-base font-bold hover:bg-slate-200 transition-colors"
              >
                Login as Staff
              </button>
            </div>

            <div className="w-full text-center">
              <p className="text-xs text-slate-500">© 2024 NECO. All rights reserved.</p>
            </div>
          </div>
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