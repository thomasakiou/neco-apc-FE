import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { SDLStagingRecord, StagingSummary, ChangeType } from '../../../types/sdlStaging';
import { commitStagedChanges } from '../../../services/sdlStaging';
import { formatDisplayValue } from '../../../utils/sdlParser';
import AlertModal from '../../../components/AlertModal';

const SDLStagingPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();

    // Get staged data from navigation state
    const initialRecords: SDLStagingRecord[] = location.state?.stagingRecords || [];

    const [records, setRecords] = useState<SDLStagingRecord[]>(initialRecords);
    const [loading, setLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
    const [filterType, setFilterType] = useState<ChangeType | 'ALL'>('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [rowsPerPage, setRowsPerPage] = useState(10);

    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type: 'success' | 'error' | 'warning' | 'info';
        details?: any;
        onConfirm?: () => void;
    }>({ isOpen: false, title: '', type: 'info' });

    // Calculate summary statistics
    const summary: StagingSummary = useMemo(() => ({
        totalRecords: records.length,
        newRecords: records.filter(r => r.changeType === 'NEW').length,
        modifiedRecords: records.filter(r => r.changeType === 'MODIFIED').length,
        unchangedRecords: records.filter(r => r.changeType === 'UNCHANGED').length,
        selectedRecords: records.filter(r => r.isSelected && r.changeType !== 'UNCHANGED').length
    }), [records]);

    // Filter and search records
    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            const matchesFilter = filterType === 'ALL' || record.changeType === filterType;
            const matchesSearch = !searchTerm ||
                record.fileno.toLowerCase().includes(searchTerm.toLowerCase()) ||
                record.fullName.toLowerCase().includes(searchTerm.toLowerCase());
            return matchesFilter && matchesSearch;
        });
    }, [records, filterType, searchTerm]);

    // Paginate records
    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * rowsPerPage;
        const endIndex = startIndex + rowsPerPage;
        return filteredRecords.slice(startIndex, endIndex);
    }, [filteredRecords, currentPage, rowsPerPage]);

    const totalPages = Math.ceil(filteredRecords.length / rowsPerPage);

    // Reset to page 1 when filters change
    React.useEffect(() => {
        setCurrentPage(1);
    }, [filterType, searchTerm]);

    // Redirect if no data
    if (initialRecords.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center h-full bg-background-light dark:bg-[#101922] p-8">
                <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">info</span>
                <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 mb-2">No Staging Data</h2>
                <p className="text-slate-500 dark:text-slate-400 mb-6">Please import a file from the SDL page to review changes.</p>
                <button
                    onClick={() => navigate('/admin/metadata/sdl')}
                    className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-lg shadow-lg hover:shadow-xl transition-all"
                >
                    Go to SDL Page
                </button>
            </div>
        );
    }

    const toggleRow = (fileno: string) => {
        const newExpanded = new Set(expandedRows);
        if (newExpanded.has(fileno)) {
            newExpanded.delete(fileno);
        } else {
            newExpanded.add(fileno);
        }
        setExpandedRows(newExpanded);
    };

    const handleSelectRecord = (fileno: string, checked: boolean) => {
        setRecords(prev => prev.map(r =>
            r.fileno === fileno ? { ...r, isSelected: checked } : r
        ));
    };

    const handleSelectAll = (checked: boolean) => {
        const filteredFilenos = new Set(filteredRecords.filter(r => r.changeType !== 'UNCHANGED').map(r => r.fileno));
        setRecords(prev => prev.map(r =>
            filteredFilenos.has(r.fileno) ? { ...r, isSelected: checked } : r
        ));
    };

    const handleCommit = async () => {
        const selectedCount = records.filter(r => r.isSelected && r.changeType !== 'UNCHANGED').length;

        if (selectedCount === 0) {
            setAlertModal({
                isOpen: true,
                title: 'No Changes Selected',
                message: 'Please select at least one record to commit.',
                type: 'warning'
            });
            return;
        }

        setAlertModal({
            isOpen: true,
            title: 'Confirm Commit',
            message: `Are you sure you want to commit ${selectedCount} change(s)? This will update the SDL database.`,
            type: 'warning',
            onConfirm: async () => {
                setLoading(true);
                try {
                    const result = await commitStagedChanges(records);

                    if (result.errorCount > 0) {
                        setAlertModal({
                            isOpen: true,
                            title: 'Commit Completed with Errors',
                            message: `Created: ${result.createdCount}, Updated: ${result.updatedCount}, Errors: ${result.errorCount}`,
                            type: 'warning',
                            details: { errors: result.errors }
                        });
                    } else {
                        setAlertModal({
                            isOpen: true,
                            title: 'Commit Successful',
                            message: `Successfully created ${result.createdCount} and updated ${result.updatedCount} records.`,
                            type: 'success',
                            onConfirm: () => navigate('/admin/metadata/sdl')
                        });
                    }
                } catch (error: any) {
                    setAlertModal({
                        isOpen: true,
                        title: 'Commit Failed',
                        message: error.message || 'An error occurred while committing changes.',
                        type: 'error'
                    });
                } finally {
                    setLoading(false);
                }
            }
        });
    };

    const handleDiscard = () => {
        setAlertModal({
            isOpen: true,
            title: 'Discard Changes?',
            message: 'Are you sure you want to discard all staged changes? This cannot be undone.',
            type: 'warning',
            onConfirm: () => navigate('/admin/metadata/sdl')
        });
    };

    const handleExportPdf = () => {
        try {
            setLoading(true);
            const doc = new jsPDF('l', 'mm', 'a4');

            doc.setFontSize(22);
            doc.setTextColor(0, 128, 0);
            doc.text('SDL Import - Staged Changes', 14, 20);

            doc.setFontSize(10);
            doc.setTextColor(100);
            const dateStr = new Date().toLocaleString();
            doc.text(`Generated on: ${dateStr}`, 14, 28);
            doc.text(`New: ${summary.newRecords} | Modified: ${summary.modifiedRecords} | Selected: ${summary.selectedRecords}`, 14, 33);

            const changedRecords = records.filter(r => r.changeType !== 'UNCHANGED' && r.isSelected);

            const tableColumn = ["S/N", "File No", "Full Name", "Change Type", "Changed Fields"];
            const tableRows = changedRecords.map((record, index) => [
                (index + 1).toString(),
                record.fileno,
                record.fullName,
                record.changeType,
                record.fieldChanges.map(fc => `${fc.fieldLabel}: ${formatDisplayValue(fc.oldValue)} → ${formatDisplayValue(fc.newValue)}`).join('; ') || 'N/A'
            ]);

            autoTable(doc, {
                head: [tableColumn],
                body: tableRows,
                startY: 38,
                styles: { fontSize: 8.5, font: 'helvetica', cellPadding: 2 },
                headStyles: { fillColor: [0, 128, 0], textColor: [255, 255, 255], fontStyle: 'bold' },
                alternateRowStyles: { fillColor: [245, 247, 250] },
                columnStyles: { 4: { cellWidth: 80 } },
                margin: { top: 38, left: 10, right: 10 }
            });

            doc.save(`SDL_Staging_Changes_${new Date().toISOString().split('T')[0]}.pdf`);

            setAlertModal({
                isOpen: true,
                title: 'Export Successful',
                message: `Exported ${changedRecords.length} staged changes to PDF.`,
                type: 'success'
            });
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Export Failed',
                message: 'Failed to export changes to PDF.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = () => {
        try {
            setLoading(true);
            const changedRecords = records.filter(r => r.changeType !== 'UNCHANGED' && r.isSelected);

            const exportData = changedRecords.map((record, index) => ({
                'S/N': index + 1,
                'File No': record.fileno,
                'Full Name': record.fullName,
                'Change Type': record.changeType,
                'Changed Fields': record.fieldChanges.map(fc =>
                    `${fc.fieldLabel}: ${formatDisplayValue(fc.oldValue)} → ${formatDisplayValue(fc.newValue)}`
                ).join('; ') || 'N/A'
            }));

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Staged Changes");

            ws['!cols'] = [
                { wch: 5 },
                { wch: 15 },
                { wch: 30 },
                { wch: 12 },
                { wch: 80 }
            ];

            XLSX.writeFile(wb, `SDL_Staging_Changes_${new Date().toISOString().split('T')[0]}.xlsx`);

            setAlertModal({
                isOpen: true,
                title: 'Export Successful',
                message: `Exported ${changedRecords.length} staged changes to Excel.`,
                type: 'success'
            });
        } catch (error) {
            setAlertModal({
                isOpen: true,
                title: 'Export Failed',
                message: 'Failed to export changes to Excel.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    };

    const isAllSelected = filteredRecords.filter(r => r.changeType !== 'UNCHANGED').length > 0 &&
        filteredRecords.filter(r => r.changeType !== 'UNCHANGED').every(r => r.isSelected);

    const getChangeTypeBadge = (type: ChangeType) => {
        switch (type) {
            case 'NEW':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                        <span className="material-symbols-outlined text-sm">add_circle</span>
                        NEW
                    </span>
                );
            case 'MODIFIED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                        <span className="material-symbols-outlined text-sm">edit</span>
                        MODIFIED
                    </span>
                );
            case 'UNCHANGED':
                return (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        UNCHANGED
                    </span>
                );
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] overflow-hidden transition-colors duration-200">
            <div className="flex-1 flex flex-col p-4 md:p-8 gap-6 md:gap-8 overflow-y-auto">
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
                <div className="flex flex-wrap items-center justify-between gap-6 pb-6 border-b border-slate-300 dark:border-gray-700">
                    <div className="flex flex-col gap-2">
                        <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-600 to-orange-600 dark:from-amber-400 dark:to-orange-500 tracking-tight">
                            SDL Import - Review Changes
                        </h1>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-lg">
                            Review and commit changes before updating the database.
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={handleExportPdf}
                            disabled={loading}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">picture_as_pdf</span>
                            Export PDF
                        </button>
                        <button
                            onClick={handleExportExcel}
                            disabled={loading}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">table_view</span>
                            Export Excel
                        </button>
                        <button
                            onClick={handleDiscard}
                            disabled={loading}
                            className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-400 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                            Discard All
                        </button>
                        <button
                            onClick={handleCommit}
                            disabled={loading || summary.selectedRecords === 0}
                            className="group flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                            ) : (
                                <span className="material-symbols-outlined text-lg">check_circle</span>
                            )}
                            Commit Selected ({summary.selectedRecords})
                        </button>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-surface-light dark:bg-[#121b25] rounded-xl p-4 border border-slate-200 dark:border-gray-800 shadow-sm">
                        <div className="text-3xl font-black text-slate-700 dark:text-slate-200">{summary.totalRecords}</div>
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total Records</div>
                    </div>
                    <div className="bg-surface-light dark:bg-[#121b25] rounded-xl p-4 border border-emerald-200 dark:border-emerald-900 shadow-sm">
                        <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400">{summary.newRecords}</div>
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">New Records</div>
                    </div>
                    <div className="bg-surface-light dark:bg-[#121b25] rounded-xl p-4 border border-amber-200 dark:border-amber-900 shadow-sm">
                        <div className="text-3xl font-black text-amber-600 dark:text-amber-400">{summary.modifiedRecords}</div>
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Modified</div>
                    </div>
                    <div className="bg-surface-light dark:bg-[#121b25] rounded-xl p-4 border border-slate-200 dark:border-gray-800 shadow-sm">
                        <div className="text-3xl font-black text-slate-400 dark:text-slate-500">{summary.unchangedRecords}</div>
                        <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Unchanged</div>
                    </div>
                    <div className="bg-surface-light dark:bg-[#121b25] rounded-xl p-4 border border-indigo-200 dark:border-indigo-900 shadow-sm">
                        <div className="text-3xl font-black text-indigo-600 dark:text-indigo-400">{summary.selectedRecords}</div>
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Selected</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Filter:</span>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value as ChangeType | 'ALL')}
                            className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium text-sm"
                        >
                            <option value="ALL">All Types</option>
                            <option value="NEW">New Only</option>
                            <option value="MODIFIED">Modified Only</option>
                            <option value="UNCHANGED">Unchanged Only</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Rows:</span>
                        <select
                            value={rowsPerPage}
                            onChange={(e) => setRowsPerPage(Number(e.target.value))}
                            className="h-10 px-3 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium text-sm"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                    <div className="flex-1 max-w-md">
                        <input
                            type="text"
                            placeholder="Search by file no or name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full h-10 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="bg-surface-light dark:bg-[#121b25] rounded-2xl shadow-xl border border-slate-200 dark:border-gray-800 overflow-hidden flex-shrink-0">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200 dark:divide-gray-700">
                            <thead className="bg-slate-50 dark:bg-[#0b1015]">
                                <tr>
                                    <th className="py-4 px-4 text-left">
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={(e) => handleSelectAll(e.target.checked)}
                                            className="w-5 h-5 text-emerald-600 rounded border-slate-300 dark:border-gray-600 focus:ring-emerald-500"
                                        />
                                    </th>
                                    <th className="py-4 px-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">File No</th>
                                    <th className="py-4 px-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Full Name</th>
                                    <th className="py-4 px-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Change Type</th>
                                    <th className="py-4 px-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Changes</th>
                                    <th className="py-4 px-4 text-left text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                                {paginatedRecords.map((record) => (
                                    <React.Fragment key={record.fileno}>
                                        <tr className={`transition-colors ${record.isSelected ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}`}>
                                            <td className="py-4 px-4">
                                                {record.changeType !== 'UNCHANGED' && (
                                                    <input
                                                        type="checkbox"
                                                        checked={record.isSelected}
                                                        onChange={(e) => {
                                                            e.stopPropagation();
                                                            handleSelectRecord(record.fileno, e.target.checked);
                                                        }}
                                                        className="w-5 h-5 text-emerald-600 rounded border-slate-300 dark:border-gray-600 focus:ring-emerald-500"
                                                    />
                                                )}
                                            </td>
                                            <td className="py-4 px-4 font-bold text-slate-900 dark:text-slate-100">{record.fileno}</td>
                                            <td className="py-4 px-4 text-slate-700 dark:text-slate-300">{record.fullName}</td>
                                            <td className="py-4 px-4">{getChangeTypeBadge(record.changeType)}</td>
                                            <td className="py-4 px-4 text-sm text-slate-600 dark:text-slate-400">
                                                {record.changeType === 'NEW' ? (
                                                    <span className="text-emerald-600 dark:text-emerald-400">New staff record</span>
                                                ) : record.fieldChanges.length > 0 ? (
                                                    <span>{record.fieldChanges.length} field(s) changed</span>
                                                ) : (
                                                    <span className="text-slate-400">No changes</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4">
                                                {record.fieldChanges.length > 0 && (
                                                    <button
                                                        onClick={() => toggleRow(record.fileno)}
                                                        className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 text-sm font-bold hover:underline"
                                                    >
                                                        <span className="material-symbols-outlined text-base">
                                                            {expandedRows.has(record.fileno) ? 'expand_less' : 'expand_more'}
                                                        </span>
                                                        {expandedRows.has(record.fileno) ? 'Hide' : 'View'} Details
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {expandedRows.has(record.fileno) && record.fieldChanges.length > 0 && (
                                            <tr className="bg-slate-50 dark:bg-[#0b1015]">
                                                <td colSpan={6} className="py-4 px-8">
                                                    <div className="space-y-2">
                                                        <div className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                                                            Field Changes
                                                        </div>
                                                        <div className="grid gap-2">
                                                            {record.fieldChanges.map((change, idx) => (
                                                                <div key={idx} className="flex items-center gap-4 p-3 bg-surface-light dark:bg-[#121b25] rounded-lg border border-slate-200 dark:border-gray-700">
                                                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 min-w-[120px]">
                                                                        {change.fieldLabel}
                                                                    </span>
                                                                    <span className="text-sm text-rose-600 dark:text-rose-400 line-through">
                                                                        {formatDisplayValue(change.oldValue)}
                                                                    </span>
                                                                    <span className="material-symbols-outlined text-slate-400 text-sm">arrow_forward</span>
                                                                    <span className="text-sm text-emerald-600 dark:text-emerald-400 font-bold">
                                                                        {formatDisplayValue(change.newValue)}
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {filteredRecords.length === 0 && (
                        <div className="p-12 text-center">
                            <span className="material-symbols-outlined text-5xl text-slate-300 dark:text-slate-600 mb-4">search_off</span>
                            <p className="text-slate-500 dark:text-slate-400 font-medium">No records match your filter criteria.</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {filteredRecords.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-4 bg-surface-light dark:bg-[#121b25] rounded-xl p-4 border border-slate-200 dark:border-gray-800">
                        <div className="text-sm text-slate-600 dark:text-slate-400">
                            Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, filteredRecords.length)} of {filteredRecords.length} records
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(1)}
                                disabled={currentPage === 1}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                <span className="material-symbols-outlined text-base">first_page</span>
                            </button>
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                <span className="material-symbols-outlined text-base">chevron_left</span>
                            </button>
                            <span className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                <span className="material-symbols-outlined text-base">chevron_right</span>
                            </button>
                            <button
                                onClick={() => setCurrentPage(totalPages)}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-200 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
                            >
                                <span className="material-symbols-outlined text-base">last_page</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SDLStagingPage;
