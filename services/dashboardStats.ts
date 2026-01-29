import { getStaffList, getAllStaff } from './staff';
import { getAllAPC } from './apc';
import { getAllPostingRecords } from './posting';
import { getStateList } from './state';
import { getAllSSCECustodians, getAllBECECustodians, getAllSSCEExtCustodians } from './custodianSpecific';
import { getAllNCEECenters } from './nceeCenter';
import { getAllGiftedCenters } from './giftedCenter';
import { getAllTTCenters } from './ttCenter';
import { getMarkingVenueList, getAllSSCEExtMarkingVenues, getAllBECEMarkingVenues } from './markingVenue';

// Define the response shape for the dashboard
export interface DashboardStats {
    counts: {
        staff: number;
        apc: number;
        completedPostings: number;
        ssceCustodians: number;
        beceCustodians: number;
        ssceExtCustodians: number;
        states: number;
        markingVenues: number;
        ssceExtMarkingVenues: number;
        beceMarkingVenues: number;
        nceeCenters: number;
        giftedCenters: number;
        ttCenters: number;
    };
    charts: {
        staffDistribution: { name: string; value: number }[];
        postingStatus: { name: string; value: number; color: string }[];
        totalPostings: number; // Total number of APC records considered
    };
    staffRoles: {
        hods: number;
        education: number;
        stateCoordinators: number;
        directors: number;
        secretaries: number;
        others: number;
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
        beceCustodians,
        ssceExtCustodians,
        ssceExtMarkingVenues,
        beceMarkingVenues,
        giftedData,
        ttData
    ] = await Promise.all([
        safeFetch(getStaffList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getAllAPC(0, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getStateList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getMarkingVenueList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }, 10000),
        safeFetch(getAllNCEECenters(), [], 10000),
        safeFetch(getAllSSCECustodians(), [], 10000),
        safeFetch(getAllBECECustodians(), [], 10000),
        safeFetch(getAllSSCEExtCustodians(), [], 10000),
        safeFetch(getAllSSCEExtMarkingVenues(), [], 10000),
        safeFetch(getAllBECEMarkingVenues(), [], 10000),
        safeFetch(getAllGiftedCenters(), [], 10000),
        safeFetch(getAllTTCenters(), [], 10000)
    ]);

    const staffCount = staffData.total || 0;
    const apcCount = apcData.total || 0;
    const statesCount = stateData.total || 0;
    const venuesCount = venueData.total || 0;
    const nceeCount = nceeData.length;
    const ssceCount = ssceCustodians.length;
    const beceCount = beceCustodians.length;
    const ssceExtCustodianCount = ssceExtCustodians.length;
    const beceMarkingVenueCount = beceMarkingVenues.length;
    const giftedCount = (giftedData as any[]).length;
    const ssceExtMarkingVenueCount = ssceExtMarkingVenues.length;
    const ttCount = (ttData as any[]).length;
    // const ttData = (arguments[0] as any)[11] || []; // No, destructuring is cleaner if I can update it.
    // I need to update the destructuring variable list too.

    // Actually, I should update the destructuring list first or in the same go. but I can't do non-contiguous edits easily.
    // I will use `ttData` from the array access for now, OR I will restart and use `replace_file_content` on the destructuring list first.
    // The previous tool called `replace_file_content` on lines 80-82.
    // Destructuring is on lines 59-70.

    // I will access the 11th element (index 11, since 0-10 were used) from the result array.
    // Wait, `Promise.all` returns an array.
    // I destructured it into variables.
    // I didn't add a variable for the 12th element (index 11) in the destructuring list yet.
    // So `Promise.all` result is being destructured into 11 variables.
    // The 12th element is ignored.

    // I MUST update the destructuring list.
    // I will do that in the next tool call.
    // For this tool call (which targets lines 93-95), I'll just add `ttCount`.
    // But `ttData` isn't available yet.

    // Use `arguments` hack or similar? No, strictly typed.
    // I'll update the destructuring list FIRST in the NEXT step (wait, I should have done it before).
    // I'll update the destructuring list NOW using `replace_file_content` on the destructuring block.


    // 2. Fetch HEAVY DATA for charts (with longer timeout and graceful failure)
    const [allStaff, allPostings, allAPCs] = await Promise.all([
        safeFetch(getAllStaff(true), [], 60000),
        safeFetch(getAllPostingRecords(), [], 60000),
        safeFetch(getAllAPC(0, 50000, '', true).then(res => res.items).catch(() => []), [])
    ]);

    // Data Processing for Charts with null checks
    const stationCounts: Record<string, number> = {};

    // Staff Role Counters
    let hodCount = 0;
    let educationCount = 0;
    let coordinatorCount = 0;
    let directorCount = 0;
    let secretaryCount = 0;
    let othersCount = 0;

    if (allStaff.length > 0) {
        for (let i = 0; i < allStaff.length; i++) {
            const staff = allStaff[i];

            // Role Counting
            if (staff.is_hod) hodCount++;
            if (staff.is_education) educationCount++;
            if (staff.is_state_coordinator || staff.is_state_cordinator) coordinatorCount++;
            if (staff.is_director) directorCount++;
            if (staff.is_secretary) secretaryCount++;
            if (staff.others) othersCount++;

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
            ssceExtCustodians: ssceExtCustodianCount,
            states: statesCount,
            markingVenues: venuesCount,
            ssceExtMarkingVenues: ssceExtMarkingVenueCount,
            beceMarkingVenues: beceMarkingVenueCount,
            nceeCenters: nceeCount,
            giftedCenters: giftedCount,
            ttCenters: ttCount
        },
        charts: {
            staffDistribution,
            postingStatus,
            totalPostings: apcCount
        },
        staffRoles: {
            hods: hodCount,
            education: educationCount,
            stateCoordinators: coordinatorCount,
            directors: directorCount,
            secretaries: secretaryCount,
            others: othersCount
        }
    };

    dashboardCache = result;
    lastCacheTime = now;
    return result;
};
