import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAllAPCRecords, createAPC } from '../../../services/apc';
import { getAllStaff } from '../../../services/staff';
import { getPageCache, setPageCache } from '../../../services/pageCache';
import { APCRecord, APCCreate } from '../../../types/apc';
import { Staff } from '../../../types/staff';

interface ComparisonRow {
    id: string;
    fileNo: string;
    apcName: string;
    sdlName?: string;
    apcGrade: string;
    sdlGrade?: string;
    apcStation: string;
    sdlStation?: string;
    status: 'Match' | 'Mismatch' | 'MissingSDL';
    nameMismatch?: boolean;
    gradeMismatch?: boolean;
    stationMismatch?: boolean;
}

interface MissingRow {
    fileNo: string;
    name: string;
    grade: string;
    station: string;
    remark: string;
}

interface MissingInSDLRow {
    fileNo: string;
    name: string;
    grade: string;
    station: string;
}

const ComparePage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [comparisonData, setComparisonData] = useState<ComparisonRow[]>([]);
    const [missingInAPC, setMissingInAPC] = useState<MissingRow[]>([]);
    const [missingInSDL, setMissingInSDL] = useState<MissingInSDLRow[]>([]);
    const [activeTab, setActiveTab] = useState<'compare' | 'mismatch' | 'missing' | 'missingSDL'>('compare');
    const [statusFilter, setStatusFilter] = useState<'All' | 'Match' | 'Mismatch' | 'MissingSDL'>('All');
    const [mismatchTypeFilter, setMismatchTypeFilter] = useState<'All' | 'Name' | 'Grade' | 'Station'>('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);
    const [stats, setStats] = useState({
        totalAPC: 0,
        totalSDL: 0,
        matches: 0,
        mismatches: 0,
        missingInAPC: 0,
        missingInSDL: 0
    });
    const [showAddModal, setShowAddModal] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState<MissingRow | null>(null);

    // State persistence via PageCache
    useEffect(() => {
        const cached = getPageCache('compare-page');
        if (cached) {
            setActiveTab(cached.activeTab || 'compare');
            setStatusFilter(cached.filters?.status || 'All');
            setMismatchTypeFilter(cached.filters?.mismatchType || 'All');
            setSearchQuery(cached.searchTerm || '');
            setPage(cached.page || 1);
            setLimit(cached.limit || 25);
        }
        fetchData();
    }, []);

    // Save cache on state change
    useEffect(() => {
        setPageCache('compare-page', {
            activeTab,
            searchTerm: searchQuery,
            page,
            limit,
            filters: {
                status: statusFilter,
                mismatchType: mismatchTypeFilter
            }
        });
    }, [activeTab, statusFilter, mismatchTypeFilter, searchQuery, page, limit]);

    // Reset page on filter change
    useEffect(() => {
        setPage(1);
    }, [activeTab, statusFilter, mismatchTypeFilter, searchQuery]);

    const fetchData = async (force: boolean = false) => {
        setLoading(true);
        try {
            const [apcRecords, staffList] = await Promise.all([
                getAllAPCRecords(true, force),
                getAllStaff(false, force) // Fetch ALL staff for accurate total count
            ]);
            const staffMap = new Map<string, Staff>();

            staffList.forEach(s => {
                if (s.fileno) {
                    staffMap.set(s.fileno.trim().toUpperCase(), s);
                }
            });

            const comparison: ComparisonRow[] = [];
            const processedStaffIds = new Set<string>();
            const missingSDLRecords: MissingInSDLRow[] = [];

            let matches = 0;
            let mismatches = 0;

            apcRecords.forEach(apc => {
                const fileNoKey = apc.file_no?.trim().toUpperCase();
                if (!fileNoKey) return;

                const staff = staffMap.get(fileNoKey);

                processedStaffIds.add(fileNoKey);

                // Only consider it a match/mismatch if staff exists AND is active
                if (staff && staff.active) {
                    const apcNameNorm = apc.name.replace(/\s+/g, '').toLowerCase();
                    const sdlNameNorm = staff.full_name.replace(/\s+/g, '').toLowerCase();
                    const nameMatch = apcNameNorm === sdlNameNorm;

                    const apcConraiss = (apc.conraiss || '').replace(/\s+/g, '');
                    const sdlConr = (staff.conr || '').replace(/\s+/g, '');
                    const conraissMatch = apcConraiss === sdlConr;

                    const apcStation = (apc.station || '').replace(/\s+/g, '').toLowerCase();
                    const sdlStation = (staff.station || '').replace(/\s+/g, '').toLowerCase();
                    const stationMatch = apcStation === sdlStation;

                    const isPerfectMatch = nameMatch && conraissMatch && stationMatch;

                    if (isPerfectMatch) matches++;
                    else mismatches++;

                    comparison.push({
                        id: apc.id,
                        fileNo: apc.file_no,
                        apcName: apc.name,
                        sdlName: staff.full_name,
                        apcGrade: apc.conraiss || '-',
                        sdlGrade: staff.conr || '-',
                        apcStation: apc.station || '-',
                        sdlStation: staff.station || '-',
                        status: isPerfectMatch ? 'Match' : 'Mismatch',
                        nameMismatch: !nameMatch,
                        gradeMismatch: !conraissMatch,
                        stationMismatch: !stationMatch
                    });
                } else {
                    missingSDLRecords.push({
                        fileNo: apc.file_no,
                        name: apc.name,
                        grade: apc.conraiss || '-',
                        station: apc.station || '-'
                    });
                    comparison.push({
                        id: apc.id,
                        fileNo: apc.file_no,
                        apcName: apc.name,
                        apcGrade: apc.conraiss || '-',
                        apcStation: apc.station || '-',
                        status: 'MissingSDL'
                    });
                }
            });

            setComparisonData(comparison);

            const missing: MissingRow[] = [];
            staffList.forEach(s => {
                if (!s.active) return; // Only expect active staff to be in APC
                const fileNoKey = s.fileno?.trim().toUpperCase();
                if (fileNoKey && !processedStaffIds.has(fileNoKey)) {
                    missing.push({
                        fileNo: s.fileno,
                        name: s.full_name,
                        grade: s.conr || s.rank || '-',
                        station: s.station || '-',
                        remark: s.remark || '-'
                    });
                }
            });

            setMissingInAPC(missing);
            setMissingInSDL(missingSDLRecords);

            setStats({
                totalAPC: apcRecords.length,
                totalSDL: staffList.length,
                matches,
                mismatches,
                missingInAPC: missing.length,
                missingInSDL: missingSDLRecords.length
            });

        } catch (error) {
            console.error("Error comparing data:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-background-light dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            <div className="flex flex-col gap-2 pb-6 border-b border-slate-300">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-900 via-teal-800 to-emerald-700 dark:from-emerald-400 dark:via-teal-300 dark:to-emerald-500 tracking-tight">
                    Data Comparison
                </h1>
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Reconcile differences between APC records and Staff Disposition List (SDL).</p>
                    <button
                        onClick={() => fetchData(true)}
                        className="group flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-light dark:bg-[#0b1015] border border-slate-200 dark:border-gray-800 text-slate-700 dark:text-slate-300 font-bold text-xs shadow-sm hover:shadow-md hover:border-slate-300 hover:bg-background-light dark:hover:bg-slate-800 transition-all duration-200"
                        title="Reload both APC and Staff data from server"
                    >
                        <span className="material-symbols-outlined text-emerald-500 group-hover:rotate-180 transition-transform duration-500 text-lg">refresh</span>
                        Refresh Data
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
                <StatCard label="Total APC Records" value={stats.totalAPC} icon="list_alt" />
                <StatCard label="Total SDL Records" value={stats.totalSDL} icon="group" />
                <StatCard label="Perfect Matches" value={stats.matches} icon="check_circle" color="text-emerald-600 dark:text-emerald-400" bg="bg-emerald-50 dark:bg-emerald-900/10" />
                <StatCard label="Mismatches" value={stats.mismatches} icon="warning" color="text-amber-600 dark:text-amber-400" bg="bg-amber-50 dark:bg-amber-900/10" />
                <StatCard label="Missing in APC" value={stats.missingInAPC} icon="person_off" color="text-rose-600 dark:text-rose-400" bg="bg-rose-50 dark:bg-rose-900/10" />
                <StatCard label="Inactive in SDL" value={stats.missingInSDL} icon="person_remove" color="text-purple-600 dark:text-purple-400" bg="bg-purple-50 dark:bg-purple-900/10" />
            </div>

            <div className="bg-surface-light dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 min-h-[500px] transition-colors duration-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 border-b border-slate-300 dark:border-gray-700 pr-2">
                    <div className="flex items-center gap-2 overflow-x-auto">
                        <TabButton
                            active={activeTab === 'compare'}
                            onClick={() => setActiveTab('compare')}
                            label="All Records"
                            count={comparisonData.length}
                            icon="compare_arrows"
                        />
                        <TabButton
                            active={activeTab === 'mismatch'}
                            onClick={() => setActiveTab('mismatch')}
                            label="Mismatches"
                            count={comparisonData.filter(r => r.status === 'Mismatch').length}
                            icon="warning"
                            alert={comparisonData.filter(r => r.status === 'Mismatch').length > 0}
                        />
                        <TabButton
                            active={activeTab === 'missing'}
                            onClick={() => setActiveTab('missing')}
                            label="Missing in APC"
                            count={missingInAPC.length}
                            icon="playlist_remove"
                            alert={missingInAPC.length > 0}
                        />
                        <TabButton
                            active={activeTab === 'missingSDL'}
                            onClick={() => setActiveTab('missingSDL')}
                            label="Inactive in SDL"
                            count={missingInSDL.length}
                            icon="person_remove"
                            alert={missingInSDL.length > 0}
                        />
                    </div>

                    <div className="relative w-full md:w-64 mb-2 md:mb-0">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Search File No or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-background-light dark:bg-slate-800/50 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-slate-400"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined animate-spin text-4xl text-primary/50">donut_large</span>
                            <span className="text-slate-400 font-medium text-xs">Processing comparison...</span>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col">
                        {activeTab === 'compare' ? (
                            <ComparisonTable
                                data={(statusFilter === 'All' ? comparisonData : comparisonData.filter(r => r.status === statusFilter)).filter(item => {
                                    if (!searchQuery) return true;
                                    const q = searchQuery.toLowerCase();
                                    return (
                                        item.fileNo.toLowerCase().includes(q) ||
                                        item.apcName.toLowerCase().includes(q) ||
                                        (item.sdlName && item.sdlName.toLowerCase().includes(q))
                                    );
                                })}
                                page={page}
                                limit={limit}
                                setPage={setPage}
                                setLimit={setLimit}
                                statusFilter={statusFilter}
                                setStatusFilter={setStatusFilter}
                                mismatchTypeFilter={mismatchTypeFilter}
                                setMismatchTypeFilter={setMismatchTypeFilter}
                            />
                        ) : activeTab === 'mismatch' ? (
                            <ComparisonTable
                                data={comparisonData.filter(r => r.status === 'Mismatch').filter(item => {
                                    if (!searchQuery) return true;
                                    const q = searchQuery.toLowerCase();
                                    return (
                                        item.fileNo.toLowerCase().includes(q) ||
                                        item.apcName.toLowerCase().includes(q) ||
                                        (item.sdlName && item.sdlName.toLowerCase().includes(q))
                                    );
                                })}
                                page={page}
                                limit={limit}
                                setPage={setPage}
                                setLimit={setLimit}
                                mismatchTypeFilter={mismatchTypeFilter}
                                setMismatchTypeFilter={setMismatchTypeFilter}
                            />
                        ) : activeTab === 'missing' ? (
                            <MissingTable
                                data={missingInAPC.filter(item => {
                                    if (!searchQuery) return true;
                                    const q = searchQuery.toLowerCase();
                                    return (
                                        item.fileNo.toLowerCase().includes(q) ||
                                        item.name.toLowerCase().includes(q)
                                    );
                                })}
                                page={page}
                                limit={limit}
                                setPage={setPage}
                                setLimit={setLimit}
                                onAddToAPC={(staff) => {
                                    setSelectedStaff(staff);
                                    setShowAddModal(true);
                                }}
                            />
                        ) : (
                            <MissingInSDLTable
                                data={missingInSDL.filter(item => {
                                    if (!searchQuery) return true;
                                    const q = searchQuery.toLowerCase();
                                    return (
                                        item.fileNo.toLowerCase().includes(q) ||
                                        item.name.toLowerCase().includes(q)
                                    );
                                })}
                                page={page}
                                limit={limit}
                                setPage={setPage}
                                setLimit={setLimit}
                            />
                        )}
                    </div>
                )}
            </div>
            {showAddModal && selectedStaff && (
                <AddToAPCModal
                    staff={selectedStaff}
                    onClose={() => {
                        setShowAddModal(false);
                        setSelectedStaff(null);
                    }}
                    onSuccess={() => {
                        setShowAddModal(false);
                        setSelectedStaff(null);
                        fetchData(true);
                    }}
                />
            )}
        </div>
    );
};

const StatCard = ({ label, value, icon, color = 'text-slate-700 dark:text-slate-200', bg = 'bg-surface-light dark:bg-[#1e293b]' }: { label: string; value: number; icon: string; color?: string; bg?: string }) => (
    <div className={`p-4 rounded-xl border border-slate-100 dark:border-gray-700 shadow-sm flex items-center gap-4 ${bg}`}>
        <div className={`w-10 h-10 rounded-lg ${bg.includes('bg-surface-light') || bg.includes('dark:bg-[#1e293b]') ? 'bg-background-light dark:bg-slate-800' : 'bg-white/80 dark:bg-black/20'} flex items-center justify-center ${color}`}>
            <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        <div>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">{label}</p>
            <p className={`text-2xl font-black ${color}`}>{value}</p>
        </div>
    </div>
);

const TabButton = ({ active, onClick, label, count, icon, alert }: { active: boolean; onClick: () => void; label: string; count: number; icon: string; alert?: boolean }) => (
    <button
        onClick={onClick}
        className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-all ${active
            ? 'border-primary text-primary dark:text-emerald-400 font-bold bg-primary/5 dark:bg-emerald-900/20'
            : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/50'
            }`}
    >
        <span className="material-symbols-outlined text-lg">{icon}</span>
        <span>{label}</span>
        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${alert ? 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
            }`}>
            {count}
        </span>
    </button>
);

const ComparisonTable = ({ data, page, limit, setPage, setLimit, statusFilter, setStatusFilter, mismatchTypeFilter, setMismatchTypeFilter }: { data: ComparisonRow[]; page: number; limit: number; setPage: (p: number) => void; setLimit: (l: number) => void; statusFilter?: string; setStatusFilter?: (filter: 'All' | 'Match' | 'Mismatch' | 'MissingSDL') => void; mismatchTypeFilter?: string; setMismatchTypeFilter?: (filter: 'All' | 'Name' | 'Grade' | 'Station') => void }) => {
    const navigate = useNavigate();
    const filteredData = data.filter(item => {
        if (!mismatchTypeFilter || mismatchTypeFilter === 'All') return true;
        if (mismatchTypeFilter === 'Name') return item.nameMismatch;
        if (mismatchTypeFilter === 'Grade') return item.gradeMismatch;
        if (mismatchTypeFilter === 'Station') return item.stationMismatch;
        return true;
    });

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = filteredData.slice(startIndex, endIndex);
    const totalPages = Math.ceil(filteredData.length / limit);

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    {statusFilter && setStatusFilter && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600">Status:</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => {
                                    setStatusFilter(e.target.value as 'All' | 'Match' | 'Mismatch' | 'MissingSDL');
                                    setPage(1);
                                }}
                                className="h-8 px-2 rounded border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 text-sm"
                            >
                                <option value="All">All</option>
                                <option value="Match">Match</option>
                                <option value="Mismatch">Mismatch</option>
                                <option value="MissingSDL">Missing SDL</option>
                            </select>
                        </div>
                    )}
                    {mismatchTypeFilter && setMismatchTypeFilter && (
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600">Mismatch:</label>
                            <select
                                value={mismatchTypeFilter}
                                onChange={(e) => {
                                    setMismatchTypeFilter(e.target.value as 'All' | 'Name' | 'Grade' | 'Station');
                                    setPage(1);
                                }}
                                className="h-8 px-2 rounded border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 text-sm"
                            >
                                <option value="All">All types</option>
                                <option value="Name">Name</option>
                                <option value="Grade">Grade</option>
                                <option value="Station">Station</option>
                            </select>
                        </div>
                    )}
                    <div className="flex items-center gap-2">
                        <label className="text-sm font-medium text-slate-600">Per page:</label>
                        <select
                            value={limit}
                            onChange={(e) => {
                                setLimit(Number(e.target.value));
                                setPage(1);
                            }}
                            className="h-8 px-2 rounded border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 text-sm"
                        >
                            <option value={10}>10</option>
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>
                </div>
                <p className="text-sm text-slate-500">
                    Showing {filteredData.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredData.length)} of {filteredData.length} results
                </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700">
                <table className="w-full text-left text-sm">
                    <thead className="bg-background-light dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs tracking-wider">
                        <tr>
                            <th className="px-4 py-3 bg-emerald-50/50 dark:bg-emerald-900/10 border-r border-slate-200 dark:border-gray-700 w-[44%] text-center border-b dark:border-gray-700" colSpan={4}>APC Record</th>
                            <th className="px-4 py-3 w-[12%] text-center border-b dark:border-gray-700">Status</th>
                            <th className="px-4 py-3 bg-blue-50/50 dark:bg-blue-900/10 border-l border-slate-200 dark:border-gray-700 w-[44%] text-center border-b dark:border-gray-700" colSpan={3}>SDL Record</th>
                        </tr>
                        <tr className="border-b border-slate-300 dark:border-gray-700">
                            <th className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium">File No</th>
                            <th className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium">Name</th>
                            <th className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium">Grade/Conraiss</th>
                            <th className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium border-r border-slate-200 dark:border-gray-700">Station</th>
                            <th className="px-4 py-2 text-center text-slate-500 dark:text-slate-400 font-medium">Compare</th>
                            <th className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium border-l border-slate-200 dark:border-gray-700">Name</th>
                            <th className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium">Grade/Conraiss</th>
                            <th className="px-4 py-2 text-slate-500 dark:text-slate-400 font-medium">Station</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                        {paginatedData.map((row) => (
                            <tr key={row.id} className="hover:bg-background-light dark:hover:bg-slate-800/50 transition-colors group">
                                <td className="px-4 py-3 font-mono font-bold text-slate-600 dark:text-slate-300">{row.fileNo}</td>
                                <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.apcName}</td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.apcGrade}</td>
                                <td className="px-4 py-3 text-slate-600 dark:text-slate-400 border-r border-slate-100 dark:border-gray-800">
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{row.apcStation}</span>
                                        <button
                                            onClick={() => navigate(`/admin/apc/list?f=${row.fileNo}`)}
                                            className="p-1 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                            title="Go to APC Record"
                                        >
                                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                                        </button>
                                    </div>
                                </td>

                                <td className="px-4 py-3 text-center">
                                    {row.status === 'Match' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
                                            <span className="material-symbols-outlined text-sm">check</span> Match
                                        </span>
                                    ) : row.status === 'MissingSDL' ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-xs font-bold border border-rose-200 dark:border-rose-800">
                                            <span className="material-symbols-outlined text-sm">close</span> No SDL
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs font-bold border border-amber-200 dark:border-amber-800">
                                            <span className="material-symbols-outlined text-sm">priority_high</span> Diff
                                        </span>
                                    )}
                                </td>

                                <td className={`px-4 py-3 border-l border-slate-100 dark:border-gray-800 ${row.status === 'Mismatch' && row.apcName.trim().toLowerCase() !== (row.sdlName || '').trim().toLowerCase()
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 font-medium'
                                    : 'text-slate-700 dark:text-slate-300'
                                    }`}>
                                    {row.sdlName || '-'}
                                </td>
                                <td className={`px-4 py-3 ${row.status === 'Mismatch' && row.apcGrade !== row.sdlGrade
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 font-medium'
                                    : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                    {row.sdlGrade || '-'}
                                </td>
                                <td className={`px-4 py-3 ${row.status === 'Mismatch' && row.apcStation !== row.sdlStation
                                    ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100 font-medium'
                                    : 'text-slate-600 dark:text-slate-400'
                                    }`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span>{row.sdlStation || '-'}</span>
                                        {row.sdlName && (
                                            <button
                                                onClick={() => navigate(`/admin/metadata/sdl?q=${row.fileNo}`)}
                                                className="p-1 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                title="Go to SDL Record"
                                            >
                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            </button>
                                        )}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <div className="flex justify-center gap-2 pt-4">
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(1)}
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                    >
                        First
                    </button>
                    <button
                        disabled={page === 1}
                        onClick={() => setPage(page - 1)}
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1 bg-slate-100 rounded">
                        Page {page} of {totalPages || 1}
                    </span>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(page + 1)}
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                    >
                        Next
                    </button>
                    <button
                        disabled={page >= totalPages}
                        onClick={() => setPage(totalPages)}
                        className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                    >
                        Last
                    </button>
                </div>
            </div>
        </div>
    );
};

const MissingTable = ({ data, page, limit, setPage, setLimit, onAddToAPC }: { data: MissingRow[]; page: number; limit: number; setPage: (p: number) => void; setLimit: (l: number) => void; onAddToAPC: (staff: MissingRow) => void }) => {
    const navigate = useNavigate();
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);
    const totalPages = Math.ceil(data.length / limit);

    return (
        <div className="flex flex-col gap-4">
            {data.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4 text-slate-400">
                    <span className="material-symbols-outlined text-5xl text-emerald-100">task_alt</span>
                    <p className="font-medium">All active staff in SDL have corresponding APC records!</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600">Per page:</label>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-8 px-2 rounded border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 text-sm"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <p className="text-sm text-slate-500">
                            Showing {data.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length} results
                        </p>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-rose-50/50 dark:bg-rose-900/10 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs tracking-wider border-b border-rose-100 dark:border-rose-900/20">
                                <tr>
                                    <th className="px-4 py-3">File No</th>
                                    <th className="px-4 py-3">Staff Name</th>
                                    <th className="px-4 py-3">Grade/Conraiss</th>
                                    <th className="px-4 py-3">Station</th>
                                    <th className="px-4 py-3">Remark</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                                {paginatedData.map((row) => (
                                    <tr key={row.fileNo} className="hover:bg-rose-50/20 dark:hover:bg-rose-900/5 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-rose-700 dark:text-rose-400">{row.fileNo}</td>
                                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{row.name}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.grade}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.station}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.remark}</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => navigate(`/admin/metadata/sdl?q=${row.fileNo}`)}
                                                    className="p-1.5 rounded bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                                    title="Go to SDL Record"
                                                >
                                                    <span className="material-symbols-outlined text-sm">open_in_new</span>
                                                </button>
                                                <button
                                                    onClick={() => onAddToAPC(row)}
                                                    className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-3 py-1 rounded text-xs font-bold transition-colors border border-emerald-100 dark:border-emerald-900/30"
                                                >
                                                    + Add to APC
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-center gap-2 pt-4">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            First
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 bg-slate-100 rounded">
                            Page {page} of {totalPages || 1}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            Next
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(totalPages)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            Last
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const MissingInSDLTable = ({ data, page, limit, setPage, setLimit }: { data: MissingInSDLRow[]; page: number; limit: number; setPage: (p: number) => void; setLimit: (l: number) => void }) => {
    const navigate = useNavigate();
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginatedData = data.slice(startIndex, endIndex);
    const totalPages = Math.ceil(data.length / limit);

    return (
        <div className="flex flex-col gap-4">
            {data.length === 0 ? (
                <div className="p-12 flex flex-col items-center justify-center gap-4 text-slate-400">
                    <span className="material-symbols-outlined text-5xl text-emerald-100">task_alt</span>
                    <p className="font-medium">All APC records exist in SDL!</p>
                </div>
            ) : (
                <>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600">Per page:</label>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-8 px-2 rounded border border-slate-200 dark:border-gray-700 bg-surface-light dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 text-sm"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                        <p className="text-sm text-slate-500">
                            Showing {data.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length} results
                        </p>
                    </div>
                    <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-gray-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-purple-50/50 dark:bg-purple-900/10 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs tracking-wider border-b border-purple-100 dark:border-purple-900/20">
                                <tr>
                                    <th className="px-4 py-3">File No</th>
                                    <th className="px-4 py-3">Staff Name</th>
                                    <th className="px-4 py-3">Grade/Conraiss</th>
                                    <th className="px-4 py-3">Station</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                                {paginatedData.map((row) => (
                                    <tr key={row.fileNo} className="hover:bg-purple-50/20 dark:hover:bg-purple-900/5 transition-colors">
                                        <td className="px-4 py-3 font-mono font-bold text-purple-700 dark:text-purple-400">{row.fileNo}</td>
                                        <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-medium">{row.name}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.grade}</td>
                                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{row.station}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                onClick={() => navigate(`/admin/apc/list?f=${row.fileNo}`)}
                                                className="p-1.5 rounded bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors"
                                                title="Go to APC Record"
                                            >
                                                <span className="material-symbols-outlined text-sm">open_in_new</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex justify-center gap-2 pt-4">
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(1)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            First
                        </button>
                        <button
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            Previous
                        </button>
                        <span className="px-3 py-1 bg-slate-100 rounded">
                            Page {page} of {totalPages || 1}
                        </span>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(page + 1)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            Next
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(totalPages)}
                            className="px-3 py-1 rounded border disabled:opacity-50 hover:bg-background-light"
                        >
                            Last
                        </button>
                    </div>
                </>
            )}
        </div>
    );
};

const AddToAPCModal = ({ staff, onClose, onSuccess }: { staff: MissingRow; onClose: () => void; onSuccess: () => void }) => {
    const [selectedAssignments, setSelectedAssignments] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [count, setCount] = useState(1);

    const assignmentCodes = [
        { code: 'tt', label: 'TT' },
        { code: 'mar_accr', label: 'MAR ACCR' },
        { code: 'ncee', label: 'NCEE' },
        { code: 'gifted', label: 'GIFTED' },
        { code: 'becep', label: 'BECEP' },
        { code: 'bece_mrkp', label: 'BECE MRKP' },
        { code: 'ssce_int', label: 'SSCE INT' },
        { code: 'swapping', label: 'SWAPPING' },
        { code: 'ssce_int_mrk', label: 'SSCE INT MRK' },
        { code: 'oct_accr', label: 'OCT ACCR' },
        { code: 'ssce_ext', label: 'SSCE EXT' },
        { code: 'ssce_ext_mrk', label: 'SSCE EXT MRK' },
        { code: 'pur_samp', label: 'PUR SAMP' },
        { code: 'int_audit', label: 'INT AUDIT' },
        { code: 'stock_tk', label: 'STOCK TK' }
    ];

    const handleAssignmentChange = (code: string, checked: boolean) => {
        if (checked) {
            if (selectedAssignments.length < count) {
                setSelectedAssignments([...selectedAssignments, code]);
            }
        } else {
            setSelectedAssignments(selectedAssignments.filter(c => c !== code));
        }
    };

    const handleSubmit = async () => {
        if (selectedAssignments.length === 0) {
            alert('Please select at least one assignment');
            return;
        }

        setLoading(true);
        try {
            const apcData: APCCreate = {
                file_no: staff.fileNo,
                name: staff.name,
                conraiss: staff.grade,
                station: staff.station,
                count: count,
                active: true
            };

            // Set selected assignments
            selectedAssignments.forEach(code => {
                (apcData as any)[code] = 'Y';
            });

            await createAPC(apcData);
            onSuccess();
        } catch (error) {
            console.error('Error adding to APC:', error);
            alert('Failed to add to APC');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface-light dark:bg-[#121b25] rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-200">Add to APC</h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <span className="material-symbols-outlined text-2xl">close</span>
                    </button>
                </div>

                <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">File No</label>
                            <input type="text" value={staff.fileNo} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-background-light text-slate-500 font-bold" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                            <input type="text" value={staff.name} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-background-light text-slate-500 font-bold" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Grade</label>
                            <input type="text" value={staff.grade} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-background-light text-slate-500 font-bold" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Station</label>
                            <input type="text" value={staff.station} disabled className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-background-light text-slate-500 font-bold" />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Count</label>
                        <input
                            type="number"
                            min="1"
                            value={count}
                            onChange={(e) => {
                                const newCount = parseInt(e.target.value) || 1;
                                setCount(newCount);
                                if (selectedAssignments.length > newCount) {
                                    setSelectedAssignments(selectedAssignments.slice(0, newCount));
                                }
                            }}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg font-bold"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-3">
                            Assignment Codes ({selectedAssignments.length}/{count} selected)
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {assignmentCodes.map(({ code, label }) => {
                                const isChecked = selectedAssignments.includes(code);
                                const isDisabled = !isChecked && selectedAssignments.length >= count;
                                return (
                                    <label key={code} className={`flex items-center gap-2 p-2 rounded border cursor-pointer transition-colors ${isDisabled ? 'opacity-50 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-50'
                                        } ${isChecked ? 'bg-emerald-50 border-emerald-200' : 'border-slate-200'}`}>
                                        <input
                                            type="checkbox"
                                            checked={isChecked}
                                            disabled={isDisabled}
                                            onChange={(e) => handleAssignmentChange(code, e.target.checked)}
                                            className="rounded"
                                        />
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300">{label}</span>
                                    </label>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors">
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={loading || selectedAssignments.length === 0}
                        className="px-6 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? 'Adding...' : 'Add to APC'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ComparePage;