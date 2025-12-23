import React, { useState, useEffect } from 'react';
import { Staff, StaffCreate } from '../../types/staff';

interface StaffModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: StaffCreate) => Promise<void>;
    initialData?: Staff | null;
}

const initialFormState: StaffCreate = {
    fileno: '',
    full_name: '',
    station: '',
    qualification: '',
    sex: '',
    dob: '',
    dofa: '',
    doan: '',
    dopa: '',
    rank: '',
    conr: '',
    state: '',
    lga: '',
    email: '',
    phone: '',
    remark: '',
    is_hod: false,
    is_state_coordinator: false,
    is_director: false,
    is_education: false,
    active: true,
};

const StaffModal: React.FC<StaffModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<StaffCreate>(initialFormState);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                fileno: initialData.fileno,
                full_name: initialData.full_name,
                station: initialData.station || '',
                qualification: initialData.qualification || '',
                sex: initialData.sex || '',
                dob: initialData.dob || '',
                dofa: initialData.dofa || '',
                doan: initialData.doan || '',
                dopa: initialData.dopa || '',
                rank: initialData.rank || '',
                conr: initialData.conr || '',
                state: initialData.state || '',
                lga: initialData.lga || '',
                email: initialData.email || '',
                phone: initialData.phone || '',
                remark: initialData.remark || '',
                is_hod: initialData.is_hod ?? false,
                is_state_coordinator: initialData.is_state_coordinator ?? false,
                is_director: initialData.is_director ?? false,
                is_education: initialData.is_education ?? false,
                active: initialData.active ?? true,
            });
        } else {
            setFormData(initialFormState);
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-gray-700/50">
                {/* Fixed Header */}
                <div className="flex-none flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-700 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-900/20 dark:via-[#121b25] dark:to-teal-900/20 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-400 tracking-tight">
                            {initialData ? 'Edit Staff Profile' : 'Add New Staff Member'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Complete Staff Dossier</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-800"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <form id="staff-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Personal Info */}
                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400">person</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Personal Information</span>
                            </div>

                            <FloatingInput label="File Number" name="fileno" value={formData.fileno} onChange={handleChange} required placeholder="e.g. NECO/12345" />
                            <FloatingInput label="Full Name" name="full_name" value={formData.full_name} onChange={handleChange} required placeholder="Surname, First Middle" />
                            <FloatingInput label="Email Address" type="email" name="email" value={formData.email} onChange={handleChange} />
                            <FloatingInput label="Phone Number" type="tel" name="phone" value={formData.phone} onChange={handleChange} />

                            <SelectInput label="Gender" name="sex" value={formData.sex} onChange={handleChange} options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }]} />
                            <FloatingInput label="Date of Birth" type="date" name="dob" value={formData.dob} onChange={handleChange} />
                            <FloatingInput label="State of Origin" name="state" value={formData.state} onChange={handleChange} />
                            <FloatingInput label="LGA" name="lga" value={formData.lga} onChange={handleChange} />

                            {/* Official Info */}
                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 mt-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-teal-500 dark:text-teal-400">badge</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Official Details</span>
                            </div>

                            <FloatingInput label="Rank / Designation" name="rank" value={formData.rank} onChange={handleChange} />
                            <FloatingInput label="CONR / Grade Level" name="conr" value={formData.conr} onChange={handleChange} />
                            <FloatingInput label="Station / Dept" name="station" value={formData.station} onChange={handleChange} />
                            <FloatingInput label="Qualification" name="qualification" value={formData.qualification} onChange={handleChange} />

                            <FloatingInput label="First Appointment (DOFA)" type="date" name="dofa" value={formData.dofa} onChange={handleChange} />
                            <FloatingInput label="Appointment to NECO (DOAN)" type="date" name="doan" value={formData.doan} onChange={handleChange} />
                            <FloatingInput label="Present Appointment (DOPA)" type="date" name="dopa" value={formData.dopa} onChange={handleChange} />

                            {/* Additional */}
                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 mt-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-600 dark:text-emerald-400">note_alt</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Remarks & Status</span>
                            </div>

                            <div className="md:col-span-2">
                                <textarea
                                    name="remark"
                                    value={formData.remark || ''}
                                    onChange={handleChange}
                                    className="w-full min-h-[80px] p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-medium text-slate-700 dark:text-slate-300 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-sm resize-none"
                                    placeholder="Add any additional remarks or notes here..."
                                />
                            </div>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all md:col-span-1">
                                <input
                                    type="checkbox"
                                    name="is_hod"
                                    checked={formData.is_hod === true}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-purple-600 focus:ring-purple-500 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Is HOD?</span>
                            </label>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all md:col-span-1">
                                <input
                                    type="checkbox"
                                    name="is_state_coordinator"
                                    checked={formData.is_state_coordinator === true}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-amber-600 focus:ring-amber-500 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">State Coordinator?</span>
                            </label>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all md:col-span-1">
                                <input
                                    type="checkbox"
                                    name="is_director"
                                    checked={formData.is_director === true}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Is Director?</span>
                            </label>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all md:col-span-1">
                                <input
                                    type="checkbox"
                                    name="is_education"
                                    checked={formData.is_education === true}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Education Dept?</span>
                            </label>

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all md:col-span-2">
                                <input
                                    type="checkbox"
                                    name="active"
                                    checked={formData.active !== false}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Active Staff Member</span>
                            </label>
                        </div>
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="flex-none flex justify-end gap-4 p-6 border-t border-slate-100 dark:border-gray-700 bg-white dark:bg-[#121b25] rounded-b-2xl">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 hover:text-slate-900 dark:hover:text-slate-300 transition-all shadow-sm"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="staff-form"
                        disabled={loading}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none flex items-center gap-2"
                    >
                        {loading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                        {initialData ? 'Save Changes' : 'Create Staff Member'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Helper Components for "Fancy" Look
const FloatingInput = ({ label, type = "text", value, ...props }: any) => (
    <div className="relative group">
        <input
            type={type}
            value={value}
            {...props}
            className="peer w-full h-12 px-4 pt-5 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-300 text-sm"
        />
        <label className={`absolute left-4 text-[10px] font-bold uppercase tracking-wider transition-all pointer-events-none ${value ? 'top-1.5 text-emerald-500 dark:text-emerald-400' : 'top-4 text-slate-400 dark:text-slate-500 peer-focus:top-1.5 peer-focus:text-emerald-500 dark:peer-focus:text-emerald-400'
            }`}>
            {label}
        </label>
    </div>
);

const SelectInput = ({ label, options, ...props }: any) => (
    <div className="relative group">
        <select
            {...props}
            className="peer w-full h-12 px-4 pt-3 pb-1 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-[3px] focus:ring-emerald-500/10 transition-all font-bold text-slate-700 dark:text-slate-300 text-sm appearance-none cursor-pointer"
        >
            <option value="" disabled hidden></option>
            {options.map((opt: any) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
        <label className="absolute left-4 top-1 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 uppercase tracking-wider pointer-events-none">
            {label}
        </label>
        <span className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 pointer-events-none">expand_more</span>
    </div>
);

export default StaffModal;
