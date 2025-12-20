import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: 'super_admin' | 'user';
    moduleName?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, requiredRole, moduleName }) => {
    const { isAuthenticated, user, isLoading, isSuperAdmin, isModuleLocked } = useAuth();
    const location = useLocation();

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen bg-background-light">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!isAuthenticated) {
        return <Navigate to="/" state={{ from: location }} replace />;
    }

    // Check role requirement
    if (requiredRole && user?.role !== requiredRole && !isSuperAdmin) {
        return <Navigate to="/admin/dashboard" replace />;
    }

    // Check module lock (only for non-super admins)
    if (moduleName && isModuleLocked(moduleName) && !isSuperAdmin) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[400px] p-8 animate-in fade-in duration-500">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-xl p-12 rounded-[2.5rem] border border-slate-200 dark:border-white/10 text-center max-w-lg shadow-2xl shadow-slate-200/20 dark:shadow-none relative overflow-hidden">
                    <div className="absolute top-0 right-0 size-32 bg-rose-500/5 blur-3xl rounded-full -mr-16 -mt-16"></div>

                    <div className="relative z-10 flex flex-col items-center">
                        <div className="size-20 rounded-3xl bg-rose-500/10 flex items-center justify-center text-rose-500 mb-6 group-hover:scale-110 transition-transform">
                            <span className="material-symbols-outlined text-5xl">lock</span>
                        </div>
                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">Module Restricted</h2>
                        <p className="text-slate-500 dark:text-slate-400 font-bold mb-8 leading-relaxed">
                            This page is locked, <br />
                            <span className="text-rose-500 uppercase tracking-widest text-xs">contact administrator</span>
                        </p>
                        <button
                            onClick={() => window.history.back()}
                            className="group flex items-center gap-3 px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl hover:shadow-xl transition-all font-black text-sm active:scale-95"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:-translate-x-1 transition-transform">arrow_back</span>
                            Return Safety
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
