import React, { useState, useEffect } from 'react';

const EnvironmentSwitcher: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [env, setEnv] = useState<'remote' | 'local'>('remote');
    const [localUrl, setLocalUrl] = useState('http://localhost:8000/api');

    useEffect(() => {
        const storedEnv = localStorage.getItem('api_env') as 'remote' | 'local';
        const storedUrl = localStorage.getItem('api_local_url');

        if (storedEnv) setEnv(storedEnv);
        if (storedUrl) setLocalUrl(storedUrl);
    }, []);

    const handleSave = () => {
        if (env === 'local') {
            localStorage.setItem('api_env', 'local');
            localStorage.setItem('api_local_url', localUrl);
        } else {
            localStorage.setItem('api_env', 'remote');
            // We can keep the local URL stored even if we switch to remote
        }
        setIsOpen(false);
        // Reload to apply changes in config.ts
        window.location.reload();
    };

    return (
        <>
            {/* Floating Trigger Button */}
            <button
                onClick={() => setIsOpen(true)}
                className={`fixed bottom-0 left-32 z-50 flex items-center gap-2 px-3 py-2 rounded-full shadow-lg border border-white/10 transition-all hover:scale-105 active:scale-95 ${env === 'local'
                    ? 'bg-amber-600 text-white hover:bg-amber-500'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                    }`}
                title="Switch API Environment"
            >
                <span className="material-symbols-outlined text-sm">
                    {env === 'local' ? 'terminal' : 'cloud'}
                </span>
                <span className="text-xs font-bold uppercase tracking-wider">
                    {env === 'local' ? 'Local DB' : 'Live DB'}
                </span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="w-full max-w-sm bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform transition-all">
                        <div className="p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-[#0b1015]/50 flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                                <span className="material-symbols-outlined text-primary">settings_ethernet</span>
                                Database Connection
                            </h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                            >
                                <span className="material-symbols-outlined">close</span>
                            </button>
                        </div>

                        <div className="p-5 space-y-4">
                            <div className="space-y-3">
                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <input
                                        type="radio"
                                        name="env"
                                        checked={env === 'remote'}
                                        onChange={() => setEnv('remote')}
                                        className="w-4 h-4 text-emerald-600 focus:ring-emerald-500"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">Live Database</span>
                                            <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 rounded-full">Remote</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">Connects to the production server</p>
                                    </div>
                                </label>

                                <label className="flex items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                                    <input
                                        type="radio"
                                        name="env"
                                        checked={env === 'local'}
                                        onChange={() => setEnv('local')}
                                        className="w-4 h-4 text-amber-600 focus:ring-amber-500"
                                    />
                                    <div className="flex-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-slate-700 dark:text-slate-200">Local Database</span>
                                            <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">Dev</span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5">Connects to your machine (localhost)</p>
                                    </div>
                                </label>
                            </div>

                            {env === 'local' && (
                                <div className="space-y-1 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Local API URL</label>
                                    <input
                                        type="text"
                                        value={localUrl}
                                        onChange={(e) => setLocalUrl(e.target.value)}
                                        className="w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-white text-sm focus:ring-2 focus:ring-primary/50 outline-none"
                                        placeholder="http://localhost:8000/api"
                                    />
                                </div>
                            )}

                            <div className="pt-2">
                                <button
                                    onClick={handleSave}
                                    className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-dark text-white font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                                >
                                    Save & Reload
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default EnvironmentSwitcher;
