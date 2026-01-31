import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getAllPrintingPoints, deletePrintingPoint, createPrintingPoint, updatePrintingPoint, uploadPrintingPoints } from '../../services/printingPoint';
import { PrintingPoint, PrintingPointCreate } from '../../types/printingPoint';
import AlertModal from '../../components/AlertModal';
import { getPageCache, setPageCache } from '../../services/pageCache';

const PrintingPoints: React.FC = () => {
    const cached = getPageCache('PrintingPoints');
    const [searchParams] = useSearchParams();
    const stateFilter = searchParams.get('state');

    const [points, setPoints] = useState<PrintingPoint[]>(cached?.data || []);
    const [loading, setLoading] = useState(!cached);
    const [uploading, setUploading] = useState(false);
    const [page, setPage] = useState(cached?.page || 1);
    const [limit, setLimit] = useState(cached?.limit || 10);
    const [sortField, setSortField] = useState<keyof PrintingPoint | null>(cached?.sortField || null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>(cached?.sortDirection || 'asc');
    const [searchTerm, setSearchTerm] = useState(cached?.searchTerm || '');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPoint, setEditingPoint] = useState<PrintingPoint | null>(null);
    const hasInitialized = useRef(!!cached);
    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type?: 'success' | 'error' | 'warning' | 'info';
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
    });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPoints = useCallback(async (force: boolean = false) => {
        if (hasInitialized.current && !force) {
            hasInitialized.current = false;
            return;
        }
        setLoading(true);
        try {
            const result = await getAllPrintingPoints(false, force);
            let data = result;
            if (stateFilter) {
                data = result.filter(c => c.state?.toLowerCase() === stateFilter.toLowerCase());
            }
            setPoints(data);
        } catch (error) {
            console.error('Error fetching Printing Points:', error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to fetch Printing Points.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, [stateFilter]);

    useEffect(() => {
        fetchPoints();
    }, [fetchPoints]);

    // Update Cache
    useEffect(() => {
        setPageCache('PrintingPoints', {
            data: points,
            page,
            limit,
            sortField,
            sortDirection,
            searchTerm
        });
    }, [points, page, limit, sortField, sortDirection, searchTerm]);

    const filteredPoints = useMemo(() => {
        return points.filter(point =>
            point.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            point.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            point.status?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [searchTerm, points]);

    const sortedPoints = useMemo(() => {
        if (!sortField) return filteredPoints;
        return [...filteredPoints].sort((a, b) => {
            const aValue = a[sortField];
            const bValue = b[sortField];
            if (aValue === bValue) return 0;
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;

            const compareResult = aValue < bValue ? -1 : 1;
            return sortDirection === 'asc' ? compareResult : -compareResult;
        });
    }, [filteredPoints, sortField, sortDirection]);

    const total = sortedPoints.length;

    const displayedPoints = useMemo(() => {
        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        return sortedPoints.slice(startIndex, endIndex);
    }, [sortedPoints, page, limit]);

    const handleSort = (field: keyof PrintingPoint) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    const handleCreate = () => {
        setEditingPoint(null);
        setIsModalOpen(true);
    };

    const handleEdit = (point: PrintingPoint) => {
        setEditingPoint(point);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this Printing Point?',
            type: 'warning',
            onConfirm: async () => {
                try {
                    await deletePrintingPoint(id);
                    fetchPoints();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'Printing Point deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete Printing Point.',
                        type: 'error'
                    });
                }
            }
        });
    };

    const handleSubmit = async (data: PrintingPointCreate) => {
        try {
            if (editingPoint) {
                await updatePrintingPoint(editingPoint.id, data);
            } else {
                await createPrintingPoint(data);
            }
            fetchPoints();
            setIsModalOpen(false);
            setAlertModal({
                isOpen: true,
                title: 'Success',
                message: `Printing Point ${editingPoint ? 'updated' : 'created'} successfully.`,
                type: 'success'
            });
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: `Failed to ${editingPoint ? 'update' : 'create'} Printing Point.`,
                type: 'error'
            });
        }
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredPoints.map(c => c.id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        const newSelected = new Set(selectedIds);
        if (checked) newSelected.add(id);
        else newSelected.delete(id);
        setSelectedIds(newSelected);
    };

    const isAllSelected = filteredPoints.length > 0 && filteredPoints.every(c => selectedIds.has(c.id));

    return (
        <>
            {uploading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md">
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-white font-medium text-lg">Uploading data...</p>
                    </div>
                </div>
            )}
            <div className="p-4 md:p-8 max-w-7xl mx-auto bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
                <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                            Printing Points {stateFilter && `- ${stateFilter}`}
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">
                            {stateFilter ? `Printing Points in ${stateFilter}` : 'Manage Printing Points'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchPoints(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                            title="Refresh Data from Backend"
                        >
                            <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                            Refresh
                        </button>
                        <button
                            onClick={() => {
                                const headers = ['name', 'state', 'status'];
                                const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
                                const encodedUri = encodeURI(csvContent);
                                const link = document.createElement("a");
                                link.setAttribute("href", encodedUri);
                                link.setAttribute("download", "printing_points_template.csv");
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">download</span>
                            Template
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                setUploading(true);
                                uploadPrintingPoints(file)
                                    .then(result => {
                                        setAlertModal({
                                            isOpen: true,
                                            title: 'Upload Complete',
                                            message: `Created: ${result.created_count}, Errors: ${result.error_count}`,
                                            type: 'success'
                                        });
                                        fetchPoints();
                                    })
                                    .catch(error => {
                                        setAlertModal({
                                            isOpen: true,
                                            title: 'Upload Failed',
                                            message: 'Failed to upload Printing Points.',
                                            type: 'error'
                                        });
                                    })
                                    .finally(() => {
                                        setUploading(false);
                                        if (fileInputRef.current) fileInputRef.current.value = '';
                                    });
                            }}
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                        />
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">upload_file</span>
                            Upload CSV
                        </button>
                        <button
                            onClick={() => {
                                const headers = ['Name', 'State', 'Status'];
                                const rows = filteredPoints.map(point => [
                                    point.name,
                                    point.state || '',
                                    point.status || ''
                                ]);
                                const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(row => row.join(',')).join('\n');
                                const encodedUri = encodeURI(csvContent);
                                const link = document.createElement("a");
                                link.setAttribute("href", encodedUri);
                                link.setAttribute("download", "printing_points_export.csv");
                                document.body.appendChild(link);
                                link.click();
                                document.body.removeChild(link);
                            }}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">file_download</span>
                            Export CSV
                        </button>
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            New Point
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] rounded-2xl border border-slate-200/60 dark:border-gray-800 shadow-sm overflow-hidden transition-colors mt-6">
                    <div className="p-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-[#121b25] flex flex-col lg:flex-row justify-between items-center gap-4">
                        <div className="flex flex-col md:flex-row gap-4 items-center w-full lg:w-auto">
                            <div className="relative w-full lg:w-96 group">
                                <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                                <input
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 shadow-sm"
                                    placeholder="Search Printing Points..."
                                />
                            </div>
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
                        </div>
                        {selectedIds.size > 0 && (
                            <button
                                onClick={() => {
                                    setAlertModal({
                                        isOpen: true,
                                        title: 'Delete Selected Points',
                                        message: `Are you sure you want to delete ${selectedIds.size} selected items? This action cannot be undone.`,
                                        type: 'warning',
                                        onConfirm: async () => {
                                            setLoading(true);
                                            try {
                                                await Promise.all(Array.from(selectedIds).map((id: string) => deletePrintingPoint(id)));
                                                setSelectedIds(new Set());
                                                fetchPoints();
                                                setAlertModal({
                                                    isOpen: true,
                                                    title: 'Success',
                                                    message: 'Selected items deleted successfully.',
                                                    type: 'success'
                                                });
                                            } catch (error) {
                                                setAlertModal({
                                                    isOpen: true,
                                                    title: 'Error',
                                                    message: 'Failed to delete some items.',
                                                    type: 'error'
                                                });
                                            } finally {
                                                setLoading(false);
                                            }
                                        }
                                    });
                                }}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                            >
                                <span className="material-symbols-outlined text-lg">delete</span>
                                Delete Selected ({selectedIds.size})
                            </button>
                        )}
                    </div>

                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-20 flex justify-center items-center flex-col gap-3">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                <span className="text-slate-400 font-medium text-xs">Loading data...</span>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                                <thead className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-gray-700">
                                    <tr>
                                        <th className="p-4 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                checked={isAllSelected}
                                                onChange={(e) => handleSelectAll(e.target.checked)}
                                            />
                                        </th>
                                        <SortableHeader field="name" label="Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="state" label="State" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="status" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
                                    {displayedPoints.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <p className="font-medium">No Printing Points found</p>
                                                    <p className="text-xs">Try adjusting your search</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        displayedPoints.map((point) => (
                                            <tr key={point.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                                <td className="p-4 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                        checked={selectedIds.has(point.id)}
                                                        onChange={(e) => handleSelectOne(point.id, e.target.checked)}
                                                    />
                                                </td>
                                                <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200 text-sm">{point.name}</td>
                                                <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{point.state || '-'}</td>
                                                <td className="px-4 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${point.status === 'Active' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                                                        {point.status || 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-4">
                                                    <div className="flex items-center justify-center gap-2">
                                                        <button
                                                            onClick={() => handleEdit(point)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                                                            title="Edit"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">edit</span>
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(point.id)}
                                                            className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all"
                                                            title="Delete"
                                                        >
                                                            <span className="material-symbols-outlined text-lg">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 p-6 border-t border-slate-100 dark:border-gray-800">
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
                                Page {page} of {Math.ceil(total / limit)}
                            </span>
                            <button
                                disabled={page === Math.ceil(total / limit)}
                                onClick={() => setPage(p => Math.min(Math.ceil(total / limit), p + 1))}
                                className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                            >
                                <span className="material-symbols-outlined text-xl">chevron_right</span>
                            </button>
                            <button
                                disabled={page === Math.ceil(total / limit)}
                                onClick={() => setPage(Math.ceil(total / limit))}
                                className="group flex items-center justify-center w-10 h-10 rounded-lg border border-slate-200 dark:border-gray-700 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent disabled:hover:text-slate-400"
                                title="Last Page"
                            >
                                <span className="material-symbols-outlined text-xl">last_page</span>
                            </button>
                        </div>
                    </div>
                </div>

                {isModalOpen && (
                    <PrintingPointModal
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSubmit={handleSubmit}
                        initialData={editingPoint}
                    />
                )}

                <AlertModal
                    isOpen={alertModal.isOpen}
                    onClose={() => setAlertModal({ ...alertModal, isOpen: false })}
                    title={alertModal.title}
                    message={alertModal.message}
                    type={alertModal.type}
                    onConfirm={alertModal.onConfirm}
                />
            </div>
        </>
    );
};

interface PrintingPointModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: PrintingPointCreate) => Promise<void>;
    initialData?: PrintingPoint | null;
}

const PrintingPointModal: React.FC<PrintingPointModalProps> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<PrintingPointCreate>({
        name: '',
        state: '',
        status: 'Active',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                state: initialData.state || '',
                status: initialData.status || 'Active',
            });
        }
    }, [initialData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await onSubmit(formData);
            onClose();
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 dark:border-gray-800 transition-colors">
                <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-gray-800 bg-gradient-to-r from-emerald-50/50 via-white to-teal-50/50 dark:from-emerald-900/20 dark:via-[#121b25] dark:to-teal-900/20 rounded-t-2xl transition-colors">
                    <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-300">
                        {initialData ? 'Edit Printing Point' : 'Add New Printing Point'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 dark:text-slate-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all"
                    >
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 bg-white dark:bg-[#121b25] transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Name *</label>
                            <input
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 transition-all text-slate-700 dark:text-slate-300"
                                placeholder="Enter name"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">State</label>
                            <input
                                type="text"
                                name="state"
                                value={formData.state || ''}
                                onChange={handleChange}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 transition-all text-slate-700 dark:text-slate-300"
                                placeholder="Enter state"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Status</label>
                            <select
                                name="status"
                                value={formData.status || 'Active'}
                                onChange={handleChange}
                                className="w-full h-12 px-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-slate-800/50 focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 transition-all text-slate-700 dark:text-slate-300"
                            >
                                <option value="Active">Active</option>
                                <option value="Inactive">Inactive</option>
                            </select>
                        </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-slate-100 dark:border-gray-800 bg-slate-50 dark:bg-slate-800/50 p-6 -m-6 mt-4 rounded-b-2xl transition-colors">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 dark:text-slate-400 bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : (initialData ? 'Update Point' : 'Create Point')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SortableHeader = ({ field, label, sortField, sortDirection, onSort }: any) => (
    <th
        className="px-4 py-3 cursor-pointer group hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-colors"
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
);

export default PrintingPoints;
