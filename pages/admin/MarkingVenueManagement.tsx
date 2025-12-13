import React, { useEffect, useState, useRef } from 'react';
import { getMarkingVenueList, deleteMarkingVenue, createMarkingVenue, updateMarkingVenue, uploadMarkingVenueCsv, getAllMarkingVenues, bulkDeleteMarkingVenues } from '../../services/markingVenue';
import { MarkingVenue, MarkingVenueCreate } from '../../types/markingVenue';
import { getAllStates } from '../../services/state';
import { State } from '../../types/state';
import MarkingVenueModal from './MarkingVenueModal';
import AlertModal from '../../components/AlertModal';

const MarkingVenueManagement: React.FC = () => {
    const [venueList, setVenueList] = useState<MarkingVenue[]>([]);
    const [allVenues, setAllVenues] = useState<MarkingVenue[]>([]);
    const [states, setStates] = useState<State[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortField, setSortField] = useState<keyof MarkingVenue | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedState, setSelectedState] = useState('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const hasActiveFilters = selectedState !== 'All';

    const filteredVenues = venueList.filter(venue => {
        const matchesState = selectedState === 'All' || venue.state_id === selectedState;
        return matchesState;
    });

    const sortedVenues = [...filteredVenues].sort((a, b) => {
        if (!sortField) return 0;

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

    const allFilteredVenues = allVenues.filter(venue => {
        const matchesState = selectedState === 'All' || venue.state_id === selectedState;
        return matchesState;
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVenue, setEditingVenue] = useState<MarkingVenue | null>(null);
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
            const response = await uploadMarkingVenueCsv(file);
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
            fetchData();
            fetchAllVenues();
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
    }, [searchTerm]);

    useEffect(() => {
        setPage(1);
    }, [selectedState]);

    const fetchData = async () => {
        setLoading(true);
        try {
            if (hasActiveFilters) {
                const allData = await getAllMarkingVenues();
                const filtered = allData.filter(venue => {
                    const matchesSearch = !searchTerm ||
                        venue.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        venue.code?.toLowerCase().includes(searchTerm.toLowerCase());
                    const matchesState = selectedState === 'All' || venue.state_id === selectedState;
                    return matchesSearch && matchesState;
                });

                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                setVenueList(filtered.slice(startIndex, endIndex));
                setTotal(filtered.length);
            } else {
                const response = await getMarkingVenueList(page, limit, searchTerm);
                setVenueList(response.items);
                setTotal(response.total);
            }
        } catch (error) {
            console.error('Error fetching marking venues:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllVenues = async () => {
        try {
            const data = await getAllMarkingVenues();
            setAllVenues(data);
        } catch (error) {
            console.error('Error fetching all marking venues:', error);
        }
    };

    const fetchStates = async () => {
        try {
            const data = await getAllStates();
            setStates(data);
        } catch (error) {
            console.error('Error fetching states:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, [page, searchTerm, limit, selectedState]);

    useEffect(() => {
        fetchAllVenues();
        fetchStates();
    }, []);

    const handleDelete = async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this marking venue? This action cannot be undone.',
            type: 'warning',
            onConfirm: async () => {
                try {
                    await deleteMarkingVenue(id);
                    fetchData();
                    fetchAllVenues();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'Marking venue deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting marking venue:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete marking venue.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleEdit = (venue: MarkingVenue) => {
        setEditingVenue(venue);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingVenue(null);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (data: MarkingVenueCreate) => {
        try {
            if (editingVenue) {
                await updateMarkingVenue(editingVenue.id, data);
            } else {
                await createMarkingVenue(data);
            }
            fetchData();
            fetchAllVenues();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving marking venue:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to save marking venue. Please check your inputs and try again.',
                type: 'error'
            });
            throw error;
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(allFilteredVenues.map(v => v.id));
            setSelectedIds(allIds);
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) {
            newSelected.add(id);
        } else {
            newSelected.delete(id);
        }
        setSelectedIds(newSelected);
    };

    const handleSort = (field: keyof MarkingVenue) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const totalPages = Math.ceil(total / limit);
    const isAllSelected = allFilteredVenues.length > 0 && allFilteredVenues.every(v => selectedIds.has(v.id));

    const downloadCsvTemplate = () => {
        const headers = ['state_code', 'name', 'code', 'address', 'parcels', 'active'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "marking_venue_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) {
            setAlertModal({
                isOpen: true,
                title: 'No Selection',
                message: 'Please select at least one marking venue to delete.',
                type: 'warning'
            });
            return;
        }

        setAlertModal({
            isOpen: true,
            title: 'Confirm Bulk Deletion',
            message: `Are you sure you want to delete ${selectedIds.size} selected marking venue(s)? This action cannot be undone.`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    await bulkDeleteMarkingVenues(Array.from(selectedIds));
                    setSelectedIds(new Set());
                    fetchData();
                    fetchAllVenues();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: `Successfully deleted ${selectedIds.size} marking venue(s).`,
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting marking venues:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete some marking venues. Please try again.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const getStateName = (stateId: string) => {
        const state = states.find(s => s.id === stateId);
        return state?.name || 'Unknown';
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            <MarkingVenueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingVenue}
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
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                    <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                        Marking Venue Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Manage marking venues and locations</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        onChange={handleFileUpload}
                        className="hidden"
                        id="csv-upload"
                    />
                    <button
                        onClick={downloadCsvTemplate}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-300 transition-all shadow-sm"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Template
                    </button>
                    <label
                        htmlFor="csv-upload"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 hover:border-teal-300 transition-all cursor-pointer shadow-sm"
                    >
                        <span className="material-symbols-outlined text-lg">upload_file</span>
                        Upload CSV
                    </label>
                    <button
                        onClick={handleAdd}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">add</span>
                        Add Venue
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 transition-colors">
                {/* Filters */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-slate-400 text-lg">search</span>
                            </div>
                            <input
                                className="w-full pl-10 h-10 rounded-lg border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-primary focus:ring-[3px] focus:ring-primary/20 transition-all duration-200 text-slate-700 dark:text-slate-200 font-medium text-sm placeholder:text-slate-400"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Per page:</label>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-bold text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 cursor-pointer"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                        <div className="relative min-w-[200px]">
                            <select
                                value={selectedState}
                                onChange={(e) => setSelectedState(e.target.value)}
                                className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer focus:ring-primary focus:border-primary truncate"
                            >
                                <option value="All">State: All</option>
                                {states.map(state => <option key={state.id} value={state.id}>{state.name}</option>)}
                            </select>
                            <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 text-lg pointer-events-none">arrow_drop_down</span>
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
                <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/50">
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
                                <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-gray-700">
                                    <tr>
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                checked={isAllSelected}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <SortableHeader field="name" label="Venue Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="code" label="Code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <th className="px-4 py-3">State</th>
                                        <SortableHeader field="address" label="Address" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="parcels" label="Parcels" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                        <SortableHeader field="active" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
                                    {filteredVenues.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <p className="font-medium">No marking venues found</p>
                                                    <p className="text-xs">Try adjusting your search or filters</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        sortedVenues.map((venue) => (
                                            <VenueRow
                                                key={venue.id}
                                                venue={venue}
                                                stateName={getStateName(venue.state_id)}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                isSelected={selectedIds.has(venue.id)}
                                                onSelect={handleSelectOne}
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
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            title="First Page"
                        >
                            <span className="material-symbols-outlined text-xl">first_page</span>
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl">chevron_left</span>
                        </button>
                        <span className="flex items-center px-4 text-sm font-bold text-slate-700 dark:text-slate-300">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                        >
                            <span className="material-symbols-outlined text-xl">chevron_right</span>
                        </button>
                        <button
                            disabled={page === totalPages}
                            onClick={() => setPage(totalPages)}
                            className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
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

const SortableHeader = ({
    field,
    label,
    sortField,
    sortDirection,
    onSort,
    center = false
}: {
    field: keyof MarkingVenue;
    label: string;
    sortField: keyof MarkingVenue | null;
    sortDirection: 'asc' | 'desc';
    onSort: (field: keyof MarkingVenue) => void;
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
};

interface VenueRowProps {
    venue: MarkingVenue;
    stateName: string;
    onEdit: (venue: MarkingVenue) => void;
    onDelete: (id: string) => void;
    isSelected: boolean;
    onSelect: (id: string, checked: boolean) => void;
}

const VenueRow: React.FC<VenueRowProps> = ({ venue, stateName, onEdit, onDelete, isSelected, onSelect }) => {
    return (
        <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
            <td className="p-4 text-center">
                <input
                    type="checkbox"
                    className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                    checked={isSelected}
                    onChange={(e) => onSelect(venue.id, e.target.checked)}
                />
            </td>
            <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200 text-sm">{venue.name}</td>
            <td className="px-4 py-4 text-slate-600 dark:text-slate-300 text-sm">{venue.code || '-'}</td>
            <td className="px-4 py-4 text-slate-600 dark:text-slate-300 text-sm">{stateName}</td>
            <td className="px-4 py-4 text-slate-600 dark:text-slate-400 text-sm truncate max-w-xs">{venue.address || '-'}</td>
            <td className="px-4 py-4 text-center text-slate-700 dark:text-slate-300 font-medium text-sm">{venue.parcels}</td>
            <td className="px-4 py-4 text-center">
                <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${venue.active
                    ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                    : 'bg-rose-100 text-rose-700 border border-rose-200'
                    }`}>
                    {venue.active ? 'Active' : 'Inactive'}
                </span>
            </td>
            <td className="px-4 py-4">
                <div className="flex items-center justify-center gap-2">
                    <button
                        onClick={() => onEdit(venue)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 transition-all"
                        title="Edit"
                    >
                        <span className="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button
                        onClick={() => onDelete(venue.id)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-700 transition-all"
                        title="Delete"
                    >
                        <span className="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    );
};

export default MarkingVenueManagement;
