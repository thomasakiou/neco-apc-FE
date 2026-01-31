import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllTypesettingAPCRecords, updateTypesettingAPC, getAssignmentUsage } from '../../services/typesettingApc';
import { getAllStaff } from '../../services/staff';
import { getPageCache, setPageCache } from '../../services/pageCache';
import { TypesettingAPCRecord, TypesettingAPCCreate } from '../../types/typesettingApc';
import { Staff } from '../../types/staff';
import AlertModal from '../../components/AlertModal';

interface JuxtaposeRow extends TypesettingAPCRecord {
    assignmentCount: number;
    sdlStaff?: Staff | null;
    isMissingInSDL: boolean;
    hasFieldMismatch: boolean;
    hasCountMismatch: boolean;
    mismatches: string[];
}

const normalize = (str: string | null | undefined) => {
    if (!str) return '';
    return str.toLowerCase().replace(/\s+/g, ' ').trim();
};

const TypesettingJuxtapose: React.FC = () => {
    const navigate = useNavigate();
    const cached = getPageCache('TypesettingJuxtapose');

    const [loading, setLoading] = useState(true);
    const [allRecords, setAllRecords] = useState<JuxtaposeRow[]>([]);
    const [filterType, setFilterType] = useState<'all' | 'mismatch' | 'missing' | 'fields'>(cached?.filters?.filterType || 'all');
    const [searchQuery, setSearchQuery] = useState(cached?.searchTerm || '');
    const [page, setPage] = useState(cached?.page || 1);
    const [limit, setLimit] = useState(cached?.limit || 25);
    const [editingRecord, setEditingRecord] = useState<TypesettingAPCRecord | null>(null);
    const [showEditModal, setShowEditModal] = useState(false);

    const [alertModal, setAlertModal] = useState<{
        isOpen: boolean;
        title: string;
        message?: string;
        type: 'success' | 'error' | 'warning' | 'info';
    }>({ isOpen: false, title: '', type: 'info' });

    const fetchData = useCallback(async (force: boolean = false) => {
        setLoading(true);
        try {
            const [apcRecords, sdlStaffList] = await Promise.all([
                getAllTypesettingAPCRecords(true, force),
                getAllStaff(true, force)
            ]);

            const sdlMap = new Map<string, Staff>();
            sdlStaffList.forEach(s => {
                const normalizedNo = s.fileno.toString().padStart(4, '0');
                sdlMap.set(normalizedNo, s);
            });

            const processed: JuxtaposeRow[] = apcRecords.map(record => {
                const assignmentCount = getAssignmentUsage(record);
                const normalizedNo = record.file_no.padStart(4, '0');
                const sdlStaff = sdlMap.get(normalizedNo) || null;

                const mismatches: string[] = [];
                const isMissingInSDL = !sdlStaff;
                const hasCountMismatch = (record.count || 0) !== assignmentCount;

                let hasFieldMismatch = false;
                if (sdlStaff) {
                    // Compare Name
                    if (normalize(record.name) !== normalize(sdlStaff.full_name)) {
                        mismatches.push(`Name: APC("${record.name}") vs SDL("${sdlStaff.full_name}")`);
                        hasFieldMismatch = true;
                    }
                    // Compare Station
                    if (normalize(record.station) !== normalize(sdlStaff.station)) {
                        mismatches.push(`Station: APC("${record.station}") vs SDL("${sdlStaff.station}")`);
                        hasFieldMismatch = true;
                    }
                    // Compare CONRAISS
                    if (normalize(record.conraiss) !== normalize(sdlStaff.conr)) {
                        mismatches.push(`CONR: APC("${record.conraiss}") vs SDL("${sdlStaff.conr}")`);
                        hasFieldMismatch = true;
                    }
                    // Compare Qualification
                    if (normalize(record.qualification) !== normalize(sdlStaff.qualification)) {
                        mismatches.push(`Qualification: APC("${record.qualification}") vs SDL("${sdlStaff.qualification}")`);
                        hasFieldMismatch = true;
                    }
                    // Compare Sex
                    const apcSex = normalize(record.sex);
                    const sdlSex = normalize(sdlStaff.sex);
                    const sexMap: any = { 'm': 'male', 'f': 'female', 'male': 'male', 'female': 'female' };
                    if (apcSex && sdlSex && sexMap[apcSex] !== sexMap[sdlSex]) {
                        mismatches.push(`Sex: APC("${record.sex}") vs SDL("${sdlStaff.sex}")`);
                        hasFieldMismatch = true;
                    }
                }

                return {
                    ...record,
                    assignmentCount,
                    sdlStaff,
                    isMissingInSDL,
                    hasFieldMismatch,
                    hasCountMismatch,
                    mismatches
                };
            });
            setAllRecords(processed);
        } catch (error) {
            console.error("Error fetching Typesetting data:", error);
            setAlertModal({
                isOpen: true,
                title: 'Error',
                message: 'Failed to fetch data for juxtaposition. Please try again.',
                type: 'error'
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        setPageCache('TypesettingJuxtapose', {
            searchTerm: searchQuery,
            page,
            limit,
            filters: { filterType }
        });
    }, [searchQuery, page, limit, filterType]);

    const stats = useMemo(() => {
        return {
            total: allRecords.length,
            countMismatch: allRecords.filter(r => r.hasCountMismatch).length,
            missingInSDL: allRecords.filter(r => r.isMissingInSDL).length,
            fieldMismatch: allRecords.filter(r => r.hasFieldMismatch).length
        };
    }, [allRecords]);

    const filteredRecords = useMemo(() => {
        let result = allRecords;

        if (filterType === 'mismatch') result = result.filter(r => r.hasCountMismatch);
        if (filterType === 'missing') result = result.filter(r => r.isMissingInSDL);
        if (filterType === 'fields') result = result.filter(r => r.hasFieldMismatch);

        if (searchQuery) {
            const q = searchQuery.toLowerCase().trim();
            result = result.filter(r =>
                r.file_no.toLowerCase().includes(q) ||
                r.name.toLowerCase().includes(q)
            );
        }

        return result;
    }, [allRecords, filterType, searchQuery]);

    const paginatedRecords = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredRecords.slice(start, start + limit);
    }, [filteredRecords, page, limit]);

    const totalPages = Math.ceil(filteredRecords.length / limit);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            <div className="flex flex-col gap-2 pb-6 border-b border-slate-300 dark:border-gray-800">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                    Typesetting Juxtapose
                </h1>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Compare Typesetting APC records with Staff SDL records.</p>
                    <button
                        onClick={() => fetchData(true)}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#0b1015] border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all duration-200"
                    >
                        <span className="material-symbols-outlined text-emerald-500 group-hover:rotate-180 transition-transform duration-500 text-lg">refresh</span>
                        Refresh Data
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <StatCard
                    label="Total APC Records"
                    value={stats.total}
                    icon="data_table"
                    active={filterType === 'all'}
                    onClick={() => { setFilterType('all'); setPage(1); }}
                />
                <StatCard
                    label="Count Mismatch"
                    value={stats.countMismatch}
                    icon="rule"
                    color="text-amber-600 dark:text-amber-400"
                    bg="bg-amber-50 dark:bg-amber-900/10"
                    active={filterType === 'mismatch'}
                    onClick={() => { setFilterType('mismatch'); setPage(1); }}
                />
                <StatCard
                    label="Missing in SDL"
                    value={stats.missingInSDL}
                    icon="person_off"
                    color="text-rose-600 dark:text-rose-400"
                    bg="bg-rose-50 dark:bg-rose-900/10"
                    active={filterType === 'missing'}
                    onClick={() => { setFilterType('missing'); setPage(1); }}
                />
                <StatCard
                    label="Field Mismatch"
                    value={stats.fieldMismatch}
                    icon="compare"
                    color="text-blue-600 dark:text-blue-400"
                    bg="bg-blue-50 dark:bg-blue-900/10"
                    active={filterType === 'fields'}
                    onClick={() => { setFilterType('fields'); setPage(1); }}
                />
            </div>

            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 min-h-[500px]">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="relative w-full md:w-96">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Search by Name or File No..."
                            value={searchQuery}
                            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-slate-400 uppercase">Per Page</label>
                        <select
                            value={limit}
                            onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                            className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-gray-700 rounded-lg px-2 py-1 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-primary/20"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-4">
                        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                        <p className="text-slate-400 font-medium text-sm">Juxposing records...</p>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col gap-4">
                        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-gray-800">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                                    <tr>
                                        <th className="px-6 py-4">File No</th>
                                        <th className="px-6 py-4">Full Name</th>
                                        <th className="px-6 py-4">Status / SDL Info</th>
                                        <th className="px-6 py-4 text-center">Counts (APC vs Act)</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                                    {paginatedRecords.length > 0 ? paginatedRecords.map((record) => (
                                        <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-6 py-4 font-mono text-xs font-bold text-slate-900 dark:text-slate-200">{record.file_no}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className={`text-sm font-bold ${record.hasFieldMismatch ? 'text-amber-500' : 'text-slate-700 dark:text-slate-200'}`}>
                                                        {record.name}
                                                    </span>
                                                    {record.isMissingInSDL && (
                                                        <span className="text-[10px] text-rose-500 font-bold uppercase tracking-tighter">Not Found in SDL</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {record.mismatches.map((m, i) => (
                                                        <span key={i} className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800/30">
                                                            {m}
                                                        </span>
                                                    ))}
                                                    {!record.isMissingInSDL && record.mismatches.length === 0 && (
                                                        <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1">
                                                            <span className="material-symbols-outlined text-xs">check_circle</span>
                                                            SDL Sync Match
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <div className="flex items-center justify-center gap-2">
                                                    <span className="text-xs font-black text-slate-400 uppercase">APC:</span>
                                                    <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black shadow-inner
                                                        ${record.hasCountMismatch ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400 animate-pulse' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'}`}>
                                                        {record.count}
                                                    </span>
                                                    <span className="text-xs font-black text-slate-400 uppercase">ACT:</span>
                                                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-xs font-black bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 shadow-inner">
                                                        {record.assignmentCount}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setEditingRecord(record);
                                                            setShowEditModal(true);
                                                        }}
                                                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                        title="Edit Typesetting APC"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">edit</span>
                                                    </button>
                                                    <button
                                                        onClick={() => navigate(`/admin/typesetting/apc?f=${record.file_no}`)}
                                                        className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                                        title="View in APC List"
                                                    >
                                                        <span className="material-symbols-outlined text-lg">visibility</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-12 text-center text-slate-400 font-medium italic">No records found matching your criteria.</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="flex flex-col md:flex-row items-center justify-between gap-4 mt-4 px-2">
                                <p className="text-xs font-bold text-slate-400 uppercase">
                                    Showing {(page - 1) * limit + 1} to {Math.min(page * limit, filteredRecords.length)} of {filteredRecords.length}
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(page - 1)}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <span className="material-symbols-outlined">chevron_left</span>
                                    </button>
                                    <div className="flex items-center gap-1">
                                        {[...Array(totalPages)].map((_, i) => {
                                            const p = i + 1;
                                            if (totalPages > 7) {
                                                if (p > 1 && p < page - 1 && p !== 2) return p === 2 ? <span key={p} className="px-2 text-slate-400">...</span> : null;
                                                if (p < totalPages && p > page + 1 && p !== totalPages - 1) return p === totalPages - 1 ? <span key={p} className="px-2 text-slate-400">...</span> : null;
                                            }
                                            return (
                                                <button
                                                    key={p}
                                                    onClick={() => setPage(p)}
                                                    className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${page === p ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                                                >
                                                    {p}
                                                </button>
                                            );
                                        })}
                                    </div>
                                    <button
                                        disabled={page === totalPages}
                                        onClick={() => setPage(page + 1)}
                                        className="p-2 rounded-lg border border-slate-200 dark:border-gray-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                                    >
                                        <span className="material-symbols-outlined">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <AlertModal
                isOpen={alertModal.isOpen}
                title={alertModal.title}
                message={alertModal.message}
                type={alertModal.type}
                onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
            />

            {showEditModal && (
                <APCModal
                    isOpen={showEditModal}
                    onClose={() => { setShowEditModal(false); setEditingRecord(null); }}
                    onSubmit={async (data) => {
                        try {
                            if (editingRecord) {
                                await updateTypesettingAPC(editingRecord.id, data);
                                setAlertModal({
                                    isOpen: true,
                                    title: 'Success',
                                    message: 'APC record updated successfully.',
                                    type: 'success'
                                });
                                fetchData(true);
                            }
                        } catch (error: any) {
                            setAlertModal({
                                isOpen: true,
                                title: 'Error',
                                message: `Failed to save record: ${error.message}`,
                                type: 'error'
                            });
                        }
                    }}
                    initialData={editingRecord}
                />
            )}
        </div>
    );
};

const APCModal: React.FC<{ isOpen: boolean; onClose: () => void; onSubmit: (data: TypesettingAPCCreate) => Promise<void>; initialData?: TypesettingAPCRecord | null; }> = ({ isOpen, onClose, onSubmit, initialData }) => {
    const [formData, setFormData] = useState<TypesettingAPCCreate>({ file_no: '', name: '', conraiss: '', station: '', active: true });
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
                            {initialData ? 'Edit Typesetting APC Record' : 'Add Typesetting APC Record'}
                        </h2>
                        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium uppercase tracking-widest mt-1">Data Correction</p>
                    </div>
                    <button onClick={onClose} className="w-10 h-10 flex items-center justify-center rounded-full text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-all duration-200">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8">
                    <form id="typesetting-apc-juxtapose-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="md:col-span-2 pb-2 border-b border-slate-100 dark:border-gray-700 mb-2 flex items-center gap-2">
                                <span className="material-symbols-outlined text-emerald-500">person</span>
                                <span className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">Basic Information</span>
                            </div>
                            <FloatingInput label="File Number" value={formData.file_no} onChange={(val: string) => setFormData({ ...formData, file_no: val })} />
                            <FloatingInput label="Full Name" value={formData.name} onChange={(val: string) => setFormData({ ...formData, name: val })} />
                            <FloatingInput label="CONRAISS" value={formData.conraiss || ''} onChange={(val: string) => setFormData({ ...formData, conraiss: val })} />
                            <FloatingInput label="Station" value={formData.station || ''} onChange={(val: string) => setFormData({ ...formData, station: val })} />
                            <FloatingInput label="Count" type="number" value={formData.count || 0} onChange={(val: any) => setFormData({ ...formData, count: parseInt(val) })} />

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

                <div className="flex-none flex justify-end gap-4 p-6 border-t border-slate-100 dark:border-gray-700 bg-white dark:bg-[#121b25]">
                    <button type="button" onClick={onClose} className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">Cancel</button>
                    <button type="submit" form="typesetting-apc-juxtapose-form" disabled={loading} className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold text-sm shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 transition-all disabled:opacity-50">
                        {loading ? 'Saving...' : 'Save Changes'}
                    </button>
                </div>
            </div>
        </div>
    );
};

const FloatingInput = ({ label, value, onChange, type = 'text' }: any) => (
    <div className="relative flex flex-col gap-1">
        <label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest pl-1">{label}</label>
        <input
            type={type}
            className="w-full h-10 px-4 rounded-lg border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0b1015] focus:bg-white dark:focus:bg-[#0b1015] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all font-bold text-sm text-slate-700 dark:text-slate-200"
            value={value}
            onChange={(e) => onChange(e.target.value)}
        />
    </div>
);

const StatCard = ({ label, value, icon, color = 'text-slate-700 dark:text-slate-200', bg = 'bg-white dark:bg-[#121b25]', active, onClick }: { label: string; value: number; icon: string; color?: string; bg?: string; active: boolean; onClick: () => void }) => (
    <button
        onClick={onClick}
        className={`p-6 rounded-2xl border transition-all duration-300 text-left flex items-center gap-5 group
            ${active
                ? 'bg-white dark:bg-[#1a242f] border-primary shadow-lg ring-4 ring-primary/5 scale-[1.02]'
                : 'bg-white dark:bg-[#121b25] border-slate-100 dark:border-gray-800 hover:border-slate-300 dark:hover:border-gray-600'
            }`}
    >
        <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300
            ${active ? 'bg-primary text-white' : `${bg} ${color} group-hover:scale-110 shadow-inner`}`}>
            <span className="material-symbols-outlined text-3xl font-light">{icon}</span>
        </div>
        <div className="flex flex-col">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-2">{label}</p>
            <p className={`text-3xl font-black tracking-tight ${active ? 'text-slate-900 dark:text-white' : color}`}>{value}</p>
        </div>
    </button>
);

export default TypesettingJuxtapose;
