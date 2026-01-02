import React, { useState } from 'react';

interface HelpSection {
    title: string;
    icon: string;
    content: string;
    tips?: string[];
}

export interface ModuleHelp {
    title: string;
    description: string;
    sections: HelpSection[];
}

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
    helpData: ModuleHelp;
}

const HelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose, helpData }) => {
    const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0]));

    if (!isOpen) return null;

    const toggleSection = (index: number) => {
        setExpandedSections(prev => {
            const next = new Set(prev);
            if (next.has(index)) next.delete(index);
            else next.add(index);
            return next;
        });
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 animate-fadeIn">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity duration-300"
                onClick={onClose}
            ></div>

            {/* Modal Content */}
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#121b25] rounded-3xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col max-h-[85vh] transition-all duration-300 transform scale-100 overflow-hidden">

                {/* Header */}
                <div className="flex-none p-6 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-[#0b1015]/50 flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="size-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
                            <span className="material-symbols-outlined text-2xl">help_center</span>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                                {helpData.title} Guide
                            </h2>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
                                {helpData.description}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                    >
                        <span className="material-symbols-outlined text-xl">close</span>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    {helpData.sections.map((section, idx) => {
                        const isExpanded = expandedSections.has(idx);
                        return (
                            <div
                                key={idx}
                                className={`rounded-xl border transition-all duration-200 ${isExpanded
                                    ? 'bg-slate-50 dark:bg-slate-800/20 border-indigo-200 dark:border-indigo-900/30'
                                    : 'bg-white dark:bg-[#0b1015] border-slate-200 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-700'
                                    }`}
                            >
                                <button
                                    onClick={() => toggleSection(idx)}
                                    className="w-full flex items-center justify-between p-4 text-left"
                                >
                                    <div className="flex items-center gap-3">
                                        <span className={`material-symbols-outlined ${isExpanded ? 'text-indigo-500 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-500'
                                            }`}>
                                            {section.icon}
                                        </span>
                                        <span className={`font-bold text-sm ${isExpanded ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-700 dark:text-slate-300'
                                            }`}>
                                            {section.title}
                                        </span>
                                    </div>
                                    <span className={`material-symbols-outlined text-slate-400 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-500' : ''
                                        }`}>
                                        expand_more
                                    </span>
                                </button>

                                {isExpanded && (
                                    <div className="px-4 pb-4 pl-[3.25rem]">
                                        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed dark:font-light">
                                            {section.content}
                                        </p>

                                        {section.tips && section.tips.length > 0 && (
                                            <div className="mt-4 flex flex-col gap-2">
                                                {section.tips.map((tip, tIdx) => (
                                                    <div key={tIdx} className="flex items-start gap-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 p-2 rounded-lg border border-emerald-100 dark:border-emerald-900/20">
                                                        <span className="material-symbols-outlined text-sm mt-0.5">lightbulb</span>
                                                        <span>{tip}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="flex-none p-4 bg-slate-50 dark:bg-[#0b1015] border-t border-slate-100 dark:border-gray-800 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                        Close Guide
                    </button>
                </div>
            </div>
        </div>
    );
};

export default HelpModal;
