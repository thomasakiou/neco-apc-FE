import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { useNavigate } from 'react-router-dom';
import { getStateList, deleteState, createState, updateState, uploadStateCsv, getAllStates, bulkDeleteStates, getMarkingVenuesByState, getCustodiansByState, getSchoolsByState, getMarkingVenuesByStateName, getSchoolsByStateName, getNCEECentersByStateName } from '../../services/state';
import { getSSCECustodiansByState, getBECECustodiansByState } from '../../services/custodianSpecific';
import { State, StateCreate, MarkingVenue, Custodian, School } from '../../types/state';
import StateModal from './StateModal';
import AlertModal from '../../components/AlertModal';

const StateManagement: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortField, setSortField] = useState<keyof State | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [allStates, setAllStates] = useState<State[]>([]);
    const [selectedStateCode, setSelectedStateCode] = useState('All');
    const [selectedStateName, setSelectedStateName] = useState('All');
    const [selectedZone, setSelectedZone] = useState('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [relatedData, setRelatedData] = useState<{
        [stateId: string]: {
            ssceCustodians?: any[];
            beceCustodians?: any[];
            loading?: boolean;
        }
    }>({});

    const uniqueStateCodes = useMemo(() => Array.from(new Set(allStates.map(s => s.state_code).filter(Boolean))) as string[], [allStates]);
    const uniqueStateNames = useMemo(() => Array.from(new Set(allStates.map(s => s.name).filter(Boolean))) as string[], [allStates]);
    const uniqueZones = useMemo(() => Array.from(new Set(allStates.map(s => s.zone).filter(Boolean))) as string[], [allStates]);

    const filteredStates = useMemo(() => {
        let result = allStates;

        // Search Filter
        if (debouncedSearchTerm) {
            const lowerTerm = debouncedSearchTerm.toLowerCase().trim();
            result = result.filter(state =>
                state.name?.toLowerCase().includes(lowerTerm) ||
                state.state_code?.toLowerCase().includes(lowerTerm) ||
                state.capital?.toLowerCase().includes(lowerTerm) ||
                state.zone?.toLowerCase().includes(lowerTerm)
            );
        }

        // Dropdown Filters
        if (selectedStateCode !== 'All') {
            result = result.filter(state => state.state_code === selectedStateCode);
        }
        if (selectedStateName !== 'All') {
            result = result.filter(state => state.name === selectedStateName);
        }
        if (selectedZone !== 'All') {
            result = result.filter(state => state.zone === selectedZone);
        }

        // SORT LOGIC
        if (sortField) {
            result = [...result].sort((a, b) => {
                const aValue = a[sortField];
                const bValue = b[sortField];

                if (aValue === null || aValue === undefined) return 1;
                if (bValue === null || bValue === undefined) return -1;

                if (typeof aValue === 'string' && typeof bValue === 'string') {
                    const comparison = aValue.toLowerCase().localeCompare(bValue.toLowerCase());
                    return sortDirection === 'asc' ? comparison : -comparison;
                }

                const comparison = aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
                return sortDirection === 'asc' ? comparison : -comparison;
            });
        }

        return result;
    }, [allStates, debouncedSearchTerm, selectedStateCode, selectedStateName, selectedZone, sortField, sortDirection]);

    const total = filteredStates.length;

    const paginatedStates = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredStates.slice(startIndex, startIndex + limit);
    }, [filteredStates, page, limit]);

    // For bulk actions selection
    const allFilteredStates = filteredStates;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingState, setEditingState] = useState<State | null>(null);
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type?: 'success' | 'error' | 'warning' | 'info';
        details?: any;
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const response = await uploadStateCsv(file);
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
            fetchAllStates();
        } catch (error: any) {
            console.error('Upload failed:', error);
            setAlertModal({
                isOpen: true,
                title: 'Upload Failed',
                message: error.message || 'An error occurred while uploading the file.',
                type: 'error'
            });
        } finally {
            setLoading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    useEffect(() => {
        setPage(1);
    }, [debouncedSearchTerm, selectedStateCode, selectedStateName, selectedZone]);

    const handleSort = useCallback((field: keyof State) => {
        setSortField(prev => {
            if (prev === field) {
                setSortDirection(d => (d === 'asc' ? 'desc' : 'asc'));
                return field;
            }
            setSortDirection('asc');
            return field;
        });
    }, []);

    const fetchAllStates = useCallback(async (force: boolean = false) => {
        setLoading(true);
        try {
            const data = await getAllStates(force);
            setAllStates(Array.isArray(data) ? data : []);
        } catch (e) {
            console.error("Failed to load states", e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAllStates();
    }, [fetchAllStates]);

    const handleDelete = async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this state? This action cannot be undone.',
            type: 'warning',
            onConfirm: async () => {
                try {
                    await deleteState(id);
                    fetchAllStates();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'State deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting state:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete state.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleEdit = useCallback((state: State) => {
        setEditingState(state);
        setIsModalOpen(true);
    }, []);

    const handleAdd = useCallback(() => {
        setEditingState(null);
        setIsModalOpen(true);
    }, []);

    const handleModalSubmit = useCallback(async (data: StateCreate) => {
        try {
            if (editingState) {
                await updateState(editingState.id, data);
            } else {
                await createState(data);
            }
            fetchAllStates();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving state:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to save state. Please check your inputs and try again.',
                type: 'error'
            });
            throw error;
        }
    }, [editingState, fetchAllStates]);

    const handleSelectAll = useCallback((checked: boolean) => {
        if (checked) {
            const allIds = new Set(filteredStates.map(s => s.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    }, [filteredStates]);

    const handleSelectOne = useCallback((id: string, checked: boolean) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (checked) next.add(id);
            else next.delete(id);
            return next;
        });
    }, []);

    const toggleRowExpansion = useCallback(async (stateId: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(stateId)) {
            newExpanded.delete(stateId);
        } else {
            newExpanded.add(stateId);
            // Load related data if not already loaded
            if (!relatedData[stateId] || (!relatedData[stateId].ssceCustodians && !relatedData[stateId].beceCustodians)) {
                setRelatedData(prev => ({ ...prev, [stateId]: { loading: true } }));
                try {
                    const state = allStates.find(s => s.id === stateId);
                    if (!state) return;

                    const [ssceRes, beceRes] = await Promise.all([
                        getSSCECustodiansByState(state.name).catch(() => []),
                        getBECECustodiansByState(state.name).catch(() => [])
                    ]);

                    const normalizeData = (data: any) => {
                        if (Array.isArray(data)) return data;
                        if (data && Array.isArray(data.items)) return data.items;
                        return [];
                    };

                    setRelatedData(prev => ({
                        ...prev,
                        [stateId]: {
                            ssceCustodians: normalizeData(ssceRes),
                            beceCustodians: normalizeData(beceRes),
                            loading: false
                        }
                    }));
                } catch (error) {
                    console.error('Error loading related data:', error);
                    setRelatedData(prev => ({ ...prev, [stateId]: { loading: false } }));
                }
            }
        }
        setExpandedRows(newExpanded);
    }, [expandedRows, allStates, relatedData]);

    const totalPages = Math.ceil(total / limit);
    const isAllSelected = allFilteredStates.length > 0 && allFilteredStates.every(s => selectedIds.has(s.id));

    const downloadCsvTemplate = useCallback(() => {
        const headers = ['state_code', 'name', 'capital', 'zone', 'mkv_count', 'schools_count', 'custodians_count'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "state_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, []);

    const handleExport = useCallback(() => {
        try {
            const headers = ['Code', 'State Name', 'Capital', 'Zone', 'MKV', 'Schools', 'Custodians'];
            const rows = filteredStates.map(state => [
                state.state_code,
                state.name,
                state.capital,
                state.zone,
                state.mkv_count,
                state.schools_count,
                state.custodians_count
            ]);

            const csvContent = "data:text/csv;charset=utf-8,"
                + headers.join(",") + "\n"
                + rows.map(r => r.join(",")).join("\n");

            const encodedUri = encodeURI(csvContent);
            const link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", `State_Records_${new Date().toISOString().split('T')[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Export failed:', error);
        }
    }, [filteredStates]);

    const handleBulkDelete = useCallback(() => {
        if (selectedIds.size === 0) {
            setAlertModal({
                isOpen: true,
                title: 'No Selection',
                message: 'Please select at least one state to delete.',
                type: 'warning'
            });
            return;
        }

        setAlertModal({
            isOpen: true,
            title: 'Confirm Bulk Deletion',
            message: `Are you sure you want to delete ${selectedIds.size} selected state(s)? This action cannot be undone.`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    await bulkDeleteStates(Array.from(selectedIds));
                    setSelectedIds(new Set());
                    fetchAllStates();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: `Successfully deleted ${selectedIds.size} state(s).`,
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting states:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete some states. Please try again.',
                        type: 'error'
                    });
                }
            }
        });
    }, [selectedIds, fetchAllStates]);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            <StateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingState}
            />

            <AlertModal
                isOpen={alertModal.isOpen}
                onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
                details={alertModal.details}
                onConfirm={alertModal.onConfirm}
            />

            {/* Header */}
            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4 px-2">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                        State Configuration
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse ml-2" />
                    </h1>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">Geographical Infrastructure Management</p>
                </div>

                <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => fetchAllStates(true)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm"
                        title="Refresh Data from Backend"
                    >
                        <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                        Refresh
                    </button>
                    <button
                        onClick={handleAdd}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl shadow-lg hover:shadow-emerald-500/25 hover:-translate-y-0.5 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">add_location</span>
                        Add State
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Export
                    </button>
                </div>
            </header>

            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 transition-colors duration-200">
                {/* Filters */}
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 mb-8 px-2">
                    <div className="relative group w-full lg:max-w-md">
                        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                        <input
                            type="text"
                            placeholder="Search states, codes or capitals..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-12 pl-12 pr-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl text-sm font-medium focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all shadow-sm"
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
                        <FilterSelect
                            label="State Name"
                            value={selectedStateName}
                            options={uniqueStateNames}
                            onChange={setSelectedStateName}
                        />
                        <FilterSelect
                            label="State Code"
                            value={selectedStateCode}
                            options={uniqueStateCodes}
                            onChange={setSelectedStateCode}
                        />
                        <FilterSelect
                            label="Zone"
                            value={selectedZone}
                            options={uniqueZones}
                            onChange={setSelectedZone}
                        />
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
                        {selectedIds.size > 0 && (
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">delete</span>
                                Delete Selected ({selectedIds.size})
                            </button>
                        )}
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
                                <thead className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-300 dark:border-gray-700">
                                    <tr>
                                        <th className="p-4 w-10"></th>
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                checked={isAllSelected}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <SortableHeader field="state_code" label="Code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="name" label="State Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="capital" label="Capital" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="zone" label="Zone" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />

                                        <SortableHeader field="mkv_count" label="MKV" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                        <SortableHeader field="schools_count" label="Schools" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                        <SortableHeader field="custodians_count" label="Custodians" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
                                    {paginatedStates.length === 0 ? (
                                        <tr>
                                            <td colSpan={9} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <p className="font-medium">No states found</p>
                                                    <p className="text-xs">Try adjusting your search or filters</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedStates.map((state) => (
                                            <StateRow
                                                key={state.id}
                                                state={state}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                isSelected={selectedIds.has(state.id)}
                                                onSelect={handleSelectOne}
                                                isExpanded={expandedRows.has(state.id)}
                                                onToggleExpand={toggleRowExpansion}
                                                relatedData={relatedData[state.id]}
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
                        Showing <span className="text-slate-900 dark:text-slate-200 font-bold">{(page - 1) * limit + 1}</span> to <span className="text-slate-900 dark:text-slate-200 font-bold">{Math.min(page * limit, total)}</span> of <span className="text-slate-900 dark:text-slate-200 font-bold">{total}</span> results
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
                            <span className="material-symbols-outlined text-xl">chevron_left</span>
                        </button>
                        <span className="flex items-center px-4 rounded-lg bg-slate-50 dark:bg-purple-900/20 text-sm font-bold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-transparent">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl">chevron_right</span>
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(totalPages)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 dark:hover:bg-primary/10 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="Last Page"
                        >
                            <span className="material-symbols-outlined text-xl">last_page</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SortableHeader = React.memo(({
    field,
    label,
    sortField,
    sortDirection,
    onSort,
    center = false
}: {
    field: keyof State;
    label: string;
    sortField: keyof State | null;
    sortDirection: 'asc' | 'desc';
    onSort: (field: keyof State) => void;
    center?: boolean;
}) => {
    const isActive = sortField === field;

    return (
        <th
            className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors select-none ${center ? 'text-center' : ''}`}
            onClick={() => onSort(field)}
        >
            <div className={`flex items-center gap-2 ${center ? 'justify-center' : ''}`}>
                <span>{label}</span>
                <span className={`material-symbols-outlined text-lg transition-all ${isActive ? 'text-emerald-600' : 'text-slate-300'
                    }`}>
                    {isActive && sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                </span>
            </div>
        </th>
    );
});

const FilterSelect = React.memo(({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (val: string) => void }) => (
    <div className="relative min-w-[200px]">
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer focus:ring-primary focus:border-primary truncate"
        >
            <option value="All">{label}: All</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">arrow_drop_down</span>
    </div>
));

interface StateRowProps {
    state: State;
    onEdit: (state: State) => void;
    onDelete: (id: string) => void | Promise<void>;
    isSelected: boolean;
    onSelect: (id: string, checked: boolean) => void;
    isExpanded: boolean;
    onToggleExpand: (id: string) => void | Promise<void>;
    relatedData?: {
        ssceCustodians?: any[];
        beceCustodians?: any[];
        loading?: boolean;
    };
}

const StateRow = React.memo<StateRowProps>(({
    state,
    onEdit,
    onDelete,
    isSelected,
    onSelect,
    isExpanded,
    onToggleExpand,
    relatedData
}) => {
    const navigate = useNavigate();
    return (
        <React.Fragment>
            <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4">
                    <button
                        onClick={() => onToggleExpand(state.id)}
                        className="flex items-center justify-center w-6 h-6 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        <span className={`material-symbols-outlined text-lg text-slate-600 dark:text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                            chevron_right
                        </span>
                    </button>
                </td>
                <td className="p-4 text-center">
                    <input
                        type="checkbox"
                        className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                        checked={isSelected}
                        onChange={(e) => onSelect(state.id, e.target.checked)}
                    />
                </td>
                <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300 text-sm">{state.state_code}</td>
                <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 text-sm">{state.name}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400 text-sm">{state.capital}</td>
                <td className="px-4 py-4 text-slate-600 dark:text-slate-400 text-sm">{state.zone || '-'}</td>

                <td className="px-4 py-4 text-center">
                    <span className="inline-flex px-2 py-1 rounded-md text-xs font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400">
                        {state.mkv_count}
                    </span>
                </td>
                <td className="px-4 py-4 text-center">
                    <span className="inline-flex px-2 py-1 rounded-md text-xs font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">
                        {state.schools_count}
                    </span>
                </td>
                <td className="px-4 py-4 text-center">
                    <span className="inline-flex px-2 py-1 rounded-md text-xs font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        {state.custodians_count}
                    </span>
                </td>
                <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={() => onEdit(state)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300 transition-all"
                            title="Edit"
                        >
                            <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                            onClick={() => onDelete(state.id)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-700 dark:hover:text-rose-300 transition-all"
                            title="Delete"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr>
                    <td colSpan={10} className="bg-slate-50/50 dark:bg-slate-800/30 p-6">
                        {relatedData?.loading ? (
                            <div className="flex items-center justify-center py-8">
                                <span className="material-symbols-outlined animate-spin text-2xl text-primary/50">donut_large</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div className="bg-white dark:bg-[#0b1015] rounded-lg border border-emerald-200 dark:border-emerald-900/40 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">security</span>
                                            SSCE Custodians ({relatedData?.ssceCustodians?.length || 0})
                                        </h3>
                                        <button
                                            onClick={() => navigate(`/admin/ssce-custodians?state=${encodeURIComponent(state.name)}`)}
                                            className="text-xs px-2 py-1 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 rounded hover:bg-emerald-200 dark:hover:bg-emerald-900/50 transition-colors font-bold"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {relatedData?.ssceCustodians?.map((custodian: any) => (
                                            <div key={custodian.id} className="text-xs p-2 bg-emerald-50 dark:bg-emerald-900/10 rounded border border-emerald-100 dark:border-emerald-900/20">
                                                <div className="font-bold text-emerald-900 dark:text-emerald-200">{custodian.name}</div>
                                                {custodian.code && <div className="text-emerald-600 dark:text-emerald-400">Code: {custodian.code}</div>}
                                                <div className="text-emerald-600 dark:text-emerald-400">Centers: {custodian.numb_of_centers}</div>
                                            </div>
                                        )) || <p className="text-xs text-slate-400">No SSCE custodians</p>}
                                    </div>
                                </div>
                                <div className="bg-white dark:bg-[#0b1015] rounded-lg border border-teal-200 dark:border-teal-900/40 p-4">
                                    <div className="flex items-center justify-between mb-3">
                                        <h3 className="text-sm font-bold text-teal-700 dark:text-teal-400 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-lg">verified_user</span>
                                            BECE Custodians ({relatedData?.beceCustodians?.length || 0})
                                        </h3>
                                        <button
                                            onClick={() => navigate(`/admin/bece-custodians?state=${encodeURIComponent(state.name)}`)}
                                            className="text-xs px-2 py-1 bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 rounded hover:bg-teal-200 dark:hover:bg-teal-900/50 transition-colors font-bold"
                                        >
                                            View All
                                        </button>
                                    </div>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {relatedData?.beceCustodians?.map((custodian: any) => (
                                            <div key={custodian.id} className="text-xs p-2 bg-teal-50 dark:bg-teal-900/10 rounded border border-teal-100 dark:border-teal-900/20">
                                                <div className="font-bold text-teal-900 dark:text-teal-200">{custodian.name}</div>
                                                {custodian.code && <div className="text-teal-600 dark:text-teal-400">Code: {custodian.code}</div>}
                                                <div className="text-teal-600 dark:text-teal-400">Centers: {custodian.numb_of_centers}</div>
                                            </div>
                                        )) || <p className="text-xs text-slate-400">No BECE custodians</p>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
});

export default StateManagement;
