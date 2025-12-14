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

// Helper to swallow errors and return a default value
async function safeFetch<T>(promise: Promise<T>, fallback: T): Promise<T> {
    try {
        return await promise;
    } catch (error) {
        console.warn('Dashboard specific metric fetch failed:', error);
        return fallback;
    }
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
    // 1. Fetch Basic Counts (independently in parallel so one failure doesn't kill all)
    const [
        staffData,
        apcData,
        stateData,
        venueData,
        nceeData,
        // For custodians, our existing specific services fetch all active items. 
        // If the list is huge, we might optimize later, but for now we fetch list length.
        ssceCustodians,
        beceCustodians,
        // For charts, we need bulk data
        allStaff,
        allPostings
    ] = await Promise.all([
        safeFetch(getStaffList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }),
        safeFetch(getAllAPC(0, 1), { items: [], total: 0, skip: 0, limit: 1 }),
        safeFetch(getStateList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }),
        safeFetch(getMarkingVenueList(1, 1), { items: [], total: 0, skip: 0, limit: 1 }),
        safeFetch(getAllNCEECenters(), []), // Reverted to getAll for accurate count
        safeFetch(getAllSSCECustodians(), []),
        safeFetch(getAllBECECustodians(), []),
        safeFetch(getAllStaff(), []),
        safeFetch(getAllPostingRecords(), [])
    ]);

    // Parse counts based on response types
    const staffCount = staffData.total || 0;
    const apcCount = apcData.total || 0;
    const statesCount = stateData.total || 0;

    // Optimized: use 'total' from response
    const venuesCount = venueData.total || 0;
    // NCEE returned array now
    const nceeCount = nceeData.length;
    const ssceCount = ssceCustodians.length;
    const beceCount = beceCustodians.length;

    // 2. Calculate Chart Data

    // a) Staff Distribution by Location (Station)
    const stationCounts: Record<string, number> = {};

    allStaff.forEach(staff => {
        if (!staff.station) return;
        let stationName = staff.station.trim();

        // Normalize HQ
        if (
            stationName.toLowerCase().includes('hq') ||
            stationName.toLowerCase().includes('headquarter') ||
            stationName.toLowerCase() === 'minna'
        ) {
            stationName = 'HQ';
        }

        stationCounts[stationName] = (stationCounts[stationName] || 0) + 1;
    });

    const staffDistribution = Object.entries(stationCounts)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10); // Top 10

    // b) Posting Status Overview

    let notPosted = 0;
    let pending = 0;
    let completed = 0;

    // Fetch all APCs safely for this chart logic
    let allAPCs: any[] = [];
    try {
        const apcModule = await import('./apc');
        allAPCs = await safeFetch(apcModule.getAllAPCRecords(), []);
    } catch (e) {
        console.warn('Failed to load APC records for chart', e);
    }

    // Create map of postings for fast lookup
    const postingMap = new Map(allPostings.map(p => [p.file_no, p]));

    allAPCs.forEach(apc => {
        const posting = postingMap.get(apc.file_no);
        const allotted = apc.count || 0;

        if (!posting) {
            // No record in posting table -> Not Posted
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
    });

    const postingStatus = [
        { name: 'Completed', value: completed, color: '#43a047' }, // Success
        { name: 'Partial', value: pending, color: '#FFC107' },   // Warning
        { name: 'Not Posted', value: notPosted, color: '#DC3545' } // Danger/Error
    ];

    return {
        counts: {
            staff: staffCount,
            apc: apcCount,
            completedPostings: completed, // Updated to use the calculated 'completed' var which matches logic
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
};
