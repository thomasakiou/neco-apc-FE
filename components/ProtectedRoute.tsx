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
            <div className="flex flex-col items-center justify-center h-screen bg-background-light p-8">
                <div className="bg-white p-8 rounded-xl shadow-lg text-center max-w-md">
                    <span className="material-symbols-outlined text-red-500 text-6xl mb-4">lock</span>
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Module Locked</h2>
                    <p className="text-slate-600 mb-6">This module has been temporarily locked by the administrator.</p>
                    <button
                        onClick={() => window.history.back()}
                        className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-semibold"
                    >
                        Go Back
                    </button>
                </div>
            </div>
        );
    }

    return <>{children}</>;
};

export default ProtectedRoute;
