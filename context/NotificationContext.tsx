import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import Toast from '../components/Toast';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

interface Notification {
    id: string;
    message: string;
    type: NotificationType;
    duration?: number;
}

interface NotificationContextType {
    showNotification: (message: string, type: NotificationType, duration?: number) => void;
    show: (message: string, type: NotificationType, duration?: number) => void;
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);

    const removeNotification = useCallback((id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);

    const show = useCallback((message: string, type: NotificationType, duration = 3000) => {
        const id = Math.random().toString(36).substring(2, 9);
        setNotifications(prev => [...prev, { id, message, type, duration }]);
    }, []);

    const success = useCallback((message: string, duration?: number) => show(message, 'success', duration), [show]);
    const error = useCallback((message: string, duration?: number) => show(message, 'error', duration), [show]);
    const warning = useCallback((message: string, duration?: number) => show(message, 'warning', duration), [show]);
    const info = useCallback((message: string, duration?: number) => show(message, 'info', duration), [show]);

    return (
        <NotificationContext.Provider value={{ showNotification: show, show, success, error, warning, info }}>
            {children}
            {/* Toast Container */}
            <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3 pointer-events-none">
                {notifications.map(n => (
                    <div key={n.id} className="pointer-events-auto">
                        <Toast
                            id={n.id}
                            message={n.message}
                            type={n.type}
                            duration={n.duration}
                            onClose={removeNotification}
                        />
                    </div>
                ))}
            </div>
        </NotificationContext.Provider>
    );
};

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};
