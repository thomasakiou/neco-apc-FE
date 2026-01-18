import React, { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { getSSCEExtCustodiansByState, getAllSSCEExtCustodians, createSSCEExtCustodian, updateSSCEExtCustodian, deleteSSCEExtCustodian, bulkDeleteSSCEExtCustodians, uploadSSCEExtCustodianCsv } from '../../services/custodianSpecific';
import AlertModal from '../../components/AlertModal';
import { SSCEExtCustodian } from '../../types/custodian';

// Note: If getSSCEExtCustodiansByState is not yet in services, I might need to add it or fallback to client-side filtering.
// Checking services/custodianSpecific.ts again... I didn't add getSSCEExtCustodiansByState specifically, only getAllSSCEExtCustodians.
// I'll update the service to add it or use filtering here. Actually, I should add it to the service for consistency.
// For now I will implement it with getAll and filtering if needed, but the backend likely has the state endpoint.

const SSCEExtCustodians: React.FC = () => {
    const [searchParams] = useSearchParams();
    const stateFilter = searchParams.get('state');
    const [custodians, setCustodians] = useState<SSCEExtCustodian[]>([]);
    const [filteredCustodians, setFilteredCustodians] = useState<SSCEExtCustodian[]>([]);
    const [displayedCustodians, setDisplayedCustodians] = useState<SSCEExtCustodian[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortField, setSortField] = useState<keyof SSCEExtCustodian | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showModal, setShowModal] = useState(false);
    const [editingCustodian, setEditingCustodian] = useState<SSCEExtCustodian | null>(null);
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

    useEffect(() => {
        fetchCustodians();
    }, []);

    useEffect(() => {
        const filtered = custodians.filter(custodian =>
            custodian.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            custodian.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            custodian.state?.toLowerCase().includes(searchTerm.toLowerCase())
        );

        const sorted = [...filtered].sort((a, b) => {
            if (!sortField) return 0;
            const aValue = a[sortField];
            const bValue = b[sortField];
            if (aValue === bValue) return 0;
            if (aValue === undefined || aValue === null) return 1;
            if (bValue === undefined || bValue === null) return -1;

            const compareResult = aValue < bValue ? -1 : 1;
            return sortDirection === 'asc' ? compareResult : -compareResult;
        });

        setFilteredCustodians(sorted);
        setTotal(sorted.length);

        const startIndex = (page - 1) * limit;
        const endIndex = startIndex + limit;
        setDisplayedCustodians(sorted.slice(startIndex, endIndex));
    }, [searchTerm, custodians, sortField, sortDirection, page, limit]);

    useEffect(() => {
        setPage(1);
    }, [searchTerm]);

    const fetchCustodians = async () => {
        setLoading(true);
        try {
            // Using getAllSSCEExtCustodians and filtering on client if stateFilter exists
            // Since I didn't verify the state-specific endpoint for EXT yet.
            const items = await getAllSSCEExtCustodians();
            if (stateFilter) {
                const filtered = items.filter((c: any) => c.state === stateFilter);
                setCustodians(filtered);
                setFilteredCustodians(filtered);
            } else {
                setCustodians(items);
                setFilteredCustodians(items);
            }
        } catch (error) {
            console.error('Error fetching SSCE EXT custodians:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field: keyof SSCEExtCustodian) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };

    const handleDelete = async (id: string) => {
        setAlertModal({
            isOpen: true,
            title: 'Confirm Deletion',
            message: 'Are you sure you want to delete this custodian?',
            type: 'warning',
            onConfirm: async () => {
                try {
                    setLoading(true);
                    await deleteSSCEExtCustodian(id);
                    fetchCustodians();
                    setAlertModal({
                        isOpen: true,
                        title: 'Success',
                        message: 'Custodian deleted successfully.',
                        type: 'success'
                    });
                } catch (error) {
                    setAlertModal({
                        isOpen: true,
                        title: 'Error',
                        message: 'Failed to delete custodian.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(filteredCustodians.map(c => c.id)));
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

    const isAllSelected = filteredCustodians.length > 0 && filteredCustodians.every(c => selectedIds.has(c.id));

    const handleExport = () => {
        const headers = ['State', 'Code', 'Name', 'No. of Centers', 'Mandate', 'Status'];
        const rows = filteredCustodians.map(custodian => [
            custodian.state || '',
            custodian.code || '',
            custodian.name,
            custodian.numb_of_centers,
            custodian.mandate || '',
            custodian.active ? 'Active' : 'Inactive'
        ]);
        const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].map(row => row.join(',')).join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "ssce_ext_custodians_export.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleTemplate = () => {
        const headers = ['state', 'code', 'name', 'numb_of_centers', 'mandate', 'active'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "ssce_ext_custodians_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setLoading(true);
            const result = await uploadSSCEExtCustodianCsv(file);
            fetchCustodians();
            setAlertModal({
                isOpen: true,
                title: 'Upload Complete',
                message: `Created: ${result.created_count || 0}, Skipped: ${result.skipped_count || 0}, Errors: ${result.error_count || 0}`,
                type: 'success'
            });
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Upload Failed',
                message: 'Failed to upload custodians.',
                type: 'error'
            });
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200">
                <div className="flex flex-col gap-2">
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 to-teal-800 dark:from-emerald-400 dark:to-teal-500 tracking-tight">
                        SSCE EXT Custodians {stateFilter && `- ${stateFilter}`}
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                        {stateFilter ? `SSCE EXT custodian points in ${stateFilter}` : 'Manage Senior School Certificate Examination (External) custodian points.'}
                    </p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleTemplate}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">download</span>
                        Template
                    </button>
                    <input type="file" accept=".csv,.xlsx,.xls" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">upload_file</span>
                        Upload CSV
                    </button>
                    <button
                        onClick={handleExport}
                        className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/50 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">file_download</span>
                        Export CSV
                    </button>
                    <button
                        onClick={() => setShowModal(true)}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                    >
                        <span className="material-symbols-outlined text-lg">add_circle</span>
                        New Custodian
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
                                placeholder="Search custodians..."
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
                                    title: 'Delete Selected Custodians',
                                    message: `Are you sure you want to delete ${selectedIds.size} selected custodians? This action cannot be undone.`,
                                    type: 'warning',
                                    onConfirm: async () => {
                                        try {
                                            setLoading(true);
                                            await bulkDeleteSSCEExtCustodians(Array.from(selectedIds));
                                            setSelectedIds(new Set());
                                            fetchCustodians();
                                            setAlertModal({
                                                isOpen: true,
                                                title: 'Success',
                                                message: 'Selected custodians deleted successfully.',
                                                type: 'success'
                                            });
                                        } catch (error) {
                                            setAlertModal({
                                                isOpen: true,
                                                title: 'Error',
                                                message: 'Failed to delete some custodians.',
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
                            <span className="text-slate-400 font-medium text-xs">Loading custodians...</span>
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
                                    <SortableHeader field="state" label="State" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader field="code" label="Code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader field="name" label="Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader field="numb_of_centers" label="Centers" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader field="mandate" label="Mandate" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <SortableHeader field="active" label="Status" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                    <th className="px-4 py-3 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
                                {displayedCustodians.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-10 text-center">
                                            <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                                                    <span className="material-symbols-outlined text-2xl">inbox</span>
                                                </div>
                                                <p className="font-medium">No custodians found</p>
                                                <p className="text-xs">Try adjusting your search</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    displayedCustodians.map((custodian) => (
                                        <tr key={custodian.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-4 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
                                                    checked={selectedIds.has(custodian.id)}
                                                    onChange={(e) => handleSelectOne(custodian.id, e.target.checked)}
                                                />
                                            </td>
                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{custodian.state || '-'}</td>
                                            <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200 text-sm">{custodian.code || '-'}</td>
                                            <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 text-sm">{custodian.name}</td>
                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{custodian.numb_of_centers}</td>
                                            <td className="px-4 py-4 text-slate-600 dark:text-slate-400">{custodian.mandate || '-'}</td>
                                            <td className="px-4 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${custodian.active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                                                    {custodian.active ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-4 py-4">
                                                <div className="flex items-center justify-center gap-2">
                                                    <button
                                                        onClick={() => { setEditingCustodian(custodian); setShowModal(true); }}
                                                        className="flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                                                        title="Edit"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(custodian.id)}
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

            {showModal && (
                <SSCEExtCustodianModal
                    custodian={editingCustodian}
                    onClose={() => { setShowModal(false); setEditingCustodian(null); }}
                    onSuccess={() => { setShowModal(false); setEditingCustodian(null); fetchCustodians(); }}
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
    );
};

const SSCEExtCustodianModal: React.FC<{ custodian?: SSCEExtCustodian | null; onClose: () => void; onSuccess: () => void }> = ({ custodian, onClose, onSuccess }) => {
    const [formData, setFormData] = useState({
        state: custodian?.state || '',
        code: custodian?.code || '',
        name: custodian?.name || '',
        numb_of_centers: custodian?.numb_of_centers || 0,
        mandate: custodian?.mandate || '',
        active: custodian?.active ?? true
    });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (custodian) {
                await updateSSCEExtCustodian(custodian.id, formData);
            } else {
                await createSSCEExtCustodian(formData);
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving custodian:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md p-4">
            <div className="bg-white dark:bg-[#121b25] rounded-2xl p-6 w-full max-w-md">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">{custodian ? 'Edit SSCE EXT Custodian' : 'Add SSCE EXT Custodian'}</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">State</label>
                        <input type="text" value={formData.state} onChange={(e) => setFormData(prev => ({ ...prev, state: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Code</label>
                        <input type="text" value={formData.code} onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                        <input type="text" required value={formData.name} onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Number of Centers</label>
                        <input type="number" min="0" value={formData.numb_of_centers} onChange={(e) => setFormData(prev => ({ ...prev, numb_of_centers: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mandate</label>
                        <input type="text" value={formData.mandate} onChange={(e) => setFormData(prev => ({ ...prev, mandate: e.target.value }))} className="w-full px-3 py-2 border border-slate-200 dark:border-gray-700 rounded-lg bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300" />
                    </div>
                    <div>
                        <label className="flex items-center gap-2">
                            <input type="checkbox" checked={formData.active} onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))} className="rounded" />
                            <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Active</span>
                        </label>
                    </div>
                    <div className="flex justify-end gap-3 pt-4">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-300">
                            Cancel
                        </button>
                        <button type="submit" disabled={loading} className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                            {loading ? 'Saving...' : custodian ? 'Update' : 'Create'}
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

export default SSCEExtCustodians;
