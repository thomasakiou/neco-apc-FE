import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import * as XLSX from 'xlsx';
import { getAllFinalPostings, deleteAllFinalPostings, bulkDeleteFinalPostings } from '../../services/finalPosting';
import { bulkCreatePostings } from '../../services/posting';
import { getAllAssignments } from '../../services/assignment';
import { getAllStates } from '../../services/state';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { FinalPostingResponse } from '../../types/finalPosting';
import { Assignment } from '../../types/assignment';
import { MarkingVenue } from '../../types/markingVenue';
import { useNotification } from '../../context/NotificationContext';
import SearchableSelect from '../../components/SearchableSelect';
import { getAllAPCRecords, updateAPC } from '../../services/apc';
import { assignmentFieldMap } from '../../services/personalizedPost';

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

interface CollapsibleRowProps {
    record: FinalPostingResponse;
    selected: boolean;
    onSelect: (checked: boolean) => void;
    assignmentMap: Map<string, string>;
}

const getColorScheme = (text: string, index: number) => {
    const normalized = text.toLowerCase();
    const schemes = [
        { // 0: Emerald (Green)
            bg: 'bg-emerald-50 dark:bg-emerald-900/20',
            text: 'text-emerald-700 dark:text-emerald-400',
            border: 'border-emerald-200 dark:border-emerald-800/50',
            dot: 'bg-emerald-500'
        },
        { // 1: Blue
            bg: 'bg-blue-50 dark:bg-blue-900/20',
            text: 'text-blue-700 dark:text-blue-400',
            border: 'border-blue-200 dark:border-blue-800/50',
            dot: 'bg-blue-500'
        },
        { // 2: Amber
            bg: 'bg-amber-50 dark:bg-amber-900/20',
            text: 'text-amber-700 dark:text-amber-400',
            border: 'border-amber-200 dark:border-amber-800/50',
            dot: 'bg-amber-500'
        },
        { // 3: Purple
            bg: 'bg-purple-50 dark:bg-purple-900/20',
            text: 'text-purple-700 dark:text-purple-400',
            border: 'border-purple-200 dark:border-purple-800/50',
            dot: 'bg-purple-500'
        },
        { // 4: Rose
            bg: 'bg-rose-50 dark:bg-rose-900/20',
            text: 'text-rose-700 dark:text-rose-400',
            border: 'border-rose-200 dark:border-rose-800/50',
            dot: 'bg-rose-500'
        },
        { // 5: Cyan
            bg: 'bg-cyan-50 dark:bg-cyan-900/20',
            text: 'text-cyan-700 dark:text-cyan-400',
            border: 'border-cyan-200 dark:border-cyan-800/50',
            dot: 'bg-cyan-500'
        },
        { // 6: Orange
            bg: 'bg-orange-50 dark:bg-orange-900/20',
            text: 'text-orange-700 dark:text-orange-400',
            border: 'border-orange-200 dark:border-orange-800/50',
            dot: 'bg-orange-500'
        }
    ];

    // Priority Assignments
    if (normalized.includes('ssce internal') || normalized.includes('int')) return schemes[0];
    if (normalized.includes('ssce external') || normalized.includes('ext')) return schemes[1];
    if (normalized.includes('trial') || normalized.includes('tt')) return schemes[2];
    if (normalized.includes('bece')) return schemes[3];
    if (normalized.includes('ncee')) return schemes[4];

    return schemes[index % schemes.length];
};

const CollapsibleRow = React.memo<CollapsibleRowProps>(({ record, selected, onSelect, assignmentMap }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    // Get color schemes for all assignments once to reuse across columns
    const schemes = useMemo(() => {
        return (record.assignments || []).map((a, idx) => {
            const val = typeof a === 'string' ? a : a.name || a.code;
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
                    <div className="flex flex-col gap-0.5">
                        <span className="font-bold text-slate-900 dark:text-slate-100 text-base">{record.name}</span>
                        <span className="text-xs text-slate-500 uppercase font-semibold">{record.sex || '-'}</span>
                    </div>
                </td>
                <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300 text-sm">{record.station || '-'}</td>
                <td className="px-4 py-4">
                    <span className="inline-flex px-2.5 py-1 rounded-md text-sm font-black bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase">
                        {record.conraiss || '-'}
                    </span>
                </td>
                <td className="px-4 py-4">
                    <div className="flex flex-col gap-2.5">
                        {record.assignment_venue?.map((venue, idx) => {
                            const venueStr = typeof venue === 'string' ? venue : venue?.name || venue?.code || '';
                            const code = venueStr.includes('(') && venueStr.includes(')') ? venueStr.match(/\((.*?)\)/)?.[1] : '-';
                            return (
                                <div key={idx} className="text-xs font-mono font-bold text-slate-500 py-0.5">
                                    {code}
                                </div>
                            );
                        })}
                    </div>
                </td>
                <td className="px-4 py-4">
                    <div className="flex flex-col gap-2.5">
                        {record.assignments?.map((assignment, idx) => {
                            const val = typeof assignment === 'string' ? assignment : assignment.name || assignment.code;
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
                            const name = typeof mandate === 'string' ? mandate : mandate.mandate || mandate.code;
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
                            const venueStr = typeof venue === 'string' ? venue : venue?.name || venue?.code || '';
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
                        {record.assignment_venue?.map((venue, idx) => {
                            const venueStr = typeof venue === 'string' ? venue : venue.name || venue.code;
                            const state = record.state?.[idx] || (venueStr?.includes('|') ? venueStr.split('|').pop().trim() : '-');
                            const scheme = schemes[idx] || getColorScheme(state, idx);
                            return (
                                <div key={idx}>
                                    <span className={`inline-flex px-3 py-1 rounded-md text-xs font-black ${scheme.bg} ${scheme.text} border ${scheme.border} uppercase shadow-sm`}>
                                        {state}
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
                                {/* Statistics */}
                                <div>
                                    <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2.5">Record Stats</span>
                                    <div className="flex flex-col gap-2">
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Year:</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{record.year}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Count:</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-300">{record.count}</span>
                                        </div>
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-500 font-medium">Posted For:</span>
                                            <span className="font-black text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded">{record.posted_for}</span>
                                        </div>
                                    </div>
                                </div>
                                {/* Description */}
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

const FinalPostings: React.FC = () => {
    const [postings, setPostings] = useState<FinalPostingResponse[]>([]);
    const [loading, setLoading] = useState(true);
    const [restoring, setRestoring] = useState(false);
    const { success, error } = useNotification();

    // Pagination
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(50); // Higher default limit for reading

    // Filter Options (Fetched for convenience)
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [venues, setVenues] = useState<MarkingVenue[]>([]);

    // Search States
    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [searchStation, setSearchStation] = useState('');

    // Dropdown Filter States
    const [filterAssignment, setFilterAssignment] = useState('');
    const [filterMandate, setFilterMandate] = useState('');
    const [filterVenue, setFilterVenue] = useState('');
    const [filterState, setFilterState] = useState('');
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
                            <div
                                className="bg-teal-500 h-full transition-all duration-300"
                                style={{ width: `${(deletionProgress.current / deletionProgress.total) * 100}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.size === 0) return;

        // 1. Identify which original records actually match current filters
        const selectedGrouped = postings.filter(p => selectedIds.has(p.id));
        const recordsToProcess: FinalPostingResponse[] = [];

        selectedGrouped.forEach(group => {
            const originalRecords = (group as any)._original || [group];
            recordsToProcess.push(...originalRecords.filter(matchesFilter));
        });

        if (recordsToProcess.length === 0) {
            alert("No records match your current filters in the selection.");
            return;
        }

        const confirmed = window.confirm(
            `Are you sure you want to delete ${recordsToProcess.length} assignment record(s)? This will return the staff to the pool.`
        );

        if (!confirmed) return;

        try {
            setDeleting(true);
            setDeletionProgress({ current: 0, total: recordsToProcess.length });

            // 1. Fetch all APC records to perform updates
            const allAPC = await getAllAPCRecords(false, true);
            const apcMap = new Map(allAPC.map(a => [a.file_no.toString().padStart(4, '0'), a]));

            // 2. Process matched records to update APC
            const CHUNK_SIZE = 50;
            for (let i = 0; i < recordsToProcess.length; i += CHUNK_SIZE) {
                const chunk = recordsToProcess.slice(i, i + CHUNK_SIZE);
                const updates = [];

                for (const posting of chunk) {
                    const normFileNo = posting.file_no.toString().padStart(4, '0');
                    const apcRecord = apcMap.get(normFileNo);

                    if (apcRecord && posting.assignments && posting.assignments.length > 0) {
                        let payload: any = { ...apcRecord };
                        const { id, created_at, updated_at, created_by, updated_by, ...rest } = payload;
                        payload = { ...rest };

                        let hasChanges = false;
                        posting.assignments.forEach((assignment: any) => {
                            const codeOrName = typeof assignment === 'string' ? assignment : assignment.code || assignment.name;
                            const fieldName = assignmentFieldMap[codeOrName] || assignmentFieldMap[codeOrName?.toString().toUpperCase()];
                            if (fieldName) {
                                payload[fieldName] = null; // Clear the assignment field in APC (Mark as un-posted)
                                hasChanges = true;
                            }
                        });

                        if (hasChanges) {
                            updates.push(updateAPC(apcRecord.id, payload));
                        }
                    }
                }

                if (updates.length > 0) {
                    await Promise.allSettled(updates);
                }

                setDeletionProgress(prev => ({
                    current: Math.min(i + CHUNK_SIZE, recordsToProcess.length),
                    total: recordsToProcess.length
                }));
            }

            // 3. Delete from final table
            const idsToDelete = recordsToProcess.map(r => r.id);
            await bulkDeleteFinalPostings(idsToDelete);
            success(`${recordsToProcess.length} assignment records deleted.`);

            // Cleanup local state
            setSelectedIds(new Set());
            setDeletionProgress(null);
            fetchInitialData(); // Full refresh to ensure grouped state is correct
        } catch (err: any) {
            console.error(err);
            error(err.message || 'Failed to delete final postings.');
            setDeletionProgress(null);
        } finally {
            setDeleting(false);
        }
    };

    const handleDeleteAll = async () => {
        const confirmed = window.confirm(
            "CRITICAL: Are you sure you want to DELETE ALL final postings? This will return ALL staff to the pool. This action cannot be undone."
        );

        if (!confirmed) return;

        const doubleConfirmed = window.confirm(
            "Are you absolutely SURE? This will wipe the ENTIRE Final Postings table."
        );

        if (!doubleConfirmed) return;

        try {
            setDeleting(true);

            // 1. Fetch all APC records
            const allAPC = await getAllAPCRecords(false, true);
            const apcMap = new Map(allAPC.map(a => [a.file_no.toString().padStart(4, '0'), a]));

            // 2. Fetch fresh raw data for restoration
            const allFinalData = await getAllFinalPostings();
            const allRawPostings = allFinalData.items || (Array.isArray(allFinalData) ? allFinalData : []);

            setDeletionProgress({ current: 0, total: allRawPostings.length });

            // 3. Process ALL postings in chunks for APC restoration
            const CHUNK_SIZE = 50;

            for (let i = 0; i < allRawPostings.length; i += CHUNK_SIZE) {
                const chunk = allRawPostings.slice(i, i + CHUNK_SIZE);
                const updates = [];

                for (const posting of chunk) {
                    const normFileNo = posting.file_no.toString().padStart(4, '0');
                    const apcRecord = apcMap.get(normFileNo);

                    if (apcRecord && posting.assignments && posting.assignments.length > 0) {
                        let payload: any = { ...apcRecord };
                        const { id, created_at, updated_at, created_by, updated_by, ...rest } = payload;
                        payload = { ...rest };

                        let hasChanges = false;
                        posting.assignments.forEach((assignment: any) => {
                            const codeOrName = typeof assignment === 'string' ? assignment : assignment.code || assignment.name;
                            const fieldName = assignmentFieldMap[codeOrName] || assignmentFieldMap[codeOrName?.toString().toUpperCase()];
                            if (fieldName) {
                                payload[fieldName] = null; // Mark as un-posted
                                hasChanges = true;
                            }
                        });

                        if (hasChanges) {
                            updates.push(updateAPC(apcRecord.id, payload));
                        }
                    }
                }

                if (updates.length > 0) {
                    await Promise.allSettled(updates);
                }

                setDeletionProgress(prev => ({
                    current: Math.min(i + CHUNK_SIZE, allRawPostings.length),
                    total: allRawPostings.length
                }));
            }

            // 4. Delete everything from final table (Backend call)
            await deleteAllFinalPostings();
            success('All final postings deleted and staff returned to pool.');

            setPostings([]);
            setSelectedIds(new Set());
            setDeletionProgress(null);
            fetchInitialData();
        } catch (err: any) {
            console.error(err);
            error(err.message || 'Failed to delete all final postings.');
            setDeletionProgress(null);
        } finally {
            setDeleting(false);
        }
    };

    const groupPostings = (items: FinalPostingResponse[]): (FinalPostingResponse & { _original?: FinalPostingResponse[] })[] => {
        const groups = new Map<string, FinalPostingResponse & { _original?: FinalPostingResponse[] }>();

        items.forEach(item => {
            const key = normalizeString(item.file_no);
            if (!groups.has(key)) {
                // Initialize with a shallow copy and start the _original tracker
                groups.set(key, { ...item, _original: [{ ...item }] });
            } else {
                const existing = groups.get(key)!;
                if (!existing._original) existing._original = [];
                existing._original.push({ ...item });

                // Merge Arrays (concatenate)
                if (item.assignments) existing.assignments = [...(existing.assignments || []), ...item.assignments];
                if (item.mandates) existing.mandates = [...(existing.mandates || []), ...item.mandates];
                if (item.assignment_venue) existing.assignment_venue = [...(existing.assignment_venue || []), ...item.assignment_venue];
                if (item.state) existing.state = [...(existing.state || []), ...item.state];

                // Merge Description
                if (item.description && existing.description !== item.description) {
                    existing.description = filterUnique([existing.description, item.description].filter(Boolean) as string[]).join(' | ');
                }
            }
        });

        return Array.from(groups.values());
    };

    // Helper for description unique
    const filterUnique = <T,>(arr: T[]): T[] => Array.from(new Set(arr));

    const fetchInitialData = useCallback(async () => {
        try {
            setLoading(true);
            const [finalPostingsData, assignmentsData, venuesData] = await Promise.all([
                getAllFinalPostings(),
                getAllAssignments(),
                getAllMarkingVenues()
            ]);

            const rawItems = finalPostingsData.items || (Array.isArray(finalPostingsData) ? finalPostingsData : []);
            const groupedDisplayItems = groupPostings(rawItems);

            setPostings(groupedDisplayItems);
            setAssignments(assignmentsData);
            setVenues(venuesData);
        } catch (err) {
            console.error("Failed to fetch final postings", err);
            // error("Failed to load final postings."); // Optional: Don't spam error on load if just empty
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchInitialData();
    }, [fetchInitialData]);

    // Derived Data Map
    const assignmentMap = useMemo(() => {
        const map = new Map<string, string>();
        assignments.forEach(a => {
            if (a.code) map.set(a.code, a.name);
            if (a.name) map.set(a.name, a.name);
        });
        return map;
    }, [assignments]);

    // Derived Filters
    const uniqueAssignments = useMemo(() => {
        const set = new Set<string>();
        postings.forEach(p => {
            p.assignments?.forEach(a => {
                const val = typeof a === 'string' ? a : a.name || a.code;
                const name = assignmentMap.get(val) || val;
                if (name) set.add(name);
            });
        });
        return Array.from(set).sort();
    }, [postings, assignmentMap]);

    const uniqueMandates = useMemo(() => {
        const mandateSet = new Set<string>();
        postings.forEach(p => {
            p.mandates?.forEach(m => {
                const mName = typeof m === 'string' ? m : m.mandate || m.code;
                if (mName) mandateSet.add(mName);
            });
        });
        return Array.from(mandateSet).sort();
    }, [postings]);

    const uniqueYears = useMemo(() => {
        const yearSet = new Set<string>();
        postings.forEach(p => {
            if (p.year) yearSet.add(p.year);
        });
        return Array.from(yearSet).sort();
    }, [postings]);

    const uniqueStates = useMemo(() => {
        const stateSet = new Set<string>();
        postings.forEach(p => {
            if (p.state && p.state.length > 0) {
                p.state.forEach(s => stateSet.add(s));
            } else if (p.assignment_venue && p.assignment_venue.length > 0) {
                // Try to extract state from venue if possible (fallback)
                p.assignment_venue.forEach(v => {
                    const vStr = typeof v === 'string' ? v : v.name;
                    if (vStr && vStr.includes('|')) {
                        stateSet.add(vStr.split('|').pop()?.trim() || '');
                    }
                });
            }
        });
        // Remove empty strings
        if (stateSet.has('')) stateSet.delete('');
        return Array.from(stateSet).sort();
    }, [postings]);

    const matchesFilter = useCallback((p: FinalPostingResponse) => {
        if (debouncedFileNo && !String(p.file_no || '').toLowerCase().includes(debouncedFileNo.toLowerCase())) return false;
        if (debouncedName && !String(p.name || '').toLowerCase().includes(debouncedName.toLowerCase())) return false;
        if (debouncedStation && !p.station?.toLowerCase().includes(debouncedStation.toLowerCase())) return false;

        if (filterAssignment) {
            const lowerSearch = filterAssignment.toLowerCase();
            const match = p.assignments?.some((a: any) => {
                const val = typeof a === 'string' ? a : a.name || a.code;
                const name = assignmentMap.get(val) || val;
                return name?.toLowerCase().includes(lowerSearch);
            });
            if (!match) return false;
        }

        if (filterMandate) {
            const match = p.mandates?.some((m: any) =>
                (typeof m === 'string' ? m : m.mandate || m.code) === filterMandate
            );
            if (!match) return false;
        }

        if (filterVenue) {
            const match = p.assignment_venue?.some((v: any) =>
                (typeof v === 'string' ? v : v.name || v.code) === filterVenue
            );
            if (!match) return false;
        }

        if (filterYear && p.year !== filterYear) return false;

        if (filterState) {
            const normalizedFilter = normalizeString(filterState);
            const recordStates = p.state?.length
                ? p.state
                : (p.assignment_venue?.[0]?.includes('|') ? [p.assignment_venue[0].split('|').pop().trim()] : []);

            if (!recordStates.some(s => normalizeString(s) === normalizedFilter)) return false;
        }

        return true;
    }, [
        debouncedFileNo,
        debouncedName,
        debouncedStation,
        filterAssignment,
        filterMandate,
        filterVenue,
        filterYear,
        filterState,
        assignmentMap
    ]);

    const filteredPostings = useMemo(() => {
        return postings.filter(matchesFilter);
    }, [postings, matchesFilter]);

    const paginatedPostings = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredPostings.slice(startIndex, startIndex + limit);
    }, [filteredPostings, page, limit]);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredPostings.map(p => p.id)));
        } else {
            setSelectedIds(new Set());
        }
    }, [filteredPostings]);

    const handleSelectOne = useCallback((id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const handleRestore = async () => {
        if (selectedIds.size === 0) {
            alert("Please select records to restore.");
            return;
        }

        // 1. Identify which original records actually match current filters
        const selectedGrouped = postings.filter(p => selectedIds.has(p.id));
        const recordsToProcess: FinalPostingResponse[] = [];

        selectedGrouped.forEach(group => {
            const originalRecords = (group as any)._original || [group];
            recordsToProcess.push(...originalRecords.filter(matchesFilter));
        });

        if (recordsToProcess.length === 0) {
            alert("No records match your current filters in the selection.");
            return;
        }

        if (!window.confirm(`Are you sure you want to IMPORT ${recordsToProcess.length} records to the Staging area?`)) {
            return;
        }

        try {
            setRestoring(true);

            // Transform to PostingCreate format
            const payload = {
                items: recordsToProcess.map(p => {
                    const { id, created_at, updated_at, created_by, updated_by, ...rest } = p;
                    return rest;
                })
            };

            await bulkCreatePostings(payload);
            success(`Successfully imported ${recordsToProcess.length} records to Staging.`);
            setSelectedIds(new Set()); // Clear selection
        } catch (err: any) {
            console.error("Import failed", err);
            error(err.message || "Failed to import records.");
        } finally {
            setRestoring(false);
        }
    };

    const handleExportExcel = () => {
        if (filteredPostings.length === 0) {
            alert("No data to export");
            return;
        }

        // Flatten data for Excel
        const data = filteredPostings.map(p => ({
            'File No': p.file_no,
            'Name': p.name,
            'Station': p.station,
            'Sex': p.sex,
            'CONRAISS': p.conraiss,
            'Assignments': p.assignments?.map(a => {
                const val = typeof a === 'string' ? a : a.name || a.code;
                return assignmentMap.get(val) || val;
            }).join(', '),
            'Mandates': p.mandates?.map(m => typeof m === 'string' ? m : m.mandate).join(', '),
            'Venues': p.assignment_venue?.map(v => typeof v === 'string' ? v : v.name).join(', '),
            'States': p.state?.join(', '),
            'Year': p.year
        }));

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Final Postings");
        XLSX.writeFile(wb, "Final_Postings_Export.xlsx");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-in fade-in duration-500 relative">
            {renderLoadingOverlay()}
            <div className="flex flex-col gap-8">

                {/* Header */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                    <div>
                        <h1 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight mb-2">
                            Final Posting
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium max-w-2xl">
                            Archived view of consolidated staff postings.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={handleDeleteSelected}
                            disabled={deleting || selectedIds.size === 0}
                            className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl shadow-lg transition-all font-bold text-sm ${selectedIds.size > 0 && !deleting
                                ? 'bg-red-600 hover:bg-red-700 shadow-red-500/20'
                                : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">delete</span>
                            {deleting ? 'Deleting...' : `Delete Selected (${selectedIds.size})`}
                        </button>
                        <button
                            onClick={handleDeleteAll}
                            disabled={deleting || postings.length === 0}
                            className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl shadow-lg transition-all font-bold text-sm ${postings.length > 0 && !deleting
                                ? 'bg-rose-700 hover:bg-rose-800 shadow-rose-500/20'
                                : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                }`}
                            title="Delete all final postings and return staff to pool"
                        >
                            <span className="material-symbols-outlined text-[20px]">delete_sweep</span>
                            {deleting ? 'Processing...' : 'Delete All'}
                        </button>
                        <button
                            onClick={() => fetchInitialData()}
                            disabled={loading}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-xl shadow-lg transition-all font-bold text-sm"
                            title="Reload data from server"
                        >
                            <span className={`material-symbols-outlined text-[20px] ${loading ? 'animate-spin' : ''}`}>sync</span>
                            {loading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button
                            onClick={handleExportExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-lg shadow-emerald-500/20 transition-all font-bold text-sm"
                        >
                            <span className="material-symbols-outlined text-[20px]">download</span>
                            Export Excel
                        </button>
                        <button
                            onClick={handleRestore}
                            disabled={selectedIds.size === 0 || restoring}
                            className={`flex items-center gap-2 px-4 py-2 text-white rounded-xl shadow-lg transition-all font-bold text-sm ${selectedIds.size > 0 && !restoring
                                ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 cursor-pointer'
                                : 'bg-slate-300 dark:bg-slate-700 cursor-not-allowed'
                                }`}
                        >
                            <span className="material-symbols-outlined text-[20px]">restore</span>
                            {restoring ? 'Importing...' : `Import to Staging (${selectedIds.size})`}
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white dark:bg-[#1e293b] p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                        <input
                            type="text"
                            placeholder="Search File No..."
                            value={searchFileNo}
                            onChange={(e) => setSearchFileNo(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f172a] text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium placeholder:text-slate-400"
                        />
                        <input
                            type="text"
                            placeholder="Search Name..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0f172a] text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium placeholder:text-slate-400"
                        />
                        <SearchableSelect
                            options={[{ id: '', name: 'All Assignments' }, ...uniqueAssignments.map(a => ({ id: a, name: a }))]}
                            value={filterAssignment}
                            onChange={setFilterAssignment}
                            placeholder="Filter Assignment"
                        />
                        <SearchableSelect
                            options={[{ id: '', name: 'All Mandates' }, ...uniqueMandates.map(m => ({ id: m, name: m }))]}
                            value={filterMandate}
                            onChange={setFilterMandate}
                            placeholder="Filter Mandate"
                        />
                        <SearchableSelect
                            options={[{ id: '', name: 'All Years' }, ...uniqueYears.map(y => ({ id: y, name: y }))]}
                            value={filterYear}
                            onChange={setFilterYear}
                            placeholder="Filter Year"
                        />
                        <SearchableSelect
                            options={[{ id: '', name: 'All States' }, ...uniqueStates.map(s => ({ id: s, name: s }))]}
                            value={filterState}
                            onChange={setFilterState}
                            placeholder="Filter State"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white dark:bg-[#1e293b] rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                    <th className="p-4 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            checked={filteredPostings.length > 0 && selectedIds.size === filteredPostings.length}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-teal-600 focus:ring-teal-500 w-3.5 h-3.5 cursor-pointer"
                                        />
                                    </th>
                                    <th className="p-4 w-12"></th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">File No</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Name</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Station</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Rank</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Code</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Assignments</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Mandates</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">Venues</th>
                                    <th className="p-4 text-left text-xs font-black text-slate-400 uppercase tracking-wider">State</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {paginatedPostings.length > 0 ? (
                                    paginatedPostings.map((posting) => (
                                        <CollapsibleRow
                                            key={posting.id}
                                            record={posting}
                                            selected={selectedIds.has(posting.id)}
                                            onSelect={(checked) => handleSelectOne(posting.id, checked)}
                                            assignmentMap={assignmentMap}
                                        />
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={11} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <span className="material-symbols-outlined text-4xl text-slate-300">inbox</span>
                                                <p className="text-slate-500 font-medium">No archived postings found.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                    {/* Pagination */}
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex flex-col md:flex-row justify-between items-center gap-4">
                        <div className="flex items-center gap-4">
                            <div className="text-sm text-slate-500 dark:text-slate-400 font-medium">
                                Showing <span className="text-slate-900 dark:text-slate-200 font-bold">{filteredPostings.length === 0 ? 0 : Math.min((page - 1) * limit + 1, filteredPostings.length)}</span> to <span className="text-slate-900 dark:text-slate-200 font-bold">{Math.min(page * limit, filteredPostings.length)}</span> of <span className="text-slate-900 dark:text-slate-200 font-bold">{filteredPostings.length}</span> results
                            </div>
                            <div className="flex items-center gap-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Show:</label>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="h-8 px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all"
                                >
                                    {[10, 20, 30, 50, 100].map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(1)}
                                disabled={page === 1}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                                title="First Page"
                            >
                                <span className="material-symbols-outlined text-lg">first_page</span>
                            </button>
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                                title="Previous Page"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_left</span>
                            </button>
                            <span className="px-4 py-1.5 bg-white dark:bg-slate-700 rounded-lg text-sm font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600 shadow-sm">
                                Page {page} of {Math.ceil(filteredPostings.length / limit) || 1}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={page * limit >= filteredPostings.length}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                                title="Next Page"
                            >
                                <span className="material-symbols-outlined text-lg">chevron_right</span>
                            </button>
                            <button
                                onClick={() => setPage(Math.ceil(filteredPostings.length / limit))}
                                disabled={page * limit >= filteredPostings.length}
                                className="p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-slate-600 dark:text-slate-400"
                                title="Last Page"
                            >
                                <span className="material-symbols-outlined text-lg">last_page</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FinalPostings;
