import { AssignmentBoardData, MandateColumn, StaffMandateAssignment } from '../types/apc';
import { getMandatesByAssignment } from './assignment';
import { getAllHODApcRecords, updateHODApc, assignmentFieldMap } from './hodApc';
import { Assignment } from '../types/assignment';
import { getAllHODPostings, bulkCreateHODPostings } from './hodPosting';
import { PostingCreate } from '../types/posting';

export const getHODAssignmentBoardData = async (assignment: Assignment): Promise<AssignmentBoardData> => {
    // 1. Fetch data
    const [mandates, allHODApc, allHODPostings] = await Promise.all([
        getMandatesByAssignment(assignment),
        getAllHODApcRecords(true),
        getAllHODPostings(true)
    ]);

    const fieldName = assignmentFieldMap[assignment.code];

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

    allHODApc.forEach((record: any) => {
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

    allHODPostings.forEach(p => {
        const assignmentsArr = Array.isArray(p.assignments) ? p.assignments : [];
        staffPostingsCount.set(p.file_no, (staffPostingsCount.get(p.file_no) || 0) + assignmentsArr.length);

        if (assignmentsArr.length > 0) {
            const specificSet = staffPostedSpecifics.get(p.file_no) || new Set();
            assignmentsArr.forEach(code => specificSet.add(code));
            staffPostedSpecifics.set(p.file_no, specificSet);
        }
    });

    // 4. Distribute HODs
    const unassignedStaff: StaffMandateAssignment[] = [];

    allHODApc.forEach((hod: any) => {
        const normalizedStaffFileNo = hod.file_no.padStart(4, '0');
        const postedSpecifics = staffPostedSpecifics.get(normalizedStaffFileNo);

        // Hide if already posted for THIS assignment type
        if (postedSpecifics && postedSpecifics.has(assignment.code)) return;

        const totalPosted = staffPostingsCount.get(normalizedStaffFileNo) || 0;
        const totalAllotted = hod.count || 0;
        const assignLeft = Math.max(0, totalAllotted - totalPosted);
        const mandateId = assignedStaffMap.get(normalizedStaffFileNo);

        if (assignLeft <= 0 && !mandateId) return; // Hide exhausted staff unless they are already assigned on board

        const staffAssignment: StaffMandateAssignment = {
            id: hod.id,
            staff_no: hod.file_no,
            staff_name: hod.name,
            rank: hod.rank || 'HOD',
            current_station: hod.station || '',
            qualification: hod.qualification || '',
            conr: hod.conraiss || '',
            mandate_id: mandateId || null,
            apc_id: hod.id,
            total_allotted: totalAllotted,
            assign_left: assignLeft
        };

        if (mandateId) {
            mandateColumns.find(c => c.id === mandateId)?.staff.push(staffAssignment);
        } else if (fieldName) {
            const val = hod[fieldName as keyof any];
            if (val && val.toString().trim() !== '') unassignedStaff.push(staffAssignment);
        }
    });

    return { assignmentId: assignment.id, unassignedStaff, mandateColumns };
};

export const bulkSaveHODAssignments = async (
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
    const [allPostings, allHODApc, mandates] = await Promise.all([
        getAllHODPostings(true),
        getAllHODApcRecords(true),
        getMandatesByAssignment(assignment)
    ]);
    const postingMap = new Map<string, any>(allPostings.map(p => [p.file_no, p]));
    const hodApcMap = new Map<string, any>(allHODApc.map(a => [a.file_no.padStart(4, '0'), a]));
    const mandateLookup = new Map<string, any>(mandates.map(m => [m.id, m]));
    const modifiedStaffNos = new Set<string>();
    const fieldName = assignmentFieldMap[assignment.code];

    for (const change of changes) {
        const normalizedStaffNo = change.staff.staff_no.toString().padStart(4, '0');
        const hodApcRecord = hodApcMap.get(normalizedStaffNo);

        if (!hodApcRecord && change.action === 'add') throw new Error(`HOD ${change.staff.staff_no} not found in records.`);

        const allottedCount = numberOfNights !== undefined ? numberOfNights : (hodApcRecord?.count || 0);
        const apcLimit = hodApcRecord?.count || 0;
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
            if (change.action === 'add' && apcLimit - totalPosted <= 0) {
                throw new Error(`Limit reached for ${change.staff.staff_name}. (Allowed: ${apcLimit}, Used: ${totalPosted})`);
            }

            // Sync with HOD APC
            if (change.action === 'add' && hodApcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = hodApcRecord;
                await updateHODApc(id, { ...clean, [fieldName]: '' });
            }

            const newAssignments = postingRecord?.assignments ? [...postingRecord.assignments] : [];
            const newMandates = postingRecord?.mandates ? [...postingRecord.mandates] : [];
            const newVenues = postingRecord?.assignment_venue ? [...postingRecord.assignment_venue] : [];

            const existingIdx = newAssignments.indexOf(assignment.code);
            if (existingIdx !== -1) {
                newAssignments.splice(existingIdx, 1); newMandates.splice(existingIdx, 1); newVenues.splice(existingIdx, 1);
            }

            newAssignments.push(assignment.code);
            newMandates.push(mandateName.substring(0, 50));
            newVenues.push(venue);

            postingMap.set(normalizedStaffNo, {
                ...(postingRecord || {}),
                file_no: normalizedStaffNo,
                name: change.staff.staff_name,
                station: change.staff.current_station,
                conraiss: change.staff.conr,
                year: new Date().getFullYear().toString(),
                count: allottedCount,
                posted_for: newAssignments.length,
                to_be_posted: apcLimit - newAssignments.length,
                assignments: newAssignments,
                mandates: newMandates,
                assignment_venue: newVenues,
                state: station?.state || null,
                description: description || null
            });
            modifiedStaffNos.add(normalizedStaffNo);

        } else if (change.action === 'remove') {
            if (hodApcRecord && fieldName) {
                const { id, created_at, updated_at, created_by, updated_by, ...clean } = hodApcRecord;
                await updateHODApc(id, { ...clean, [fieldName]: 'Returned' });
            }

            if (postingRecord) {
                const idx = postingRecord.assignments?.indexOf(assignment.code);
                if (idx !== -1 && idx !== undefined) {
                    postingRecord.assignments.splice(idx, 1);
                    postingRecord.mandates.splice(idx, 1);
                    postingRecord.assignment_venue.splice(idx, 1);
                    postingRecord.posted_for = postingRecord.assignments.length;
                    postingRecord.to_be_posted = allottedCount - postingRecord.posted_for;
                    modifiedStaffNos.add(normalizedStaffNo);
                }
            }
        }
    }

    if (modifiedStaffNos.size > 0) {
        const batch = Array.from(modifiedStaffNos).map(s => {
            const rec = postingMap.get(s);
            const { id, created_at, updated_at, created_by, updated_by, ...clean } = rec;
            return clean as PostingCreate;
        });
        await bulkCreateHODPostings({ items: batch });
    }
};
