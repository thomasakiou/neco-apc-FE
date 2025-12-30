import React, { useEffect, useState, useMemo } from 'react';
import { getAllAPCRecords } from '../../../services/apc';
import { getAllPostingRecords } from '../../../services/posting';
import { APCRecord } from '../../../types/apc';
import { PostingResponse } from '../../../types/posting';

interface FlaggedReason {
    type: 'count_mismatch' | 'assignment_count_mismatch' | 'posting_reduction_mismatch';
    message: string;
}

interface FlaggedStaff {
    id: string;
    fileNo: string;
    name: string;
    conraiss: string;
    expectedCount: number;
    actualApcCount: number;
    textAssignmentCount: number;
    postingCount: number;
    reasons: FlaggedReason[];
}

const FlaggedStaffPage: React.FC = () => {
    const [loading, setLoading] = useState(true);
    const [apcRecords, setApcRecords] = useState<APCRecord[]>([]);
    const [postings, setPostings] = useState<PostingResponse[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [limit, setLimit] = useState(25);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [apcList, postingList] = await Promise.all([
                getAllAPCRecords(true, false),
                getAllPostingRecords(false)
            ]);
            setApcRecords(apcList);
            setPostings(postingList);
        } catch (error) {
            console.error("Error fetching flagging data:", error);
        } finally {
            setLoading(false);
        }
    };

    const getExpectedCount = (conraiss: string): number => {
        const match = conraiss.match(/\d+/);
        if (!match) return 0;
        const grade = parseInt(match[0]);

        if (grade === 6 || grade === 7) return 1;
        if (grade >= 8 && grade <= 10) return 2;
        if (grade === 11 || grade === 12) return 3;
        if (grade === 13 || grade === 14) return 4;
        return 0;
    };

    // Only the 15 specific assignment fields from TT to STOCK-TK
    const assignmentFields = [
        'tt', 'ssce_int', 'ssce_ext', 'ssce_int_mrk', 'ssce_ext_mrk',
        'ncee', 'becep', 'bece_mrkp', 'mar_accr', 'oct_accr',
        'pur_samp', 'gifted', 'swapping', 'int_audit', 'stock_tk'
    ];

    const getTextAssignmentCount = (record: APCRecord): number => {
        let count = 0;
        assignmentFields.forEach(field => {
            const val = (record as any)[field];
            if (val && val.toString().trim() !== '') {
                count++;
            }
        });
        return count;
    };

    const flaggedStaffList = useMemo(() => {
        const results: FlaggedStaff[] = [];
        const postingCountMap = new Map<string, number>();

        // Count actual assignments per staff (not just row count)
        postings.forEach(p => {
            const fileNo = p.file_no.trim().padStart(4, '0');
            // Use assignments array length or posted_for field to get actual assignment count
            const assignmentCount = p.assignments?.length || p.posted_for || 0;
            postingCountMap.set(fileNo, (postingCountMap.get(fileNo) || 0) + assignmentCount);
        });

        apcRecords.forEach(apc => {
            const fileNo = apc.file_no.trim().padStart(4, '0');
            const conraiss = apc.conraiss || '';
            const expectedBaseCount = getExpectedCount(conraiss);

            if (expectedBaseCount === 0) return; // Skip those not in the defined ranges

            const actualApcCount = apc.count || 0;
            const textAssignmentCount = getTextAssignmentCount(apc);
            const postingCount = postingCountMap.get(fileNo) || 0;
            const expectedReducedCount = Math.max(0, expectedBaseCount - postingCount);

            const reasons: FlaggedReason[] = [];

            // Condition 1: Basic count mismatch (APC count vs specified rule)
            // Wait, the user said "conraiss 6,7 should have a count of 1... if any of these conditions is flaunted... i want that staff to be flagged"
            // So if apc.count doesn't match expectedBaseCount, it's flagged?
            // "conraiss 6,7 should have a count of 1 and only i assignment in APC table should have text in it"
            if (actualApcCount !== expectedBaseCount) {
                reasons.push({
                    type: 'count_mismatch',
                    message: `CONRAISS ${conraiss} expects count ${expectedBaseCount}, but APC record has ${actualApcCount}.`
                });
            }

            // Condition 2: Assignment count mismatch
            if (textAssignmentCount !== expectedBaseCount) {
                reasons.push({
                    type: 'assignment_count_mismatch',
                    message: `Expected ${expectedBaseCount} Assignments, but found ${textAssignmentCount}.`
                });
            }

            // Condition 3: Posting reduction rule
            // "if a staff for example has 3 counts and 3 assignment with text in APC and that staff exist in posting table, 
            // meaning the assignment field text should have reduced to 2 or 3 depending on how many times the staff appears in posting table"
            // Note: User said "reduced to 2 or 3", probably meant "reduced to 2 or 1" if they have 1 or 2 postings.
            if (postingCount > 0) {
                if (textAssignmentCount > expectedReducedCount) {
                    reasons.push({
                        type: 'posting_reduction_mismatch',
                        message: `Staff appears ${postingCount} time(s) in postings. Expected assignments should reduce to ${expectedReducedCount}, but found ${textAssignmentCount}.`
                    });
                }
            }

            if (reasons.length > 0) {
                results.push({
                    id: apc.id,
                    fileNo: apc.file_no,
                    name: apc.name,
                    conraiss: conraiss,
                    expectedCount: expectedBaseCount,
                    actualApcCount: actualApcCount,
                    textAssignmentCount: textAssignmentCount,
                    postingCount: postingCount,
                    reasons: reasons
                });
            }
        });

        return results;
    }, [apcRecords, postings]);

    const filteredData = useMemo(() => {
        if (!searchQuery) return flaggedStaffList;
        const q = searchQuery.toLowerCase();
        return flaggedStaffList.filter(s =>
            s.fileNo.toLowerCase().includes(q) ||
            s.name.toLowerCase().includes(q)
        );
    }, [flaggedStaffList, searchQuery]);

    const paginatedData = useMemo(() => {
        const start = (page - 1) * limit;
        return filteredData.slice(start, start + limit);
    }, [filteredData, page, limit]);

    const totalPages = Math.ceil(filteredData.length / limit);

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#101922] p-8 gap-8 overflow-y-auto transition-colors duration-200">
            <div className="flex flex-col gap-2 pb-6 border-b border-slate-200">
                <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-900 via-red-800 to-rose-700 dark:from-rose-400 dark:via-red-300 dark:to-rose-500 tracking-tight">
                    Flagged Staff Records
                </h1>
                <p className="text-slate-500 dark:text-slate-400 font-medium text-sm">Identifying staff with assignment count violations based on CONRAISS and Postings.</p>
            </div>

            <div className="bg-white dark:bg-[#121b25] p-6 rounded-2xl border border-slate-100 dark:border-gray-800 shadow-xl shadow-slate-200/50 dark:shadow-none flex flex-col gap-6 min-h-[500px] transition-colors duration-200">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-rose-600 dark:text-rose-400">{filteredData.length}</span>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Flagged Personnel</span>
                        </div>
                        <div className="h-10 w-px bg-slate-100 dark:bg-gray-800 hidden md:block"></div>
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-slate-600">Rows:</label>
                            <select
                                value={limit}
                                onChange={(e) => {
                                    setLimit(Number(e.target.value));
                                    setPage(1);
                                }}
                                className="h-9 px-2 rounded-lg border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0b1015] text-slate-700 dark:text-slate-300 text-sm font-bold"
                            >
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                            </select>
                        </div>
                    </div>

                    <div className="relative w-full md:w-64">
                        <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
                        <input
                            type="text"
                            placeholder="Search by File No or Name..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-gray-700 rounded-lg text-sm text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 outline-none transition-all"
                        />
                    </div>
                </div>

                {loading ? (
                    <div className="flex-1 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                            <span className="material-symbols-outlined animate-spin text-4xl text-rose-500/50">data_exploration</span>
                            <span className="text-slate-400 font-medium text-xs tracking-widest uppercase">Analyzing Records...</span>
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-gray-700">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold uppercase text-xs tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Staff Details</th>
                                    <th className="px-6 py-4">CONRAISS</th>
                                    <th className="px-6 py-4 text-center">Expected</th>
                                    <th className="px-6 py-4 text-center">Found</th>
                                    <th className="px-6 py-4 text-center">Postings</th>
                                    <th className="px-6 py-4">Flagging Reasons</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                                {paginatedData.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center py-20">
                                            <div className="flex flex-col items-center gap-3 text-slate-400">
                                                <span className="material-symbols-outlined text-5xl opacity-20">verified_user</span>
                                                <p className="font-medium">No flagging violations discovered.</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedData.map((staff) => (
                                        <tr key={staff.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-900 dark:text-white">{staff.name}</span>
                                                    <span className="font-mono text-xs text-rose-500 font-bold uppercase">{staff.fileNo}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-bold text-slate-600 dark:text-slate-400">{staff.conraiss}</td>
                                            <td className="px-6 py-4 text-center">
                                                <span className="px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 font-black text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-gray-700">{staff.expectedCount}</span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <span className={`px-2 py-1 rounded font-black ${staff.textAssignmentCount === staff.expectedCount ? 'text-slate-700 dark:text-slate-300' : 'text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20'}`}>
                                                    {staff.textAssignmentCount}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center font-bold text-indigo-600 dark:text-indigo-400">{staff.postingCount}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col gap-1">
                                                    {staff.reasons.map((r, i) => (
                                                        <div key={i} className="flex items-start gap-2 text-[11px] leading-tight">
                                                            <span className="material-symbols-outlined text-rose-500 text-sm mt-0.5">error_outline</span>
                                                            <span className="text-slate-500 dark:text-slate-400 font-medium">{r.message}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}

                {!loading && totalPages > 1 && (
                    <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-4 border-t border-slate-100 dark:border-gray-800">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                            Page {page} of {totalPages}
                        </p>
                        <div className="flex gap-1">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(1)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">first_page</span>
                            </button>
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => p - 1)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">chevron_left</span>
                            </button>
                            <div className="px-4 flex items-center font-black text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-gray-700">
                                {page}
                            </div>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">chevron_right</span>
                            </button>
                            <button
                                disabled={page >= totalPages}
                                onClick={() => setPage(totalPages)}
                                className="size-9 flex items-center justify-center rounded-lg border border-slate-200 dark:border-gray-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 transition-all font-black text-rose-500"
                            >
                                <span className="material-symbols-outlined">last_page</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FlaggedStaffPage;
