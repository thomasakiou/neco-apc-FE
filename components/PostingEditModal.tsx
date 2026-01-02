import React, { useState, useEffect } from 'react';
import { PostingResponse, PostingCreate } from '../types/posting';

interface PostingEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: Partial<PostingCreate>) => Promise<void>;
    initialData: PostingResponse | null;
}

const PostingEditModal: React.FC<PostingEditModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState<{
        assignments: string;
        mandates: string;
        venue: string;
        description: string;
        posted_for: number;
        to_be_posted: number;
        count: number;
    }>({
        assignments: '',
        mandates: '',
        venue: '',
        description: '',
        posted_for: 0,
        to_be_posted: 0,
        count: 0
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                assignments: initialData.assignments.map(a => typeof a === 'string' ? a : a.code).join(', '),
                mandates: initialData.mandates.map(m => typeof m === 'string' ? m : m.mandate).join(', '),
                venue: initialData.assignment_venue.join(', '),
                description: initialData.description || '',
                posted_for: initialData.posted_for || 0,
                to_be_posted: initialData.to_be_posted || 0,
                count: initialData.count || 0
            });
        }
    }, [initialData]);

    if (!isOpen || !initialData) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload: Partial<PostingCreate> = {
                assignments: formData.assignments.split(',').map(s => s.trim()).filter(Boolean),
                mandates: formData.mandates.split(',').map(s => s.trim()).filter(Boolean),
                assignment_venue: formData.venue.split(',').map(s => s.trim()).filter(Boolean),
                description: formData.description,
                posted_for: Number(formData.posted_for),
                to_be_posted: Number(formData.to_be_posted),
                count: Number(formData.count)
            };
            await onSubmit(payload);
            onClose();
        } catch (error) {
            console.error('Submit error:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#121b25] w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Edit Posting</h2>
                        <p className="text-sm text-slate-500 font-mono mt-1">{initialData.name} ({initialData.file_no})</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex flex-col gap-6">
                    {/* Assignments */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Assignments (comma separated)</label>
                        <input
                            type="text"
                            value={formData.assignments}
                            onChange={e => setFormData({ ...formData, assignments: e.target.value })}
                            className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            placeholder="e.g. SSCE-INT, BECE"
                        />
                    </div>

                    {/* Mandates */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Mandates (comma separated)</label>
                        <input
                            type="text"
                            value={formData.mandates}
                            onChange={e => setFormData({ ...formData, mandates: e.target.value })}
                            className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            placeholder="e.g. TEAM A, TEAM B"
                        />
                    </div>

                    {/* Venue */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Venue (comma separated)</label>
                        <input
                            type="text"
                            value={formData.venue}
                            onChange={e => setFormData({ ...formData, venue: e.target.value })}
                            className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            placeholder="Venue Name"
                        />
                    </div>

                    {/* Counts */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Number of Nights</label>
                            <input
                                type="number"
                                value={formData.count}
                                onChange={e => setFormData({ ...formData, count: Number(e.target.value) })}
                                className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Posted For</label>
                            <input
                                type="number"
                                value={formData.posted_for}
                                onChange={e => setFormData({ ...formData, posted_for: Number(e.target.value) })}
                                className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">To Be Posted</label>
                            <input
                                type="number"
                                value={formData.to_be_posted}
                                onChange={e => setFormData({ ...formData, to_be_posted: Number(e.target.value) })}
                                className="w-full h-11 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                            />
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Description</label>
                        <textarea
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            className="w-full h-24 px-4 py-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all resize-none"
                            placeholder="Additional details..."
                        ></textarea>
                    </div>

                </form>

                <div className="p-6 border-t border-slate-100 dark:border-gray-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-slate-900/50 rounded-b-2xl">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold shadow-lg shadow-indigo-500/20 transition-all transform active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {loading ? <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span> : null}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PostingEditModal;
