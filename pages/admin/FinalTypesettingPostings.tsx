import React, { useEffect, useState, useMemo, useCallback } from 'react';
import * as XLSX from 'xlsx';
import { getAllTypesettingFinalPostings, deleteAllTypesettingFinalPostings, bulkDeleteTypesettingFinalPostings } from '../../services/typesettingFinalPosting';
import { bulkCreateTypesettingPostings } from '../../services/typesettingPosting';
import { getAllAssignments } from '../../services/assignment';
import { TypesettingFinalPostingResponse as FinalPostingResponse } from '@/types/typesettingFinalPosting';
import { Assignment } from '../../types/assignment';
import { useNotification } from '../../context/NotificationContext';
import { useDebounce } from '../../hooks/useDebounce';

const normalizeString = (str: string | null | undefined): string => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const formatVenueName = (venue: string | null | undefined): string => {
    if (!venue) return '-';
    if (venue.includes('|')) {
        const parts = venue.split('|').map(p => p.trim());
        const uniqueParts: string[] = [];
        const seen = new Set<string>();
        for (const p of parts) {
            const lower = p.toLowerCase();
            if (!seen.has(lower)) {
                seen.add(lower);
                uniqueParts.push(p);
            }
        }
        return uniqueParts.join(' | ');
    }
    return venue;
};

const getColorScheme = (text: string, index: number) => {
    const normalized = text.toLowerCase();
    const schemes = [
        { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-800/50', dot: 'bg-emerald-500' },
        { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800/50', dot: 'bg-blue-500' },
        { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400', border: 'border-amber-200 dark:border-amber-800/50', dot: 'bg-amber-500' },
        { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800/50', dot: 'bg-purple-500' },
        { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400', border: 'border-rose-200 dark:border-rose-800/50', dot: 'bg-rose-500' },
        { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-200 dark:border-cyan-800/50', dot: 'bg-cyan-500' },
        { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800/50', dot: 'bg-orange-500' }
    ];

    if (normalized.includes('ssce internal') || normalized.includes('int')) return schemes[0];
    if (normalized.includes('ssce external') || normalized.includes('ext')) return schemes[1];
    if (normalized.includes('trial') || normalized.includes('tt') || normalized.includes('printing')) return schemes[2];
    if (normalized.includes('bece')) return schemes[3];
    if (normalized.includes('ncee')) return schemes[4];

    return schemes[index % schemes.length];
};

interface CollapsibleRowProps {
    record: FinalPostingResponse;
    selected: boolean;
    onSelect: (checked: boolean) => void;
    assignmentMap: Map<string, string>;
}

const CollapsibleRow = React.memo<CollapsibleRowProps>(({ record, selected, onSelect, assignmentMap }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const schemes = useMemo(() => {
        return (record.assignments || []).map((a, idx) => {
            const val = typeof a === 'string' ? a : (a as any).name || (a as any).code;
            const name = assignmentMap.get(val) || val;
            return getColorScheme(name, idx);
        });
    }, [record.assignments, assignmentMap]);

    return (
        <React.Fragment>
            <tr className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                <td className="p-4 text-center">
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => onSelect(e.target.checked)}
                        className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-teal-600 focus:ring-teal-500 w-4 h-4 cursor-pointer"
                    />
                </td>
                <td className="p-4 text-center">
                    <button
                        onClick={() => setIsExpanded(!isExpanded)}
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <span className={`material-symbols-outlined transition-transform duration-200 text-2xl ${isExpanded ? 'rotate-90' : ''}`}>
                            chevron_right
                        </span>
                    </button>
                </td>
                <td className="px-4 py-4 font-mono text-base font-bold text-slate-700 dark:text-slate-300">{record.file_no}</td>
                <td className="px-4 py-4">
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{record.name}</span>
                </td>
                <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300 text-sm">{record.station || '-'}</td>
                <td className="px-4 py-4">
                    <span className="inline-flex px-2.5 py-1 rounded-md text-sm font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase">
                        {record.conraiss || '-'}
                    </span>
                </td>
                <td className="px-4 py-4">
                    <div className="flex flex-col gap-2.5">
                        {record.assignments?.map((assignment, idx) => {
                            const val = typeof assignment === 'string' ? assignment : (assignment as any).name || (assignment as any).code;
                            const name = assignmentMap.get(val) || val;
                            const scheme = schemes[idx] || getColorScheme(name, idx);
                            return (
                                <div key={idx}>
                                    <span className={`inline-flex px-3 py-1.5 rounded-lg text-xs font-black ${scheme.bg} ${scheme.text} border ${scheme.border} uppercase whitespace-nowrap shadow-sm`}>
                                        {name}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </td>
                <td className="px-4 py-4">
                    <div className="flex flex-col gap-2.5">
                        {record.mandates?.map((mandate, idx) => {
                            const name = typeof mandate === 'string' ? mandate : (mandate as any).mandate || (mandate as any).code;
                            const scheme = schemes[idx] || getColorScheme(name, idx);
                            return (
                                <div key={idx} className={`text-xs font-black ${scheme.text} flex items-start gap-2.5 max-w-[220px] leading-relaxed py-0.5`} title={name}>
                                    <span className={`w-2 h-2 rounded-full ${scheme.dot} flex-shrink-0 shadow-sm shadow-current/30 mt-1`}></span>
                                    <span className="break-words">{name}</span>
                                </div>
                            );
                        })}
                    </div>
                </td>
                <td className="px-4 py-4">
                    <div className="flex flex-col gap-2.5">
                        {record.assignment_venue?.map((venue, idx) => {
                            const venueStr = typeof venue === 'string' ? venue : (venue as any)?.name || (venue as any)?.code || '';
                            const formatted = formatVenueName(venueStr);
                            const scheme = schemes[idx] || getColorScheme(formatted, idx);
                            return (
                                <div key={idx} className={`text-xs font-black ${scheme.text} border-l-[3px] ${scheme.border} pl-3 max-w-[250px] leading-relaxed py-0.5`} title={formatted}>
                                    {formatted}
                                </div>
                            );
                        })}
                    </div>
                </td>
                <td className="px-4 py-4">
                    <div className="flex flex-col gap-2.5">
                        {record.assignment_venue?.map((_, idx) => {
                            const stateValue = record.state;
                            const s = Array.isArray(stateValue) ? (stateValue[idx] || stateValue[0] || '-') : (stateValue || '-');
                            const scheme = schemes[idx] || getColorScheme(s, idx);
                            return (
                                <div key={idx}>
                                    <span className={`inline-flex px-3 py-1 rounded-md text-xs font-black ${scheme.bg} ${scheme.text} border ${scheme.border} uppercase shadow-sm`}>
                                        {s}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                    <td colSpan={10} className="p-0">
                        <div className="px-16 py-8 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-sm">
                                <div>
                                    <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">Record Stats</span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Year:</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{record.year}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Numb of Nites:</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{record.numb_of__nites}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="col-span-2">
                                    <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">Description</span>
                                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 italic p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 min-h-[40px] shadow-sm">
                                        {record.description || 'No description provided.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
});

const FinalTypesettingPostings: React.FC = () => {
    const [postings, setPostings] = useState<FinalPostingResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState(false);
    const { success, error } = useNotification();

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50);

    // Filter Options
    const [assignments, setAssignments] = useState<Assignment[]>([]);

    // Search States
    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [searchStation, setSearchStation] = useState('');

    // Dropdown Filter States
    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterMandate, setFilterMandate] = useState('');
    const [filterVenue, setFilterVenue] = useState('');
    const [filterYear, setFilterYear] = useState('');

    // Debounce
    const debouncedFileNo = useDebounce(searchFileNo, 300);
    const debouncedName = useDebounce(searchName, 300);
    const debouncedStation = useDebounce(searchStation, 300);

    // Selection
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [deleting, setDeleting] = useState(false);
    const [deletionProgress, setDeletionProgress] = useState<{ current: number; total: number } | null>(null);

    const renderLoadingOverlay = () => {
        if (!loading && !deleting) return null;
        return (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center animate-fadeIn">
                <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
                    <div className="relative">
                        <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <span className="material-symbols-outlined text-teal-500 animate-pulse">
                                {deletionProgress ? 'delete_sweep' : 'sync'}
                            </span>
                        </div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
                            {deletionProgress ? 'Processing Deletion' : 'Loading Data'}
                        </h3>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                            {deletionProgress
                                ? `Returning staff to pool: ${deletionProgress.current} / ${deletionProgress.total}`
                                : 'Please wait while we sync with the server...'}
                        </p>
                    </div>
                    {deletionProgress && (
                        <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                            <div className="bg-teal-500 h-full transition-all duration-300" style={{ width: `${(deletionProgress.current / deletionProgress.total) * 100}%` }}></div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const groupPostings = (items: FinalPostingResponse[]): (FinalPostingResponse & { _original?: FinalPostingResponse[] })[] => {
        const groups = new Map<string, FinalPostingResponse & { _original?: FinalPostingResponse[] }>();
        items.forEach(item => {
            const key = normalizeString(item.file_no);
            if (!groups.has(key)) {
                groups.set(key, { ...item, _original: [{ ...item }] });
            } else {
                const existing = groups.get(key)!;
                if (!existing._original) existing._original = [];
                existing._original.push({ ...item });
                if (item.assignments) existing.assignments = [...(existing.assignments || []), ...item.assignments];
                if (item.mandates) existing.mandates = [...(existing.mandates || []), ...item.mandates];
                if (item.assignment_venue) existing.assignment_venue = [...(existing.assignment_venue || []), ...item.assignment_venue];
                if (item.description && existing.description !== item.description) {
                    existing.description = Array.from(new Set([existing.description, item.description].filter(Boolean))).join(' | ');
                }
            }
        });
        return Array.from(groups.values());
    };

    const fetchInitialData = useCallback(async () => {
        try {
            setLoading(true);
            const [finalPostingsData, assignmentsData] = await Promise.all([
                getAllTypesettingFinalPostings(),
                getAllAssignments()
            ]);
            const rawItems = finalPostingsData.items || [];
            const groupedDisplayItems = groupPostings(rawItems);
            setPostings(groupedDisplayItems);
            setAssignments(assignmentsData);
        } catch (err) {
            console.error("Failed to fetch final postings", err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    const assignmentMap = useMemo(() => {
        const map = new Map<string, string>();
        assignments.forEach(a => {
            if (a.code) map.set(a.code, a.name);
            if (a.name) map.set(a.name, a.name);
        });
        return map;
    }, [assignments]);

    const uniqueAssignments = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => {
            p.assignments?.forEach(a => {
                const val = typeof a === 'string' ? a : (a as any).name || (a as any).code;
                const name = assignmentMap.get(val) || val;
                if (name) set.add(name);
            });
        });
        return Array.from(set).sort();
    }, [postings, assignmentMap]);

    const uniqueMandates = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => p.mandates?.forEach(m => set.add(typeof m === 'string' ? m : (m as any).mandate)));
        return Array.from(set).sort();
    }, [postings]);

    const uniqueYears = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => p.year && set.add(p.year));
        return Array.from(set).sort();
    }, [postings]);

    const matchesFilter = useCallback((p: FinalPostingResponse) => {
        if (debouncedFileNo && !String(p.file_no || '').toLowerCase().includes(debouncedFileNo.toLowerCase())) return false;
        if (debouncedName && !String(p.name || '').toLowerCase().includes(debouncedName.toLowerCase())) return false;
        if (debouncedStation && !p.station?.toLowerCase().includes(debouncedStation.toLowerCase())) return false;
        if (filterAssignment) {
            const lowerFilter = filterAssignment.toLowerCase();
            const match = p.assignments?.some(a => {
                const val = typeof a === 'string' ? a : (a as any).name || (a as any).code;
                return (assignmentMap.get(val) || val)?.toLowerCase().includes(lowerFilter);
            });
            if (!match) return false;
        }
        if (filterMandate) {
            const match = p.mandates?.some(m => (typeof m === 'string' ? m : (m as any).mandate) === filterMandate);
            if (!match) return false;
        }
        if (filterVenue) {
            const match = p.assignment_venue?.some(v => (typeof v === 'string' ? v : (v as any).name) === filterVenue);
            if (!match) return false;
        }
        if (filterYear && p.year !== filterYear) return false;

        // Handle state filtering
        if (p.state) {
            const stateValues = Array.isArray(p.state) ? p.state : [p.state];
            // If you need specific state filtering logic, add it here.
            // For now just returning true if state exists.
        }

        return true;
    }, [debouncedFileNo, debouncedName, debouncedStation, filterAssignment, filterMandate, filterVenue, filterYear, assignmentMap]);

    const filteredPostings = useMemo(() => postings.filter(matchesFilter), [postings, matchesFilter]);
    const paginatedPostings = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredPostings.slice(start, start + limit);
    }, [filteredPostings, page, limit]);

    const handleSelectAll = (checked: boolean) => setSelectedIds(checked ? new Set(filteredPostings.map(p => p.id)) : new Set());
    const handleSelectOne = (id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id); else next.delete(id);
            return next;
        });
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;
        const recordsToProcess: FinalPostingResponse[] = [];
        postings.filter(p => selectedIds.has(p.id)).forEach(group => {
            recordsToProcess.push(...((group as any)._original || [group]).filter(matchesFilter));
        });
        if (!window.confirm(`Delete ${recordsToProcess.length} record(s)?`)) return;
        try {
            setDeleting(true);
            setDeletionProgress({ current: 0, total: recordsToProcess.length });
            const idsToDelete = recordsToProcess.map(r => r.id);
            await bulkDeleteTypesettingFinalPostings(idsToDelete);
            success("Deleted successfully.");
            setSelectedIds(new Set());
            fetchInitialData();
        } catch (err: any) {
            error(err.message || "Failed to delete.");
        } finally {
            setDeleting(false);
            setDeletionProgress(null);
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm("CRITICAL: Delete ALL records?")) return;
        try {
            setDeleting(true);
            await deleteAllTypesettingFinalPostings();
            success("All records deleted.");
            fetchInitialData();
        } catch (err: any) {
            error(err.message || "Failed to delete all.");
        } finally {
            setDeleting(false);
        }
    };

    const handleRestore = async () => {
        if (selectedIds.size === 0) return;
        const recordsToProcess: FinalPostingResponse[] = [];
        postings.filter(p => selectedIds.has(p.id)).forEach(group => {
            recordsToProcess.push(...((group as any)._original || [group]).filter(matchesFilter));
        });
        if (!window.confirm(`Restore ${recordsToProcess.length} records to staging?`)) return;
        try {
            setRestoring(true);
            const items = recordsToProcess.map(({ id, created_at, updated_at, created_by, updated_by, ...rest }: any) => rest);
            await bulkCreateTypesettingPostings({ items });
            await bulkDeleteTypesettingFinalPostings(recordsToProcess.map(r => r.id));
            success("Restored to staging.");
            setSelectedIds(new Set());
            fetchInitialData();
        } catch (err: any) {
            error(err.message || "Restore failed.");
        } finally {
            setRestoring(false);
        }
    };

    const handleExportExcel = () => {
        const data = filteredPostings.map(p => ({
            'File No': p.file_no,
            'Name': p.name,
            'Station': p.station,
            'CONRAISS': p.conraiss,
            'Assignments': p.assignments?.map(val => assignmentMap.get(val) || val).join(', '),
            'Mandates': p.mandates?.join(', '),
            'Venues': p.assignment_venue?.join(', '),
            'Year': p.year
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Final Postings");
        XLSX.writeFile(wb, "Final_Typesetting_Postings.xlsx");
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 relative">
            {renderLoadingOverlay()}
            <div className="flex flex-col gap-8">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-500 to-cyan-600 dark:from-emerald-400 dark:via-teal-400 dark:to-cyan-400 drop-shadow-sm tracking-tight mb-2">Final Typesetting Posting</h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium">Archived view of consolidated typesetting postings.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button onClick={handleRestore} disabled={restoring || selectedIds.size === 0} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl shadow-lg font-bold text-sm hover:bg-indigo-700 disabled:opacity-50">
                            <span className="material-symbols-outlined text-[20px]">settings_backup_restore</span> Restore to Staging
                        </button>
                        <button onClick={handleExportExcel} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl shadow-lg font-bold text-sm hover:bg-emerald-700">
                            <span className="material-symbols-outlined text-[20px]">download</span> Export Excel
                        </button>
                        <button onClick={handleDeleteSelected} disabled={deleting || selectedIds.size === 0} className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl shadow-lg transition-all font-bold text-sm ${selectedIds.size > 0 ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'}`}>
                            <span className="material-symbols-outlined text-[20px]">delete</span> Delete
                        </button>
                        <button onClick={handleDeleteAll} disabled={deleting || postings.length === 0} className="flex items-center gap-2 px-4 py-2 text-white bg-rose-700 hover:bg-rose-800 rounded-xl shadow-lg font-bold text-sm">
                            <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] p-5 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-xl flex flex-col gap-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="relative"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">search</span><input placeholder="File No..." value={searchFileNo} onChange={e => setSearchFileNo(e.target.value)} className="w-full pl-10 h-10 rounded-lg bg-slate-50 dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-sm" /></div>
                        <div className="relative"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">person_search</span><input placeholder="Name..." value={searchName} onChange={e => setSearchName(e.target.value)} className="w-full pl-10 h-10 rounded-lg bg-slate-50 dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-sm" /></div>
                        <div className="relative"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">location_on</span><input placeholder="Station..." value={searchStation} onChange={e => setSearchStation(e.target.value)} className="w-full pl-10 h-10 rounded-lg bg-slate-50 dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-sm" /></div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <select value={filterAssignment} onChange={e => setFilterAssignment(e.target.value)} className="h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-slate-300"><option value="">All Assignments</option>{uniqueAssignments.map(a => <option key={a} value={a}>{a}</option>)}</select>
                        <select value={filterMandate} onChange={e => setFilterMandate(e.target.value)} className="h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-slate-300"><option value="">All Mandates</option>{uniqueMandates.map(m => <option key={m} value={m}>{m}</option>)}</select>
                        <select value={filterYear} onChange={e => setFilterYear(e.target.value)} className="h-9 px-3 rounded-lg bg-slate-50 dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-xs font-bold text-slate-600 dark:text-slate-300"><option value="">All Years</option>{uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}</select>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] rounded-3xl border border-slate-200 dark:border-gray-800 shadow-2xl overflow-hidden">
                    <div className="overflow-x-auto text-sm">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-[#0f161d] text-xs uppercase font-black text-slate-400">
                                    <th className="p-4 text-center w-12"><input type="checkbox" onChange={e => handleSelectAll(e.target.checked)} checked={selectedIds.size === filteredPostings.length && filteredPostings.length > 0} className="rounded border-slate-300 text-teal-600 w-4 h-4 cursor-pointer" /></th>
                                    <th className="p-4 text-center w-16">Details</th>
                                    <th className="p-4 w-28">File No</th>
                                    <th className="p-4">Full Name</th>
                                    <th className="p-4">Station</th>
                                    <th className="p-4">CONRAISS</th>
                                    <th className="p-4">Assignments</th>
                                    <th className="p-4">Mandate(s)</th>
                                    <th className="p-4">Venue(s)</th>
                                    <th className="p-4">State(s)</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                {paginatedPostings.length > 0 ? (
                                    paginatedPostings.map(p => <CollapsibleRow key={p.id} record={p} selected={selectedIds.has(p.id)} onSelect={chk => handleSelectOne(p.id, chk)} assignmentMap={assignmentMap} />)
                                ) : (
                                    <tr><td colSpan={10} className="p-20 text-center text-slate-400 font-bold uppercase tracking-widest bg-slate-50/50 dark:bg-[#0f161d]/50 italic">No matching records found</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-200 dark:border-gray-800 shadow-lg">
                    <div className="text-sm font-bold text-slate-500 uppercase tracking-wider">Showing <span className="text-indigo-600 dark:text-indigo-400">{paginatedPostings.length}</span> of {filteredPostings.length} records</div>
                    <div className="flex items-center gap-3">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-bold">
                            <span className="material-symbols-outlined">chevron_left</span>
                        </button>
                        <div className="px-6 h-10 flex items-center justify-center bg-slate-50 dark:bg-[#0b1015] rounded-xl border border-slate-200 dark:border-gray-700 text-sm font-black text-slate-700 dark:text-slate-300">Page {page} of {Math.ceil(filteredPostings.length / limit) || 1}</div>
                        <button onClick={() => setPage(p => p + 1)} disabled={page >= Math.ceil(filteredPostings.length / limit)} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-bold">
                            <span className="material-symbols-outlined">chevron_right</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalTypesettingPostings;
