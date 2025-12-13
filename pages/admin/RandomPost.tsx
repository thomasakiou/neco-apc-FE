import React from 'react';

const RandomPost: React.FC = () => {
    return (
        <div className="p-8 max-w-7xl mx-auto flex flex-col gap-6 bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                        Random Post
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Automated random posting generation.</p>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] rounded-lg border border-gray-200 dark:border-gray-800 p-10 transition-colors flex flex-col items-center justify-center text-center gap-4 min-h-[400px]">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                    <span className="material-symbols-outlined text-4xl">shuffle</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-200">Random Posting Generator</h3>
                <p className="text-slate-500 dark:text-slate-400 max-w-md">
                    This module will allow for randomized staff postings based on configurable criteria.
                </p>
                <button className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center gap-2 mt-4 cursor-not-allowed opacity-70">
                    <span className="material-symbols-outlined">construction</span>
                    Coming Soon
                </button>
            </div>
        </div>
    );
};

export default RandomPost;
