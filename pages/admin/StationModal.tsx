import React, { useState, useEffect } from 'react';
import { Station, StationCreate } from '../../types/station';

interface StationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: StationCreate) => Promise<void>;
    initialData?: Station | null;
}

const initialFormState: StationCreate = {
    station_code: '',
    station: '',
    zone: '',
    active: true,
};

const StationModal: React.FC<StationModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<StationCreate>(initialFormState);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                station_code: initialData.station_code,
                station: initialData.station,
                zone: initialData.zone || '',
                active: initialData.active ?? true,
            });
        } else {
            setFormData(initialFormState);
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 dark:bg-slate-950/60 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25] backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-md flex flex-col border border-slate-200/50 dark:border-gray-800">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-950/10 dark:via-[#121b25] dark:to-teal-950/10 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                            {initialData ? 'Edit Station' : 'Add New Station'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Station name must be unique</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-900/30"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
                    <FloatingInput
                        label="Station Code"
                        name="station_code"
                        value={formData.station_code}
                        onChange={handleChange}
                        required
                    />
                    <FloatingInput
                        label="Station Name"
                        name="station"
                        value={formData.station}
                        onChange={handleChange}
                        required
                    />
                    <FloatingInput
                        label="Zone"
                        name="zone"
                        value={formData.zone}
                        onChange={handleChange}
                    />

                    <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-[#121b25] hover:border-slate-300 dark:hover:border-gray-700 transition-all">
                        <input
                            type="checkbox"
                            name="active"
                            checked={formData.active}
                            onChange={handleCheckboxChange}
                            className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer transition-colors"
                        />
                        <div className="flex flex-col">
                            <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Active Status</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">Station is currently active and operational</span>
                        </div>
                    </label>
                </form>

                {/* Footer */}
                <div className="flex gap-3 p-6 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-[#1a2430] hover:border-slate-300 dark:hover:border-gray-600 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Saving...' : (initialData ? 'Save Changes' : 'Create Station')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FloatingInput = ({ label, value, ...props }: any) => (
    <div className="relative group">
        <input
            value={value}
            {...props}
            className="peer w-full h-12 px-4 pt-5 pb-1 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#121b25] focus:border-emerald-500 dark:focus:border-emerald-400 focus:ring-[3px] focus:ring-emerald-500/10 dark:focus:ring-emerald-400/10 transition-all font-bold text-slate-700 dark:text-slate-200 text-sm"
        />
        <label className={`absolute left-4 text-[10px] font-bold uppercase tracking-wider transition-all pointer-events-none ${value ? 'top-1.5 text-emerald-500' : 'top-4 text-slate-400 dark:text-slate-500 peer-focus:top-1.5 peer-focus:text-emerald-500 dark:peer-focus:text-emerald-400'
            }`}>
            {label}
        </label>
    </div>
);

export default StationModal;
