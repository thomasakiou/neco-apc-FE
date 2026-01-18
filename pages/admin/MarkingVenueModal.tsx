import React, { useState, useEffect } from 'react';
import { MarkingVenue, MarkingVenueCreate } from '../../types/markingVenue';
import { getAllStates } from '../../services/state';
import { State } from '../../types/state';

interface MarkingVenueModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: MarkingVenueCreate) => Promise<void>;
    initialData?: MarkingVenue | null;
    titlePrefix?: string;
}

const initialFormState: MarkingVenueCreate = {
    state: '',
    name: '',
    code: '',
    address: '',
    parcels: 0,
    active: true,
};

const MarkingVenueModal: React.FC<MarkingVenueModalProps> = ({ isOpen, onClose, onSubmit, initialData, titlePrefix = 'SSCE INT' }) => {
    const [formData, setFormData] = useState<MarkingVenueCreate>(initialFormState);
    const [loading, setLoading] = useState(false);
    const [states, setStates] = useState<State[]>([]);

    useEffect(() => {
        const fetchStates = async () => {
            try {
                const data = await getAllStates();
                setStates(data);
            } catch (error) {
                console.error('Error fetching states:', error);
            }
        };
        if (isOpen) {
            fetchStates();
        }
    }, [isOpen]);

    useEffect(() => {
        if (initialData) {
            setFormData({
                state: initialData.state,
                name: initialData.name,
                code: initialData.code || '',
                address: initialData.address || '',
                parcels: initialData.parcels,
                active: initialData.active ?? true,
            });
        } else {
            setFormData(initialFormState);
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        setFormData((prev) => ({
            ...prev,
            [name]: type === 'number' ? Number(value) : value
        }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData((prev) => ({ ...prev, [name]: checked }));
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-900/80 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col border border-slate-200/50 dark:border-gray-800 transition-colors">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-900/20 dark:via-[#121b25] dark:to-teal-900/20 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-400 tracking-tight">
                            {initialData ? `Edit ${titlePrefix} Marking Venue` : `Add New ${titlePrefix} Marking Venue`}
                        </h2>
                        <p className="text-slate-500 text-xs font-medium uppercase tracking-widest mt-1">{titlePrefix} Marking Venue Configuration</p>
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
                    <div className="relative group">
                        <select
                            name="state"
                            value={formData.state}
                            onChange={handleChange}
                            required
                            className="peer w-full h-12 px-4 pt-5 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#121b25] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-200 text-sm appearance-none cursor-pointer"
                        >
                            <option value="" disabled hidden></option>
                            {states.map(state => (
                                <option key={state.id} value={state.name}>{state.name}</option>
                            ))}
                        </select>
                        <label className={`absolute left-4 text-[10px] font-bold uppercase tracking-wider transition-all pointer-events-none ${formData.state ? 'top-1.5 text-emerald-500' : 'top-4 text-slate-400 peer-focus:top-1.5 peer-focus:text-emerald-500'
                            }`}>
                            State
                        </label>
                        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">expand_more</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FloatingInput
                            label="Venue Name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                        />
                        <FloatingInput
                            label="Venue Code"
                            name="code"
                            value={formData.code || ''}
                            onChange={handleChange}
                        />
                    </div>

                    <FloatingInput
                        label="Address"
                        name="address"
                        value={formData.address || ''}
                        onChange={handleChange}
                    />

                    <FloatingInput
                        label="Number of Parcels"
                        name="parcels"
                        type="number"
                        value={formData.parcels?.toString() || '0'}
                        onChange={handleChange}
                    />

                    <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-[#121b25] hover:border-slate-300 dark:hover:border-gray-600 transition-all">
                        <input
                            type="checkbox"
                            name="active"
                            checked={formData.active}
                            onChange={handleCheckboxChange}
                            className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Active Status</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Venue is currently active and operational</span>
                        </div>
                    </label>
                </form>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] rounded-b-2xl transition-colors">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Venue')}
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
            className="peer w-full h-12 px-4 pt-5 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#121b25] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-200 text-sm"
        />
        <label className={`absolute left-4 text-[10px] font-bold uppercase tracking-wider transition-all pointer-events-none ${value ? 'top-1.5 text-emerald-500' : 'top-4 text-slate-400 peer-focus:top-1.5 peer-focus:text-emerald-500'
            }`}>
            {label}
        </label>
    </div>
);

export default MarkingVenueModal;
