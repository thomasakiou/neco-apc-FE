import React, { useState, useMemo, useEffect } from 'react';
import { useTheme } from '../../components/ThemeContext';
import SearchableSelect from '../../components/SearchableSelect';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getAllStaff } from '../../services/staff';
import { getAllAPCRecords } from '../../services/apc';
import { getAllPostingRecords } from '../../services/posting';
import { Staff } from '../../types/staff';
import { APCRecord } from '../../types/apc';
import { PostingResponse } from '../../types/posting';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#8dd1e1'];

// Zone Mapping
const STATE_TO_ZONE: Record<string, string> = {
    'Benue': 'North Central', 'Kogi': 'North Central', 'Kwara': 'North Central', 'Nasarawa': 'North Central', 'Niger': 'North Central', 'Plateau': 'North Central', 'FCT': 'North Central', 'Abuja': 'North Central',
    'Adamawa': 'North East', 'Bauchi': 'North East', 'Borno': 'North East', 'Gombe': 'North East', 'Taraba': 'North East', 'Yobe': 'North East',
    'Jigawa': 'North West', 'Kaduna': 'North West', 'Kano': 'North West', 'Katsina': 'North West', 'Kebbi': 'North West', 'Sokoto': 'North West', 'Zamfara': 'North West',
    'Abia': 'South East', 'Anambra': 'South East', 'Ebonyi': 'South East', 'Enugu': 'South East', 'Imo': 'South East',
    'Akwa Ibom': 'South South', 'Bayelsa': 'South South', 'Cross River': 'South South', 'Delta': 'South South', 'Edo': 'South South', 'Rivers': 'South South',
    'Ekiti': 'South West', 'Lagos': 'South West', 'Ogun': 'South West', 'Ondo': 'South West', 'Osun': 'South West', 'Oyo': 'South West'
};

const getZone = (state: string) => STATE_TO_ZONE[state] || 'Unknown';

const Statistics: React.FC = () => {
    const { theme } = useTheme();

    // Data State
    const [allStaff, setAllStaff] = useState<Staff[]>([]);
    const [allAPC, setAllAPC] = useState<APCRecord[]>([]);
    const [allPostings, setAllPostings] = useState<PostingResponse[]>([]);
    const [loading, setLoading] = useState<boolean>(true);

    // Filter State
    const [selectedState, setSelectedState] = useState<string>('');
    const [selectedSex, setSelectedSex] = useState<string>('');
    const [selectedConraiss, setSelectedConraiss] = useState<string>('');
    const [selectedStation, setSelectedStation] = useState<string>('');
    const [selectedZone, setSelectedZone] = useState<string>('');
    const [selectedPromotionDate, setSelectedPromotionDate] = useState<string>('');

    // Table State
    const [tableSearch, setTableSearch] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(10);

    // Fetch Data on Mount
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [staffRes, apcRes, postingRes] = await Promise.all([
                    getAllStaff(true),
                    getAllAPCRecords(),
                    getAllPostingRecords()
                ]);
                setAllStaff(staffRes);
                setAllAPC(apcRes);
                setAllPostings(postingRes);
            } catch (error) {
                console.error("Error fetching statistics data:", error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // Unique Options for Filters
    const uniqueStates = useMemo(() => Array.from(new Set(allStaff.map(s => s.state).filter(Boolean))).sort(), [allStaff]);
    const uniqueStations = useMemo(() => Array.from(new Set(allStaff.map(s => s.station).filter(Boolean))).sort(), [allStaff]);
    const uniqueConraiss = useMemo(() => Array.from(new Set(allStaff.map(s => s.conr).filter(Boolean))).sort((a, b) => Number(b) - Number(a)), [allStaff]); // Descending
    const uniqueZones = useMemo(() => Array.from(new Set(Object.values(STATE_TO_ZONE))).sort(), []);
    const uniquePromotionDates = useMemo(() => Array.from(new Set(allStaff.map(s => s.dopa?.split('T')[0]?.split(' ')[0]).filter(Boolean))).sort(), [allStaff]);

    // Derived Statistics based on filters
    const filteredData = useMemo(() => {
        return allStaff.filter(item => {
            const matchState = !selectedState || item.state === selectedState;
            const matchSex = !selectedSex || item.sex === selectedSex;
            const matchConraiss = !selectedConraiss || item.conr === selectedConraiss;
            const matchStation = !selectedStation || item.station === selectedStation;

            const staffZone = getZone(item.state || '');
            const matchZone = !selectedZone || staffZone === selectedZone;

            const matchPromotionDate = !selectedPromotionDate || (item.dopa && (item.dopa.split('T')[0].split(' ')[0] === selectedPromotionDate));

            return matchState && matchSex && matchConraiss && matchStation && matchZone && matchPromotionDate;
        });
    }, [allStaff, selectedState, selectedSex, selectedConraiss, selectedStation, selectedZone, selectedPromotionDate]);

    const stats = useMemo(() => {
        const staffIds = new Set(filteredData.map(s => s.fileno));

        // Filter associated records
        const filteredAPC = allAPC.filter(apc => staffIds.has(apc.file_no));
        const filteredPostings = allPostings.filter(p => staffIds.has(p.file_no)); // Assuming posting has file_no

        // Aggregations
        const byState = Object.entries(filteredData.reduce((acc, curr) => {
            const key = curr.state || 'Unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>))
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => Number(b.value) - Number(a.value)); // Sort by count descending

        const bySex = Object.entries(filteredData.reduce((acc, curr) => {
            const key = curr.sex || 'Unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {} as Record<string, number>)).map(([name, value]) => ({ name: name === 'M' ? 'Male' : name === 'F' ? 'Female' : name, value }));

        // Posting Status
        const totalWithPosting = filteredPostings.length;
        const totalWithoutPosting = filteredData.length - totalWithPosting;

        return {
            totalStaff: filteredData.length,
            totalAPC: filteredAPC.length,
            totalPostings: totalWithPosting,
            byState: byState.slice(0, 15), // Top 15 states to avoid overcrowding
            bySex,
            postingStatus: [
                { name: 'Posted', value: totalWithPosting },
                { name: 'Not Posted', value: totalWithoutPosting < 0 ? 0 : totalWithoutPosting }
            ]
        };
    }, [filteredData, allAPC, allPostings]);

    // Reset page to 1 when filters change
    useEffect(() => {
        setPage(1);
    }, [selectedState, selectedSex, selectedConraiss, selectedStation, selectedZone, selectedPromotionDate]);

    // Table specific options/filtering
    const tableFilteredData = useMemo(() => {
        return filteredData.filter(staff => {
            if (!tableSearch) return true;
            const searchLower = tableSearch.toLowerCase();
            return (
                staff.full_name?.toLowerCase().includes(searchLower) ||
                staff.fileno?.toLowerCase().includes(searchLower) ||
                staff.station?.toLowerCase().includes(searchLower)
            );
        });
    }, [filteredData, tableSearch]);

    // Valid APC File Numbers for quick lookup
    const apcFileNoSet = useMemo(() => new Set(allAPC.map(a => a.file_no)), [allAPC]);

    // Posting Map for detailed lookup
    const postingMap = useMemo(() => {
        const map = new Map<string, PostingResponse>();
        allPostings.forEach(p => map.set(p.file_no, p));
        return map;
    }, [allPostings]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * limit;
        return tableFilteredData.slice(start, start + limit);
    }, [tableFilteredData, page, limit]);

    // Export handlers
    const handleExportPDF = () => {
        const doc = new jsPDF();
        doc.text('Statistics Report', 14, 22);
        doc.setFontSize(10);
        doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

        // Summary Table
        autoTable(doc, {
            startY: 35,
            head: [['Metric', 'Count']],
            body: [
                ['Total Staff', stats.totalStaff],
                ['Total APC Records', stats.totalAPC],
                ['Total Postings', stats.totalPostings],
            ],
            theme: 'grid',
            headStyles: { fillColor: [41, 128, 185] }
        });

        // Detailed Table
        autoTable(doc, {
            startY: (doc as any).lastAutoTable.finalY + 10,
            head: [['Staff ID', 'Name', 'State', 'Sex', 'Conraiss', 'Station', 'Rank', 'APC Status', 'Post Status', 'DOPA']],
            body: filteredData.map(d => {
                const p = postingMap.get(d.fileno);
                const isPosted = p && p.mandates && p.mandates.length > 0;
                return [
                    d.fileno,
                    d.full_name,
                    d.state,
                    d.sex,
                    d.conr,
                    d.station,
                    d.rank,
                    apcFileNoSet.has(d.fileno) ? 'Active' : 'Missing',
                    isPosted ? 'Posted' : 'Not Posted',
                    d.dopa || '-'
                ];
            }),
            styles: { fontSize: 8 },
            headStyles: { fillColor: [52, 73, 94] }
        });

        doc.save('statistics_report.pdf');
    };

    const handleExportXLSX = () => {
        // 1. Summary Sheet
        const summaryData = [
            { Metric: 'Total Staff', Count: stats.totalStaff },
            { Metric: 'Total APC Records', Count: stats.totalAPC },
            { Metric: 'Total Postings', Count: stats.totalPostings },
        ];
        const summaryWS = XLSX.utils.json_to_sheet(summaryData);

        // 2. Details Sheet
        const detailsData = filteredData.map(d => {
            const p = postingMap.get(d.fileno);
            const isPosted = p && p.mandates && p.mandates.length > 0;
            return {
                'Staff ID': d.fileno,
                'Name': d.full_name,
                'State': d.state,
                'Sex': d.sex,
                'Conraiss': d.conr,
                'Station': d.station,
                'Rank': d.rank,
                'APC Status': apcFileNoSet.has(d.fileno) ? 'Active' : 'Missing',
                'Posting Status': isPosted ? 'Posted' : 'Not Posted',
                'DOPA': d.dopa || '-',
                'Email': d.email,
                'Phone': d.phone
            };
        });
        const detailsWS = XLSX.utils.json_to_sheet(detailsData);

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, summaryWS, "Summary");
        XLSX.utils.book_append_sheet(wb, detailsWS, "Staff Details");

        XLSX.writeFile(wb, "statistics_report.xlsx");
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full min-h-[400px]">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-500 dark:text-slate-400 font-medium">Loading statistics data...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-8 min-h-screen bg-slate-50 dark:bg-[#0b1116] text-slate-900 dark:text-slate-100 font-sans pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Statistics Dashboard</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Dynamic analysis of Staff, APC, and Postings</p>
                </div>
                <div className="flex gap-3">
                    <button onClick={handleExportPDF} className="flex items-center gap-2 px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-lg transition-colors shadow-sm font-medium">
                        <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                        Export PDF
                    </button>
                    <button onClick={handleExportXLSX} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm font-medium">
                        <span className="material-symbols-outlined text-sm">table_view</span>
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">filter_alt</span>
                    Filter Criteria
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Station</label>
                        <select
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2632] focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
                            value={selectedStation}
                            onChange={(e) => setSelectedStation(e.target.value)}
                        >
                            <option value="">All Stations</option>
                            {uniqueStations.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">State of Origin</label>
                        <select
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2632] focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
                            value={selectedState}
                            onChange={(e) => setSelectedState(e.target.value)}
                        >
                            <option value="">All States</option>
                            {uniqueStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Sex</label>
                        <select
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2632] focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
                            value={selectedSex}
                            onChange={(e) => setSelectedSex(e.target.value)}
                        >
                            <option value="">All</option>
                            <option value="M">Male</option>
                            <option value="F">Female</option>
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">CONRAISS Level</label>
                        <select
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2632] focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
                            value={selectedConraiss}
                            onChange={(e) => setSelectedConraiss(e.target.value)}
                        >
                            <option value="">All Levels</option>
                            {uniqueConraiss.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Zone</label>
                        <select
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2632] focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
                            value={selectedZone}
                            onChange={(e) => setSelectedZone(e.target.value)}
                        >
                            <option value="">All Zones</option>
                            {uniqueZones.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">DOPA (Appt. Date)</label>
                        <select
                            className="w-full p-2.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1a2632] focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
                            value={selectedPromotionDate}
                            onChange={(e) => setSelectedPromotionDate(e.target.value)}
                        >
                            <option value="">All Dates</option>
                            {uniquePromotionDates.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                        <span className="material-symbols-outlined text-3xl">group</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Filtered Staff</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalStaff}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                    <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-xl text-amber-600 dark:text-amber-400">
                        <span className="material-symbols-outlined text-3xl">badge</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">APC Records</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalAPC}</h3>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                    <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                        <span className="material-symbols-outlined text-3xl">assignment_ind</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Posted Staff</p>
                        <h3 className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalPostings}</h3>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Staff Distribution by State (Top 15)</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.byState} margin={{ bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#334155' : '#e2e8f0'} />
                                <XAxis
                                    dataKey="name"
                                    stroke={theme === 'dark' ? '#94a3b8' : '#64748b'}
                                    angle={-45}
                                    textAnchor="end"
                                    height={60}
                                    interval={0}
                                    tick={{ fontSize: 10 }}
                                />
                                <YAxis stroke={theme === 'dark' ? '#94a3b8' : '#64748b'} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', borderColor: theme === 'dark' ? '#334155' : '#e2e8f0' }}
                                    itemStyle={{ color: theme === 'dark' ? '#e2e8f0' : '#1e293b' }}
                                />
                                <Legend />
                                <Bar dataKey="value" name="Staff Count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Gender Distribution</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.bySex}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {stats.bySex.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="text-lg font-bold mb-6 text-slate-900 dark:text-white">Posting Status</h3>
                    <div className="h-80 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={stats.postingStatus}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    fill="#8884d8"
                                    paddingAngle={5}
                                    dataKey="value"
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    <Cell fill="#10b981" />
                                    <Cell fill="#ef4444" />
                                </Pie>
                                <Tooltip />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Staff Details Table */}
            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Staff Details</h3>
                    <div className="relative w-full md:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-400">search</span>
                        <input
                            type="text"
                            placeholder="Search table..."
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0b1015] focus:ring-2 focus:ring-primary/50 outline-none transition-shadow"
                            value={tableSearch}
                            onChange={(e) => {
                                setTableSearch(e.target.value);
                                setPage(1); // Reset to first page on search
                            }}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-slate-200 dark:border-slate-700">
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">File No</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">Full Name</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">Station</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">CONRAISS</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">Rank</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">Sex</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">State</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">APC Status</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">Post Status</th>
                                <th className="p-3 font-semibold text-slate-600 dark:text-slate-400 text-sm">DOPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedData.length > 0 ? (
                                paginatedData.map(staff => {
                                    const p = postingMap.get(staff.fileno);
                                    const isPosted = p && p.mandates && p.mandates.length > 0;
                                    const hasAPC = apcFileNoSet.has(staff.fileno);
                                    return (
                                        <tr key={staff.fileno || staff.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300 font-medium flex items-center gap-2">
                                                {staff.fileno}
                                                {!hasAPC && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                                                        Not on APC
                                                    </span>
                                                )}
                                                {hasAPC && !isPosted && (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                                                        Not Posted
                                                    </span>
                                                )}
                                            </td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{staff.full_name}</td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{staff.station}</td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{staff.conr}</td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{staff.rank}</td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{staff.sex}</td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">{staff.state}</td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                                                {apcFileNoSet.has(staff.fileno) ? 'Active' : 'Missing'}
                                            </td>
                                            <td className="p-3 text-sm text-slate-700 dark:text-slate-300">
                                                {isPosted ? (
                                                    <span className="text-emerald-600 font-medium">Posted</span>
                                                ) : (
                                                    hasAPC ? <span className="text-amber-600 font-medium">Not Posted</span> : '-'
                                                )}
                                            </td>
                                            <td className="p-3 text-sm font-mono text-slate-700 dark:text-slate-300">{staff.dopa || '-'}</td>
                                        </tr>
                                    );
                                })
                            ) : (
                                <tr>
                                    <td colSpan={10} className="p-8 text-center text-slate-500 dark:text-slate-400">
                                        No staff records found matching the criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {tableFilteredData.length > 0 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-4">
                        <div className="flex items-center gap-4">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Showing <span className="font-medium">{Math.min((page - 1) * limit + 1, tableFilteredData.length)}</span> to <span className="font-medium">{Math.min(page * limit, tableFilteredData.length)}</span> of <span className="font-medium">{tableFilteredData.length}</span> entries
                            </p>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1a2632] text-sm text-slate-700 dark:text-slate-300 focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                                <option value={10}>10 rows</option>
                                <option value={20}>20 rows</option>
                                <option value={50}>50 rows</option>
                                <option value={100}>100 rows</option>
                            </select>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_left</span>
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: Math.min(5, Math.ceil(tableFilteredData.length / limit)) }, (_, i) => {
                                    // Simple pagination logic for display (showing first 5 or current window)
                                    // For simplicity in this iteration, just showing a few pages or current
                                    let p = i + 1;
                                    if (page > 3 && Math.ceil(tableFilteredData.length / limit) > 5) {
                                        p = page - 2 + i;
                                    }
                                    if (p > Math.ceil(tableFilteredData.length / limit)) return null;

                                    return (
                                        <button
                                            key={p}
                                            onClick={() => setPage(p)}
                                            className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === p
                                                ? 'bg-primary text-white'
                                                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}
                                        >
                                            {p}
                                        </button>
                                    );
                                })}
                            </div>
                            <button
                                onClick={() => setPage(p => Math.min(Math.ceil(tableFilteredData.length / limit), p + 1))}
                                disabled={page >= Math.ceil(tableFilteredData.length / limit)}
                                className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <span className="material-symbols-outlined text-sm">chevron_right</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Statistics;
