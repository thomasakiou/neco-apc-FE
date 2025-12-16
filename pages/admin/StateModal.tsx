import React, { useState, useEffect } from 'react';
import { State, StateCreate } from '../../types/state';

interface StateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: StateCreate) => Promise<void>;
    initialData?: State | null;
}

const initialFormState: StateCreate = {
    state_code: '',
    name: '',
    capital: '',
    zone: '',
    mkv_count: 0,
    schools_count: 0,
    custodians_count: 0,
};

const StateModal: React.FC<StateModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<StateCreate>(initialFormState);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                state_code: initialData.state_code,
                name: initialData.name,
                capital: initialData.capital,
                zone: initialData.zone || '',
                mkv_count: initialData.mkv_count,
                schools_count: initialData.schools_count,
                custodians_count: initialData.custodians_count,
            });
        } else {
            setFormData(initialFormState);
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-200/50 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-700 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-900/20 dark:via-[#121b25] dark:to-teal-900/20 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-300 tracking-tight">
                            {initialData ? 'Edit State' : 'Add New State'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">State Configuration</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all duration-200 shadow-sm border border-transparent hover:border-rose-100"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FloatingInput
                            label="State Code"
                            name="state_code"
                            value={formData.state_code}
                            onChange={handleChange}
                            required
                        />
                        <FloatingInput
                            label="State Name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FloatingInput
                            label="Capital City"
                            name="capital"
                            value={formData.capital}
                            onChange={handleChange}
                            required
                        />
                        <FloatingInput
                            label="Zone"
                            name="zone"
                            value={formData.zone}
                            onChange={handleChange}
                        />
                    </div>

                    <div className="pt-2 pb-2 border-t border-slate-100 dark:border-gray-700">
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Entity Counts (Optional)</p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FloatingInput
                                label="Marking Venues"
                                name="mkv_count"
                                type="number"
                                value={formData.mkv_count?.toString() || '0'}
                                onChange={handleChange}
                            />
                            <FloatingInput
                                label="Schools"
                                name="schools_count"
                                type="number"
                                value={formData.schools_count?.toString() || '0'}
                                onChange={handleChange}
                            />
                            <FloatingInput
                                label="Custodians"
                                name="custodians_count"
                                type="number"
                                value={formData.custodians_count?.toString() || '0'}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-slate-100 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : (initialData ? 'Save Changes' : 'Create State')}
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
            className="peer w-full h-12 px-4 pt-5 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#121b25] focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-white text-sm"
        />
        <label className={`absolute left-4 text-[10px] font-bold uppercase tracking-wider transition-all pointer-events-none ${value ? 'top-1.5 text-emerald-500' : 'top-4 text-slate-400 dark:text-slate-500 peer-focus:top-1.5 peer-focus:text-emerald-500'
            }`}>
            {label}
        </label>
    </div>
);

export default StateModal;
