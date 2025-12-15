import React, { useEffect, useState } from 'react';

export interface ToastProps {
    id: string;
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    duration?: number;
    onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, duration = 3000, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Trigger enter animation
        requestAnimationFrame(() => setIsVisible(true));

        const timer = setTimeout(() => {
            setIsVisible(false);
            // Allow exit animation to finish before removing
            setTimeout(() => onClose(id), 300);
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, id, onClose]);

    const getIcon = () => {
        switch (type) {
            case 'success': return 'check_circle';
            case 'error': return 'error';
            case 'warning': return 'warning';
            case 'info': return 'info';
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success': return 'bg-emerald-50 text-emerald-900 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-100 dark:border-emerald-800';
            case 'error': return 'bg-rose-50 text-rose-900 border-rose-200 dark:bg-rose-900/40 dark:text-rose-100 dark:border-rose-800';
            case 'warning': return 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/40 dark:text-amber-100 dark:border-amber-800';
            case 'info': return 'bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/40 dark:text-blue-100 dark:border-blue-800';
        }
    };

    const getIconColor = () => {
        switch (type) {
            case 'success': return 'text-emerald-500 dark:text-emerald-400';
            case 'error': return 'text-rose-500 dark:text-rose-400';
            case 'warning': return 'text-amber-500 dark:text-amber-400';
            case 'info': return 'text-blue-500 dark:text-blue-400';
        }
    };

    return (
        <div
            className={`
                flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 transform
                ${getColors()}
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
            style={{ minWidth: '300px', maxWidth: '400px' }}
        >
            <span className={`material-symbols-outlined text-2xl ${getIconColor()}`}>
                {getIcon()}
            </span>
            <p className="text-sm font-bold flex-1">{message}</p>
            <button
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }}
                className="opacity-50 hover:opacity-100 transition-opacity"
            >
                <span className="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    );
};

export default Toast;
