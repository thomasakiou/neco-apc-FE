import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { getSSCEExtMarkingVenueList, deleteSSCEExtMarkingVenue, createSSCEExtMarkingVenue, updateSSCEExtMarkingVenue, uploadSSCEExtMarkingVenueCsv, getAllSSCEExtMarkingVenues } from '../../services/markingVenue';
import { SSCEExtMarkingVenue, SSCEExtMarkingVenueCreate } from '../../types/markingVenue';
import { getAllStates } from '../../services/state';
import { State } from '../../types/state';
import MarkingVenueModal from './MarkingVenueModal';
import AlertModal from '../../components/AlertModal';

const SSCEExtMarkingVenues: React.FC = () => {
    const [states, setStates] = useState<State[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortField, setSortField] = useState<keyof SSCEExtMarkingVenue | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [allVenues, setAllVenues] = useState<SSCEExtMarkingVenue[]>([]);
    const [selectedState, setSelectedState] = useState('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const filteredVenues = useMemo(() => {
        let result = allVenues;

        // Search Filter
        if (debouncedSearchTerm) {
            const lowerTerm = debouncedSearchTerm.toLowerCase().trim();
            result = result.filter(venue =>
                venue.name?.toLowerCase().includes(lowerTerm) ||
                venue.code?.toLowerCase().includes(lowerTerm)
            );
        }

        // State Filter
        if (selectedState !== 'All') {
            const normalizedState = selectedState.replace(/[- ]/g, '').toLowerCase();
            result = result.filter(venue =>
                venue.state && venue.state.replace(/[- ]/g, '').toLowerCase() === normalizedState
            );
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
    }, [allVenues, debouncedSearchTerm, selectedState, sortField, sortDirection]);

    const total = filteredVenues.length;

    const paginatedVenues = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredVenues.slice(startIndex, startIndex + limit);
    }, [filteredVenues, page, limit]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVenue, setEditingVenue] = useState<SSCEExtMarkingVenue | null>(null);
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
            const response = await uploadSSCEExtMarkingVenueCsv(file);
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

    const fetchAllVenues = async () => {
        setLoading(true);
        try {
            const data = await getAllSSCEExtMarkingVenues();
            setAllVenues(data);
        } catch (error) {
            console.error('Error fetching all SSCE EXT marking venues:', error);
        } finally {
            setLoading(false);
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
        setPage(1);
    }, [debouncedSearchTerm, selectedState]);

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
                    await deleteSSCEExtMarkingVenue(id);
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

    const handleEdit = (venue: SSCEExtMarkingVenue) => {
        setEditingVenue(venue);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingVenue(null);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (data: SSCEExtMarkingVenueCreate) => {
        try {
            if (editingVenue) {
                await updateSSCEExtMarkingVenue(editingVenue.id, data);
            } else {
                await createSSCEExtMarkingVenue(data);
            }
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
            const allIds = new Set(filteredVenues.map(v => v.id));
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

    const handleSort = (field: keyof SSCEExtMarkingVenue) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const totalPages = Math.ceil(total / limit);
    const isAllSelected = filteredVenues.length > 0 && filteredVenues.every(v => selectedIds.has(v.id));

    const downloadCsvTemplate = () => {
        const headers = ['state', 'name', 'code', 'address', 'parcels', 'active'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "ssce_ext_marking_venue_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto transition-colors duration-200">
            <MarkingVenueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingVenue}
                titlePrefix="SSCE EXT"
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

            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                        SSCE EXT Marking Venue Management
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Manage Senior School Certificate Examination (External) marking venues and locations</p>
                </div>
                <div className="flex flex-wrap gap-3">
                    <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFileUpload} className="hidden" id="csv-upload" />
                    <button onClick={downloadCsvTemplate} className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all">
                        <span className="material-symbols-outlined text-lg">download</span> Template
                    </button>
                    <label htmlFor="csv-upload" className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 cursor-pointer transition-all">
                        <span className="material-symbols-outlined text-lg">upload_file</span> Upload CSV
                    </label>
                    <button onClick={handleAdd} className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                        <span className="material-symbols-outlined text-lg">add</span> Add Venue
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl flex flex-col gap-6">
                <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="flex flex-col md:flex-row gap-4 items-center w-full md:w-auto">
                        <div className="relative w-full md:w-64">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
                            <input className="w-full pl-10 h-10 rounded-lg border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:border-primary text-sm text-slate-700 dark:text-slate-200" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Per page:</label>
                            <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 text-sm">
                                <option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                            <thead className="bg-slate-100/80 dark:bg-slate-800/80 text-slate-900 dark:text-slate-300 font-bold uppercase border-b">
                                <tr>
                                    <th className="p-4 w-10 text-center"><input type="checkbox" checked={isAllSelected} onChange={(e) => handleSelectAll(e.target.checked)} className="rounded" /></th>
                                    <SortableHeader field="name" label="Venue Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader field="code" label="Code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <th className="px-4 py-3">State</th>
                                    <SortableHeader field="address" label="Address" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader field="parcels" label="Parcels" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                    <SortableHeader field="active" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} center />
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y bg-white dark:bg-[#121b25]">
                                {paginatedVenues.map((venue) => (
                                    <tr key={venue.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4 text-center"><input type="checkbox" checked={selectedIds.has(venue.id)} onChange={(e) => handleSelectOne(venue.id, e.target.checked)} className="rounded" /></td>
                                        <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200">{venue.name}</td>
                                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{venue.code || '-'}</td>
                                        <td className="px-4 py-4 text-slate-600 dark:text-slate-300">{venue.state || '-'}</td>
                                        <td className="px-4 py-4 text-slate-600 dark:text-slate-400 text-sm truncate max-w-xs">{venue.address || '-'}</td>
                                        <td className="px-4 py-4 text-center text-slate-600 dark:text-slate-300">{venue.parcels || 0}</td>
                                        <td className="px-4 py-4 text-center">
                                            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-bold ${venue.active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                {venue.active ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-4 py-4 flex justify-center gap-2">
                                            <button onClick={() => handleEdit(venue)} className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 p-1 rounded transition-all"><span className="material-symbols-outlined">edit</span></button>
                                            <button onClick={() => handleDelete(venue.id)} className="text-rose-600 dark:text-rose-400 hover:bg-rose-50 p-1 rounded transition-all"><span className="material-symbols-outlined">delete</span></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Showing {Math.min(filteredVenues.length, (page - 1) * limit + 1)} to {Math.min(page * limit, filteredVenues.length)} of {filteredVenues.length} results</p>
                    <div className="flex gap-2">
                        <button disabled={page === 1} onClick={() => setPage(1)} className="p-2 border rounded border-slate-200 dark:border-gray-700 dark:text-slate-300 disabled:opacity-50"><span className="material-symbols-outlined">first_page</span></button>
                        <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="p-2 border rounded border-slate-200 dark:border-gray-700 dark:text-slate-300 disabled:opacity-50"><span className="material-symbols-outlined">chevron_left</span></button>
                        <span className="flex items-center px-4 font-bold text-slate-700 dark:text-slate-300">Page {page} of {totalPages}</span>
                        <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="p-2 border rounded border-slate-200 dark:border-gray-700 dark:text-slate-300 disabled:opacity-50"><span className="material-symbols-outlined">chevron_right</span></button>
                        <button disabled={page === totalPages} onClick={() => setPage(totalPages)} className="p-2 border rounded border-slate-200 dark:border-gray-700 dark:text-slate-300 disabled:opacity-50"><span className="material-symbols-outlined">last_page</span></button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SortableHeader = ({ field, label, sortField, sortDirection, onSort, center = false }: any) => (
    <th className={`px-4 py-3 cursor-pointer select-none ${center ? 'text-center' : ''}`} onClick={() => onSort(field)}>
        <div className={`flex items-center gap-2 ${center ? 'justify-center' : ''}`}>
            <span>{label}</span>
            <span className={`material-symbols-outlined text-lg ${sortField === field ? 'text-emerald-600' : 'text-slate-300'}`}>
                {sortField === field && sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward'}
            </span>
        </div>
    </th>
);

export default SSCEExtMarkingVenues;
