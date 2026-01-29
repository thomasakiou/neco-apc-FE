import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import { getAssignments, getAllAssignments, getMandatesByAssignment, deleteAssignment, createAssignment, updateAssignment, uploadAssignments, deleteAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { Assignment, AssignmentCreate } from '../../types/assignment';
import AssignmentModal from './AssignmentModal';
import AlertModal from '../../components/AlertModal';

const AssignmentConfig: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);
    const [sortField, setSortField] = useState<keyof Assignment | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const debouncedSearchTerm = useDebounce(searchTerm, 300);
    const [allAssignments, setAllAssignments] = useState<Assignment[]>([]);
    const [allMandates, setAllMandates] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
    const [selectedAssignmentForMandates, setSelectedAssignmentForMandates] = useState<Assignment | null>(null);
    const [assignmentMandates, setAssignmentMandates] = useState<string[]>([]);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [relatedData, setRelatedData] = useState<{
        [assignmentId: string]: {
            mandates?: any[];
            loading?: boolean;
        }
    }>({});

    // Modal States
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);
    const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; type: 'success' | 'error' | 'warning' | 'info'; onConfirm?: () => void }>({ title: '', message: '', type: 'info' });

    const fileInputRef = useRef<HTMLInputElement>(null);

    const filteredAssignments = useMemo(() => {
        let result = allAssignments;

        // Search Filter
        if (debouncedSearchTerm) {
            const lowerTerm = debouncedSearchTerm.toLowerCase().trim();
            result = result.filter(assignment =>
                assignment.code?.toLowerCase().includes(lowerTerm) ||
                assignment.name?.toLowerCase().includes(lowerTerm)
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
    }, [allAssignments, debouncedSearchTerm, sortField, sortDirection]);

    const total = filteredAssignments.length;

    const paginatedAssignments = useMemo(() => {
        const startIndex = (page - 1) * limit;
        return filteredAssignments.slice(startIndex, startIndex + limit);
    }, [filteredAssignments, page, limit]);

    // For bulk actions selection
    const allFilteredAssignments = filteredAssignments;

    const fetchAssignments = useCallback(async (force: boolean = false) => {
        setLoading(true);
        try {
            const data = await getAllAssignments(false, force);
            setAllAssignments(data);
        } catch (error: any) {
            console.error('Error fetching assignments:', error);
            showAlert('Error', 'Failed to fetch assignments. The assignments endpoint may not be available yet.', 'error');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        setPage(1);
    }, [debouncedSearchTerm]);

    useEffect(() => {
        fetchAssignments();
    }, [fetchAssignments]);

    useEffect(() => {
        const fetchMandatesData = async () => {
            try {
                const data = await getAllMandates(true);
                setAllMandates(data);
            } catch (error) {
                console.error('Error fetching mandates:', error);
                setAllMandates([]);
            }
        };
        fetchMandatesData();
    }, []);

    const handleSort = (field: keyof Assignment) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    };



    const handleDelete = async (id: string) => {
        setAlertConfig({
            title: 'Delete Assignment',
            message: 'Are you sure you want to delete this assignment? This action cannot be undone.',
            type: 'warning',
            onConfirm: async () => {
                try {
                    await deleteAssignment(id);
                    showAlert('Success', 'Assignment deleted successfully', 'success');
                    fetchAssignments();
                } catch (error: any) {
                    showAlert('Error', error.message || 'Failed to delete assignment', 'error');
                }
            }
        });
        setIsAlertOpen(true);
    };

    const handleBulkDelete = () => {
        if (selectedIds.size === 0) return;
        setAlertConfig({
            title: 'Delete Selected Assignments',
            message: `Are you sure you want to delete ${selectedIds.size} assignments? This action cannot be undone.`,
            type: 'warning',
            onConfirm: async () => {
                try {
                    // Start sequential deletion or use a bulk endpoint if available. 
                    // The service has deleteAssignments (delete ALL) but not specific list. 
                    // For now, implementing sequential delete or waiting for specific bulk endpoint.
                    // Given the service `deleteAssignments` is for ALL, I will stick to individual deletes for now 
                    // or just implement a loop here. Ideally backend should support bulk delete by IDs.
                    const promises = Array.from(selectedIds).map(id => deleteAssignment(id as string));
                    await Promise.all(promises);

                    showAlert('Success', 'Selected assignments deleted successfully', 'success');
                    setSelectedIds(new Set());
                    fetchAssignments();
                } catch (error: any) {
                    showAlert('Error', 'Failed to delete some assignments', 'error');
                }
            }
        });
        setIsAlertOpen(true);
    };

    const handleCreate = () => {
        setSelectedAssignment(null);
        setIsModalOpen(true);
    };

    const handleEdit = (assignment: Assignment) => {
        setSelectedAssignment(assignment);
        setIsModalOpen(true);
    };

    const handleSubmit = async (data: AssignmentCreate) => {
        try {
            if (selectedAssignment) {
                await updateAssignment(selectedAssignment.id, data);
                showAlert('Success', 'Assignment updated successfully', 'success');
            } else {
                await createAssignment(data);
                showAlert('Success', 'Assignment created successfully', 'success');
            }
            fetchAssignments();
        } catch (error: any) {
            showAlert('Error', error.message || 'Operation failed', 'error');
            throw error; // Re-throw to keep modal open if needed, or handle inside modal
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const result = await uploadAssignments(file);
            showAlert('Upload Results', `Created: ${result.created_count}, Skipped: ${result.skipped_count}, Errors: ${result.error_count}`, 'success');
            await fetchAssignments();
        } catch (error: any) {
            showAlert('Error', error.message || 'Upload failed', 'error');
            setLoading(false);
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const showAlert = (title: string, message: string, type: 'success' | 'error' | 'warning' | 'info') => {
        setAlertConfig({ title, message, type });
        setIsAlertOpen(true);
    };

    // Selection Handlers
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(new Set(allFilteredAssignments.map(m => m.id)));
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

    const toggleRowExpansion = async (assignment: Assignment) => {
        const assignmentId = assignment.id;
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(assignmentId)) {
            newExpanded.delete(assignmentId);
        } else {
            newExpanded.add(assignmentId);
            // Load related data if not already loaded
            if (!relatedData[assignmentId]) {
                setRelatedData(prev => ({ ...prev, [assignmentId]: { loading: true } }));
                try {
                    const mandates = await getMandatesByAssignment(assignment);
                    setRelatedData(prev => ({
                        ...prev,
                        [assignmentId]: { mandates, loading: false }
                    }));
                } catch (error) {
                    console.error('Error loading mandates:', error);
                    setRelatedData(prev => ({ ...prev, [assignmentId]: { loading: false } }));
                }
            }
        }
        setExpandedRows(newExpanded);
    };

    const isAllSelected = allFilteredAssignments.length > 0 && selectedIds.size === allFilteredAssignments.length;

    const downloadCsvTemplate = () => {
        const headers = ['code', 'assignment', 'mandates', 'active'];
        const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "assignment_upload_template.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const totalPages = Math.ceil(total / limit);

    const handleAssignmentSelect = async (assignment: Assignment) => {
        setSelectedAssignmentForMandates(assignment);
        try {
            const mandates = await getMandatesByAssignment(assignment);
            setAssignmentMandates(mandates.map((m: any) => m.code));
        } catch (error) {
            console.error('Error loading assignment mandates:', error);
            setAssignmentMandates([]);
        }
    };



    const handleMandateToggle = async (mandateCode: string, checked: boolean) => {
        if (!selectedAssignmentForMandates) return;

        const newMandates = checked
            ? [...assignmentMandates, mandateCode]
            : assignmentMandates.filter(m => m !== mandateCode);

        try {
            await updateAssignment(selectedAssignmentForMandates.id, {
                code: selectedAssignmentForMandates.code,
                name: selectedAssignmentForMandates.name,
                mandates: newMandates,
                active: selectedAssignmentForMandates.active ?? true
            });
            setAssignmentMandates(newMandates);
            fetchAssignments();
        } catch (error) {
            console.error('Error updating assignment mandates:', error);
        }
    };

    return (
        <div className="p-4 md:p-8 max-w-[1800px] mx-auto bg-slate-50 dark:bg-[#101922] transition-colors duration-200 min-h-screen">
            <div className="flex flex-col gap-4 md:gap-6">
                <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-200 dark:border-gray-800">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                            Assignment Configuration
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Manage assignments and their active status</p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={() => fetchAssignments(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-sm"
                            title="Refresh Data from Backend"
                        >
                            <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
                            Refresh
                        </button>
                        <button
                            onClick={downloadCsvTemplate}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-300 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined text-lg">download</span>
                            Template
                        </button>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-teal-700 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-lg hover:bg-teal-100 dark:hover:bg-teal-900/50 hover:border-teal-300 transition-all shadow-sm"
                        >
                            <span className="material-symbols-outlined text-lg">upload_file</span>
                            Import CSV
                        </button>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                            accept=".csv,.xlsx,.xls"
                            className="hidden"
                        />
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-6 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">add_circle</span>
                            New Assignment
                        </button>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] rounded-2xl border border-slate-200/60 dark:border-gray-800 shadow-sm flex flex-col overflow-hidden transition-colors">
                    {/* Filters */}
                    <div className="p-4 border-b border-slate-100 dark:border-gray-800 flex flex-col lg:flex-row gap-4 justify-between items-center bg-slate-50/50 dark:bg-[#121b25]">
                        <div className="relative w-full lg:w-96 group">
                            <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
                            <input
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full h-11 pl-10 pr-4 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all text-sm font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-400 shadow-sm"
                                placeholder="Search assignments..."
                            />
                        </div>

                        {selectedIds.size > 0 && (
                            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-200">
                                <span className="text-sm font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">
                                    {selectedIds.size} selected
                                </span>
                                <button
                                    onClick={handleBulkDelete}
                                    className="h-10 px-4 text-xs font-bold text-white bg-rose-500 hover:bg-rose-600 rounded-lg shadow-sm hover:shadow flex items-center gap-2 transition-all"
                                >
                                    <span className="material-symbols-outlined text-base">delete</span>
                                    Delete Selected
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="overflow-x-auto">
                        {loading ? (
                            <div className="p-20 flex justify-center items-center flex-col gap-3">
                                <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                                <span className="text-slate-400 font-medium text-xs">Loading records...</span>
                            </div>
                        ) : (
                            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-400">
                                <thead className="bg-slate-100/80 dark:bg-slate-800/50 text-slate-900 dark:text-slate-300 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-gray-700">
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
                                        <SortableHeader field="code" label="Code" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <SortableHeader field="name" label="Assignment Name" sortField={sortField} sortDirection={sortDirection} onSort={handleSort} />
                                        <th className="px-4 py-3">Status</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-gray-800 bg-white dark:bg-[#121b25]">
                                    {paginatedAssignments.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="p-10 text-center">
                                                <div className="flex flex-col items-center justify-center gap-3 text-slate-400">
                                                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-1">
                                                        <span className="material-symbols-outlined text-2xl">inbox</span>
                                                    </div>
                                                    <p className="font-medium">No assignments found</p>
                                                    <p className="text-xs">Try adjusting your search</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedAssignments.map((assignment) => (
                                            <AssignmentRow
                                                key={assignment.id}
                                                assignment={assignment}
                                                onEdit={handleEdit}
                                                onDelete={handleDelete}
                                                isSelected={selectedIds.has(assignment.id)}
                                                onSelect={handleSelectOne}
                                                isExpanded={expandedRows.has(assignment.id)}
                                                onToggleExpand={toggleRowExpansion}
                                                relatedData={relatedData[assignment.id]}
                                                onAssignmentSelect={handleAssignmentSelect}
                                            />
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                    {/* Pagination */}
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

            <AssignmentModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSubmit}
                initialData={selectedAssignment}
                allMandates={allMandates}
            />

            <AlertModal
                isOpen={isAlertOpen}
                onClose={() => setIsAlertOpen(false)}
                title={alertConfig.title}
                message={alertConfig.message}
                type={alertConfig.type}
                onConfirm={alertConfig.onConfirm}
            />
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

interface AssignmentRowProps {
    assignment: Assignment;
    onEdit: (data: Assignment) => void;
    onDelete: (id: string) => void | Promise<void>;
    isSelected: boolean;
    onSelect: (id: string, checked: boolean) => void;
    isExpanded: boolean;
    onToggleExpand: (assignment: Assignment) => void;
    relatedData?: {
        mandates?: any[];
        loading?: boolean;
    };
    onAssignmentSelect: (assignment: Assignment) => void;
}

const AssignmentRow: React.FC<AssignmentRowProps> = ({
    assignment,
    onEdit,
    onDelete,
    isSelected,
    onSelect,
    isExpanded,
    onToggleExpand,
    relatedData,
    onAssignmentSelect
}) => {
    return (
        <>
            <tr className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                <td className="p-4">
                    <button
                        onClick={() => onToggleExpand(assignment)}
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
                        onChange={(e) => onSelect(assignment.id, e.target.checked)}
                    />
                </td>
                <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-200 text-sm">{assignment.code}</td>
                <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 text-sm">{assignment.name}</td>
                <td className="px-4 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(assignment.active ?? true) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                        }`}>
                        {(assignment.active ?? true) ? 'Active' : 'Inactive'}
                    </span>
                </td>
                <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                        <button
                            onClick={() => onEdit(assignment)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 transition-all"
                            title="Edit"
                        >
                            <span className="material-symbols-outlined text-lg">edit</span>
                        </button>
                        <button
                            onClick={() => onDelete(assignment.id)}
                            className="flex items-center justify-center w-8 h-8 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/30 hover:text-rose-700 transition-all"
                            title="Delete"
                        >
                            <span className="material-symbols-outlined text-lg">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
            {isExpanded && (
                <tr>
                    <td colSpan={6} className="bg-slate-50/50 dark:bg-slate-900/50 p-6">
                        {relatedData?.loading ? (
                            <div className="flex items-center justify-center py-8">
                                <span className="material-symbols-outlined animate-spin text-2xl text-primary/50">donut_large</span>
                            </div>
                        ) : (
                            <div className="bg-white dark:bg-[#0b1015] rounded-lg border border-emerald-200 dark:border-emerald-900/50 p-4">
                                <h3 className="text-sm font-bold text-emerald-700 dark:text-emerald-500 mb-3 flex items-center gap-2">
                                    <span className="material-symbols-outlined text-lg">assignment</span>
                                    Mandates ({relatedData?.mandates?.length || 0})
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                                    {relatedData?.mandates?.map(mandate => (
                                        <div key={mandate.id} className="text-xs p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded border border-emerald-100 dark:border-emerald-800">
                                            <div className="font-bold text-emerald-900 dark:text-emerald-300 mb-1">{mandate.mandate}</div>
                                            {mandate.code && <div className="text-emerald-600 dark:text-emerald-400 mb-1">Code: {mandate.code}</div>}
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${(mandate.active ?? true) ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'}`}>
                                                    {(mandate.active ?? true) ? 'Active' : 'Inactive'}
                                                </span>
                                            </div>
                                            {mandate.conraiss_range && mandate.conraiss_range.length > 0 && (
                                                <div className="text-emerald-600 text-[10px]">
                                                    CONRAISS: {mandate.conraiss_range.join(', ')}
                                                </div>
                                            )}
                                        </div>
                                    )) || <p className="text-xs text-slate-400">No mandates</p>}
                                </div>
                            </div>
                        )}
                    </td>
                </tr>
            )}
        </>
    );
};

export default AssignmentConfig;
