import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createAPC, updateAPC, getAllAPCRecords, getAssignmentLimit, getAssignmentUsage } from '../../services/apc';
import { getAllStaff } from '../../services/staff';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { assignmentFieldMap } from '../../services/personalizedPost';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { Staff } from '../../types/staff';
import AlertModal from '../../components/AlertModal';

const CustomAPC: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [mandates, setMandates] = useState<Mandate[]>([]);
    const [selectedAssignment, setSelectedAssignment] = useState('');
    const [selectedMandate, setSelectedMandate] = useState('');
    const [availableMandates, setAvailableMandates] = useState<Mandate[]>([]);

    // Staged staff now includes optional CSV-provided mandate
    const [stagedStaff, setStagedStaff] = useState<(Staff & { csvMandate?: string })[]>([]);
    const [allStaff, setAllStaff] = useState<Staff[]>([]);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({ isOpen: false, title: '', type: 'info' });

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [asgn, mand, staff] = await Promise.all([
                    getAllAssignments(true),
                    getAllMandates(),
                    getAllStaff(true)
                ]);
                setAssignments(asgn);
                setMandates(mand);
                setAllStaff(staff);
            } catch (e) {
                console.error("Failed to load initial data", e);
            }
        };
        loadInitialData();
    }, []);

    useEffect(() => {
        if (selectedAssignment) {
            const assignment = assignments.find(a => a.code === selectedAssignment);
            if (assignment) {
                const filtered = mandates.filter(m => assignment.mandates?.includes(m.code));
                setAvailableMandates(filtered);
            }
        } else {
            setAvailableMandates([]);
        }
    }, [selectedAssignment, assignments, mandates]);

    const handleDownloadTemplate = () => {
        const headers = ['file_no', 'mandate'];
        const rows = [['4063', 'Supervisor'], ['3157', '']];
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", "apc_custom_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const text = await file.text();
            const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
            if (lines.length < 2) throw new Error('CSV is empty or missing headers');

            const headers = lines[0].toLowerCase().split(',').map(h => h.trim());
            const idxFileNo = headers.findIndex(h => h.includes('file') || h.includes('no'));
            // Optional mandate column
            const idxMandate = headers.findIndex(h => h.includes('mandate') || h.includes('position') || h.includes('rank'));

            if (idxFileNo === -1) {
                throw new Error('CSV must contain a "file_no" column');
            }

            const rawData = lines.slice(1).map(line => {
                const cols = line.split(',').map(c => c.trim());
                return {
                    fileno: cols[idxFileNo],
                    mandate: idxMandate !== -1 ? cols[idxMandate] : undefined
                };
            }).filter(d => d.fileno);

            const staffMap = new Map<string, Staff>(allStaff.map(s => [s.fileno, s]));
            const matches: (Staff & { csvMandate?: string })[] = [];
            const missing: string[] = [];

            rawData.forEach(row => {
                const staff = staffMap.get(row.fileno);
                if (staff) {
                    matches.push({ ...staff, csvMandate: row.mandate });
                } else {
                    missing.push(row.fileno);
                }
            });

            setStagedStaff(matches);
            setCurrentPage(1);

            if (missing.length > 0) {
                setAlertModal({
                    isOpen: true,
                    title: 'Upload Summary',
                    message: `Matched ${matches.length} staff. Could not find ${missing.length} file numbers in the system: ${missing.join(', ')}`,
                    type: 'warning'
                });
            } else if (matches.length > 0) {
                setAlertModal({
                    isOpen: true,
                    title: 'CSV Parsed',
                    message: `Successfully staged ${matches.length} staff for perusal.`,
                    type: 'info'
                });
            }
        } catch (error: any) {
            setAlertModal({
                isOpen: true,
                title: 'Process Failed',
                message: error.message || 'An error occurred while processing the CSV file.',
                type: 'error'
            });
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleCommit = async () => {
        if (!selectedAssignment || stagedStaff.length === 0) return;
        setLoading(true);
        try {
            const allAPC = await getAllAPCRecords(false, true);
            const apcMap = new Map(allAPC.map(r => [r.file_no, r]));
            const fieldName = assignmentFieldMap[selectedAssignment];

            if (!fieldName) throw new Error(`Invalid assignment code: ${selectedAssignment}`);

            // If a global mandate is selected, use it (resolved to name), otherwise use per-row CSV mandate
            const globalMandateName = selectedMandate
                ? mandates.find(m => m.code === selectedMandate)?.mandate || selectedMandate
                : null;

            let successCount = 0;
            const exhaustedStaff: string[] = [];

            for (const staff of stagedStaff) {
                const existing = apcMap.get(staff.fileno);
                const limit = getAssignmentLimit(staff.conr);
                const usage = existing ? getAssignmentUsage(existing) : 0;

                // Skip if usage already at or exceeds limit
                if (usage >= limit) {
                    exhaustedStaff.push(`${staff.full_name} (${staff.fileno})`);
                    continue;
                }

                let val = 'Post'; // Default

                if (globalMandateName) {
                    val = globalMandateName;
                } else if (staff.csvMandate) {
                    // Try to resolve CSV mandate code to name, or use as is if it looks like a name
                    const raw = staff.csvMandate.trim();
                    if (raw) {
                        const match = mandates.find(m => m.code === raw || m.mandate.toLowerCase() === raw.toLowerCase());
                        val = match ? match.mandate : raw;
                    }
                }

                if (existing) {
                    const { id, created_at, updated_at, created_by, updated_by, ...clean } = existing;
                    await updateAPC(id, { ...clean, [fieldName]: val, count: limit });
                } else {
                    const newRecord = {
                        file_no: staff.fileno,
                        name: staff.full_name,
                        conraiss: staff.conr,
                        station: staff.station,
                        qualification: staff.qualification,
                        sex: staff.sex,
                        count: limit,
                        active: true,
                        year: new Date().getFullYear().toString(),
                        [fieldName]: val
                    };
                    await createAPC(newRecord as any);
                }
                successCount++;
            }

            let message = `Successfully updated manual APC for ${successCount} staff members.`;
            if (exhaustedStaff.length > 0) {
                message += `\n\n⚠️ Skipped ${exhaustedStaff.length} staff (assignment count exhausted):\n${exhaustedStaff.slice(0, 5).join('\n')}${exhaustedStaff.length > 5 ? `\n...and ${exhaustedStaff.length - 5} more.` : ''}`;
            }

            setAlertModal({
                isOpen: true,
                title: exhaustedStaff.length > 0 ? 'Commit Complete (With Warnings)' : 'Commit Complete',
                message,
                type: exhaustedStaff.length > 0 ? 'warning' : 'success'
            });
        } catch (error: any) {
            setAlertModal({
                isOpen: true,
                title: 'Commit Failed',
                message: error.message || 'An error occurred during final commitment.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const paginatedStaff = stagedStaff.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    const totalPages = Math.ceil(stagedStaff.length / rowsPerPage);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-4 md:p-8 gap-8 overflow-y-auto">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate('/admin/apc/list')}
                    className="w-10 h-10 flex items-center justify-center rounded-xl bg-white dark:bg-[#1a2530] border border-slate-200 dark:border-gray-800 text-slate-600 dark:text-slate-400 hover:text-primary transition-all shadow-sm"
                >
                    <span className="material-symbols-outlined">arrow_back</span>
                </button>
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Custom APC Generation
                    </h1>
                    <p className="text-sm md:text-base lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Upload CSV for Direct Assignment Mapping</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-8">
                    <div className="flex items-center gap-4 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-2xl border border-emerald-100 dark:border-emerald-800/50">
                        <div className="w-12 h-12 rounded-full bg-emerald-600 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-2xl">settings</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-emerald-900 dark:text-emerald-200">Assignment Parameters</h3>
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">Select the target duty for staged staff</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Target Assignment</label>
                            <select
                                value={selectedAssignment}
                                onChange={(e) => setSelectedAssignment(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                            >
                                <option value="" className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">Select Assignment</option>
                                {assignments.map(a => <option key={a.id} value={a.code} className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">{a.name}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col gap-2">
                            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mandate (Optional)</label>
                            <select
                                value={selectedMandate}
                                onChange={(e) => setSelectedMandate(e.target.value)}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] font-bold text-sm text-slate-700 dark:text-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all cursor-pointer"
                            >
                                <option value="" className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">No Mandate (Full Post)</option>
                                {availableMandates.map(m => <option key={m.id} value={m.code} className="bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200">{m.mandate}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 p-4 bg-blue-50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800/50">
                        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white">
                            <span className="material-symbols-outlined text-2xl">csv</span>
                        </div>
                        <div>
                            <h3 className="font-bold text-blue-900 dark:text-blue-200">Data Upload</h3>
                            <p className="text-xs text-blue-600 dark:text-blue-400">Select file to stage staff</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-start gap-3">
                            <span className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500">1</span>
                            <div className="flex-1">
                                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">file_no Only</p>
                                <p className="text-xs text-slate-500">Your CSV mainly needs "file_no". Add "mandate" column for specific overrides.</p>
                            </div>
                        </div>

                        <button
                            onClick={handleDownloadTemplate}
                            className="mt-4 flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 transition-colors uppercase tracking-widest"
                        >
                            <span className="material-symbols-outlined text-sm">download</span>
                            Download Simplified Template
                        </button>
                    </div>

                    <div className="mt-auto pt-6 border-t border-slate-100 dark:border-gray-800">
                        <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={loading || !selectedAssignment}
                            className="w-full h-14 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold rounded-2xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-3 active:scale-95"
                        >
                            {loading ? <span className="material-symbols-outlined animate-spin">progress_activity</span> : <span className="material-symbols-outlined">cloud_upload</span>}
                            {loading ? 'Processing...' : 'Stage Staff from CSV'}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col gap-8">
                    <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col h-full min-h-[400px]">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-black text-slate-800 dark:text-slate-200 uppercase italic">Staging Area</h3>
                                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Verify staff details before committing</p>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black">
                                {stagedStaff.length} STAGED
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[500px] border border-slate-100 dark:border-gray-800 rounded-2xl">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-[#0b1015] sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">File No</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Name</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Mandate</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Station</th>
                                        <th className="px-4 py-3 text-[10px] font-black text-slate-400 uppercase">Conr</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                    {paginatedStaff.length === 0 ? (
                                        <tr>
                                            <td colSpan={4} className="px-4 py-20 text-center text-slate-400 font-bold italic text-sm">
                                                No staff staged. Upload a CSV to begin.
                                            </td>
                                        </tr>
                                    ) : (
                                        stagedStaff.map((s, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors">
                                                <td className="px-4 py-3 text-sm font-black text-primary">{s.fileno}</td>
                                                <td className="px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-300">{s.full_name}</td>
                                                <td className="px-4 py-3 text-xs text-slate-500 font-medium">{s.csvMandate || selectedMandate || '-'}</td>
                                                <td className="px-4 py-3 text-xs text-slate-500 font-medium">{s.station}</td>
                                                <td className="px-4 py-3 text-xs text-slate-500 font-medium">{s.conr}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {stagedStaff.length > 0 && (
                            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 py-4 border-t border-slate-100 dark:border-gray-800">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Rows:</span>
                                        <select
                                            value={rowsPerPage}
                                            onChange={(e) => {
                                                setRowsPerPage(Number(e.target.value));
                                                setCurrentPage(1);
                                            }}
                                            className="h-8 px-2 rounded-lg border border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0b1015] text-[10px] font-bold text-slate-700 dark:text-slate-200"
                                        >
                                            {[10, 20, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                                        </select>
                                    </div>
                                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                                        Showing {(currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, stagedStaff.length)} of {stagedStaff.length}
                                    </span>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                        disabled={currentPage === 1}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0b1015] text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                    </button>
                                    <div className="flex items-center gap-1">
                                        <span className="px-3 py-1 rounded-lg bg-primary text-white text-[10px] font-black">
                                            {currentPage}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-400">/</span>
                                        <span className="text-[10px] font-black text-slate-500">{totalPages}</span>
                                    </div>
                                    <button
                                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                        disabled={currentPage === totalPages}
                                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0b1015] text-slate-500 disabled:opacity-30 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="mt-8">
                            <button
                                onClick={handleCommit}
                                disabled={loading || stagedStaff.length === 0 || !selectedAssignment}
                                className="w-full h-14 bg-primary hover:bg-primary-dark disabled:bg-slate-100 dark:disabled:bg-gray-800 disabled:text-slate-400 text-white font-black rounded-2xl shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
                            >
                                <span className="material-symbols-outlined">check_circle</span>
                                COMMIT TO APC TABLE
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <AlertModal
                {...alertModal}
                onClose={() => {
                    setAlertModal(prev => ({ ...prev, isOpen: false }));
                    if (alertModal.type === 'success') navigate('/admin/apc/list');
                }}
            />
        </div>
    );
};

export default CustomAPC;
