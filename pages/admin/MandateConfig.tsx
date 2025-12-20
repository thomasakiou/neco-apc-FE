import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { getMandateList, deleteMandate, createMandate, updateMandate, uploadMandateCsv, getAllMandates, bulkDeleteMandates } from '../../services/mandate';
import { getAllAssignments } from '../../services/assignment';
import { Mandate, MandateCreate } from '../../types/mandate';
import { Assignment } from '../../types/assignment';
import MandateModal from './MandateModal';
import AlertModal from '../../components/AlertModal';

const MandateConfig: React.FC = () => {
    const [allMandates, setAllMandates] = useState<Mandate[]>([]);
    const [assignmentList, setAssignmentList] = useState<Assignment[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [selectedAssignment, setSelectedAssignment] = useState('All');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedMandate, setSelectedMandate] = useState<Mandate | null>(null);
    const [sortField, setSortField] = useState<keyof Mandate | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

    const filteredMandates = useMemo(() => {
        let result = allMandates;

        // Search Filter
        if (debouncedSearchTerm) {
            const lowerTerm = debouncedSearchTerm.toLowerCase().trim();
            result = result.filter(mandate =>
                mandate.code?.toLowerCase().includes(lowerTerm) ||
                mandate.mandate?.toLowerCase().includes(lowerTerm)
            );
        }

        // Dropdown Filters
        if (selectedAssignment !== 'All') {
            result = result.filter(mandate =>
                mandate.conraiss_range && mandate.conraiss_range.includes(selectedAssignment)
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
    }, [allMandates, debouncedSearchTerm, selectedAssignment, sortField, sortDirection]);

    const total = filteredMandates.length;

    const paginatedMandates = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredMandates.slice(startIndex, startIndex + limit);
    }, [filteredMandates, page, limit]);

    // For bulk actions selection
    const allFilteredMandates = filteredMandates;

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMandate, setEditingMandate] = useState<Mandate | null>(null);
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
            const response = await uploadMandateCsv(file);
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
            fetchAllMandates();
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
    }, [debouncedSearchTerm, selectedAssignment]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const data = await getAllMandates();
            setAllMandates(data);
        } catch (error) {
            console.error('Error fetching mandates:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchAllMandates = async () => {
        try {
            const data = await getAllMandates();
            setAllMandates(data);
        } catch (error) {
            console.error('Error fetching all mandates:', error);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        fetchAllMandates();
    }, []);

    useEffect(() => {
        const fetchAssignments = async () => {
            try {
                const data = await getAllAssignments();
                setAssignmentList(data);
            } catch (error) {
                console.error('Error fetching assignments:', error);
            }
        };
        fetchAssignments();
    }, []);

    const handleDelete = async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this mandate? This action cannot be undone.',
            type: 'warning',
            onConfirm: async () => {
                try {
                    await deleteMandate(id);
                    fetchData();
                    fetchAllMandates();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'Mandate deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting mandate:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete mandate.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleEdit = (mandate: Mandate) => {
        setEditingMandate(mandate);
        setIsModalOpen(true);
    };

    const handleAdd = () => {
        setEditingMandate(null);
        setIsModalOpen(true);
    };

    const handleModalSubmit = async (data: MandateCreate) => {
        try {
            if (editingMandate) {
                await updateMandate(editingMandate.id, data);
            } else {
                await createMandate(data);
            }
            fetchData();
            fetchAllMandates();
            setIsModalOpen(false);
        } catch (error) {
            console.error('Error saving mandate:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to save mandate. Please check your inputs and try again.',
                type: 'error'
            });
            throw error;
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            const allIds = new Set(allFilteredMandates.map(m => m.id));
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

    const handleSort = (field: keyof Mandate) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const totalPages = Math.ceil(total / limit);
    const isAllSelected = allFilteredMandates.length > 0 && allFilteredMandates.every(m => selectedIds.has(m.id));

    const downloadCsvTemplate = () => {
        const headers = ['code', 'mandate', 'station', 'conraiss_range'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "mandate_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) {
            setAlertModal({
                isOpen: true,
                title: 'No Selection',
                message: 'Please select at least one mandate to delete.',
                type: 'warning'
            });
            return;
        }

        setAlertModal({
            isOpen: true,
            title: 'Confirm Bulk Deletion',
            message: `Are you sure you want to delete ${selectedIds.size} selected mandate(s)? This action cannot be undone.`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    await bulkDeleteMandates(Array.from(selectedIds));
                    setSelectedIds(new Set());
                    fetchData();
                    fetchAllMandates();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: `Successfully deleted ${selectedIds.size} mandate(s).`,
                        type: 'success'
                    });
                } catch (error) {
                    console.error('Error deleting mandates:', error);
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete some mandates. Please try again.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleRowClick = (mandate: Mandate) => {
        setSelectedMandate(mandate);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto flex flex-col gap-4 md:gap-6 bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <MandateModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleModalSubmit}
                initialData={editingMandate}
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
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 tracking-tight">
                        Mandate Configuration
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Manage mandate types and map mandates by CONRAISS.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Table */}
                <div className="lg:col-span-2 bg-white dark:bg-[#121b25] rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-fit transition-colors">
                    <div className="flex flex-col gap-4 mb-4">
                        <div className="flex justify-between items-center gap-4">
                            <div className="relative flex-grow">
                                <span className="material-symbols-outlined absolute left-3 top-3 text-gray-400">search</span>
                                <input
                                    className="form-input w-full pl-10 h-10 rounded-lg bg-gray-50 dark:bg-[#0b1015] dark:text-white border-none"
                                    placeholder="Search for mandates..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
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
                                    className="h-10 px-3 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">download</span>
                                    Template
                                </button>
                                <label
                                    htmlFor="csv-upload"
                                    className="h-10 px-3 text-sm font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all cursor-pointer flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">upload_file</span>
                                    Upload
                                </label>
                                <button
                                    onClick={handleAdd}
                                    className="h-10 px-4 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all flex items-center gap-2"
                                >
                                    <span className="material-symbols-outlined text-lg">add</span>
                                    New Mandate
                                </button>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400 whitespace-nowrap">Per page:</label>
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

                            <div className="relative min-w-[200px]">
                                <select
                                    value={selectedAssignment}
                                    onChange={(e) => setSelectedAssignment(e.target.value)}
                                    className="appearance-none w-full h-10 pl-3 pr-8 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 hover:border-primary/50 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm transition-all cursor-pointer focus:ring-primary focus:border-primary truncate"
                                >
                                    <option value="All">Assignment: All</option>
                                    {assignmentList.map(assignment => (
                                        <option key={assignment.id} value={assignment.code}>{assignment.name}</option>
                                    ))}
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

                    {loading ? (
                        <div className="flex h-80 items-center justify-center">
                            <div className="flex flex-col items-center gap-3">
                                <span className="material-symbols-outlined animate-spin text-4xl text-primary/50">donut_large</span>
                                <span className="text-slate-400 font-medium text-xs">Loading records...</span>
                            </div>
                        </div>
                    ) : (
                        <>
                            <table className="w-full text-left text-sm text-slate-500 dark:text-slate-400">
                                <thead className="bg-gray-50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-medium">
                                    <tr>
                                        <th className="px-4 py-3 w-10">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                checked={isAllSelected}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <SortableHeader field="code" label="Mandate Code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="mandate" label="Mandate Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="station" label="Station" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="active" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <th className="px-4 py-3">CONRAISS</th>
                                        <th className="px-4 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                    {paginatedMandates.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <p className="font-medium">No mandates found</p>
                                                    <p className="text-xs">Try adjusting your search or filters</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedMandates.map((mandate) => (
                                            <MRow
                                                key={mandate.id}
                                                mandate={mandate}
                                                isActive={selectedMandate?.id === mandate.id}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                onClick={handleRowClick}
                                                isSelected={selectedIds.has(mandate.id)}
                                                onSelect={handleSelectOne}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Pagination */}
                            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 mt-4 border-t border-slate-100 dark:border-gray-800">
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
                        </>
                    )}
                </div>

                {/* Right Panel Mapping */}
                <div className="lg:col-span-1 bg-white dark:bg-[#121b25] rounded-xl border border-gray-200 dark:border-gray-800 p-6 h-fit sticky top-6 transition-colors">
                    <div className="border-b border-gray-100 dark:border-gray-800 pb-4 mb-4">
                        <h3 className="text-lg font-bold text-slate-900 dark:text-slate-200">CONRAISS Mapping</h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            For <span className="font-semibold text-primary">{selectedMandate?.mandate || 'Select a mandate'}</span> mandate
                        </p>
                    </div>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                        {['6', '7', '8', '9', '10', '11', '12', '13', '14', '15'].map(num => (
                            <div key={num} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50">
                                <label className="text-sm font-medium text-slate-900 dark:text-slate-300">CONRAISS {num}</label>
                                <input
                                    type="checkbox"
                                    className="rounded text-primary focus:ring-primary dark:bg-gray-700 dark:border-gray-600"
                                    checked={selectedMandate?.conraiss_range?.includes(num) || false}
                                    disabled={!selectedMandate}
                                    readOnly
                                />
                            </div>
                        ))}
                    </div>
                    {selectedMandate && (
                        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800">
                            <button
                                onClick={() => handleEdit(selectedMandate)}
                                className="btn-primary w-full h-10 font-bold text-sm"
                            >
                                Edit Mapping
                            </button>
                        </div>
                    )}
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
    onSort
}: {
    field: keyof Mandate;
    label: string;
    sortField: keyof Mandate | null;
    sortDirection: 'asc' | 'desc';
    onSort: (field: keyof Mandate) => void;
}) => {
    const isActive = sortField === field;

    return (
        <th
            className="px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors select-none"
            onClick={() => onSort(field)}
        >
            <div className="flex items-center gap-2">
                <span>{label}</span>
                <span className={`material-symbols-outlined text-lg transition-all ${isActive ? 'text-emerald-600' : 'text-slate-300'
                    }`}>
                    {isActive && sortDirection === 'desc' ? 'arrow_downward' : 'arrow_upward'}
                </span>
            </div>
        </th>
    );
};

interface MRowProps {
    mandate: Mandate;
    isActive: boolean;
    onEdit: (mandate: Mandate) => void;
    onDelete: (id: string) => void | Promise<void>;
    onClick: (mandate: Mandate) => void;
    isSelected: boolean;
    onSelect: (id: string, checked: boolean) => void;
}

const MRow: React.FC<MRowProps> = ({ mandate, isActive, onEdit, onDelete, onClick, isSelected, onSelect }) => (
    <tr
        className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors ${isActive ? 'bg-primary/5 dark:bg-emerald-900/10' : ''}`}
        onClick={() => onClick(mandate)}
    >
        <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
            <input
                type="checkbox"
                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                checked={isSelected}
                onChange={(e) => onSelect(mandate.id, e.target.checked)}
            />
        </td>
        <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-200">{mandate.code}</td>
        <td className="px-4 py-4 font-medium text-slate-900 dark:text-slate-200">{mandate.mandate}</td>
        <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{mandate.station || '-'}</td>
        <td className="px-4 py-4">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(mandate.active ?? true) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                }`}>
                {(mandate.active ?? true) ? 'Active' : 'Inactive'}
            </span>
        </td>
        <td className="px-4 py-4">{mandate.conraiss_range?.length || 0} Mapped</td>
        <td className="px-4 py-4 flex gap-2" onClick={(e) => e.stopPropagation()}>
            <button
                onClick={() => onEdit(mandate)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400"
            >
                <span className="material-symbols-outlined text-lg">edit</span>
            </button>
            <button
                onClick={() => onDelete(mandate.id)}
                className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 text-slate-500 dark:text-slate-400"
            >
                <span className="material-symbols-outlined text-lg">delete</span>
            </button>
        </td>
    </tr>
);

export default MandateConfig;