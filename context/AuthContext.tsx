import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as authService from '../services/auth';
import { UserResponse, UserRole } from '../types/auth';

interface AuthContextType {
    user: UserResponse | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<void>;
    logout: () => void;
    isAdmin: boolean;
    isSuperAdmin: boolean;
    moduleLocks: Record<string, boolean>;
    toggleModuleLock: (moduleName: string) => void;
    isModuleLocked: (moduleName: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<UserResponse | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [moduleLocks, setModuleLocks] = useState<Record<string, boolean>>(() => {
        try {
            const saved = localStorage.getItem('neco_apcic_module_locks');
            return saved ? JSON.parse(saved) : {};
        } catch (e) {
            console.error('Failed to parse module locks from localStorage:', e);
            return {};
        }
    });

    const checkAuth = useCallback(async () => {
        const token = authService.getStoredToken();
        if (!token) {
            setIsLoading(false);
            return;
        }

        try {
            const userData = await authService.getMe();
            setUser(userData);
        } catch (error) {
            console.error('Failed to authenticate:', error);
            authService.logout();
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        checkAuth();
    }, [checkAuth]);

    useEffect(() => {
        localStorage.setItem('neco_apcic_module_locks', JSON.stringify(moduleLocks));
    }, [moduleLocks]);

    const login = async (username: string, password: string) => {
        await authService.login(username, password);
        await checkAuth();
    };

    const logout = () => {
        authService.logout();
        setUser(null);
    };

    const toggleModuleLock = useCallback((moduleName: string) => {
        setModuleLocks(prev => {
            const newState = {
                ...prev,
                [moduleName]: !prev[moduleName]
            };
            return newState;
        });
    }, []);

    const isModuleLocked = useCallback((moduleName: string) => {
        const locked = !!moduleLocks[moduleName];
        // console.log(`[AuthContext] Checking lock for ${moduleName}:`, locked);
        return locked;
    }, [moduleLocks]);

    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        isAdmin: user?.role === 'super_admin' || user?.role === 'user', // Adjust if 'user' is also considered an admin in some contexts
        isSuperAdmin: user?.role === 'super_admin',
        moduleLocks,
        toggleModuleLock,
        isModuleLocked,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
