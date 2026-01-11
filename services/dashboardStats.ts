import { getStaffList, getAllStaff } from './staff';
import { getAllAPC } from './apc';
import { getAllPostingRecords } from './posting';
import { getStateList } from './state';
import { getMarkingVenueList } from './markingVenue';
import { getAllSSCECustodians, getAllBECECustodians } from './custodianSpecific';
import { getAllNCEECenters } from './nceeCenter';

// Define the response shape for the dashboard
export interface DashboardStats {
    counts: {
        staff: number;
        apc: number;
        completedPostings: number;
        ssceCustodians: number;
        beceCustodians: number;
        states: number;
        markingVenues: number;
        nceeCenters: number;
    };
    charts: {
        staffDistribution: { name: string; value: number }[];
        postingStatus: { name: string; value: number; color: string }[];
        totalPostings: number; // Total number of APC records considered
    };
}

// Helper to swallow errors and return a default value with timeout
async function safeFetch<T>(promise: Promise<T>, fallback: T, timeoutMs: number = 30000): Promise<T> {
    const timeoutPromise = new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Fetch timeout')), timeoutMs)
    );

    try {
        return await Promise.race([promise, timeoutPromise]);
    } catch (error) {
        console.warn('Dashboard metric fetch failed or timed out:', error);
        return fallback;
    }
}

// Cache for dashboard stats
let dashboardCache: DashboardStats | null = null;
let lastCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const getDashboardStats = async (forceRefresh = false): Promise<DashboardStats> => {
    const now = Date.now();
    if (!forceRefresh && dashboardCache && (now - lastCacheTime < CACHE_TTL)) {
        return dashboardCache;
    }

    // 1. Fetch BASIC COUNTS first (Parallel & Optimized)
    const [
        staffData,
        apcData,
        stateData,
        venueData,
        nceeData,
        ssceCustodians,
        beceCustodians
    ] = await Promise.all([
        safeFetch(getStaffList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getAllAPC(0, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getStateList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getMarkingVenueList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getAllNCEECenters(), [], 10000),
        safeFetch(getAllSSCECustodians(), [], 10000),
        safeFetch(getAllBECECustodians(), [], 10000)
    ]);

    const staffCount = staffData.total || 0;
    const apcCount = apcData.total || 0;
    const statesCount = stateData.total || 0;
    const venuesCount = venueData.total || 0;
    const nceeCount = nceeData.length;
    const ssceCount = ssceCustodians.length;
    const beceCount = beceCustodians.length;

    // 2. Fetch HEAVY DATA for charts (with longer timeout and graceful failure)
    const [allStaff, allPostings, allAPCs] = await Promise.all([
        safeFetch(getAllStaff(true), [], 60000),
        safeFetch(getAllPostingRecords(), [], 60000),
        safeFetch(getAllAPC(0, 50000, '', true).then(res => res.items).catch(() => []), [])
    ]);

    // Data Processing for Charts with null checks
    const stationCounts: Record<string, number> = {};
    if (allStaff.length > 0) {
        for (let i = 0; i < allStaff.length; i++) {
            const staff = allStaff[i];
            if (!staff?.station) continue;
            let stationName = staff.station.trim();
            if (stationName.toLowerCase().includes('hq') || stationName.toLowerCase().includes('headquarter') || stationName.toLowerCase() === 'minna') {
                stationName = 'HQ';
            }
            stationCounts[stationName] = (stationCounts[stationName] || 0) + 1;
        }
    }

    const staffDistribution = Object.entries(stationCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

    let notPosted = 0;
    let pending = 0;
    let completed = 0;

    if (allAPCs.length > 0) {
        const postingMap = new Map();
        for (let i = 0; i < allPostings.length; i++) {
            if (allPostings[i]?.file_no) postingMap.set(allPostings[i].file_no, allPostings[i]);
        }

        for (let i = 0; i < allAPCs.length; i++) {
            const apc = allAPCs[i];
            if (!apc) continue;
            const posting = postingMap.get(apc.file_no);
            const allotted = apc.count || 0;

            if (!posting) {
                notPosted++;
            } else {
                const mandatesCount = posting.mandates ? posting.mandates.length : 0;
                if (mandatesCount === 0) {
                    notPosted++;
                } else if (mandatesCount >= allotted || (posting.to_be_posted !== null && Number(posting.to_be_posted) <= 0)) {
                    completed++;
                } else {
                    pending++;
                }
            }
        }
    }

    const postingStatus = [
        { name: 'Completed', value: completed, color: '#10b981' },
        { name: 'Partial', value: pending, color: '#f59e0b' },
        { name: 'Not Posted', value: notPosted, color: '#ef4444' }
    ];

    const result = {
        counts: {
            staff: staffCount,
            apc: apcCount,
            completedPostings: completed,
            ssceCustodians: ssceCount,
            beceCustodians: beceCount,
            states: statesCount,
            markingVenues: venuesCount,
            nceeCenters: nceeCount
        },
        charts: {
            staffDistribution,
            postingStatus,
            totalPostings: apcCount
        }
    };

    dashboardCache = result;
    lastCacheTime = now;
    return result;
};
