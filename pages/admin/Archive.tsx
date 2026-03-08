import React, { useState, useEffect, useMemo } from 'react';
import { getAllArchives, createArchive, updateArchive, deleteArchive } from '../../services/archive';
import { getAllStaff } from '../../services/staff';
import { ArchiveRecord } from '../../types/archive';
import { Staff } from '../../types/staff';

const ArchivePage: React.FC = () => {
    const [loading, setLoading] = useState(false);

    // Form States
    const [searchFileNo, setSearchFileNo] = useState('');
    const [foundStaff, setFoundStaff] = useState<Staff | null>(null);
    const [comment, setComment] = useState('');
    const [allStaff, setAllStaff] = useState<Staff[]>([]);

    // Archive List States
    const [archives, setArchives] = useState<ArchiveRecord[]>([]);

    // Search / Filter on archived records
    const [tableSearch, setTableSearch] = useState('');

    // Editing States
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editComment, setEditComment] = useState('');

    useEffect(() => {
        loadInitialData();
    }, []);

    const loadInitialData = async () => {
        setLoading(true);
        try {
            const [staffData, archivesData] = await Promise.all([
                getAllStaff(false),
                getAllArchives(0, 1000)
            ]);
            setAllStaff(staffData);
            setArchives(archivesData.items);
        } catch (error) {
            console.error("Failed to load initial data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        if (!searchFileNo.trim()) {
            alert('Please enter a File Number to search.');
            return;
        }

        const q = searchFileNo.trim().toLowerCase();
        const staff = allStaff.find(s => s.fileno.toLowerCase() === q);

        if (staff) {
            setFoundStaff(staff);
        } else {
            setFoundStaff(null);
            alert('Staff not found. Please verify the File Number.');
        }
    };

    const handleArchiveSubmit = async () => {
        if (!foundStaff) {
            alert('Please search for a valid staff member first.');
            return;
        }

        if (!comment.trim()) {
            alert('Please provide a comment/reason for archiving.');
            return;
        }

        const currentYear = new Date().getFullYear().toString();

        setLoading(true);
        try {
            await createArchive({
                file_no: foundStaff.fileno,
                name: foundStaff.full_name,
                conraiss: foundStaff.conr || '',
                station: foundStaff.station || '',
                year: currentYear,
                comment: comment.trim()
            });

            alert('Staff successfully archived.');

            // Reset form
            setSearchFileNo('');
            setFoundStaff(null);
            setComment('');

            // Reload archives
            const archivesData = await getAllArchives(0, 1000, true);
            setArchives(archivesData.items);

        } catch (error: any) {
            console.error("Failed to archive staff", error);
            alert(`Failed to archive: ${error.message || 'Unknown error'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteArchive = async (id: string) => {
        if (!confirm('Are you sure you want to delete this archive record?')) return;

        setLoading(true);
        try {
            await deleteArchive(id);
            alert('Archive record deleted successfully.');
            const archivesData = await getAllArchives(0, 1000, true);
            setArchives(archivesData.items);
        } catch (error: any) {
            console.error("Failed to delete archive", error);
            alert(`Failed to delete archive: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- Edit Handlers ---
    const handleStartEdit = (record: ArchiveRecord) => {
        setEditingId(record.id);
        setEditComment(record.comment || '');
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditComment('');
    };

    const handleSaveEdit = async (record: ArchiveRecord) => {
        if (!editComment.trim()) {
            alert('Comment cannot be empty.');
            return;
        }
        setLoading(true);
        try {
            await updateArchive(record.id, {
                file_no: record.file_no,
                name: record.name,
                conraiss: record.conraiss,
                station: record.station,
                year: record.year,
                comment: editComment.trim()
            });
            alert('Archive record updated.');
            setEditingId(null);
            setEditComment('');
            const archivesData = await getAllArchives(0, 1000, true);
            setArchives(archivesData.items);
        } catch (error: any) {
            console.error("Failed to update archive", error);
            alert(`Failed to update: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // --- Filtered Archives ---
    const filteredArchives = useMemo(() => {
        if (!tableSearch.trim()) return archives;
        const q = tableSearch.trim().toLowerCase();
        return archives.filter(r =>
            r.file_no.toLowerCase().includes(q) ||
            r.name.toLowerCase().includes(q) ||
            (r.comment || '').toLowerCase().includes(q) ||
            (r.station || '').toLowerCase().includes(q)
        );
    }, [archives, tableSearch]);

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-6 border-b border-slate-300">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-slate-600 via-slate-500 to-slate-600 dark:from-slate-400 dark:via-slate-300 dark:to-slate-400 tracking-tight">
                        Staff Archive
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                        Keep records of staff who declined postings or were dropped.
                    </p>
                </div>
            </div>

            {/* Form Section */}
            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6">
                <div className="flex items-center gap-2 pb-4 border-b border-slate-100 dark:border-gray-800">
                    <span className="material-symbols-outlined text-slate-500">archive</span>
                    <h3 className="text-lg font-bold text-slate-800 dark:text-white">New Archive Entry</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Search Field */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Search File Number</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 text-sm font-bold text-slate-900 dark:text-slate-100 uppercase"
                                placeholder="Enter File No..."
                                value={searchFileNo}
                                onChange={(e) => setSearchFileNo(e.target.value.toUpperCase())}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                            />
                            <button
                                onClick={handleSearch}
                                disabled={loading || !searchFileNo.trim()}
                                className="px-4 h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors flex items-center justify-center disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-sm">search</span>
                            </button>
                        </div>
                    </div>

                    {/* Extracted Details - Auto-filled */}
                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Staff Name</label>
                        <input
                            type="text"
                            readOnly
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-[#0c131a] text-sm font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed"
                            value={foundStaff ? foundStaff.full_name : '---'}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">CONRAISS / Station</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                readOnly
                                className="w-1/3 h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-[#0c131a] text-sm font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed text-center"
                                value={foundStaff ? (foundStaff.conr || 'N/A') : '---'}
                            />
                            <input
                                type="text"
                                readOnly
                                className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-[#0c131a] text-sm font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed"
                                value={foundStaff ? (foundStaff.station || 'N/A') : '---'}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Archive Year</label>
                        <input
                            type="text"
                            readOnly
                            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-slate-100 dark:bg-[#0c131a] text-sm font-bold text-slate-600 dark:text-slate-400 cursor-not-allowed"
                            value={new Date().getFullYear().toString()}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-2 mt-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Comment / Reason</label>
                    <textarea
                        className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 dark:border-gray-600 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-slate-100"
                        placeholder="e.g. Declined posting due to medical reasons, dropped from deployment schedule, etc."
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        disabled={!foundStaff}
                    />
                </div>

                <div className="flex justify-end pt-4 border-t border-slate-100 dark:border-gray-800">
                    <button
                        onClick={handleArchiveSubmit}
                        disabled={loading || !foundStaff || !comment.trim()}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white font-bold shadow-lg shadow-slate-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                    >
                        <span className="material-symbols-outlined">save</span>
                        Save to Archive
                    </button>
                </div>
            </div>

            {/* List Section */}
            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 flex-1 min-h-[400px] relative">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pb-4 border-b border-slate-100 dark:border-gray-800 justify-between">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-slate-500">list_alt</span>
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">Archived Records</h3>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[10px] font-black text-slate-500">{filteredArchives.length}</span>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <div className="relative flex-1 sm:min-w-[280px]">
                            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                            <input
                                type="text"
                                placeholder="Search by name, file no, comment..."
                                value={tableSearch}
                                onChange={(e) => setTableSearch(e.target.value)}
                                className="w-full h-10 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 ring-indigo-500/20 outline-none transition-all"
                            />
                            {tableSearch && (
                                <button
                                    onClick={() => setTableSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-[16px]">close</span>
                                </button>
                            )}
                        </div>
                        <button
                            onClick={loadInitialData}
                            disabled={loading}
                            className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors flex-shrink-0"
                            title="Refresh Archives"
                        >
                            <span className="material-symbols-outlined text-[20px]">refresh</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/50">
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-gray-700 w-16 text-center">S/N</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-gray-700">File No</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-gray-700">Name</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-gray-700">Station / CONRAISS</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-gray-700">Year</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-gray-700">Comment</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-widest border-b border-slate-200 dark:border-gray-700 w-28 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white dark:bg-[#121b25] divide-y divide-slate-100 dark:divide-gray-800">
                            {filteredArchives.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-500 dark:text-slate-400 font-medium italic">
                                        {tableSearch ? 'No records match your search.' : 'No archived records found.'}
                                    </td>
                                </tr>
                            ) : (
                                filteredArchives.map((record, index) => (
                                    <tr key={record.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${editingId === record.id ? 'bg-indigo-50/50 dark:bg-indigo-900/10' : ''}`}>
                                        <td className="p-4 text-sm font-bold text-slate-500 text-center">{index + 1}</td>
                                        <td className="p-4 text-sm font-black text-slate-800 dark:text-slate-200">{record.file_no}</td>
                                        <td className="p-4 text-sm font-bold text-slate-700 dark:text-slate-300">{record.name}</td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{record.station || '-'}</span>
                                                <span className="text-xs font-bold text-slate-500 uppercase">{record.conraiss || '-'}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm font-bold text-slate-600 dark:text-slate-400">{record.year}</td>
                                        <td className="p-4">
                                            {editingId === record.id ? (
                                                <textarea
                                                    className="w-full min-h-[60px] p-2 rounded-lg border border-indigo-300 dark:border-indigo-600 bg-white dark:bg-slate-900 text-sm font-medium text-slate-900 dark:text-slate-100 focus:ring-2 ring-indigo-500/30 outline-none"
                                                    value={editComment}
                                                    onChange={(e) => setEditComment(e.target.value)}
                                                    autoFocus
                                                />
                                            ) : (
                                                <span className="text-sm font-medium text-slate-600 dark:text-slate-400 block max-w-xs" title={record.comment || ''}>
                                                    {record.comment || '-'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex justify-center gap-1.5">
                                                {editingId === record.id ? (
                                                    <>
                                                        <button
                                                            onClick={() => handleSaveEdit(record)}
                                                            disabled={loading}
                                                            className="w-8 h-8 rounded bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40 text-emerald-600 transition-colors flex items-center justify-center disabled:opacity-50"
                                                            title="Save"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">check</span>
                                                        </button>
                                                        <button
                                                            onClick={handleCancelEdit}
                                                            className="w-8 h-8 rounded bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-500 transition-colors flex items-center justify-center"
                                                            title="Cancel"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">close</span>
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button
                                                            onClick={() => handleStartEdit(record)}
                                                            disabled={loading}
                                                            className="w-8 h-8 rounded bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:hover:bg-indigo-900/40 text-indigo-600 transition-colors flex items-center justify-center disabled:opacity-50"
                                                            title="Edit Comment"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteArchive(record.id)}
                                                            disabled={loading}
                                                            className="w-8 h-8 rounded bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-600 transition-colors flex items-center justify-center disabled:opacity-50"
                                                            title="Delete Archive"
                                                        >
                                                            <span className="material-symbols-outlined text-[18px]">delete</span>
                                                        </button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {loading && (
                    <div className="absolute inset-0 bg-white/50 dark:bg-black/20 backdrop-blur-sm flex items-center justify-center rounded-2xl z-10">
                        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-300 border-t-slate-800 dark:border-gray-700 dark:border-t-white"></div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ArchivePage;
