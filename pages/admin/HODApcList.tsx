import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { HODApcRecord, HODApcCreate } from '../../types/hodApc';
import { getAllHODApc, updateHODApc, deleteHODApc, bulkDeleteHODApc, syncHODApc, getAllHODApcRecords } from '../../services/hodApc';
import { getAllAssignments } from '../../services/assignment';
import { Assignment } from '../../types/assignment';
import AlertModal from '../../components/AlertModal';
import * as XLSX from 'xlsx';

const HODApcList: React.FC = () => {
    const [allRecords, setAllRecords] = useState<HODApcRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    const [sortField, setSortField] = useState<keyof HODApcRecord | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const [assignmentOptions, setAssignmentOptions] = useState<Assignment[]>([]);

    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [filterConraiss, setFilterConraiss] = useState('');
    const [filterStation, setFilterStation] = useState('');
    const [filterAssignment, setFilterAssignment] = useState('');

    const debouncedSearchFileNo = useDebounce(searchFileNo, 300);
    const debouncedSearchName = useDebounce(searchName, 300);
    const debouncedFilterStation = useDebounce(filterStation, 300);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [showGeneratorModal, setShowGeneratorModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<HODApcRecord | null>(null);
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type: 'success' | 'error' | 'warning' | 'info';
        details?: any;
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', type: 'info' });

    const assignmentFieldMap: Record<string, string> = {
        'TT': 'tt',
        'MAR-ACCR': 'mar_accr',
        'NCEE': 'ncee',
        'GIFTED': 'gifted',
        'BECEP': 'becep',
        'BECE-MRKP': 'bece_mrkp',
        'SSCE-INT': 'ssce_int',
        'SWAPPING': 'swapping',
        'SSCE-INT-MRK': 'ssce_int_mrk',
        'OCT-ACCR': 'oct_accr',
        'SSCE-EXT': 'ssce_ext',
        'SSCE-EXT-MRK': 'ssce_ext_mrk',
        'PUR-SAMP': 'pur_samp',
        'INT-AUDIT': 'int_audit',
        'STOCK-TK': 'stock_tk'
    };

    useEffect(() => {
        setPage(1);
    }, [debouncedSearchFileNo, debouncedSearchName, filterConraiss, debouncedFilterStation, filterAssignment]);

    const filteredRecords = useMemo(() => {
        let result = [...allRecords];

        if (debouncedSearchFileNo) {
            const lowerFileNo = debouncedSearchFileNo.toLowerCase().trim();
            result = result.filter(record => record.file_no.toLowerCase().includes(lowerFileNo));
        }
        if (debouncedSearchName) {
            const lowerName = debouncedSearchName.toLowerCase().trim();
            result = result.filter(record => record.name.toLowerCase().includes(lowerName));
        }
        if (filterConraiss) {
            result = result.filter(record => record.conraiss === filterConraiss);
        }
        if (debouncedFilterStation) {
            const lowerStation = debouncedFilterStation.toLowerCase().trim();
            result = result.filter(record => record.station && record.station.toLowerCase().includes(lowerStation));
        }

        if (filterAssignment) {
            const fieldName = assignmentFieldMap[filterAssignment];
            if (fieldName) {
                result = result.filter(record => {
                    const val = record[fieldName as keyof HODApcRecord];
                    return !!(val && val.toString().trim() !== '');
                });
            }
        }

        if (sortField) {
            result.sort((a, b) => {
                const aValue = a[sortField];
                const bValue = b[sortField];

                if (aValue === bValue) return 0;
                if (aValue === undefined || aValue === null) return 1;
                if (bValue === undefined || bValue === null) return -1;

                const compareResult = aValue < bValue ? -1 : 1;
                return sortDirection === 'asc' ? compareResult : -compareResult;
            });
        }

        return result;
    }, [allRecords, debouncedSearchFileNo, debouncedSearchName, filterConraiss, debouncedFilterStation, filterAssignment, sortField, sortDirection]);

    const total = filteredRecords.length;

    const records = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredRecords.slice(startIndex, startIndex + limit);
    }, [filteredRecords, page, limit]);

    const conraissOptions = useMemo(() => {
        return Array.from(new Set(allRecords.map(r => r.conraiss).filter(Boolean))).sort() as string[];
    }, [allRecords]);

    const stationOptions = useMemo(() => {
        return Array.from(new Set(allRecords.map(r => r.station).filter(Boolean))).sort() as string[];
    }, [allRecords]);

    const fetchAllRecords = useCallback(async () => {
        setLoading(true);
        try {
            const all = await getAllHODApcRecords(false);
            setAllRecords(all);
        } catch (error) {
            console.error('Error fetching HOD APC records:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to fetch HOD APC records. Please try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    const handleSync = async () => {
        setLoading(true);
        try {
            const result = await syncHODApc();
            setAlertModal({
                isOpen: true,
                title: 'Sync Successful',
                message: `Successfully synchronized HOD data from SDL. ${result.created_count} records were processed.`,
                type: 'success'
            });
            fetchAllRecords();
        } catch (error: any) {
            console.error('Sync failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Sync Failed',
                message: error.message || 'An error occurred during synchronization.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const toggleRow = useCallback((id: string) => {
        setExpandedRows(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(allRecords.map(r => r.id)));
        } else {
            setSelectedIds(new Set());
        }
    }, [allRecords]);

    const handleSelectOne = useCallback((id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const handleSort = useCallback((field: keyof HODApcRecord) => {
        setSortField(prevField => {
            if (prevField === field) {
                setSortDirection(prevDir => (prevDir === 'asc' ? 'desc' : 'asc'));
                return field;
            }
            setSortDirection('asc');
            return field;
        });
    }, []);

    useEffect(() => {
        const loadAssignments = async () => {
            try {
                const data = await getAllAssignments(true);
                setAssignmentOptions(data);
            } catch (e) {
                console.error("Failed to load assignments", e);
            }
        };
        loadAssignments();
        fetchAllRecords();
    }, [fetchAllRecords]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) return;

        setAlertModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: `Are you sure you want to delete ${selectedIds.size} HOD APC record(s)?`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await bulkDeleteHODApc(Array.from(selectedIds));
                    setSelectedIds(new Set());
                    fetchAllRecords();
                    setAlertModal({ isOpen: true, title: 'Success', message: 'Records deleted successfully.', type: 'success' });
                } catch (error) {
                    setAlertModal({ isOpen: true, title: 'Error', message: 'Failed to delete records.', type: 'error' });
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [selectedIds, fetchAllRecords]);

    const handleExport = useCallback(async () => {
        try {
            setLoading(true);
            const exportData = filteredRecords.map(record => ({
                'File Number': record.file_no,
                'Name': record.name,
                'CONRAISS': record.conraiss,
                'Station': record.station,
                'Qualification': record.qualification,
                'Sex': record.sex,
                'TT': record.tt,
                'MAR-ACCR': record.mar_accr,
                'NCEE': record.ncee,
                'GIFTED': record.gifted,
                'BECEP': record.becep,
                'BECE-MRKP': record.bece_mrkp,
                'SSCE-INT': record.ssce_int,
                'SWAPPING': record.swapping,
                'SSCE-INT-MRK': record.ssce_int_mrk,
                'OCT-ACCR': record.oct_accr,
                'SSCE-EXT': record.ssce_ext,
                'SSCE-EXT-MRK': record.ssce_ext_mrk,
                'PUR-SAMP': record.pur_samp,
                'INT-AUDIT': record.int_audit,
                'STOCK-TK': record.stock_tk,
                'Count': record.count ? Math.floor(record.count) : '',
                'Year': record.year ? Math.floor(Number(record.year)) : '',
                'Active': record.active ? 'Yes' : 'No',
                'Remark': record.remark
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "HOD APC List");
            XLSX.writeFile(wb, `HOD_APC_List_${new Date().toISOString().split('T')[0]}.xlsx`);

            setAlertModal({
                isOpen: true,
                title: 'Export Successful',
                message: 'HOD APC records have been exported to Excel.',
                type: 'success'
            });
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Export Failed',
                message: 'Failed to export HOD APC records.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, [filteredRecords]);

    const handleEdit = useCallback((record: HODApcRecord) => {
        setEditingRecord(record);
        setShowAddModal(true);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this HOD APC record?',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await deleteHODApc(id);
                    fetchAllRecords();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'HOD APC record deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting HOD APC record:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete HOD APC record.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [fetchAllRecords]);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        HOD's APC Table
                    </h1>
                    <p className="text-sm md:text-base lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Manage mandates for Heads of Departments synchronized from SDL.</p>
                </div>
                <div className="flex items-center gap-3">
                    {selectedIds.size > 0 && (
                        <button
                            onClick={handleBulkDelete}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                            Delete Selected ({selectedIds.size})
                        </button>
                    )}
                    <button
                        onClick={handleSync}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-lg group-hover:rotate-180 transition-transform">sync</span>
                        Sync with SDL
                    </button>
                    <button
                        onClick={() => setShowGeneratorModal(true)}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-xs shadow-lg shadow-amber-500/20 hover:shadow-amber-500/40 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-lg group-hover:rotate-12 transition-transform">auto_fix_high</span>
                        Generate Assignments
                    </button>
                    <button
                        onClick={handleExport}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-300 dark:to-indigo-500 group-hover:scale-110 transition-transform text-lg">download</span>
                        Export List
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 transition-colors duration-200">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col gap-4 w-full">
                        <div className="flex flex-col md:flex-row gap-4 w-full">
                            <FilterInput icon="tag" placeholder="Search by File No..." value={searchFileNo} onChange={setSearchFileNo} />
                            <FilterInput icon="search" placeholder="Search by Name..." value={searchName} onChange={setSearchName} />
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 w-full items-center">
                            <FilterSelect label="All CONRAISS" value={filterConraiss} options={conraissOptions} onChange={setFilterConraiss} />
                            <FilterSelect label="All Stations" value={filterStation} options={stationOptions} onChange={setFilterStation} />
                            <FilterSelect
                                label="All Assignments"
                                value={filterAssignment}
                                options={assignmentOptions.map(o => o.code)}
                                displayOptions={assignmentOptions.map(o => o.name)}
                                onChange={setFilterAssignment}
                            />
                            <div className="flex-1"></div>
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Per page:</label>
                                <select
                                    value={limit}
                                    onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 font-bold text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 cursor-pointer"
                                >
                                    {[10, 25, 50, 100].map(v => <option key={v} value={v}>{v}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-800 bg-slate-50/50 dark:bg-[#121b25]">
                    {loading ? (
                        <div className="flex h-80 items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined animate-spin text-4xl text-purple-500/50">donut_large</span>
                                <span className="text-slate-400 font-medium text-xs">Loading records...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                                <thead className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-gray-700">
                                    <tr>
                                        <th className="p-4 w-10 text-center">
                                            <button
                                                onClick={() => expandedRows.size > 0 ? setExpandedRows(new Set()) : setExpandedRows(new Set(records.map(r => r.id)))}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400"
                                            >
                                                <span className="material-symbols-outlined text-lg">{expandedRows.size > 0 ? 'unfold_less' : 'unfold_more'}</span>
                                            </button>
                                        </th>
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer"
                                                checked={allRecords.length > 0 && allRecords.every(r => selectedIds.has(r.id))}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <SortableHeader field="file_no" label="File No" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="name" label="Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="conraiss" label="CONRAISS" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="station" label="Station" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="active" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
                                    {records.length === 0 ? (
                                        <tr><td colSpan={8} className="p-10 text-center text-slate-400">No records found</td></tr>
                                    ) : (
                                        records.map((record) => (
                                            <HODApcRow
                                                key={record.id}
                                                record={record}
                                                isSelected={selectedIds.has(record.id)}
                                                onSelect={(checked) => handleSelectOne(record.id, checked)}
                                                onEdit={() => handleEdit(record)}
                                                onDelete={() => handleDelete(record.id)}
                                                isExpanded={expandedRows.has(record.id)}
                                                onToggleExpand={() => toggleRow(record.id)}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2 border-t border-slate-100 dark:border-gray-800">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Showing <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : Math.min(page * limit, total)}</span> of <span className="text-slate-900 dark:text-white font-bold">{total}</span> results
                    </p>
                    <div className="flex gap-2">
                        <PaginationBtn icon="first_page" disabled={page === 1} onClick={() => setPage(1)} />
                        <PaginationBtn icon="chevron_left" disabled={page === 1} onClick={() => setPage(p => p - 1)} />
                        <div className="flex items-center px-4 rounded-lg bg-slate-50 dark:bg-purple-900/20 text-sm font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                            Page {page} of {Math.ceil(total / limit) || 1}
                        </div>
                        <PaginationBtn icon="chevron_right" disabled={page >= Math.ceil(total / limit) || total === 0} onClick={() => setPage(p => p + 1)} />
                        <PaginationBtn icon="last_page" disabled={page >= Math.ceil(total / limit) || total === 0} onClick={() => setPage(Math.ceil(total / limit))} />
                    </div>
                </div>
            </div>

            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
                details={alertModal.details}
                onConfirm={alertModal.onConfirm}
            />

            {showAddModal && (
                <HODAPCModal
                    isOpen={showAddModal}
                    onClose={() => { setShowAddModal(false); setEditingRecord(null); }}
                    onSubmit={async (data) => {
                        try {
                            if (editingRecord) {
                                await updateHODApc(editingRecord.id, data);
                                setAlertModal({ isOpen: true, title: 'Success', message: 'HOD APC record updated successfully.', type: 'success' });
                            }
                            fetchAllRecords();
                        } catch (error: any) {
                            setAlertModal({ isOpen: true, title: 'Error', message: `Failed to save record: ${error.message}`, type: 'error' });
                        }
                    }}
                    initialData={editingRecord}
                />
            )}

            {showGeneratorModal && (
                <AssignmentGeneratorModal
                    isOpen={showGeneratorModal}
                    onClose={() => setShowGeneratorModal(false)}
                    records={allRecords}
                    onApply={async (updates, skipInfo) => {
                        setLoading(true);
                        try {
                            let successCount = 0;
                            let failCount = 0;
                            const failedItems: any[] = [];

                            // Process updates in batches for concurrency
                            const BATCH_SIZE = 5;
                            for (let i = 0; i < updates.length; i += BATCH_SIZE) {
                                const chunk = updates.slice(i, i + BATCH_SIZE);
                                await Promise.all(chunk.map(async (update) => {
                                    try {
                                        // Find the original record and merge with update data
                                        const originalRecord = allRecords.find(r => r.id === update.id);
                                        if (originalRecord) {
                                            const { id, created_at, updated_at, created_by, updated_by, ...recordData } = originalRecord;
                                            const mergedData = { ...recordData, ...update.data };
                                            await updateHODApc(update.id, mergedData);
                                            successCount++;
                                        }
                                    } catch (err: any) {
                                        failCount++;
                                        console.error('Failed to update record:', update.id, err);
                                        failedItems.push({ fileno: update.fileNo, error: err.message || 'Update failed' });
                                    }
                                }));
                            }

                            await fetchAllRecords();

                            // Compile skipped data
                            const skippedData = [
                                ...(skipInfo?.alreadyHave || []).map(f => ({ fileno: f, reason: 'Assignment already exists' })),
                                ...(skipInfo?.maxReached || []).map(f => ({ fileno: f, reason: 'Max (5) assignments reached' })),
                                ...(skipInfo?.notFound || []).map(f => ({ fileno: f, reason: 'File number not found' }))
                            ];

                            const totalSkipped = skippedData.length;

                            setAlertModal({
                                isOpen: true,
                                title: 'Assignment Generation Report',
                                message: `Processed ${updates.length} records. See details below.`,
                                type: failCount > 0 ? 'warning' : 'success',
                                details: {
                                    created: successCount,
                                    skipped: totalSkipped,
                                    errors: failCount,
                                    skippedData: skippedData,
                                    errorData: failedItems,
                                }
                            });
                        } catch (error: any) {
                            setAlertModal({ isOpen: true, title: 'Error', message: `Failed to apply assignments: ${error.message}`, type: 'error' });
                        } finally {
                            setLoading(false);
                        }
                    }}
                />
            )}
        </div>
    );
};

const FilterInput = ({ icon, placeholder, value, onChange }: any) => (
    <div className="relative flex-1">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <span className="material-symbols-outlined text-slate-400 text-lg">{icon}</span>
        </div>
        <input
            className="w-full pl-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all text-sm text-slate-700 dark:text-slate-200"
            placeholder={placeholder}
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

const FilterSelect = ({ label, value, options, displayOptions, onChange }: any) => (
    <div className="relative w-full md:w-48">
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
        >
            <option value="">{label}</option>
            {options.map((opt: string, i: number) => (
                <option key={opt} value={opt}>{displayOptions ? displayOptions[i] : opt}</option>
            ))}
        </select>
    </div>
);

const PaginationBtn = ({ icon, disabled, onClick }: any) => (
    <button
        disabled={disabled}
        onClick={onClick}
        className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-purple-500 hover:text-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all disabled:opacity-50"
    >
        <span className="material-symbols-outlined text-xl">{icon}</span>
    </button>
);

const SortableHeader = ({ field, label, sortField, sortDirection, onSort }: any) => (
    <th className="px-4 py-3 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-sm font-bold uppercase tracking-wider" onClick={() => onSort(field)}>
        <div className="flex items-center gap-2">
            {label}
            <div className="flex flex-col text-[10px] text-slate-400 group-hover:text-slate-500">
                <span className={`material-symbols-outlined text-[10px] -mb-1 ${sortField === field && sortDirection === 'asc' ? 'text-purple-600' : ''}`}>expand_less</span>
                <span className={`material-symbols-outlined text-[10px] ${sortField === field && sortDirection === 'desc' ? 'text-purple-600' : ''}`}>expand_more</span>
            </div>
        </div>
    </th>
);

const HODApcRow = ({ record, isSelected, onSelect, onEdit, onDelete, isExpanded, onToggleExpand }: any) => (
    <React.Fragment>
        <tr className={`group hover:bg-purple-50/10 dark:hover:bg-slate-800/50 transition-colors duration-150 ${isExpanded ? 'bg-purple-50/30 dark:bg-purple-900/10' : ''}`}>
            <td className="p-4 text-center">
                <button onClick={onToggleExpand} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400">
                    <span className={`material-symbols-outlined transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>chevron_right</span>
                </button>
            </td>
            <td className="p-4 text-center">
                <input type="checkbox" className="rounded border-slate-300 text-purple-600 focus:ring-purple-500 w-3.5 h-3.5 cursor-pointer" checked={isSelected} onChange={(e) => onSelect(e.target.checked)} />
            </td>
            <td className="px-4 py-4 font-mono font-black text-slate-700 dark:text-slate-300">{record.file_no}</td>
            <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-300 font-bold text-xs">{record.name.charAt(0)}</div>
                    <span className="font-bold text-slate-700 dark:text-slate-200">{record.name}</span>
                </div>
            </td>
            <td className="px-4 py-4"><span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">{record.conraiss || '-'}</span></td>
            <td className="px-4 py-4 font-medium">{record.station || '-'}</td>
            <td className="px-4 py-4 text-center">
                <span className={`px-2 py-1 rounded-full text-[10px] font-black uppercase ${record.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                    {record.active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td className="px-4 py-3">
                <div className="flex items-center justify-center gap-1">
                    <ActionBtn icon="edit" onClick={onEdit} tooltip="Edit Record" />
                    <ActionBtn icon="delete" isDanger onClick={onDelete} tooltip="Delete Record" />
                </div>
            </td>
        </tr>
        {isExpanded && (
            <tr className="bg-slate-50/50 dark:bg-slate-800/30">
                <td colSpan={8} className="p-4 pl-16">
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm text-slate-500 dark:text-slate-400">
                        {['Qualification', 'Sex', 'TT', 'MAR-ACCR', 'NCEE', 'GIFTED', 'BECEP', 'BECE-MRKP', 'SSCE-INT', 'SWAPPING', 'SSCE-INT-MRK', 'OCT-ACCR', 'SSCE-EXT', 'SSCE-EXT-MRK', 'PUR-SAMP', 'INT-AUDIT', 'STOCK-TK', 'Count', 'Year'].map(label => (
                            <div key={label}>
                                <span className="block font-bold text-slate-800 dark:text-slate-200 mb-0.5">{label}</span>
                                <span className="font-mono">{String(record[label.toLowerCase().replace(/-/g, '_') as keyof HODApcRecord] || '-')}</span>
                            </div>
                        ))}
                    </div>
                </td>
            </tr>
        )}
    </React.Fragment>
);

const ActionBtn = ({ icon, isDanger, onClick, tooltip }: any) => (
    <button onClick={onClick} title={tooltip} className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${isDanger ? 'text-rose-400 hover:bg-rose-50 hover:text-rose-600' : 'text-slate-400 hover:bg-purple-50 hover:text-purple-600'}`}>
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
);

const HODAPCModal: React.FC<{ isOpen: boolean; onClose: () => void; onSubmit: (data: HODApcCreate) => Promise<void>; initialData?: HODApcRecord | null; }> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<HODApcCreate>({ file_no: '', name: '', conraiss: '', station: '', active: true });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) setFormData({ ...initialData });
    }, [initialData, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try { await onSubmit(formData); onClose(); } catch (err) { } finally { setLoading(false); }
    };

    const assignmentFields = [
        { key: 'tt', label: 'TT' },
        { key: 'mar_accr', label: 'MAR ACCR' },
        { key: 'ncee', label: 'NCEE' },
        { key: 'gifted', label: 'GIFTED' },
        { key: 'becep', label: 'BECEP' },
        { key: 'bece_mrkp', label: 'BECE MRKP' },
        { key: 'ssce_int', label: 'SSCE INT' },
        { key: 'swapping', label: 'SWAPPING' },
        { key: 'ssce_int_mrk', label: 'SSCE INT MRK' },
        { key: 'oct_accr', label: 'OCT ACCR' },
        { key: 'ssce_ext', label: 'SSCE EXT' },
        { key: 'ssce_ext_mrk', label: 'SSCE EXT MRK' },
        { key: 'pur_samp', label: 'PUR SAMP' },
        { key: 'int_audit', label: 'INT AUDIT' },
        { key: 'stock_tk', label: 'STOCK TK' }
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-gray-700/50">
                <div className="flex-none flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-700 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-900/20 dark:via-[#121b25] dark:to-teal-900/20 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-400 tracking-tight">
                            {initialData ? 'Edit HOD APC Record' : 'Add HOD APC Record'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">HOD Assignment Management</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <form id="hod-apc-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">person</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Basic Information</span>
                            </div>
                            <FloatingInput label="File Number" value={formData.file_no} onChange={(val: string) => setFormData({ ...formData, file_no: val })} />
                            <FloatingInput label="Full Name" value={formData.name} onChange={(val: string) => setFormData({ ...formData, name: val })} />
                            <FloatingInput label="CONRAISS" value={formData.conraiss || ''} onChange={(val: string) => setFormData({ ...formData, conraiss: val })} />
                            <FloatingInput label="Station" value={formData.station || ''} onChange={(val: string) => setFormData({ ...formData, station: val })} />

                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 mt-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-teal-500">assignment</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Assignment Codes</span>
                            </div>
                            {assignmentFields.map(field => (
                                <FloatingInput key={field.key} label={field.label} value={(formData as any)[field.key] || ''} onChange={(val: string) => setFormData({ ...formData, [field.key]: val })} />
                            ))}

                            <div className="md:col-span-2 mt-4">
                                <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-all">
                                    <input
                                        type="checkbox"
                                        checked={formData.active !== false}
                                        onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                                        className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                    />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Active Record</span>
                                </label>
                            </div>
                        </div>
                    </form>
                </div>

                <div className="flex-none flex justify-end gap-4 p-6 border-t border-slate-100 dark:border-gray-700 bg-white dark:bg-[#121b25] rounded-b-2xl">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                    <button type="submit" form="hod-apc-form" disabled={loading} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FloatingInput = ({ label, value, onChange }: any) => (
    <div className="relative flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-1">{label}</label>
        <input
            className="w-full h-10 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-bold text-sm text-slate-700 dark:text-slate-200"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

// Assignment Generator Modal
const AssignmentGeneratorModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    records: HODApcRecord[];
    onApply: (updates: { id: string; data: Partial<HODApcCreate>; fileNo: string }[], skipInfo: { alreadyHave: string[]; maxReached: string[]; notFound: string[] }) => Promise<void>;
}> = ({ isOpen, onClose, records, onApply }) => {
    const [activeTab, setActiveTab] = useState<'random' | 'custom'>('random');
    const [loading, setLoading] = useState(false);
    const [selectedAssignment, setSelectedAssignment] = useState('ssce_int');
    const [csvFileNumbers, setCsvFileNumbers] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Education qualification check
    const educationKeywords = ['b.ed', 'pgd', 'pgde', 'nce', 'm.ed', 'edu', 'trcn'];
    const isEducationQualified = (qualification: string | null | undefined) =>
        qualification ? educationKeywords.some(k => qualification.toLowerCase().includes(k)) : false;

    // Excluded assignments (HODs will NOT be posted for these)
    const excludedAssignments = ['stock_tk', 'int_audit', 'pur_samp', 'swapping', 'ncee', 'gifted'];

    // Mandatory assignments for all HODs
    const mandatoryAssignments = ['ssce_int', 'ssce_int_mrk'];

    // Education-only assignments
    const educationOnlyAssignments = ['mar_accr', 'oct_accr'];

    // Optional assignments for random fill
    const optionalAssignments = ['tt', 'becep', 'bece_mrkp', 'ssce_ext', 'ssce_ext_mrk'];

    // All available assignments for custom mode (no restrictions)
    const availableAssignments = [
        { key: 'ssce_int', label: 'SSCE-INT' },
        { key: 'ssce_int_mrk', label: 'SSCE-INT-MRK' },
        { key: 'mar_accr', label: 'MAR-ACCR' },
        { key: 'oct_accr', label: 'OCT-ACCR' },
        { key: 'tt', label: 'TT' },
        { key: 'becep', label: 'BECEP' },
        { key: 'bece_mrkp', label: 'BECE-MRKP' },
        { key: 'ssce_ext', label: 'SSCE-EXT' },
        { key: 'ssce_ext_mrk', label: 'SSCE-EXT-MRK' },
        { key: 'ncee', label: 'NCEE' },
        { key: 'gifted', label: 'GIFTED' },
        { key: 'swapping', label: 'SWAPPING' },
        { key: 'pur_samp', label: 'PUR-SAMP' },
        { key: 'int_audit', label: 'INT-AUDIT' },
        { key: 'stock_tk', label: 'STOCK-TK' },
    ];

    // Count assignments for a record
    const countAssignments = (record: HODApcRecord): number => {
        const assignmentFields = ['tt', 'mar_accr', 'ncee', 'gifted', 'becep', 'bece_mrkp', 'ssce_int', 'swapping', 'ssce_int_mrk', 'oct_accr', 'ssce_ext', 'ssce_ext_mrk', 'pur_samp', 'int_audit', 'stock_tk'];
        return assignmentFields.filter(field => {
            const val = record[field as keyof HODApcRecord];
            return val && val.toString().trim() !== '';
        }).length;
    };

    // Stats
    const eduQualifiedCount = records.filter(r => isEducationQualified(r.qualification)).length;

    // Handle CSV upload
    const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n');
            const fileNumbers: string[] = [];

            lines.forEach((line, index) => {
                if (!line.trim()) return;
                const columns = line.split(',');
                let val = columns[0].trim().replace(/"/g, '');

                // Skip header
                if (index === 0 && val.toLowerCase().includes('file')) return;

                // Pad to 4 digits if numeric
                if (/^\d+$/.test(val)) {
                    val = val.padStart(4, '0');
                }
                if (val) fileNumbers.push(val);
            });

            setCsvFileNumbers(fileNumbers);
        };
        reader.readAsText(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    // Generate random assignments
    const handleRandomGenerate = async () => {
        setLoading(true);
        try {
            const updates: { id: string; data: Partial<HODApcCreate>; fileNo: string }[] = [];

            records.forEach(record => {
                const currentCount = countAssignments(record);
                const newData: Partial<HODApcCreate> = {};
                let newAssignments = 0;

                // Add mandatory assignments if not present
                mandatoryAssignments.forEach(assignment => {
                    const val = record[assignment as keyof HODApcRecord];
                    if (!val || val.toString().trim() === '') {
                        if (currentCount + newAssignments < 5) {
                            (newData as Record<string, string>)[assignment] = 'Post';
                            newAssignments++;
                        }
                    }
                });

                // Add education-only assignments for qualified HODs
                if (isEducationQualified(record.qualification)) {
                    educationOnlyAssignments.forEach(assignment => {
                        const val = record[assignment as keyof HODApcRecord];
                        if (!val || val.toString().trim() === '') {
                            if (currentCount + newAssignments < 5) {
                                (newData as Record<string, string>)[assignment] = 'Post';
                                newAssignments++;
                            }
                        }
                    });
                }

                // Fill remaining slots with optional assignments (randomized)
                const shuffledOptional = [...optionalAssignments].sort(() => Math.random() - 0.5);
                shuffledOptional.forEach(assignment => {
                    const val = record[assignment as keyof HODApcRecord];
                    if (!val || val.toString().trim() === '') {
                        if (currentCount + newAssignments < 5) {
                            (newData as Record<string, string>)[assignment] = 'Post';
                            newAssignments++;
                        }
                    }
                });

                if (Object.keys(newData).length > 0) {
                    (newData as any).count = currentCount + newAssignments;
                    updates.push({ id: record.id, data: newData, fileNo: record.file_no });
                }
            });

            await onApply(updates);
            onClose();
        } catch (error) {
            console.error('Random generation failed:', error);
        } finally {
            setLoading(false);
        }
    };

    // Apply custom assignment from CSV
    const handleCustomApply = async () => {
        if (csvFileNumbers.length === 0) return;

        setLoading(true);
        try {
            const updates: { id: string; data: Partial<HODApcCreate>; fileNo: string }[] = [];
            const skipInfo = {
                alreadyHave: [] as string[],
                maxReached: [] as string[],
                notFound: [] as string[]
            };

            // Track which file numbers were found
            const foundFileNos = new Set<string>();

            records.forEach(record => {
                if (csvFileNumbers.includes(record.file_no)) {
                    foundFileNos.add(record.file_no);
                    const currentCount = countAssignments(record);

                    // Check if already has this assignment
                    const existingValue = record[selectedAssignment as keyof HODApcRecord];
                    if (existingValue && existingValue.toString().trim() !== '') {
                        skipInfo.alreadyHave.push(record.file_no);
                        return;
                    }

                    // Check max assignments
                    if (currentCount >= 5) {
                        skipInfo.maxReached.push(record.file_no);
                        return;
                    }

                    // Custom mode: No restrictions, apply to all matched HODs
                    updates.push({
                        id: record.id,
                        data: {
                            [selectedAssignment]: 'Post',
                            count: currentCount + 1
                        },
                        fileNo: record.file_no
                    });
                }
            });

            // Find file numbers that weren't in records
            csvFileNumbers.forEach(fileNo => {
                if (!foundFileNos.has(fileNo)) {
                    skipInfo.notFound.push(fileNo);
                }
            });

            await onApply(updates, skipInfo);
            setCsvFileNumbers([]);
            onClose();
        } catch (error) {
            console.error('Custom assignment failed:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4 transition-all duration-300">
            <div className="bg-white/95 dark:bg-[#121b25]/95 backdrop-blur-xl rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh] border border-slate-200/50 dark:border-gray-700/50">
                {/* Header */}
                <div className="flex-none flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-700 bg-gradient-to-r from-amber-50/50 via-white to-orange-50/50 dark:from-amber-900/20 dark:via-[#121b25] dark:to-orange-900/20 rounded-t-2xl">
                    <div className="flex flex-col">
                        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-400 tracking-tight">
                            HOD Assignment Generator
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Generate or upload assignments</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex-none flex border-b border-slate-100 dark:border-gray-700">
                    <button
                        onClick={() => setActiveTab('random')}
                        className={`flex-1 py-3 px-4 text-sm font-bold transition-all ${activeTab === 'random' ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50 dark:bg-amber-900/20' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <span className="material-symbols-outlined text-lg align-middle mr-2">shuffle</span>
                        Random Assignment
                    </button>
                    <button
                        onClick={() => setActiveTab('custom')}
                        className={`flex-1 py-3 px-4 text-sm font-bold transition-all ${activeTab === 'custom' ? 'text-amber-600 border-b-2 border-amber-600 bg-amber-50/50 dark:bg-amber-900/20' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}
                    >
                        <span className="material-symbols-outlined text-lg align-middle mr-2">upload_file</span>
                        Custom (CSV Upload)
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === 'random' ? (
                        <div className="flex flex-col gap-6">
                            {/* Rules Card */}
                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-200 dark:border-gray-700">
                                <h3 className="font-bold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-amber-500">rule</span>
                                    Assignment Rules
                                </h3>
                                <ul className="space-y-2 text-sm">
                                    <li className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                                        <span className="material-symbols-outlined text-lg">check_circle</span>
                                        <span><b>All HODs:</b> SSCE-INT, SSCE-INT-MRK (mandatory)</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                        <span className="material-symbols-outlined text-lg">school</span>
                                        <span><b>Education qualified:</b> + MAR-ACCR, OCT-ACCR</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-rose-600 dark:text-rose-400">
                                        <span className="material-symbols-outlined text-lg">block</span>
                                        <span><b>Excluded:</b> STOCK-TK, INT-AUDIT, PUR-SAMP, SWAPPING, NCEE, GIFTED</span>
                                    </li>
                                    <li className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                                        <span className="material-symbols-outlined text-lg">speed</span>
                                        <span><b>Max 5</b> assignments per HOD</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Stats */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                                    <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{records.length}</p>
                                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Total HODs</p>
                                </div>
                                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
                                    <p className="text-3xl font-black text-blue-600 dark:text-blue-400">{eduQualifiedCount}</p>
                                    <p className="text-sm font-medium text-blue-700 dark:text-blue-300">Education Qualified</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-6">
                            {/* Assignment Select */}
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Select Assignment</label>
                                <select
                                    value={selectedAssignment}
                                    onChange={(e) => setSelectedAssignment(e.target.value)}
                                    className="w-full h-12 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                                >
                                    {availableAssignments.map(a => (
                                        <option key={a.key} value={a.key}>{a.label}</option>
                                    ))}
                                </select>
                            </div>

                            {/* CSV Upload */}
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Upload CSV with File Numbers</label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            const csvContent = "FileNo\n0001\n0002\n0003";
                                            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                            const link = document.createElement('a');
                                            link.href = URL.createObjectURL(blob);
                                            link.download = 'hod_assignment_template.csv';
                                            link.click();
                                        }}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">download</span>
                                        Download Template
                                    </button>
                                </div>
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-slate-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-amber-500 hover:bg-amber-50/50 dark:hover:bg-amber-900/20 transition-all"
                                >
                                    <span className="material-symbols-outlined text-4xl text-slate-400 dark:text-slate-500 mb-2">cloud_upload</span>
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Click to upload or drag and drop</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">CSV file with File Numbers in first column</p>
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv"
                                    onChange={handleCsvUpload}
                                    className="hidden"
                                />
                            </div>

                            {/* CSV Results */}
                            {csvFileNumbers.length > 0 && (
                                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800">
                                    <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                                        <span className="material-symbols-outlined text-lg align-middle mr-1">check_circle</span>
                                        {csvFileNumbers.length} file numbers loaded
                                    </p>
                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                                        Matching HODs: {records.filter(r => csvFileNumbers.includes(r.file_no)).length}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex-none flex justify-end gap-4 p-6 border-t border-slate-100 dark:border-gray-700 bg-white dark:bg-[#121b25] rounded-b-2xl">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                    {activeTab === 'random' ? (
                        <button
                            onClick={handleRandomGenerate}
                            disabled={loading || records.length === 0}
                            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg hover:shadow-amber-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <><span className="material-symbols-outlined animate-spin">progress_activity</span> Generating...</>
                            ) : (
                                <><span className="material-symbols-outlined">shuffle</span> Generate Random Assignments</>
                            )}
                        </button>
                    ) : (
                        <button
                            onClick={handleCustomApply}
                            disabled={loading || csvFileNumbers.length === 0}
                            className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold text-sm shadow-lg hover:shadow-amber-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? (
                                <><span className="material-symbols-outlined animate-spin">progress_activity</span> Applying...</>
                            ) : (
                                <><span className="material-symbols-outlined">check</span> Apply Assignment</>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HODApcList;
