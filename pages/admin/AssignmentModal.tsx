import React, { useState, useEffect } from 'react';
import { Assignment, AssignmentCreate } from '../../types/assignment';

interface AssignmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: AssignmentCreate) => Promise<void>;
    initialData?: Assignment | null;
    allMandates: any[];
}

const initialFormState: AssignmentCreate = {
    code: '',
    name: '',
    mandates: [],
    active: true,
};

const AssignmentModal: React.FC<AssignmentModalProps> = ({ isOpen, onClose, onSubmit, initialData, allMandates }) => {
    const [formData, setFormData] = useState<AssignmentCreate>(initialFormState);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                setFormData({
                    code: initialData.code || '',
                    name: initialData.name || '',
                    mandates: initialData.mandates || [],
                    active: initialData.active ?? true,
                });
            } else {
                setFormData(initialFormState);
            }
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleMandateToggle = (mandateCode: string) => {
        setFormData((prev) => {
            const currentMandates = prev.mandates || [];
            const newMandates = currentMandates.includes(mandateCode)
                ? currentMandates.filter(m => m !== mandateCode)
                : [...currentMandates, mandateCode];
            return { ...prev, mandates: newMandates };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error: any) {
            console.error('Assignment submission error:', error);
            // Don't close modal on error so user can retry
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-200/50 dark:border-gray-800/50 transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-900/20 dark:via-[#121b25] dark:to-teal-900/20 rounded-t-2xl transition-colors">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 tracking-tight">
                            {initialData ? 'Edit Assignment' : 'Add New Assignment'}
                        </h2>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">Assignment Configuration</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all duration-200 shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-800"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-200 dark:border-gray-700 transition-colors">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Active Status</label>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input
                                type="checkbox"
                                name="active"
                                checked={formData.active ?? true}
                                onChange={handleChange}
                                className="sr-only peer"
                            />
                            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                            <span className="ml-3 text-sm font-medium text-slate-600 dark:text-slate-400">{formData.active ? 'Active' : 'Inactive'}</span>
                        </label>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FloatingInput
                            label="Assignment Code"
                            name="code"
                            value={formData.code || ''}
                            onChange={handleChange}
                            required
                        />
                        <FloatingInput
                            label="Assignment Name"
                            name="name"
                            value={formData.name || ''}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="border border-slate-200 dark:border-gray-700 rounded-xl p-4 bg-slate-50 dark:bg-slate-800/50 transition-colors">
                        <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3 block">Assigned Mandates</label>
                        <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                            {allMandates.map((mandate) => (
                                <label
                                    key={mandate.id}
                                    className="flex items-center gap-2 p-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-600 transition-all"
                                >
                                    <input
                                        type="checkbox"
                                        checked={formData.mandates?.includes(mandate.code) || false}
                                        onChange={() => handleMandateToggle(mandate.code)}
                                        className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{mandate.mandate}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl transition-colors">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Assignment')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FloatingInput = ({ label, value, type = "text", ...props }: any) => (
    <div className="relative group">
        <input
            type={type}
            value={value}
            {...props}
            className="peer w-full h-12 px-4 pt-5 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-300 text-sm"
        />
        <label className={`absolute left-4 text-[10px] font-bold uppercase tracking-wider transition-all pointer-events-none ${value ? 'top-1.5 text-emerald-500 dark:text-emerald-400' : 'top-4 text-slate-400 dark:text-slate-500 peer-focus:top-1.5 peer-focus:text-emerald-500 dark:peer-focus:text-emerald-400'
            }`}>
            {label}
        </label>
    </div>
);

export default AssignmentModal;
