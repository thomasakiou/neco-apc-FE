import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { APCRecord, APCCreate, APCUpdate } from '../../types/apc';
import { getAllAPC, createAPC, updateAPC, deleteAPC, uploadAPC, bulkDeleteAPC, getAllAPCRecords } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllPostingRecords, updatePosting } from '../../services/posting';
import { PostingResponse } from '../../types/posting';
import { assignmentFieldMap } from '../../services/personalizedPost';
import { Assignment } from '../../types/assignment';
import AlertModal from '../../components/AlertModal';
import * as XLSX from 'xlsx';

const APCList: React.FC = () => {
    const [allRecords, setAllRecords] = useState<APCRecord[]>([]);
    const [allPostings, setAllPostings] = useState<PostingResponse[]>([]);
    const [loading, setLoading] = useState(true);
    // Search and Filter States
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // Sorting State
    const [sortField, setSortField] = useState<keyof APCRecord | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');


    const [assignmentOptions, setAssignmentOptions] = useState<Assignment[]>([]);

    // Filters
    const [searchFileNo, setSearchFileNo] = useState('');
    const [searchName, setSearchName] = useState('');
    const [filterConraiss, setFilterConraiss] = useState('');
    const [filterStation, setFilterStation] = useState('');
    const [filterAssignment, setFilterAssignment] = useState('');

    // Debounced search
    const debouncedSearchFileNo = useDebounce(searchFileNo, 300);
    const debouncedSearchName = useDebounce(searchName, 300);
    const debouncedFilterStation = useDebounce(filterStation, 300);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState<APCRecord | null>(null);
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type: 'success' | 'error' | 'warning' | 'info';
        details?: any;
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', type: 'info' });

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearchFileNo, debouncedSearchName, filterConraiss, debouncedFilterStation, filterAssignment]);

    const filteredRecords = useMemo(() => {
        let result = [...allRecords];

        // FILTER LOGIC
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
                    const val = record[fieldName as keyof APCRecord];
                    return !!(val && val.toString().trim() !== '');
                });
            }
        }

        // SORT LOGIC
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

    // Update dropdown options based on allRecords
    const conraissOptions = useMemo(() => {
        return Array.from(new Set(allRecords.map(r => r.conraiss).filter(Boolean))).sort() as string[];
    }, [allRecords]);

    const stationOptions = useMemo(() => {
        return Array.from(new Set(allRecords.map(r => r.station).filter(Boolean))).sort() as string[];
    }, [allRecords]);

    const fetchAllRecords = useCallback(async () => {
        setLoading(true);
        try {
            const [all, postingsData] = await Promise.all([
                getAllAPCRecords(false, true),
                getAllPostingRecords(true)
            ]);
            setAllRecords(all);
            setAllPostings(postingsData);
        } catch (error) {
            console.error('Error fetching all records:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to fetch records. Please try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, []);

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

    const handleSort = useCallback((field: keyof APCRecord) => {
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
            message: `Are you sure you want to delete ${selectedIds.size} APC record(s)?`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await bulkDeleteAPC(Array.from(selectedIds));

                    setSelectedIds(new Set());

                    // Background re-sync
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
            const allData = await getAllAPC(0, 100000, '');

            const filteredExport = allData.items.filter(record => {
                const matchFileNo = record.file_no.toLowerCase().includes(searchFileNo.toLowerCase().trim());
                const matchName = record.name.toLowerCase().includes(searchName.toLowerCase().trim());
                const matchConraiss = filterConraiss ? record.conraiss === filterConraiss : true;
                const matchStation = filterStation ? record.station === filterStation : true;
                return matchFileNo && matchName && matchConraiss && matchStation;
            });

            const exportData = filteredExport.map(record => ({
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
            XLSX.utils.book_append_sheet(wb, ws, "APC List");
            XLSX.writeFile(wb, `APC_List_${new Date().toISOString().split('T')[0]}.xlsx`);

            setAlertModal({
                isOpen: true,
                title: 'Export Successful',
                message: 'APC records have been exported to Excel.',
                type: 'success'
            });
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Export Failed',
                message: 'Failed to export APC records.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, [searchFileNo, searchName, filterConraiss, filterStation]);

    const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const response = await uploadAPC(file);
            setAlertModal({
                isOpen: true,
                title: 'Upload Complete',
                message: 'CSV file has been processed successfully.',
                type: 'success',
                details: {
                    created: response.created_count,
                    skipped: response.skipped_count,
                    errors: response.error_count,
                    skippedData: response.skipped || [],
                    errorData: response.errors || []
                }
            });
            fetchAllRecords();
        } catch (error: any) {
            console.error('Upload failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Upload Failed',
                message: error.message || 'An error occurred while uploading the file.',
                type: 'error'
            });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            setLoading(false);
        }
    }, [fetchAllRecords]);

    const handleEdit = useCallback((record: APCRecord) => {
        setEditingRecord(record);
        setShowAddModal(true);
    }, []);

    const handleDelete = useCallback(async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Delete',
            message: 'Are you sure you want to delete this APC record? This action cannot be undone.',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await deleteAPC(id);

                    // Background re-sync
                    fetchAllRecords();

                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'APC record deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting APC record:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete APC record.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    }, [fetchAllRecords]);

    const downloadCsvTemplate = () => {
        const headers = [
            'file_no', 'name', 'conraiss', 'station', 'qualification', 'sex',
            'tt', 'mar_accr', 'ncee', 'gifted', 'becep', 'bece_mrkp',
            'ssce_int', 'swapping', 'ssce_int_mrk', 'oct_accr', 'ssce_ext',
            'ssce_ext_mrk', 'pur_samp', 'int_audit', 'stock_tk', 'count', 'year', 'remark'
        ];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "apc_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto transition-colors duration-200">
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        Annual Posting Calendar (APC)
                    </h1>
                    <p className="text-sm md:text-base lg:text-lg text-slate-500 dark:text-slate-400 font-medium">Manage staff mandate assignments and qualifications.</p>
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
                        onClick={handleExport}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-indigo-400 to-indigo-600 dark:from-indigo-300 dark:to-indigo-500 group-hover:scale-110 transition-transform text-lg">download</span>
                        Export List
                    </button>
                    <button
                        onClick={downloadCsvTemplate}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-slate-400 to-slate-600 dark:from-slate-300 dark:to-slate-500 group-hover:scale-110 transition-transform text-lg">download</span>
                        Template
                    </button>
                    <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-transparent bg-clip-text bg-gradient-to-br from-emerald-500 to-teal-600 dark:from-emerald-400 dark:to-teal-500 group-hover:scale-110 transition-transform text-lg">upload_file</span>
                        Import
                    </button>
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-600 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined group-hover:rotate-90 transition-transform text-lg">add</span>
                        Add Record
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 transition-colors duration-200">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col gap-4 w-full">
                        {/* Search Row */}
                        <div className="flex flex-col md:flex-row gap-4 w-full">
                            {/* File No Search */}
                            <div className="relative flex-1 md:max-w-xs">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">tag</span>
                                </div>
                                <input
                                    className="w-full pl-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-700 dark:text-slate-200"
                                    placeholder="Search by File No..."
                                    value={searchFileNo}
                                    onChange={(e) => setSearchFileNo(e.target.value)}
                                />
                            </div>

                            {/* Name Search */}
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                                </div>
                                <input
                                    className="w-full pl-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-sm text-slate-700 dark:text-slate-200"
                                    placeholder="Search by Name..."
                                    value={searchName}
                                    onChange={(e) => setSearchName(e.target.value)}
                                />
                            </div>
                        </div>

                        {/* Filter Row */}
                        <div className="flex flex-col md:flex-row gap-4 w-full items-center">
                            {/* CONRAISS Filter */}
                            <div className="relative w-full md:w-48">
                                <select
                                    value={filterConraiss}
                                    onChange={(e) => setFilterConraiss(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">All CONRAISS</option>
                                    {conraissOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Station Filter */}
                            <div className="relative w-full md:w-64">
                                <select
                                    value={filterStation}
                                    onChange={(e) => setFilterStation(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm text-slate-700 dark:text-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">All Stations</option>
                                    {stationOptions.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Assignment Filter */}
                            <div className="relative w-full md:w-64">
                                <select
                                    value={filterAssignment}
                                    onChange={(e) => setFilterAssignment(e.target.value)}
                                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-sm font-bold text-black dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                                >
                                    <option value="">All Assignments</option>
                                    {assignmentOptions.map(opt => (
                                        <option key={opt.id} value={opt.code}>{opt.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex-1"></div>

                            {/* Pagination Limit */}
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Per page:</label>
                                <select
                                    value={limit}
                                    onChange={(e) => {
                                        setLimit(Number(e.target.value));
                                        setPage(1);
                                    }}
                                    className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                                >
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                    <option value={100}>100</option>
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
                                <span className="material-symbols-outlined animate-spin text-4xl text-primary/50">donut_large</span>
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
                                                onClick={() => {
                                                    if (expandedRows.size > 0) {
                                                        setExpandedRows(new Set());
                                                    } else {
                                                        const allIds = new Set(records.map(r => r.id));
                                                        setExpandedRows(allIds);
                                                    }
                                                }}
                                                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                                title={expandedRows.size > 0 ? "Collapse All" : "Expand All"}
                                            >
                                                <span className="material-symbols-outlined text-lg">
                                                    {expandedRows.size > 0 ? 'unfold_less' : 'unfold_more'}
                                                </span>
                                            </button>
                                        </th>
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
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
                                        <tr>
                                            <td colSpan={8} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <span className="text-sm font-medium">No records found</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        records.map((record) => (
                                            <APCRow
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
                        Showing <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : (page - 1) * limit + 1}</span> to <span className="text-slate-900 dark:text-white font-bold">{total === 0 ? 0 : Math.min((page - 1) * limit + records.length, total)}</span> of <span className="text-slate-900 dark:text-white font-bold">{total}</span> results
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="First Page"
                        >
                            <span className="material-symbols-outlined text-xl">first_page</span>
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
                        </button>
                        <div className="flex items-center px-4 rounded-lg bg-slate-50 dark:bg-purple-900/20 text-sm font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                            Page {page} of {total > 0 ? Math.ceil(total / limit) : 1}
                        </div>
                        <button
                            disabled={page >= Math.ceil(total / limit) || total === 0}
                            onClick={() => setPage(p => p + 1)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl group-hover:translate-x-0.5 transition-transform">chevron_right</span>
                        </button>
                        <button
                            disabled={page >= Math.ceil(total / limit) || total === 0}
                            onClick={() => setPage(Math.ceil(total / limit))}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Last Page"
                        >
                            <span className="material-symbols-outlined text-xl">last_page</span>
                        </button>
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

            <APCModal
                isOpen={showAddModal}
                onClose={() => {
                    setShowAddModal(false);
                    setEditingRecord(null);
                }}
                onSubmit={async (data) => {
                    try {
                        if (editingRecord) {
                            await updateAPC(editingRecord.id, data);

                            // SYNC LOGIC: Fetch FRESH postings to ensure we have latest counts
                            const currentPostings = await getAllPostingRecords(true);
                            const normFileNo = data.file_no.toString().padStart(4, '0');
                            const posting = currentPostings.find(p => p.file_no.toString().padStart(4, '0') === normFileNo);

                            if (posting) {
                                const newCount = Number(data.count || 0);
                                const postedFor = posting.posted_for || 0;
                                const newToBePosted = Math.max(0, newCount - postedFor);

                                await updatePosting(posting.id, {
                                    ...posting as any,
                                    count: newCount,
                                    posted_for: postedFor,
                                    to_be_posted: newToBePosted
                                });
                            }
                            setAlertModal({ isOpen: true, title: 'Success', message: 'APC record updated and posting synced successfully.', type: 'success' });
                        } else {
                            await createAPC(data);
                            setAlertModal({ isOpen: true, title: 'Success', message: 'APC record created successfully.', type: 'success' });
                        }
                        fetchAllRecords();
                    } catch (error: any) {
                        console.error("Submit failed", error);
                        setAlertModal({ isOpen: true, title: 'Error', message: `Failed to save record: ${error.message}`, type: 'error' });
                    }
                }}
                initialData={editingRecord}
            />
        </div>
    );
};

const APCRow = React.memo<{
    record: APCRecord;
    isSelected: boolean;
    onSelect: (checked: boolean) => void;
    onEdit: () => void;
    onDelete: () => void;
    isExpanded: boolean;
    onToggleExpand: () => void;
}>(({ record, isSelected, onSelect, onEdit, onDelete, isExpanded, onToggleExpand }) => {
    return (
        <React.Fragment>
            <tr className={`group hover:bg-primary/[0.02] dark:hover:bg-slate-800/50 transition-colors duration-150 ${isExpanded ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
                <td className="p-4 text-center">
                    <button
                        onClick={onToggleExpand}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                    >
                        <span className={`material-symbols-outlined transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                            chevron_right
                        </span>
                    </button>
                </td>
                <td className="p-4 text-center">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => onSelect(e.target.checked)}
                    />
                </td>
                <td className="px-4 py-4 font-mono text-base font-black text-slate-700 dark:text-slate-300">{record.file_no}</td>
                <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-200 font-bold text-sm ring-2 ring-white dark:ring-slate-800 shadow-sm">
                            {record.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-700 dark:text-slate-200 text-base">{record.name}</span>
                    </div>
                </td>
                <td className="px-4 py-4">
                    <span className="inline-flex px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-sm font-bold border border-slate-200 dark:border-slate-700">
                        {record.conraiss || '-'}
                    </span>
                </td>
                <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 text-base">{record.station || '-'}</td>
                <td className="px-4 py-4 text-center">
                    <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${record.active
                        ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        }`}>
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
                <tr className="bg-gray-100 dark:bg-slate-800/50">
                    <td colSpan={8} className="p-4 pl-16">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm text-slate-600 dark:text-slate-400">
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Qualification</span>
                                <span>{record.qualification || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Sex</span>
                                <span>{record.sex || '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">TT</span>
                                <span>{record.tt ? (record.tt.includes('.') ? parseFloat(record.tt).toString() : record.tt) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">MAR-ACCR</span>
                                <span>{record.mar_accr ? (record.mar_accr.includes('.') ? parseFloat(record.mar_accr).toString() : record.mar_accr) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">NCEE</span>
                                <span>{record.ncee ? (record.ncee.includes('.') ? parseFloat(record.ncee).toString() : record.ncee) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">GIFTED</span>
                                <span>{record.gifted ? (record.gifted.includes('.') ? parseFloat(record.gifted).toString() : record.gifted) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">BECEP</span>
                                <span>{record.becep ? (record.becep.includes('.') ? parseFloat(record.becep).toString() : record.becep) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">BECE-MRKP</span>
                                <span>{record.bece_mrkp ? (record.bece_mrkp.includes('.') ? parseFloat(record.bece_mrkp).toString() : record.bece_mrkp) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-INT</span>
                                <span>{record.ssce_int ? (record.ssce_int.includes('.') ? parseFloat(record.ssce_int).toString() : record.ssce_int) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SWAPPING</span>
                                <span>{record.swapping ? (record.swapping.includes('.') ? parseFloat(record.swapping).toString() : record.swapping) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-INT-MRK</span>
                                <span>{record.ssce_int_mrk ? (record.ssce_int_mrk.includes('.') ? parseFloat(record.ssce_int_mrk).toString() : record.ssce_int_mrk) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">OCT-ACCR</span>
                                <span>{record.oct_accr ? (record.oct_accr.includes('.') ? parseFloat(record.oct_accr).toString() : record.oct_accr) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-EXT</span>
                                <span>{record.ssce_ext ? (record.ssce_ext.includes('.') ? parseFloat(record.ssce_ext).toString() : record.ssce_ext) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">SSCE-EXT-MRK</span>
                                <span>{record.ssce_ext_mrk ? (record.ssce_ext_mrk.includes('.') ? parseFloat(record.ssce_ext_mrk).toString() : record.ssce_ext_mrk) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">PUR-SAMP</span>
                                <span>{record.pur_samp ? (record.pur_samp.includes('.') ? parseFloat(record.pur_samp).toString() : record.pur_samp) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">INT-AUDIT</span>
                                <span>{record.int_audit ? (record.int_audit.includes('.') ? parseFloat(record.int_audit).toString() : record.int_audit) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">STOCK-TK</span>
                                <span>{record.stock_tk ? (record.stock_tk.includes('.') ? parseFloat(record.stock_tk).toString() : record.stock_tk) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Count</span>
                                <span>{record.count ? Math.floor(record.count) : '-'}</span>
                            </div>
                            <div>
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Year</span>
                                <span>{record.year ? Math.floor(Number(record.year)) : '-'}</span>
                            </div>
                            <div className="col-span-2 md:col-span-4">
                                <span className="block font-bold text-slate-900 dark:text-slate-200 mb-1">Remark</span>
                                <span>{record.remark || '-'}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
});

const ActionBtn = ({ icon, isDanger, onClick, tooltip }: { icon: string; isDanger?: boolean; onClick?: () => void; tooltip?: string }) => (
    <button
        onClick={onClick}
        title={tooltip}
        className={`w-9 h-9 flex items-center justify-center rounded-lg transition-all duration-200 ${isDanger
            ? 'text-rose-400 hover:text-rose-600 hover:bg-rose-50'
            : 'text-slate-400 hover:text-primary hover:bg-primary/5'
            }`}
    >
        <span className="material-symbols-outlined text-[20px]">{icon}</span>
    </button>
);

const APCModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: APCCreate) => Promise<void>;
    initialData?: APCRecord | null;
}> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<APCCreate>({
        file_no: '',
        name: '',
        conraiss: '',
        station: '',
        qualification: '',
        sex: '',
        count: 1,
        active: true
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                file_no: initialData.file_no,
                name: initialData.name,
                conraiss: initialData.conraiss || '',
                station: initialData.station || '',
                qualification: initialData.qualification || '',
                sex: initialData.sex || '',
                tt: initialData.tt || '',
                mar_accr: initialData.mar_accr || '',
                ncee: initialData.ncee || '',
                gifted: initialData.gifted || '',
                becep: initialData.becep || '',
                bece_mrkp: initialData.bece_mrkp || '',
                ssce_int: initialData.ssce_int || '',
                swapping: initialData.swapping || '',
                ssce_int_mrk: initialData.ssce_int_mrk || '',
                oct_accr: initialData.oct_accr || '',
                ssce_ext: initialData.ssce_ext || '',
                ssce_ext_mrk: initialData.ssce_ext_mrk || '',
                pur_samp: initialData.pur_samp || '',
                int_audit: initialData.int_audit || '',
                stock_tk: initialData.stock_tk || '',
                count: initialData.count || 1,
                year: initialData.year || '',
                remark: initialData.remark || '',
                active: initialData.active ?? true
            });
        } else {
            setFormData({
                file_no: '',
                name: '',
                conraiss: '',
                station: '',
                qualification: '',
                sex: '',
                count: 1,
                active: true
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, checked } = e.target;
        setFormData(prev => ({ ...prev, [name]: checked }));
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
                            {initialData ? 'Edit APC Record' : 'Add New APC Record'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Annual Posting Calendar</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200 shadow-sm border border-transparent hover:border-rose-100 dark:hover:border-rose-800"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <form id="apc-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500 dark:text-emerald-400">person</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Basic Information</span>
                            </div>

                            <FloatingInput label="File Number" name="file_no" value={formData.file_no} onChange={handleChange} required />
                            <FloatingInput label="Name" name="name" value={formData.name} onChange={handleChange} required />
                            <FloatingInput label="CONRAISS" name="conraiss" value={formData.conraiss} onChange={handleChange} />
                            <FloatingInput label="Station" name="station" value={formData.station} onChange={handleChange} />
                            <FloatingInput label="Qualification" name="qualification" value={formData.qualification} onChange={handleChange} />
                            <SelectInput label="Gender" name="sex" value={formData.sex} onChange={handleChange} options={[{ value: 'M', label: 'Male' }, { value: 'F', label: 'Female' }]} />
                            <FloatingInput label="Count" type="number" name="count" value={formData.count} onChange={handleChange} />
                            <FloatingInput label="Year" name="year" value={formData.year} onChange={handleChange} />

                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 mt-4 flex items-center gap-2">
                                <span className="material-symbols-outlined text-teal-500 dark:text-teal-400">assignment</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Assignment Codes</span>
                            </div>

                            {assignmentFields.map(field => (
                                <FloatingInput key={field.key} label={field.label} name={field.key} value={(formData as any)[field.key] || ''} onChange={handleChange} />
                            ))}

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

                            <label className="flex items-center gap-3 p-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] cursor-pointer hover:bg-white dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-gray-600 transition-all md:col-span-2">
                                <input
                                    type="checkbox"
                                    name="active"
                                    checked={formData.active !== false}
                                    onChange={handleCheckboxChange}
                                    className="w-5 h-5 rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                />
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Active Record</span>
                            </label>
                        </div>
                    </form>
                </div>

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
                        form="apc-form"
                        disabled={loading}
                        className="px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:shadow-none flex items-center gap-2"
                    >
                        {loading && <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>}
                        {initialData ? 'Save Changes' : 'Create Record'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FloatingInput = React.memo(({ label, type = "text", value, ...props }: any) => (
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
));

const SelectInput = React.memo(({ label, options, ...props }: any) => (
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
));

const SortableHeader = React.memo(({ field, label, sortField, sortDirection, onSort }: any) => (
    <th
        className="px-4 py-3 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors text-sm font-bold uppercase tracking-wider"
        onClick={() => onSort(field)}
    >
        <div className="flex items-center gap-2">
            {label}
            <div className="flex flex-col text-[10px] text-slate-400 group-hover:text-slate-500">
                <span className={`material-symbols-outlined text-[10px] -mb-1 ${sortField === field && sortDirection === 'asc' ? 'text-primary' : ''}`}>expand_less</span>
                <span className={`material-symbols-outlined text-[10px] ${sortField === field && sortDirection === 'desc' ? 'text-primary' : ''}`}>expand_more</span>
            </div>
        </div>
    </th>
));

export default APCList;