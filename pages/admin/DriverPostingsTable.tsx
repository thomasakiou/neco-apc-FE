import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import * as XLSX from 'xlsx';
import { getAllDriverPostings, bulkDeleteDriverPostings, updateDriverPosting, deleteDriverPosting, bulkCreateDriverPostings } from '../../services/driverPosting';
import { getAllDriverAPC, updateDriverAPC, getAllDriverAPCRecords, assignmentFieldMap } from '../../services/driverApc';
import { getAllAssignments } from '../../services/assignment';
import { archiveDriverFinalPostings } from '../../services/driverFinalPosting';
import { DriverPostingResponse, DriverPostingCreate } from '../../types/driverPosting';
import { DriverAPCRecord } from '../../types/driverApc';
import { Assignment } from '../../types/assignment';
import { useNotification } from '../../context/NotificationContext';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';

interface ReportField {
    id: string;
    label: string;
    accessor: (row: DriverPostingResponse) => any;
    default: boolean;
    pdfWidth?: number;
}

const REPORT_FIELDS: ReportField[] = [
    { id: 'file_no', label: 'FILE NO', accessor: r => r.file_no, default: true, pdfWidth: 25 },
    { id: 'name', label: 'NAME', accessor: r => r.name, default: true, pdfWidth: 50 },
    { id: 'station', label: 'STATION', accessor: r => r.station || '-', default: true, pdfWidth: 35 },
    { id: 'conraiss', label: 'CONR', accessor: r => r.conraiss || '-', default: true, pdfWidth: 20 },
    { id: 'state', label: 'STATE', accessor: r => (r.state || []).join(', ') || '-', default: true, pdfWidth: 30 },
    {
        id: 'code', label: 'CODE', accessor: r => (r.assignment_venue || []).map((v: any) => {
            if (!v || typeof v !== 'string') return '';
            const m = v.match(/\((\d+)\)/);
            return m ? m[1] : '';
        }).join(', ') || '-', default: true, pdfWidth: 20
    },
    { id: 'assignment', label: 'ASSIGNMENT', accessor: r => (r.assignments || []).map((a: any) => typeof a === 'string' ? a : a.name || a.code).join(', ') || '-', default: true, pdfWidth: 45 },
    { id: 'mandate', label: 'MANDATE', accessor: r => (r.mandates || []).map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(', ') || '-', default: true, pdfWidth: 40 },
    {
        id: 'venue', label: 'VENUE', accessor: r => (r.assignment_venue || []).map((v: any) => {
            if (!v || typeof v !== 'string') return v;
            const parts = v.split('|').map(p => p.trim()).filter(Boolean);
            const uniqueParts: string[] = [];
            const seen = new Set<string>();
            for (const p of parts) {
                const lower = p.toLowerCase();
                if (!seen.has(lower)) { seen.add(lower); uniqueParts.push(p); }
            }
            return uniqueParts.join(' | ');
        }).join(', ') || '-', default: true, pdfWidth: 60
    },
    { id: 'count', label: 'NO. OF NIGHTS', accessor: r => r.numb_of__nites || 0, default: false, pdfWidth: 20 },
    { id: 'description', label: 'DESCRIPTION', accessor: r => r.description || '-', default: false, pdfWidth: 50 },
    { id: 'year', label: 'YEAR', accessor: r => r.year || '-', default: false, pdfWidth: 20 },
];

const DriverPostingsTable: React.FC = () => {
    const { success, error, warning } = useNotification();

    const [postings, setPostings] = useState<DriverPostingResponse[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);

    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);

    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterVenue, setFilterVenue] = useState('');

    const debouncedFileNo = useDebounce(searchFileNo, 300);
    const debouncedName = useDebounce(searchName, 300);

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [swapSource, setSwapSource] = useState<DriverPostingResponse | null>(null);
    const [replacementSource, setReplacementSource] = useState<DriverPostingResponse | null>(null);
    const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
    const [replacementPool, setReplacementPool] = useState<DriverAPCRecord[]>([]);
    const [modalSearchFileNo, setModalSearchFileNo] = useState('');
    const [modalSearchName, setModalSearchName] = useState('');
    const [modalSearchConraiss, setModalSearchConraiss] = useState('');

    const [orderedFieldIds, setOrderedFieldIds] = useState<string[]>(REPORT_FIELDS.filter(f => f.default).map(f => f.id));
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [reportTitle1, setReportTitle1] = useState('');
    const [reportTitle2, setReportTitle2] = useState('');
    const [reportTemplate, setReportTemplate] = useState('SSCE');
    const [exportType, setExportType] = useState<'pdf' | 'csv' | 'xlsx' | null>(null);
    const [showHelp, setShowHelp] = useState(false);

    const activeFields = useMemo(() => {
        const fieldMap = new Map(REPORT_FIELDS.map(f => [f.id, f]));
        return orderedFieldIds.map(id => fieldMap.get(id)).filter((f): f is ReportField => !!f);
    }, [orderedFieldIds]);

    const fetchData = useCallback(async (force: boolean = false) => {
        try {
            setLoading(true);
            const [postingsData, assignmentsData] = await Promise.all([
                getAllDriverPostings(force),
                getAllAssignments(force)
            ]);
            setPostings(postingsData || []);
            setAssignments(assignmentsData || []);
        } catch (err) {
            console.error("Failed to fetch data", err);
            error('Failed to load Driver postings.');
        } finally {
            setLoading(false);
        }
    }, [error]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleExecuteSwap = useCallback(async (target: DriverPostingResponse) => {
        if (!swapSource) return;
        try {
            setLoading(true);
            const sourceMandates = swapSource.mandates.map(m => typeof m === 'string' ? m : m.mandate || m.code);
            const targetMandates = target.mandates.map(m => typeof m === 'string' ? m : m.mandate || m.code);
            const sharedMandates = sourceMandates.filter(m => targetMandates.includes(m));
            if (sharedMandates.length === 0) {
                throw new Error(`Staff members must share the same mandate to swap venues.`);
            }
            if (swapSource.assignments.length !== target.assignments.length) {
                throw new Error(`Staff members must have the same number of assignments to swap venues.`);
            }
            await Promise.all([
                updateDriverPosting(swapSource.id, { assignment_venue: [...target.assignment_venue] }),
                updateDriverPosting(target.id, { assignment_venue: [...swapSource.assignment_venue] })
            ]);
            setSwapSource(null);
            await fetchData(true);
            success(`Successfully swapped venues between ${swapSource.name} and ${target.name}.`);
        } catch (err: any) {
            error(err.message || "Failed to execute swap.");
        } finally {
            setLoading(false);
        }
    }, [swapSource, fetchData, success, error]);

    const handleExecuteReplacement = useCallback(async (targetAPC: DriverAPCRecord) => {
        if (!replacementSource) return;
        try {
            setLoading(true);
            const { items: allApc } = await getAllDriverAPC(0, 100000, replacementSource.file_no);
            const sourceAPC = allApc.find(a => a.file_no === replacementSource.file_no);
            if (!sourceAPC) throw new Error("Original staff not found in Driver APC database.");

            const targetCurrentPosted = postings.filter(p => p.file_no === targetAPC.file_no).reduce((sum, p) => sum + (p.assignments?.length || 0), 0);

            const newTargetRecord: DriverPostingCreate = {
                file_no: targetAPC.file_no,
                name: targetAPC.name,
                station: targetAPC.station,
                conraiss: targetAPC.conraiss,
                year: replacementSource.year,
                numb_of__nites: replacementSource.numb_of__nites,
                assignments: replacementSource.assignments,
                mandates: replacementSource.mandates,
                assignment_venue: replacementSource.assignment_venue,
                description: replacementSource.description,
                state: replacementSource.state
            };

            const updatesSource: any = { ...sourceAPC };
            replacementSource.assignments.forEach((a: any) => {
                const code = typeof a === 'string' ? a : a.code;
                const field = assignmentFieldMap[code];
                if (field) updatesSource[field] = 'Returned';
            });
            const { id: sId, created_at: sC, updated_at: sU, created_by: sCB, updated_by: sUB, ...cleanSource } = updatesSource;
            await updateDriverAPC(sourceAPC.id, cleanSource);

            const updatesTarget: any = { ...targetAPC };
            replacementSource.assignments.forEach((a: any, idx: number) => {
                const code = typeof a === 'string' ? a : a.code;
                const field = assignmentFieldMap[code];
                if (field) {
                    updatesTarget[field] = replacementSource.assignment_venue[idx] || '';
                }
            });
            const { id: tId, created_at: tC, updated_at: tU, created_by: tCB, updated_by: tUB, ...cleanTarget } = updatesTarget;
            await updateDriverAPC(targetAPC.id, cleanTarget);

            await Promise.all([
                deleteDriverPosting(replacementSource.id),
                bulkCreateDriverPostings({ items: [newTargetRecord] })
            ]);

            success(`Successfully replaced ${replacementSource.name} with ${targetAPC.name}`);
            setIsReplacementModalOpen(false);
            setReplacementSource(null);
            await fetchData(true);
        } catch (err: any) {
            error(err.message || "Failed to replace staff.");
        } finally {
            setLoading(false);
        }
    }, [replacementSource, postings, fetchData, success, error]);

    const filteredReplacementPool = useMemo(() => {
        return replacementPool.filter(staff => {
            const matchesFileNo = !modalSearchFileNo || staff.file_no.toLowerCase().includes(modalSearchFileNo.toLowerCase());
            const matchesName = !modalSearchName || staff.name.toLowerCase().includes(modalSearchName.toLowerCase());
            const matchesConraiss = !modalSearchConraiss || staff.conraiss?.toLowerCase().includes(modalSearchConraiss.toLowerCase());
            return matchesFileNo && matchesName && matchesConraiss;
        });
    }, [replacementPool, modalSearchFileNo, modalSearchName, modalSearchConraiss]);

    const handleSingleDelete = useCallback(async (record: DriverPostingResponse) => {
        if (!window.confirm(`Are you sure you want to delete the posting for ${record.name}?`)) return;
        try {
            setLoading(true);
            const { items: allApc } = await getAllDriverAPC(0, 100000, record.file_no);
            const apcRecord = allApc.find(a => a.file_no === record.file_no);
            if (apcRecord && record.assignments && record.assignments.length > 0) {
                const updates: any = { ...apcRecord };
                let hasChanges = false;
                record.assignments.forEach((a: any) => {
                    const code = (typeof a === 'string' ? a : a.code || a.name || '').trim().toUpperCase();
                    const field = assignmentFieldMap[code];
                    if (field) { updates[field] = 'Returned'; hasChanges = true; }
                });
                if (hasChanges) {
                    const { id, created_at, updated_at, created_by, updated_by, ...clean } = updates;
                    await updateDriverAPC(apcRecord.id, clean);
                }
            }
            await deleteDriverPosting(record.id);
            success("Posting deleted and staff returned to pool.");
            await fetchData(true);
        } catch (err: any) {
            error(`Failed to delete posting: ${err.message}`);
        } finally {
            setLoading(false);
        }
    }, [fetchData, success, error]);

    const uniqueAssignments = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => { p.assignments?.forEach((a: any) => { const val = typeof a === 'string' ? a : a.name || a.code; if (val) set.add(val); }); });
        return Array.from(set).sort();
    }, [postings]);

    const uniqueVenues = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => { if (Array.isArray(p.assignment_venue)) { p.assignment_venue.forEach((v: any) => { if (v) set.add(typeof v === 'string' ? v : v.name || v); }); } });
        return Array.from(set).sort();
    }, [postings]);

    const filteredPostings = useMemo(() => {
        let result = postings;
        if (debouncedFileNo) result = result.filter(p => p.file_no?.toLowerCase().includes(debouncedFileNo.toLowerCase()));
        if (debouncedName) result = result.filter(p => p.name?.toLowerCase().includes(debouncedName.toLowerCase()));
        if (filterAssignment) result = result.filter(p => p.assignments?.some((a: any) => (typeof a === 'string' ? a : a.name || a.code) === filterAssignment));
        if (filterVenue) result = result.filter(p => p.assignment_venue?.some((v: any) => (typeof v === 'string' ? v : v.name || v) === filterVenue));
        return result;
    }, [postings, debouncedFileNo, debouncedName, filterAssignment, filterVenue]);

    const total = filteredPostings.length;
    const paginatedPostings = useMemo(() => filteredPostings.slice((page - 1) * limit, page * limit), [filteredPostings, page, limit]);

    const handleSelectAll = (checked: boolean) => setSelectedIds(checked ? new Set(filteredPostings.map(p => p.id)) : new Set());
    const handleSelectOne = (id: string, checked: boolean) => setSelectedIds(prev => { const next = new Set(prev); if (checked) next.add(id); else next.delete(id); return next; });

    const handleBulkDelete = async () => {
        if (selectedIds.size === 0) return;
        if (!window.confirm(`Delete ${selectedIds.size} posting(s)?`)) return;
        try {
            setLoading(true);
            await bulkDeleteDriverPostings(Array.from(selectedIds));
            success(`Deleted ${selectedIds.size} postings.`);
            setSelectedIds(new Set());
            fetchData(true);
        } catch (err: any) {
            error(`Failed to delete: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleCommitToFinal = async () => {
        if (postings.length === 0) { warning('No postings to commit.'); return; }
        if (!window.confirm('Are you sure you want to commit these postings to the Final Driver Postings?')) return;
        try {
            setLoading(true);
            await archiveDriverFinalPostings();
            success('Successfully committed postings to Final!');
            await fetchData(true);
        } catch (err: any) {
            error(`Failed to commit to final: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const clearFilters = () => { setSearchFileNo(''); setSearchName(''); setFilterAssignment(''); setFilterVenue(''); setPage(1); };

    const handleCSVExport = () => {
        if (filteredPostings.length === 0) { error('No postings to export.'); return; }
        const exportData = filteredPostings.map(p => {
            const row: any = {};
            activeFields.forEach(f => { row[f.label] = f.accessor(p); });
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const csv = XLSX.utils.sheet_to_csv(ws);
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `Driver_Postings_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        success('CSV Export successful!');
    };

    const handleExcelExport = () => {
        if (filteredPostings.length === 0) { error('No postings to export.'); return; }
        const exportData = filteredPostings.map(p => {
            const row: any = {};
            activeFields.forEach(f => { row[f.label] = f.accessor(p); });
            return row;
        });
        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Postings");
        XLSX.writeFile(wb, `Driver_Postings_${new Date().toISOString().split('T')[0]}.xlsx`);
        success('Excel Export successful!');
    };

    return (
        <div className="flex-1 flex flex-col min-h-full bg-slate-50 dark:bg-[#0b1015] p-4 md:p-8 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
            {/* Header */}
            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm">
                        Driver Postings Table
                    </h1>
                    <p className="mt-1 text-slate-500 dark:text-slate-400 font-medium">
                        View and manage all generated Driver postings.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    {selectedIds.size > 0 && (
                        <button onClick={handleBulkDelete} className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-rose-600 rounded-lg shadow-lg hover:bg-rose-700">
                            <span className="material-symbols-outlined text-lg">delete</span>
                            Delete ({selectedIds.size})
                        </button>
                    )}
                    <button onClick={() => setShowHelp(true)} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm font-bold text-xs" title="Table Guide">
                        <span className="material-symbols-outlined text-lg">help</span> Help
                    </button>
                    <button onClick={() => fetchData(true)} disabled={loading} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-900/20">
                        <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span> Refresh
                    </button>
                    <button onClick={() => setIsConfigOpen(!isConfigOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-lg border font-bold text-xs shadow-sm transition-all ${isConfigOpen ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white dark:bg-[#121b25] border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300'}`}>
                        <span className="material-symbols-outlined text-lg">settings_suggest</span> Customize Columns
                    </button>
                    <button onClick={handleCSVExport} disabled={loading || filteredPostings.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50">
                        <span className="material-symbols-outlined text-lg">csv</span> CSV
                    </button>
                    <button onClick={handleExcelExport} disabled={loading || filteredPostings.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50">
                        <span className="material-symbols-outlined text-lg">table_view</span> Excel
                    </button>
                    <div className="h-6 w-px bg-slate-300 dark:bg-gray-700 mx-1"></div>
                    <button onClick={handleCommitToFinal} disabled={loading || postings.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed" title="Commit these draft postings to the Final Postings record">
                        <span className="material-symbols-outlined text-lg">verified</span> Commit
                    </button>
                </div>
            </div>

            {/* Column Customization Panel */}
            {isConfigOpen && (
                <div className="bg-indigo-50/30 dark:bg-indigo-900/10 p-5 rounded-xl border border-indigo-100 dark:border-indigo-900/30 mb-6 animate-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-indigo-900 dark:text-indigo-300 uppercase tracking-wider flex items-center gap-2">
                            <span className="material-symbols-outlined">view_column</span> Customize Report Columns
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={() => setOrderedFieldIds(REPORT_FIELDS.map(f => f.id))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase">Select All</button>
                            <span className="text-slate-300">|</span>
                            <button onClick={() => setOrderedFieldIds(REPORT_FIELDS.filter(f => f.default).map(f => f.id))} className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 uppercase">Reset to Default</button>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {activeFields.map((field, idx) => (
                            <div key={field.id} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-900/20 shadow-sm">
                                <button onClick={() => { if (orderedFieldIds.length > 1) setOrderedFieldIds(prev => prev.filter(id => id !== field.id)); }} className="w-6 h-6 rounded-lg bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-600 transition-colors" title="Remove Column">
                                    <span className="material-symbols-outlined text-sm font-bold">check</span>
                                </button>
                                <span className="text-xs font-bold text-indigo-900 dark:text-indigo-100">{field.label}</span>
                                <div className="flex gap-0.5 ml-1 border-l border-indigo-200 dark:border-indigo-900/50 pl-1">
                                    <button onClick={() => { if (idx > 0) { const newOrder = [...orderedFieldIds];[newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]]; setOrderedFieldIds(newOrder); } }} disabled={idx === 0} className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center hover:bg-indigo-200 disabled:opacity-30" title="Move Left">
                                        <span className="material-symbols-outlined text-xs">chevron_left</span>
                                    </button>
                                    <button onClick={() => { if (idx < orderedFieldIds.length - 1) { const newOrder = [...orderedFieldIds];[newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]]; setOrderedFieldIds(newOrder); } }} disabled={idx === orderedFieldIds.length - 1} className="w-5 h-5 rounded bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center hover:bg-indigo-200 disabled:opacity-30" title="Move Right">
                                        <span className="material-symbols-outlined text-xs">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                    {REPORT_FIELDS.filter(f => !orderedFieldIds.includes(f.id)).length > 0 && (
                        <div className="mt-4">
                            <label className="text-[10px] font-black text-slate-400 uppercase mb-3 block tracking-widest">Available Columns</label>
                            <div className="flex flex-wrap gap-2">
                                {REPORT_FIELDS.filter(f => !orderedFieldIds.includes(f.id)).map(field => (
                                    <button key={field.id} onClick={() => setOrderedFieldIds(prev => [...prev, field.id])} className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 dark:border-gray-700 dark:bg-gray-800 hover:border-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors">
                                        <span className="w-6 h-6 rounded-lg border-2 border-dashed border-slate-300 dark:border-gray-600 flex items-center justify-center"><span className="material-symbols-outlined text-sm text-slate-400">add</span></span>
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">{field.label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Filters */}
            <div className="bg-white dark:bg-[#121b25] p-4 rounded-xl shadow-sm border border-slate-200 dark:border-gray-800 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">File No</label>
                        <input type="text" placeholder="Search..." className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={searchFileNo} onChange={e => setSearchFileNo(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Name</label>
                        <input type="text" placeholder="Search..." className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={searchName} onChange={e => setSearchName(e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Assignment</label>
                        <select className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)}>
                            <option value="">All Assignments</option>
                            {uniqueAssignments.map(a => <option key={a} value={a}>{a}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Venue</label>
                        <select className="w-full h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] border-slate-200 dark:border-gray-700 text-sm" value={filterVenue} onChange={e => setFilterVenue(e.target.value)}>
                            <option value="">All Venues</option>
                            {uniqueVenues.map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button onClick={clearFilters} className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700">
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4 mb-4">
                <span className="text-sm font-bold text-slate-500">
                    Showing <span className="text-emerald-600">{paginatedPostings.length}</span> of <span className="text-emerald-600">{total}</span> postings
                </span>
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-[#121b25] rounded-xl border border-slate-200 dark:border-gray-800 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-slate-50 dark:bg-[#0f161d] text-xs uppercase font-bold text-slate-500 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-center w-12">
                                    <input type="checkbox" checked={selectedIds.size === filteredPostings.length && filteredPostings.length > 0} onChange={e => handleSelectAll(e.target.checked)} className="w-4 h-4 rounded" />
                                </th>
                                <th className="px-4 py-3">File No</th>
                                <th className="px-4 py-3">Name</th>
                                <th className="px-4 py-3">Station</th>
                                <th className="px-4 py-3">State</th>
                                <th className="px-4 py-3">CON</th>
                                <th className="px-4 py-3">Assignment</th>
                                <th className="px-4 py-3">Venue</th>
                                <th className="px-4 py-3">Mandate</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                            {loading ? (
                                <tr><td colSpan={10} className="p-16 text-center"><div className="flex flex-col items-center gap-2"><span className="material-symbols-outlined text-4xl text-emerald-500 animate-spin">progress_activity</span><span className="text-slate-500">Loading postings...</span></div></td></tr>
                            ) : paginatedPostings.length === 0 ? (
                                <tr><td colSpan={10} className="p-16 text-center text-slate-500">No postings found.</td></tr>
                            ) : (
                                paginatedPostings.map(p => (
                                    <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                                        <td className="p-4 text-center"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={e => handleSelectOne(p.id, e.target.checked)} className="w-4 h-4 rounded" /></td>
                                        <td className="px-4 py-3 font-mono font-bold text-sm">{p.file_no}</td>
                                        <td className="px-4 py-3 font-medium">{p.name}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.station || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{(p.state || []).join(', ') || '-'}</td>
                                        <td className="px-4 py-3"><span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">{p.conraiss || '-'}</span></td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-wrap gap-1">{p.assignments?.map((a: any, idx: number) => (<span key={idx} className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 uppercase">{typeof a === 'string' ? a : a.name || a.code}</span>))}</div>
                                        </td>
                                        <td className="px-4 py-3 text-sm font-bold text-teal-600 dark:text-teal-400">{p.assignment_venue?.join(', ') || '-'}</td>
                                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{p.mandates?.map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(', ') || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-1">
                                                <button onClick={() => { if (swapSource?.id === p.id) setSwapSource(null); else if (swapSource) handleExecuteSwap(p); else { setSwapSource(p); success(`Select another staff member to swap venues with ${p.name}`); } }} className={`p-2 rounded-lg transition-all duration-300 ${swapSource?.id === p.id ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : swapSource ? 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`} title={swapSource?.id === p.id ? "Cancel Swap" : swapSource ? "Swap Venue with this Staff" : "Swap Staff Venue"}>
                                                    <span className="material-symbols-outlined text-lg">{swapSource?.id === p.id ? 'sync' : swapSource ? 'published_with_changes' : 'swap_horiz'}</span>
                                                </button>
                                                <button onClick={async () => { setReplacementSource(p); setLoading(true); try { const allStaff = await getAllDriverAPCRecords(true); const postedCounts = new Map<string, number>(); postings.forEach(post => { const count = (post.assignments || []).length; postedCounts.set(post.file_no, (postedCounts.get(post.file_no) || 0) + count); }); const eligible = allStaff.filter(s => { if (s.file_no === p.file_no) return false; const currentPosted = postedCounts.get(s.file_no) || 0; const max = s.count || 0; const needed = p.assignments.length; return (currentPosted + needed) <= max; }); setReplacementPool(eligible); setIsReplacementModalOpen(true); } catch (e) { error("Failed to load eligible replacement staff."); } finally { setLoading(false); } }} className="p-2 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors" title="Replace Staff">
                                                    <span className="material-symbols-outlined text-lg">person_add</span>
                                                </button>
                                                <button onClick={() => handleSingleDelete(p)} className="p-2 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors" title="Delete Posting">
                                                    <span className="material-symbols-outlined text-lg">delete</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Replacement Modal */}
            {isReplacementModalOpen && replacementSource && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
                        <div className="p-6 border-b border-slate-200 dark:border-gray-700">
                            <h2 className="text-xl font-black">Replace Staff: {replacementSource.name}</h2>
                            <p className="text-sm text-slate-500">Select a replacement from the eligible pool below.</p>
                        </div>
                        <div className="p-4 border-b border-slate-200 dark:border-gray-700 grid grid-cols-3 gap-3">
                            <input type="text" placeholder="File No..." value={modalSearchFileNo} onChange={e => setModalSearchFileNo(e.target.value)} className="h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] text-sm" />
                            <input type="text" placeholder="Name..." value={modalSearchName} onChange={e => setModalSearchName(e.target.value)} className="h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] text-sm" />
                            <input type="text" placeholder="CONRAISS..." value={modalSearchConraiss} onChange={e => setModalSearchConraiss(e.target.value)} className="h-10 px-3 rounded-lg border bg-slate-50 dark:bg-[#0f161d] text-sm" />
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 dark:bg-[#0f161d] sticky top-0">
                                    <tr><th className="p-3 text-xs font-bold">File No</th><th className="p-3 text-xs font-bold">Name</th><th className="p-3 text-xs font-bold">Station</th><th className="p-3 text-xs font-bold">CON</th><th className="p-3 text-xs font-bold">Action</th></tr>
                                </thead>
                                <tbody className="divide-y">
                                    {filteredReplacementPool.length === 0 ? <tr><td colSpan={5} className="p-8 text-center text-slate-500">No eligible staff found.</td></tr> : filteredReplacementPool.map(s => (
                                        <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800">
                                            <td className="p-3 font-mono text-sm">{s.file_no}</td>
                                            <td className="p-3 font-medium">{s.name}</td>
                                            <td className="p-3 text-sm">{s.station}</td>
                                            <td className="p-3 text-sm">{s.conraiss}</td>
                                            <td className="p-3"><button onClick={() => handleExecuteReplacement(s)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700">Select</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="p-4 border-t border-slate-200 dark:border-gray-700 flex justify-end"><button onClick={() => { setIsReplacementModalOpen(false); setReplacementSource(null); }} className="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-bold text-sm hover:bg-slate-300">Cancel</button></div>
                    </div>
                </div>
            )}
            {showHelp && <HelpModal isOpen={showHelp} onClose={() => setShowHelp(false)} content={helpContent.postingReports} />}
        </div>
    );
};

export default DriverPostingsTable;
