import React from 'react';

interface AlertModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    message?: string;
    type?: 'success' | 'error' | 'warning' | 'info';
    details?: {
        created?: number;
        skipped?: number;
        errors?: number;
        skippedData?: any[];
        errorData?: any[];
    };
    onConfirm?: () => void;
}

const AlertModal: React.FC<AlertModalProps> = ({
    isOpen,
    onClose,
    title,
    message,
    type = 'info',
    details,
    onConfirm
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'success':
                return <span className="material-symbols-outlined text-5xl text-emerald-500">check_circle</span>;
            case 'error':
                return <span className="material-symbols-outlined text-5xl text-rose-500">error</span>;
            case 'warning':
                return <span className="material-symbols-outlined text-5xl text-amber-500">warning</span>;
            default:
                return <span className="material-symbols-outlined text-5xl text-blue-500">info</span>;
        }
    };

    const getColors = () => {
        switch (type) {
            case 'success':
                return 'from-emerald-500 to-teal-600';
            case 'error':
                return 'from-rose-500 to-red-600';
            case 'warning':
                return 'from-amber-500 to-orange-600';
            default:
                return 'from-blue-500 to-indigo-600';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-900/80 backdrop-blur-sm p-4 transition-colors">
            <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-2xl transform transition-all duration-300 scale-100 border border-slate-200 dark:border-gray-800">
                {/* Header */}
                <div className={`flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-800 bg-gradient-to-r ${getColors()} bg-opacity-10 rounded-t-2xl`}>
                    <div className="flex items-center gap-4">
                        {getIcon()}
                        <h2 className="text-2xl font-black text-slate-900 dark:text-slate-200">{title}</h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 max-h-[60vh] overflow-y-auto">
                    {message && (
                        <p className="text-slate-600 dark:text-slate-400 text-base mb-4">{message}</p>
                    )}

                    {details && (
                        <div className="space-y-4">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-3 gap-4">
                                {details.created !== undefined && (
                                    <div className="bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4 text-center">
                                        <div className="text-3xl font-black text-emerald-700 dark:text-emerald-400">{details.created}</div>
                                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider mt-1">Created</div>
                                    </div>
                                )}
                                {details.skipped !== undefined && (
                                    <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-center">
                                        <div className="text-3xl font-black text-amber-700 dark:text-amber-400">{details.skipped}</div>
                                        <div className="text-xs font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider mt-1">Skipped</div>
                                    </div>
                                )}
                                {details.errors !== undefined && (
                                    <div className="bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-lg p-4 text-center">
                                        <div className="text-3xl font-black text-rose-700 dark:text-rose-400">{details.errors}</div>
                                        <div className="text-xs font-bold text-rose-600 dark:text-rose-500 uppercase tracking-wider mt-1">Errors</div>
                                    </div>
                                )}
                            </div>

                            {/* Skipped Data */}
                            {details.skippedData && details.skippedData.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-amber-500">info</span>
                                        Skipped Records
                                    </h3>
                                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                                        {details.skippedData.map((item, idx) => (
                                            <div key={idx} className="mb-3 pb-3 border-b border-amber-200 dark:border-amber-800 last:border-0 last:mb-0 last:pb-0">
                                                <div className="text-sm font-bold text-amber-900 dark:text-amber-400">
                                                    {item.fileno || item.full_name || `Record ${idx + 1}`}
                                                </div>
                                                <div className="text-xs text-amber-700 dark:text-amber-500 mt-1">
                                                    {item.reason || 'Already exists'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Error Data */}
                            {details.errorData && details.errorData.length > 0 && (
                                <div className="mt-6">
                                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-rose-500">error</span>
                                        Errors
                                    </h3>
                                    <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-lg p-4 max-h-60 overflow-y-auto">
                                        {details.errorData.map((item, idx) => (
                                            <div key={idx} className="mb-3 pb-3 border-b border-rose-200 dark:border-rose-800 last:border-0 last:mb-0 last:pb-0">
                                                <div className="text-sm font-bold text-rose-900 dark:text-rose-400">
                                                    {item.fileno || item.full_name || `Record ${idx + 1}`}
                                                </div>
                                                <div className="text-xs text-rose-700 dark:text-rose-500 mt-1">
                                                    {item.error || item.reason || 'Unknown error'}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 p-6 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] rounded-b-2xl">
                    {onConfirm ? (
                        <>
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    onConfirm();
                                    onClose();
                                }}
                                className={`px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r ${getColors()} rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`}
                            >
                                Confirm
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className={`px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r ${getColors()} rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all`}
                        >
                            Close
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlertModal;
