import { AssignmentBoardData, MandateColumn, StaffMandateAssignment } from '../types/apc';
import { getMandatesByAssignment } from './assignment';
import { getAllDriverAPC, updateDriverAPC, assignmentFieldMap } from './driverApc';
import { Assignment } from '../types/assignment';
import { getAllDriverPostings, bulkCreateDriverPostings, bulkDeleteDriverPostings } from './driverPosting';
import { DriverPostingCreate as PostingCreate } from '../types/driverPosting';

export const getDriverAssignmentBoardData = async (assignment: Assignment): Promise<AssignmentBoardData> => {
    // 1. Fetch data
    const [mandates, allDriverApc, allDriverPostings] = await Promise.all([
        getMandatesByAssignment(assignment),
        getAllDriverAPC(0, 100000), // Get all with large limit
        getAllDriverPostings(true)
    ]);

    const getField = (code?: string, name?: string) => {
        const keys = [code, name].filter(Boolean) as string[];
        for (const k of keys) {
            const upper = k.toUpperCase().trim();
            const withHyphen = upper.replace(/\s+/g, '-');
            const withoutHyphen = upper.replace(/-/g, ' ');

            if (assignmentFieldMap[upper]) return assignmentFieldMap[upper];
            if (assignmentFieldMap[withHyphen]) return assignmentFieldMap[withHyphen];
            if (assignmentFieldMap[withoutHyphen]) return assignmentFieldMap[withoutHyphen];
        }
        return null;
    };

    const fieldName = getField(assignment.code, assignment.name);

    // 2. Map mandates to columns
    const mandateColumns: MandateColumn[] = mandates.map(mandate => ({
        id: mandate.id,
        title: mandate.mandate,
        code: mandate.code,
        station: mandate.station,
        active: mandate.active,
        staff: []
    }));

    // 3. Create high-speed maps
    const assignedStaffMap = new Map<string, string>(); // staff_no -> mandate_id
    const staffPostingsCount = new Map<string, number>(); // staff_no -> count
    const staffPostedSpecifics = new Map<string, Set<string>>(); // staff_no -> specifics

    allDriverApc.items.forEach((record: any) => {
        const normalizedFileNo = record.file_no.padStart(4, '0');
        if (fieldName) {
            const assignmentValue = record[fieldName as keyof any];
            if (assignmentValue && typeof assignmentValue === 'string' && assignmentValue.trim() !== '') {
                const matchedMandate = mandateColumns.find(m =>
                    m.title.toLowerCase() === assignmentValue.toLowerCase() ||
                    m.code.toLowerCase() === assignmentValue.toLowerCase()
                );
                if (matchedMandate) assignedStaffMap.set(normalizedFileNo, matchedMandate.id);
            }
        }
    });

    allDriverPostings.forEach(p => {
        const assignmentsArr = Array.isArray(p.assignments) ? p.assignments : [];
        staffPostingsCount.set(p.file_no, (staffPostingsCount.get(p.file_no) || 0) + assignmentsArr.length);

        if (assignmentsArr.length > 0) {
            const specificSet = staffPostedSpecifics.get(p.file_no) || new Set();
            assignmentsArr.forEach(code => specificSet.add(code));
            staffPostedSpecifics.set(p.file_no, specificSet);
        }
    });

    // 4. Distribute Drivers
    const unassignedStaff: StaffMandateAssignment[] = [];

    allDriverApc.items.forEach((driver: any) => {
        const normalizedStaffFileNo = driver.file_no.padStart(4, '0');
        const postedSpecifics = staffPostedSpecifics.get(normalizedStaffFileNo);

        // Hide if already posted for THIS assignment type
        if (postedSpecifics && postedSpecifics.has(assignment.code)) return;

        const totalPosted = staffPostingsCount.get(normalizedStaffFileNo) || 0;
        const totalAllotted = driver.count || 0;
        const assignLeft = Math.max(0, totalAllotted - totalPosted);
        const mandateId = assignedStaffMap.get(normalizedStaffFileNo);

        if (assignLeft <= 0 && !mandateId) return; // Hide exhausted staff unless they are already assigned on board

        const staffAssignment: StaffMandateAssignment = {
            id: driver.id,
            staff_no: driver.file_no,
            staff_name: driver.name,
            rank: driver.rank || 'DRIVER',
            current_station: driver.station || '',
            qualification: driver.qualification || '',
            conr: driver.conraiss || '',
            mandate_id: mandateId || null,
            apc_id: driver.id,
            total_allotted: totalAllotted,
            assign_left: assignLeft
        };

        if (mandateId) {
            mandateColumns.find(c => c.id === mandateId)?.staff.push(staffAssignment);
        } else if (fieldName) {
            const val = driver[fieldName as keyof any];
            if (val && val.toString().trim() !== '' && val.toString().trim().toUpperCase() !== 'RETURNED') {
                unassignedStaff.push(staffAssignment);
            }
        }
    });

    return { assignmentId: assignment.id, unassignedStaff, mandateColumns };
};

export const bulkSaveDriverAssignments = async (
    payload: {
        assignment: Assignment;
        mandate?: MandateColumn;
        station?: { id: string; name: string; type: string; state?: string | null };
        changes: { staff: StaffMandateAssignment; action: 'add' | 'remove' | 'move'; targetMandateId: string | null }[];
        numberOfNights?: number;
        description?: string;
    }
): Promise<void> => {
    const { assignment, changes, station, numberOfNights, description } = payload;
    if (!assignment || !changes || changes.length === 0) return;

    // Load dependencies
    const [allPostings, allDriverApc, mandates] = await Promise.all([
        getAllDriverPostings(true),
        getAllDriverAPC(0, 100000),
        getMandatesByAssignment(assignment)
    ]);
    const postingMap = new Map<string, any>(allPostings.map(p => [String(p.file_no).padStart(4, '0'), p]));
    const driverApcMap = new Map<string, any>(allDriverApc.items.map(a => [String(a.file_no).padStart(4, '0'), a]));
    const mandateLookup = new Map<string, any>(mandates.map(m => [m.id, m]));
    const modifiedStaffNos = new Set<string>();
    const getField = (code?: string, name?: string) => {
        const keys = [code, name].filter(Boolean) as string[];
        for (const k of keys) {
            const upper = k.toUpperCase().trim();
            const withHyphen = upper.replace(/\s+/g, '-');
            const withoutHyphen = upper.replace(/-/g, ' ');

            if (assignmentFieldMap[upper]) return assignmentFieldMap[upper];
            if (assignmentFieldMap[withHyphen]) return assignmentFieldMap[withHyphen];
            if (assignmentFieldMap[withoutHyphen]) return assignmentFieldMap[withoutHyphen];
        }
        return null;
    };

    const fieldName = getField(assignment.code, assignment.name);

    for (const change of changes) {
        const normalizedStaffNo = change.staff.staff_no.toString().padStart(4, '0');
        const driverApcRecord = driverApcMap.get(normalizedStaffNo);

        if (!driverApcRecord && change.action === 'add') throw new Error(`Driver ${change.staff.staff_no} not found in records.`);

        const allottedCount = numberOfNights !== undefined ? numberOfNights : (driverApcRecord?.count || 0);
        const apcLimit = driverApcRecord?.count || 0;
        const postingRecord = postingMap.get(normalizedStaffNo);
        const totalPosted = postingRecord ? (postingRecord.assignments || []).length : 0;

        let mandateName = 'Unknown Mandate';
        if (change.targetMandateId) {
            mandateName = mandateLookup.get(change.targetMandateId)?.mandate || 'Unknown Mandate';
        } else if (payload.mandate) {
            mandateName = payload.mandate.title;
        }

        const venue = station?.name || '';

        if (change.action === 'add' || change.action === 'move') {
            const existingAssignments = postingRecord?.assignments || [];
            const normalize = (s: any) => s ? String(s).trim().toUpperCase() : '';
            const targetCode = normalize(assignment.code);

            if (change.action === 'add' && existingAssignments.some((a: any) => normalize(a) === targetCode)) {
                throw new Error(`${change.staff.staff_name} is already posted for ${assignment.name}.`);
            }

            if (change.action === 'add' && apcLimit - totalPosted <= 0) {
                throw new Error(`Limit reached for ${change.staff.staff_name}. (Allowed: ${apcLimit}, Used: ${totalPosted})`);
            }

            // Sync with Driver APC
            if (change.action === 'add' && driverApcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = driverApcRecord;
                await updateDriverAPC(id, { ...clean, [fieldName]: '' });
            }

            const newAssignments = postingRecord?.assignments ? [...postingRecord.assignments] : [];
            const newMandates = postingRecord?.mandates ? [...postingRecord.mandates] : [];
            const newVenues = postingRecord?.assignment_venue ? [...postingRecord.assignment_venue] : [];
            const newVenueCodes = postingRecord?.venue_code ? [...postingRecord.venue_code] : [];
            const newStates = postingRecord?.state
                ? (typeof postingRecord.state === 'string' ? postingRecord.state.split(' | ') : [...postingRecord.state])
                : [];

            // Synchronize arrays to match assignments length
            while (newMandates.length < newAssignments.length) newMandates.push('');
            while (newVenues.length < newAssignments.length) newVenues.push('');
            while (newVenueCodes.length < newAssignments.length) newVenueCodes.push('');
            while (newStates.length < newAssignments.length) newStates.push('');

            const existingIdx = newAssignments.indexOf(assignment.code);
            if (existingIdx !== -1) {
                newAssignments.splice(existingIdx, 1);
                newMandates.splice(existingIdx, 1);
                newVenues.splice(existingIdx, 1);
                newVenueCodes.splice(existingIdx, 1);
                newStates.splice(existingIdx, 1);
            }

            newAssignments.push(assignment.code);
            newMandates.push(mandateName.substring(0, 50));
            newVenues.push(venue);
            newVenueCodes.push(station?.code || '');
            newStates.push(station?.state || '');

            const postedFor = newAssignments.length;

            postingMap.set(normalizedStaffNo, {
                ...(postingRecord || {}),
                file_no: normalizedStaffNo,
                name: change.staff.staff_name,
                station: change.staff.current_station,
                conraiss: change.staff.conr,
                sex: driverApcRecord?.sex || null,
                qualification: driverApcRecord?.qualification || null,
                count: driverApcRecord?.count || null,
                year: new Date().getFullYear().toString(),
                state: newStates,
                assignments: newAssignments,
                mandates: newMandates,
                assignment_venue: newVenues,
                venue_code: newVenueCodes,
                posted_for: postedFor,
                to_be_posted: Math.max(0, apcLimit - postedFor),
                numb_of__nites: allottedCount,
                description: description || null
            });
            modifiedStaffNos.add(normalizedStaffNo);

        } else if (change.action === 'remove') {
            if (driverApcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = driverApcRecord;
                await updateDriverAPC(id, { ...clean, [fieldName]: 'Returned' });
            }

            if (postingRecord) {
                const idx = postingRecord.assignments?.indexOf(assignment.code);
                if (idx !== -1 && idx !== undefined) {
                    postingRecord.assignments.splice(idx, 1);
                    postingRecord.mandates.splice(idx, 1);
                    postingRecord.assignment_venue.splice(idx, 1);

                    const states = typeof postingRecord.state === 'string'
                        ? postingRecord.state.split(' | ')
                        : (postingRecord.state || []);

                    const venueCodes = typeof postingRecord.venue_code === 'string'
                        ? [postingRecord.venue_code]
                        : (postingRecord.venue_code || []);

                    if (states.length > idx) states.splice(idx, 1);
                    if (venueCodes.length > idx) venueCodes.splice(idx, 1);

                    postingRecord.state = states;
                    postingRecord.venue_code = venueCodes;

                    postingRecord.posted_for = postingRecord.assignments.length;
                    postingRecord.to_be_posted = allottedCount - postingRecord.posted_for;
                    postingRecord.numb_of__nites = allottedCount;
                    modifiedStaffNos.add(normalizedStaffNo);
                }
            }
        }
    }

    if (modifiedStaffNos.size > 0) {
        const idsToDelete = Array.from(modifiedStaffNos)
            .map(s => postingMap.get(s)?.id)
            .filter(id => id);

        if (idsToDelete.length > 0) {
            await bulkDeleteDriverPostings(idsToDelete as string[]);
        }

        const batch = Array.from(modifiedStaffNos).map(s => {
            const rec = postingMap.get(s);
            const { id, created_at, updated_at, created_by, updated_by, ...clean } = rec;
            return clean as PostingCreate;
        });
        await bulkCreateDriverPostings({ items: batch });
    }
};
