import React, { useState } from 'react';
import { useNotification } from '../context/NotificationContext';
import { changePassword } from '../services/auth';

interface InputFieldProps {
    label: string;
    value: string;
    onChange: (v: string) => void;
    type?: string;
    placeholder?: string;
    required?: boolean;
    icon: string;
}

function InputField({ label, value, onChange, type = 'text', placeholder, required = false, icon }: InputFieldProps) {
    return (
        <div className="flex flex-col gap-2 text-left">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">{label}</label>
            <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400 group-focus-within:text-indigo-500 transition-colors uppercase">{icon}</span>
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 rounded-2xl text-slate-900 dark:text-white text-sm font-bold focus:bg-white dark:focus:bg-white/10 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all outline-none"
                />
            </div>
        </div>
    );
}

export function PasswordChangeModal({ onClose }: { onClose: () => void }) {
    const { showNotification } = useNotification();
    const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
    const [isSaving, setIsSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (passwords.new !== passwords.confirm) {
            showNotification('New passwords do not match', 'error');
            return;
        }

        setIsSaving(true);
        try {
            await changePassword(passwords.current, passwords.new);
            showNotification('Password updated successfully', 'success');
            onClose();
        } catch (error: any) {
            showNotification(error.message, 'error');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 overflow-hidden">
            <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-300" onClick={onClose}></div>
            <div className="relative bg-white dark:bg-[#1e293b] rounded-[3rem] shadow-2xl w-full max-w-lg border border-slate-200/50 dark:border-white/10 overflow-hidden animate-in zoom-in-95 slide-in-from-bottom-8 duration-500">
                <div className="relative p-10 flex flex-col gap-8">
                    <div className="flex justify-between items-center">
                        <div className="text-left">
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Security Update</h2>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-wider">Change account entrance key</p>
                        </div>
                        <button onClick={onClose} className="size-10 rounded-xl bg-slate-100 dark:bg-white/10 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-all flex items-center justify-center active:scale-90">
                            <span className="material-symbols-outlined">close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <InputField
                            label="Existing Password"
                            icon="lock_open"
                            type="password"
                            placeholder="Current secret"
                            value={passwords.current}
                            onChange={(v) => setPasswords({ ...passwords, current: v })}
                            required
                        />
                        <div className="size-px bg-slate-200/50 my-2 mx-auto w-1/2"></div>
                        <InputField
                            label="New Secret Password"
                            icon="lock"
                            type="password"
                            placeholder="Set complex sequence"
                            value={passwords.new}
                            onChange={(v) => setPasswords({ ...passwords, new: v })}
                            required
                        />
                        <InputField
                            label="Verify New Password"
                            icon="verified"
                            type="password"
                            placeholder="Repeat new sequence"
                            value={passwords.confirm}
                            onChange={(v) => setPasswords({ ...passwords, confirm: v })}
                            required
                        />

                        <div className="pt-4 flex gap-3">
                            <button type="submit" disabled={isSaving} className="w-full px-6 py-4 bg-slate-900 dark:bg-emerald-600 text-white rounded-2xl font-black text-sm hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {isSaving ? <span className="material-symbols-outlined animate-spin">refresh</span> : <span className="material-symbols-outlined">security_update_good</span>}
                                Update Credentials
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
