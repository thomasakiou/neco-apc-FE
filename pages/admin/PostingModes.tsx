import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const PostingModes: React.FC = () => {
    const navigate = useNavigate();
    const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const [activeButton, setActiveButton] = useState<'system' | 'personalized'>('system');

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-6 md:gap-8 bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Posting Modes
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Manage system-driven and manual staff postings.</p>
                </div>
                <div className="flex items-center gap-2 p-1 rounded-lg bg-slate-200 dark:bg-slate-800">
                    <button
                        onClick={() => setActiveButton('system')}
                        className={`h-10 px-4 font-bold rounded-md text-sm transition-colors ${activeButton === 'system' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
                    >
                        System-Driven
                    </button>
                    <button
                        onClick={() => setActiveButton('personalized')}
                        className={`h-10 px-4 font-bold rounded-md text-sm transition-colors ${activeButton === 'personalized' ? 'bg-white text-primary shadow-sm' : 'text-slate-500'}`}
                    >
                        Personalized
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                {/* Randomized Post */}
                <div className="bg-white dark:bg-[#121b25] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col h-full transition-colors">
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200">Randomized Post</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Initiate a system-driven random posting based on the published Annual Posting Calendar (APC) and predefined rules.</p>
                    </div>
                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                        <StatusRow label="Last Run Status" value="Completed Successfully" isBadge />
                        <StatusRow label="Last Run Date" value={today} />
                        <StatusRow label="Current APC Status" value="Published" isBadge />
                    </div>
                    <div className="p-6 mt-auto border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <a href="#" className="text-primary font-medium underline">View Posting History & Logs</a>
                        <button onClick={() => navigate('/admin/assignments/random')} className="h-10 px-5 bg-primary/10 dark:bg-emerald-900/30 text-primary dark:text-emerald-400 font-bold rounded-lg hover:bg-primary/20 transition-colors text-sm">Start Randomized Post</button>
                    </div>
                </div>

                {/* Personalized Post */}
                <div className="bg-white dark:bg-[#121b25] rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 flex flex-col h-full transition-colors">
                    <div className="p-6">
                        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-200">Personalized Post</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">Manually select staff and posting locations. Use this for special cases, overrides, or individual assignments.</p>
                    </div>
                    <div className="p-6 border-t border-gray-100 dark:border-gray-800 space-y-4">
                        <StatusRow label="Last Personalized Post" value={today} />
                        <StatusRow label="Recent Activity" value="5 manual assignments created" />
                        <StatusRow label="Pending Approvals" value="2 Pending" isBadge badgeColor="bg-amber-100 text-amber-800" />
                    </div>
                    <div className="p-6 mt-auto border-t border-gray-100 dark:border-gray-800 flex items-center justify-between">
                        <a href="#" className="text-primary font-medium underline">View Manual Assignment History</a>
                        <button onClick={() => navigate('/admin/assignments/board')} className="h-10 px-5 bg-primary/10 dark:bg-emerald-900/30 text-primary dark:text-emerald-400 font-bold rounded-lg hover:bg-primary/20 transition-colors text-sm">Start Personalized Post</button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatusRow = ({ label, value, isBadge, badgeColor = 'bg-green-100 text-green-800' }: any) => (
    <div className="flex justify-between items-center">
        <p className="text-slate-500 dark:text-slate-400 text-sm">{label}:</p>
        {isBadge ? (
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeColor}`}>{value}</span>
        ) : (
            <p className="text-slate-900 dark:text-slate-200 font-medium text-sm">{value}</p>
        )}
    </div>
);

export default PostingModes;