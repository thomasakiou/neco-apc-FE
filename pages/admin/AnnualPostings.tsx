import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import * as XLSX from 'xlsx';
import { getAllPostingRecords, bulkCreatePostings, bulkDeletePostings, updatePosting } from '../../services/posting';
import { getAllAPCRecords, updateAPC } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { PostingResponse, PostingCreate } from '../../types/posting';
import { APCRecord } from '../../types/apc';
import { Assignment } from '../../types/assignment';
import { MarkingVenue } from '../../types/markingVenue';
import { useNotification } from '../../context/NotificationContext';
import SearchableSelect from '../../components/SearchableSelect';
import CsvUploadModal from '../../components/CsvUploadModal';
import { CSVPostingData, assignmentFieldMap } from '../../services/personalizedPost';

interface CollapsibleRowProps {
  record: PostingResponse;
  selected: boolean;
  onDelete: () => void;
  onReplace: () => void;
  isSwapping: boolean;
  isSwapSource: boolean;
  onSwap: () => void;
}

const formatVenueName = (venue: string | null | undefined): string => {
  if (!venue) return '-';
  const parts = venue.split('-').map(p => p.trim());
  return parts.length > 0 ? parts[parts.length - 1] : venue;
};

const deduplicatePostings = (assignments: any[], mandates: any[], venues: any[]) => {
  const seenMandates = new Set();
  const resAssignments: any[] = [];
  const resMandates: any[] = [];
  const resVenues: any[] = [];

  // Iterate backwards to keep the "latest" record as per requirement
  for (let i = mandates.length - 1; i >= 0; i--) {
    const m = mandates[i];
    const mandateStr = typeof m === 'string' ? m : m.mandate || m.code;
    if (!seenMandates.has(mandateStr)) {
      seenMandates.add(mandateStr);
      resAssignments.unshift(assignments[i]);
      resMandates.unshift(m);
      resVenues.unshift(venues[i]);
    }
  }

  return { assignments: resAssignments, mandates: resMandates, venues: resVenues };
};

const CollapsibleRow = React.memo<CollapsibleRowProps>(({ record, selected, onSelect, onDelete, onReplace, isSwapping, isSwapSource, onSwap }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <React.Fragment>
      <tr className={`group hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors ${isExpanded ? 'bg-emerald-50/30 dark:bg-emerald-900/10' : ''}`}>
        <td className="p-4 text-center">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onSelect(e.target.checked)}
            className="rounded border-slate-300 dark:border-gray-600 dark:bg-gray-700 text-primary focus:ring-primary w-3.5 h-3.5 cursor-pointer"
          />
        </td>
        <td className="p-4 text-center">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
          >
            <span className={`material-symbols-outlined transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
              chevron_right
            </span>
          </button>
        </td>
        <td className="px-4 py-4 font-mono text-sm font-bold text-slate-700 dark:text-slate-300">{record.file_no}</td>
        <td className="px-4 py-4">
          <div className="flex flex-col">
            <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">{record.name}</span>
            <span className="text-[11px] text-slate-500 uppercase font-medium">{record.sex || '-'}</span>
          </div>
        </td>
        <td className="px-4 py-4 font-medium text-slate-700 dark:text-slate-300 text-sm">{record.station || '-'}</td>
        <td className="px-4 py-4">
          <span className="inline-flex px-2 py-0.5 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 uppercase">
            {record.conraiss || '-'}
          </span>
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-wrap gap-1 max-w-[150px]">
            {record.assignments.map((assignment, idx) => (
              <span key={idx} className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase whitespace-nowrap">
                {typeof assignment === 'string' ? assignment : assignment.name || assignment.code}
              </span>
            ))}
          </div>
        </td>
        <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300 text-sm">{formatVenueName(record.assignment_venue?.[0])}</td>
        <td className="px-4 py-4 font-black text-rose-600 dark:text-rose-400 text-sm text-center">{record.to_be_posted || 0}</td>
        <td className="px-4 py-4 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={onSwap}
              className={`p-2 rounded-lg transition-all duration-300 ${isSwapSource ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : isSwapping ? 'text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
              title={isSwapSource ? "Cancel Swap" : isSwapping ? "Swap Venue with this Staff" : "Swap Staff Venue"}
            >
              <span className="material-symbols-outlined text-lg">
                {isSwapSource ? 'sync' : isSwapping ? 'published_with_changes' : 'swap_horiz'}
              </span>
            </button>
            <button
              onClick={onReplace}
              className="p-2 text-indigo-400 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg transition-colors"
              title="Replace Staff"
            >
              <span className="material-symbols-outlined text-lg">person_search</span>
            </button>
            <button
              onClick={onDelete}
              className="p-2 text-rose-400 hover:text-rose-600 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              title="Delete Assignment"
            >
              <span className="material-symbols-outlined text-lg">delete</span>
            </button>
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50/50 dark:bg-slate-800/30">
          <td colSpan={10} className="p-0">
            <div className="px-16 py-6 animate-in slide-in-from-top-2 duration-200">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-xs">
                <div>
                  <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Mandates</span>
                  <div className="flex flex-wrap gap-1.5">
                    {record.mandates.map((m, i) => (
                      <span key={i} className="px-2 py-1 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-sm font-bold text-sm">
                        {typeof m === 'string' ? m : m.mandate || m.code}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div className="col-span-2 mt-2">
                  <span className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-1.5">Description</span>
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300 italic p-2 bg-white dark:bg-slate-800 rounded border border-slate-100 dark:border-slate-700 min-h-[30px]">
                    {record.description || 'No description provided.'}
                  </p>
                </div>

                <div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Qualification</span>
                  <span className="text-slate-700 dark:text-slate-300 font-bold">{record.qualification || '-'}</span>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Posted For</span>
                  <span className="inline-flex px-2 py-1 rounded text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/30 font-black">
                    {record.posted_for || 0}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Status</span>
                  <span className="inline-flex px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black">
                    Post Active
                  </span>
                </div>
              </div>
            </div>
          </td>
        </tr >
      )}
    </React.Fragment >
  );
});


const AnnualPostings: React.FC = () => {
  const [postings, setPostings] = useState<PostingResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletionProgress, setDeletionProgress] = useState<{ current: number; total: number } | null>(null);
  const { success, error } = useNotification();

  // Swap State
  // Swap & Replace State
  const [swapSource, setSwapSource] = useState<PostingResponse | null>(null);
  const [replacementSource, setReplacementSource] = useState<PostingResponse | null>(null);
  const [isReplacementModalOpen, setIsReplacementModalOpen] = useState(false);
  const [replacementPool, setReplacementPool] = useState<APCRecord[]>([]);
  const [modalSearchFileNo, setModalSearchFileNo] = useState('');
  const [modalSearchName, setModalSearchName] = useState('');
  const [modalSearchConraiss, setModalSearchConraiss] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Filter Options
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [venues, setVenues] = useState<MarkingVenue[]>([]);

  // Search States
  const [searchFileNo, setSearchFileNo] = useState('');
  const [searchName, setSearchName] = useState('');
  const [searchStation, setSearchStation] = useState('');

  // Dropdown Filter States
  const [filterAssignment, setFilterAssignment] = useState('');
  const [filterMandate, setFilterMandate] = useState('');
  const [filterVenue, setFilterVenue] = useState('');
  const [filterPostedFor, setFilterPostedFor] = useState('');
  const [filterAssignmentsLeft, setFilterAssignmentsLeft] = useState(''); // New Filter
  const [filterToBePosted, setFilterToBePosted] = useState('');
  const [filterDescription, setFilterDescription] = useState('');
  const [venueSearch, setVenueSearch] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);

  // Debounced Search
  const debouncedFileNo = useDebounce(searchFileNo, 300);
  const debouncedName = useDebounce(searchName, 300);
  const debouncedStation = useDebounce(searchStation, 300);
  const debouncedAssignmentSearch = useDebounce(filterAssignment, 300);
  const debouncedVenueSearch = useDebounce(venueSearch, 300);

  // Modals
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchInitialData = useCallback(async (force: boolean = false) => {
    try {
      setLoading(true);
      // Step 1: Fetch primary data quickly
      const [postingsData, assignmentsData, venuesData] = await Promise.all([
        getAllPostingRecords(force),
        getAllAssignments(force),
        getAllMarkingVenues(force)
      ]);

      setPostings(postingsData);
      setAssignments(assignmentsData);
      setVenues(venuesData);
      setLoading(false); // Initial load done

      // Step 2: Sync active staff in background
      setIsSyncing(true);
      const activeAPC = await getAllAPCRecords(true, force);
      const activeFileNos = new Set(activeAPC.map(a => a.file_no));

      // Filter postings to show only active staff
      setPostings(prev => prev.filter(p => activeFileNos.has(p.file_no)));
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    } finally {
      setLoading(false);
      setIsSyncing(false);
    }
  }, [setPostings, setAssignments, setVenues]);

  const handleRefresh = () => fetchInitialData(true);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // UI for global loading/progress overlay
  const renderLoadingOverlay = () => {
    if (!loading) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center animate-fadeIn">
        <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-teal-500 animate-pulse">sync</span>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
              {deletionProgress ? 'Processing Deletion' : 'Loading Data'}
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {deletionProgress
                ? `Returning staff to pool: ${deletionProgress.current} / ${deletionProgress.total}`
                : 'Please wait while we sync with the server...'}
            </p>
          </div>

          {deletionProgress && (
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-500 h-full transition-all duration-300"
                style={{ width: `${(deletionProgress.current / deletionProgress.total) * 100}%` }}
              ></div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const uniqueMandates = useMemo(() => {
    const mandateSet = new Set<string>();
    postings.forEach(p => {
      p.mandates?.forEach(m => {
        const mName = typeof m === 'string' ? m : m.mandate || m.code;
        if (mName) mandateSet.add(mName);
      });
    });
    return Array.from(mandateSet).sort();
  }, [postings]);

  const uniqueDescriptions = useMemo(() => {
    const descSet = new Set<string>();
    postings.forEach(p => {
      if (p.description) descSet.add(p.description);
    });
    return Array.from(descSet).sort();
  }, [postings]);

  const uniqueVenues = useMemo(() => {
    const venueSet = new Set<string>();
    postings.forEach(p => {
      if (Array.isArray(p.assignment_venue)) {
        p.assignment_venue.forEach(v => {
          if (v) venueSet.add(v);
        });
      }
    });
    return Array.from(venueSet).sort();
  }, [postings]);

  const filteredVenues = useMemo(() => {
    if (!debouncedVenueSearch) return uniqueVenues;
    const lowerSearch = debouncedVenueSearch.toLowerCase();
    return uniqueVenues.filter(v => v.toLowerCase().includes(lowerSearch));
  }, [uniqueVenues, debouncedVenueSearch]);

  const filteredPostings = useMemo(() => {
    let result = postings;

    if (debouncedFileNo) {
      result = result.filter(p => p.file_no?.toLowerCase().includes(debouncedFileNo.toLowerCase()));
    }
    if (debouncedName) {
      result = result.filter(p => p.name?.toLowerCase().includes(debouncedName.toLowerCase()));
    }
    if (debouncedStation) {
      result = result.filter(p => p.station?.toLowerCase().includes(debouncedStation.toLowerCase()));
    }
    if (debouncedAssignmentSearch) {
      // Text search for assignment
      const lowerSearch = debouncedAssignmentSearch.toLowerCase();
      result = result.filter(p =>
        p.assignments?.some((a: any) => {
          const val = typeof a === 'string' ? a : a.name || a.code;
          return val?.toLowerCase().includes(lowerSearch);
        })
      );
    }
    if (filterMandate) {
      result = result.filter(p =>
        p.mandates?.some((m: any) =>
          (typeof m === 'string' ? m : m.mandate || m.code) === filterMandate
        )
      );
    }
    if (filterVenue) {
      result = result.filter(p =>
        p.assignment_venue?.some((v: any) =>
          (typeof v === 'string' ? v : v.name || v.code) === filterVenue
        )
      );
    }
    if (filterPostedFor) {
      result = result.filter(p => p.posted_for === Number(filterPostedFor) || p.posted_for?.toString() === filterPostedFor);
    }
    if (filterAssignmentsLeft) {
      result = result.filter(p => p.to_be_posted === Number(filterAssignmentsLeft));
    }
    if (filterToBePosted) {
      if (filterToBePosted === 'true') {
        result = result.filter(p => (p.to_be_posted || 0) > 0);
      } else {
        result = result.filter(p => (p.to_be_posted || 0) <= 0);
      }
    }
    if (filterDescription) {
      result = result.filter(p => p.description === filterDescription);
    }

    return result;
  }, [
    postings,
    debouncedFileNo,
    debouncedName,
    debouncedStation,
    debouncedAssignmentSearch,
    filterMandate,
    filterVenue,
    filterPostedFor,
    filterAssignmentsLeft,
    filterToBePosted,
    filterDescription
  ]);

  const total = filteredPostings.length;

  const paginatedPostings = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredPostings.slice(startIndex, startIndex + limit);
  }, [filteredPostings, page, limit]);

  // Selection handlers
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(filteredPostings.map(p => p.id)));
    } else {
      setSelectedIds(new Set());
    }
  }, [filteredPostings]);

  const handleSelectOne = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleExecuteSwap = useCallback(async (target: PostingResponse) => {
    if (!swapSource) return;
    try {
      setLoading(true);

      // 1. Mandate Validation
      const sourceMandates = swapSource.mandates.map(m => typeof m === 'string' ? m : m.mandate || m.code);
      const targetMandates = target.mandates.map(m => typeof m === 'string' ? m : m.mandate || m.code);
      const sharedMandates = sourceMandates.filter(m => targetMandates.includes(m));

      if (sharedMandates.length === 0) {
        throw new Error(`Staff members must share the same mandate to swap venues. ${swapSource.name} and ${target.name} do not share any mandates.`);
      }

      // 2. Prepare New Posting Records (Venue-based Swap)
      // Strictly swap assignment_venue arrays. Mandates and Assignments stay with original staff.
      const isSameCount = swapSource.assignments.length === target.assignments.length;

      if (!isSameCount) {
        throw new Error(`Staff members must have the same number of assignments to swap venues. ${swapSource.name} has ${swapSource.assignments.length} while ${target.name} has ${target.assignments.length}.`);
      }

      // 3. Skip Quota Validation for swaps as requested (assignments count hasn't changed)

      // 4. Update Posting Records (Targeted Updates to prevent duplication)
      await Promise.all([
        updatePosting(swapSource.id, { assignment_venue: [...target.assignment_venue] }),
        updatePosting(target.id, { assignment_venue: [...swapSource.assignment_venue] })
      ]);

      setSwapSource(null);
      await fetchInitialData();
      success(`Successfully swapped venues between ${swapSource.name} and ${target.name}.`);
    } catch (err: any) {
      console.error("Swap failed", err);
      error(err.message || "Failed to execute swap. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [swapSource, fetchInitialData, success, error]);
  const handleExecuteReplacement = useCallback(async (targetAPC: APCRecord) => {
    if (!replacementSource) return;
    try {
      setLoading(true);

      // 1. Fetch Source Staff APC Record
      const allAPC = await getAllAPCRecords(false, true);
      const sourceAPC = allAPC.find(a => a.file_no === replacementSource.file_no);

      if (!sourceAPC) throw new Error("Original staff not found in APC database.");

      // Calculate target's current total posted assignments
      const targetCurrentPosted = postings
        .filter(p => p.file_no === targetAPC.file_no)
        .reduce((sum, p) => sum + (p.assignments?.length || 0), 0);

      // 2. Prepare Updates
      const newTargetRecord: PostingCreate = {
        file_no: targetAPC.file_no,
        name: targetAPC.name,
        station: targetAPC.station,
        conraiss: targetAPC.conraiss,
        year: replacementSource.year,
        count: replacementSource.count,
        posted_for: replacementSource.assignments.length,
        to_be_posted: (targetAPC.count || 0) - (targetCurrentPosted + replacementSource.assignments.length),
        assignments: replacementSource.assignments,
        mandates: replacementSource.mandates,
        assignment_venue: replacementSource.assignment_venue,
        description: replacementSource.description
      };

      // 3. Update Source APC (Return to Pool)
      const updateSourceAPC = async () => {
        const updates: any = { ...sourceAPC };
        replacementSource.assignments.forEach(code => {
          const field = assignmentFieldMap[code];
          if (field) updates[field] = 'Returned';
        });
        const { id, created_at, updated_at, created_by, updated_by, ...clean } = updates;
        await updateAPC(id, clean);
      };

      // 4. Update Target APC (Assign Posting)
      const updateTargetAPC = async () => {
        const updates: any = { ...targetAPC };
        replacementSource.assignments.forEach((code, idx) => {
          const field = assignmentFieldMap[code];
          if (field) {
            updates[field] = replacementSource.assignment_venue[idx] || '';
          }
        });
        const { id, created_at, updated_at, created_by, updated_by, ...clean } = updates;
        await updateAPC(id, clean);
      };

      // 5. Execute API Calls
      await Promise.all([
        updateSourceAPC(),
        updateTargetAPC(),
        bulkDeletePostings([replacementSource.id]),
        bulkCreatePostings({ items: [newTargetRecord] })
      ]);

      success(`Successfully replaced ${replacementSource.name} with ${targetAPC.name}`);
      setIsReplacementModalOpen(false);
      setReplacementSource(null);
      await fetchInitialData();
    } catch (err: any) {
      console.error("Replacement failed", err);
      error(err.message || "Failed to replace staff. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [replacementSource, fetchInitialData, success, error]);

  const filteredReplacementPool = useMemo(() => {
    return replacementPool.filter(staff => {
      const matchesFileNo = !modalSearchFileNo || staff.file_no.toLowerCase().includes(modalSearchFileNo.toLowerCase());
      const matchesName = !modalSearchName || staff.name.toLowerCase().includes(modalSearchName.toLowerCase());
      const matchesConraiss = !modalSearchConraiss || staff.conraiss?.toLowerCase().includes(modalSearchConraiss.toLowerCase());
      return matchesFileNo && matchesName && matchesConraiss;
    });
  }, [replacementPool, modalSearchFileNo, modalSearchName, modalSearchConraiss]);

  const handleSingleDelete = useCallback(async (record: PostingResponse) => {
    try {
      setLoading(true);
      const allAPC = await getAllAPCRecords(false);
      const apcMap = new Map(allAPC.map(a => [a.file_no.toString().padStart(4, '0'), a]));

      const normFileNo = record.file_no.toString().padStart(4, '0');
      const apcRecord = apcMap.get(normFileNo);

      if (apcRecord && record.assignments && record.assignments.length > 0) {
        let payload: any = { ...apcRecord };
        const { id, created_at, updated_at, created_by, updated_by, ...rest } = payload;
        payload = { ...rest };

        let hasChanges = false;
        record.assignments.forEach((assignment: any) => {
          const codeOrName = typeof assignment === 'string' ? assignment : assignment.code || assignment.name;
          const fieldName = assignmentFieldMap[codeOrName] || assignmentFieldMap[codeOrName?.toString().toUpperCase()];
          if (fieldName) {
            payload[fieldName] = 'Returned';
            hasChanges = true;
          }
        });

        if (hasChanges) {
          await updateAPC(apcRecord.id, payload);
        }
      }

      await bulkDeletePostings([record.id]);
      alert("Posting deleted and staff returned successfully.");
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(record.id);
        return next;
      });
      fetchInitialData();
    } catch (error: any) {
      console.error("Delete failed", error);
      alert(`Failed to delete posting: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchInitialData, setSelectedIds]);


  const handleBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const totalCount = selectedIds.size;
    if (!window.confirm(`Are you sure you want to delete ${totalCount} posting(s)? This will return the staff to the pool.`)) return;

    try {
      setLoading(true);
      setDeletionProgress({ current: 0, total: totalCount });

      // 1. Fetch all APC records to perform updates
      const allAPC = await getAllAPCRecords(false);
      const apcMap = new Map(allAPC.map(a => [a.file_no.toString().padStart(4, '0'), a]));

      // 2. Process each selected posting to update APC
      const postingsToDelete = postings.filter(p => selectedIds.has(p.id));
      const CHUNK_SIZE = 50;

      for (let i = 0; i < postingsToDelete.length; i += CHUNK_SIZE) {
        const chunk = postingsToDelete.slice(i, i + CHUNK_SIZE);
        const updates = [];

        for (const posting of chunk) {
          const normFileNo = posting.file_no.toString().padStart(4, '0');
          const apcRecord = apcMap.get(normFileNo);

          if (apcRecord && posting.assignments && posting.assignments.length > 0) {
            let payload: any = { ...apcRecord };
            const { id, created_at, updated_at, created_by, updated_by, ...rest } = payload;
            payload = { ...rest };

            let hasChanges = false;
            if (posting.assignments && Array.isArray(posting.assignments)) {
              posting.assignments.forEach((assignment: any) => {
                const codeOrName = typeof assignment === 'string' ? assignment : assignment.code || assignment.name;
                const fieldName = assignmentFieldMap[codeOrName];
                if (fieldName) {
                  payload[fieldName] = 'Returned';
                  hasChanges = true;
                } else {
                  const upperKey = codeOrName?.toString().toUpperCase();
                  const fieldNameUpper = assignmentFieldMap[upperKey];
                  if (fieldNameUpper) {
                    payload[fieldNameUpper] = 'Returned';
                    hasChanges = true;
                  }
                }
              });
            }

            if (hasChanges) {
              updates.push(updateAPC(apcRecord.id, payload));
            }
          }
        }

        if (updates.length > 0) {
          await Promise.allSettled(updates);
        }

        const processedCount = Math.min(i + CHUNK_SIZE, totalCount);
        setDeletionProgress({ current: processedCount, total: totalCount });
      }

      // 3. Delete Postings
      await bulkDeletePostings(Array.from(selectedIds));

      alert("Selected postings deleted and staff returned successfully.");
      setSelectedIds(new Set());
      setDeletionProgress(null);
      fetchInitialData();
    } catch (error: any) {
      console.error("Bulk delete failed", error);
      alert(`Failed to delete postings: ${error.message}`);
      setDeletionProgress(null);
    } finally {
      setLoading(false);
    }
  }, [fetchInitialData, postings, selectedIds]);

  const handleExport = useCallback(() => {
    try {
      setLoading(true);
      const exportData = filteredPostings.map(record => ({
        'File Number': record.file_no,
        'Name': record.name,
        'Station': record.station,
        'CONRAISS': record.conraiss,
        'Year': record.year,
        'Count': record.count,
        'Assignments': record.assignments?.map((a: any) => typeof a === 'string' ? a : a.name || a.code).join(', '),
        'Mandates': record.mandates?.map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(', '),
        'Venue': record.assignment_venue?.map((v: any) => typeof v === 'string' ? v : v.name || v.code).join(', '),
        'Posted For': record.posted_for,
        'To Be Posted': record.to_be_posted
      }));

      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Posting List");
      XLSX.writeFile(wb, `Posting_List_${new Date().toISOString().split('T')[0]}.xlsx`);

      alert("Export successful!");
    } catch (error) {
      console.error("Export failed", error);
      alert("Failed to export data.");
    } finally {
      setLoading(false);
    }
  }, [filteredPostings]);

  const downloadCsvTemplate = useCallback(() => {
    // User requested Mandate and Venue fields to be added
    const headers = ['FileNo', 'Name', 'Station', 'Conraiss', 'Count', 'Assignments', 'Mandate', 'Venue'];
    const csvContent = "data:text/csv;charset=utf-8," + headers.join(",");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "posting_upload_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, []);

  const handleCsvUpload = useCallback(async (data: CSVPostingData[]) => {
    setLoading(true);
    try {
      const payload: PostingCreate[] = data.map(row => ({
        file_no: row.staffNo,
        name: row.name || '',
        station: row.station,
        conraiss: row.conraiss,
        year: new Date().getFullYear().toString(),
        count: row.count || 0,
        // Logic for posted_for / to_be_posted if not explicit?
        // If Assignments provided, use length. 
        // If not, maybe 0?
        posted_for: row.assignments?.length || 0,
        to_be_posted: (row.count || 0) - (row.assignments?.length || 0),

        assignments: row.assignments || [],
        mandates: row.mandate ? [row.mandate] : [],
        assignment_venue: row.venue ? [row.venue] : []
      }));

      // Send to bulk create endpoint
      await bulkCreatePostings({ items: payload });

      alert(`Successfully imported ${payload.length} records.`);
      setIsCsvModalOpen(false);
      fetchInitialData(); // Refresh table
    } catch (err: any) {
      console.error("Bulk upload failed", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchInitialData]);

  // Helper to extract unique "posted_for" values for filter
  const postedForOptions = Array.from(new Set(postings.map(p => p.posted_for).filter(val => val !== undefined && val !== null))) as (string | number)[];
  const assignmentsLeftOptions = Array.from(new Set(postings.map(p => p.to_be_posted).filter(val => val !== undefined && val !== null))) as (string | number)[];

  const assignmentOptionsForSelect = assignments.map(a => ({ id: a.id, name: a.name }));

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#0b1015] p-4 md:p-8 animate-fadeIn relative">
      {renderLoadingOverlay()}
      <div className="max-w-[1600px] mx-auto flex-1 flex flex-col h-full font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-y-auto">

        {/* Header Section */}
        <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-600 dark:from-teal-400 dark:via-emerald-400 dark:to-cyan-400 drop-shadow-sm">
              Annual Posting Board
            </h1>
            <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
              Manage staff postings, assignments, and mandates efficiently.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {selectedIds.size > 0 && (
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-gradient-to-r from-rose-600 to-red-600 rounded-lg shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                <span className="material-symbols-outlined text-lg">delete</span>
                Delete Selected ({selectedIds.size})
              </button>
            )}
            <button
              onClick={fetchInitialData}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-teal-600 dark:text-teal-400 font-bold text-xs shadow-sm hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-all"
              title="Refresh Data"
            >
              <span className={`material-symbols-outlined text-lg ${loading && !deletionProgress ? 'animate-spin' : ''}`}>refresh</span>
              Refresh
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Export List
            </button>
            <button
              onClick={downloadCsvTemplate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Template
            </button>
            {isSyncing && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-100 dark:border-indigo-800 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-tight">Syncing Pool</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
              title="Force Refresh Data"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Force Refresh
            </button>
            <button
              onClick={() => setIsCsvModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-lg shadow-emerald-500/20 transition-all"
            >
              <span className="material-symbols-outlined text-lg">upload_file</span>
              Import CSV
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#121b25] rounded-2xl shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-gray-800 p-6 flex flex-col gap-6">

          {/* Swap Mode Toolbar */}
          {swapSource && (
            <div className="animate-in slide-in-from-top-4 duration-300">
              <div className="bg-indigo-600 rounded-2xl p-4 flex items-center justify-between shadow-xl shadow-indigo-500/20 border border-indigo-500/50">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white animate-pulse">
                    <span className="material-symbols-outlined font-bold">sync</span>
                  </div>
                  <div>
                    <h4 className="text-white font-black text-sm uppercase tracking-wider">Swap Mode Active</h4>
                    <p className="text-indigo-100 text-xs text-left">Exchanging assignments for: <span className="font-bold underline">{swapSource.name}</span>. Select a target staff member below.</p>
                  </div>
                </div>
                <button
                  onClick={() => setSwapSource(null)}
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase transition-all flex items-center gap-2 border border-white/10"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  Cancel Swap
                </button>
              </div>
            </div>
          )}

          {/* Search & Filter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* Search Inputs */}
            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-teal-500 transition-colors">tag</span>
              </div>
              <input
                type="text"
                placeholder="Search File No..."
                className="w-full pl-10 h-10 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:bg-white dark:focus:bg-[#0b1015] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium"
                value={searchFileNo}
                onChange={(e) => setSearchFileNo(e.target.value)}
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-teal-500 transition-colors">person_search</span>
              </div>
              <input
                type="text"
                placeholder="Search Name..."
                className="w-full pl-10 h-10 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:bg-white dark:focus:bg-[#0b1015] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span className="material-symbols-outlined text-slate-400 group-focus-within:text-teal-500 transition-colors">assignment</span>
              </div>
              <input
                type="text"
                placeholder="Search Assignment..."
                className="w-full pl-10 h-10 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:bg-white dark:focus:bg-[#0b1015] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium"
                value={filterAssignment}
                onChange={(e) => setFilterAssignment(e.target.value)}
              />
            </div>

            {/* Assignments Left Filter */}
            <div className="relative">
              <select
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
                value={filterAssignmentsLeft}
                onChange={(e) => setFilterAssignmentsLeft(e.target.value)}
              >
                <option value="">All Assignments Left</option>
                {assignmentsLeftOptions.sort((a, b) => Number(a) - Number(b)).map(opt => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                <span className="material-symbols-outlined text-lg">expand_more</span>
              </div>
            </div>


            {/* Mandates Filter */}
            <div className="relative">
              <select
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
                value={filterMandate}
                onChange={(e) => setFilterMandate(e.target.value)}
              >
                <option value="">All Mandates</option>
                {uniqueMandates.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                <span className="material-symbols-outlined text-lg">expand_more</span>
              </div>
            </div>

            {/* Venues Filter */}
            <div className="relative flex flex-col gap-1 min-w-[200px]">
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="material-symbols-outlined text-slate-400 group-focus-within:text-teal-500 transition-colors text-sm">search</span>
                </div>
                <input
                  type="text"
                  placeholder="Filter venues..."
                  className="w-full pl-9 h-8 rounded-t-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:bg-white dark:focus:bg-[#0b1015] focus:border-teal-500 transition-all outline-none text-xs font-medium border-b-0"
                  value={venueSearch}
                  onChange={(e) => setVenueSearch(e.target.value)}
                />
              </div>
              <div className="relative">
                <select
                  className="w-full h-10 px-3 rounded-b-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
                  value={filterVenue}
                  onChange={(e) => setFilterVenue(e.target.value)}
                >
                  <option value="">All Venues {filteredVenues.length !== uniqueVenues.length ? `(${filteredVenues.length})` : ''}</option>
                  {filteredVenues.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                  <span className="material-symbols-outlined text-lg">expand_more</span>
                </div>
              </div>
            </div>

            {/* Description Filter */}
            <div className="relative">
              <select
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
              >
                <option value="">All Descriptions</option>
                {uniqueDescriptions.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
                <span className="material-symbols-outlined text-lg">expand_more</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-bold text-slate-500 whitespace-nowrap">Page Size:</label>
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                className="h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] font-bold text-sm focus:ring-teal-500"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>

          </div>

          {/* Table Container */}
          <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-800 bg-white dark:bg-[#121b25] mt-4 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-white dark:from-[#0f161d] dark:to-[#121b25] border-b border-slate-200 dark:border-gray-800">
                    <th className="p-4 w-10"><input type="checkbox" className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4" checked={filteredPostings.length > 0 && filteredPostings.every(p => selectedIds.has(p.id))} onChange={(e) => handleSelectAll(e.target.checked)} /></th>
                    <th className="p-4 w-10 text-center">
                      <span className="material-symbols-outlined text-slate-400 text-sm">unfold_more</span>
                    </th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">File No</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Station</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Conraiss</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assignments</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Venue</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Assign. Left</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                  {loading ? (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-500 italic">Loading records...</td></tr>
                  ) : paginatedPostings.length === 0 ? (
                    <tr><td colSpan={10} className="p-8 text-center text-slate-500 italic">No records found matching your filters.</td></tr>
                  ) : (
                    paginatedPostings.map((record) => (
                      <CollapsibleRow
                        key={record.id}
                        record={record}
                        selected={selectedIds.has(record.id)}
                        onSelect={(checked) => handleSelectOne(record.id, checked)}
                        isSwapping={!!swapSource}
                        isSwapSource={swapSource?.id === record.id}
                        onSwap={() => {
                          if (swapSource?.id === record.id) {
                            setSwapSource(null);
                          } else if (swapSource) {
                            handleExecuteSwap(record);
                          } else {
                            setSwapSource(record);
                          }
                        }}
                        onReplace={async () => {
                          setReplacementSource(record);
                          // Fetch eligible pool
                          const pool = await getAllAPCRecords(true, false);

                          // Pre-calculate posted counts from current postings
                          const postedCountMap = new Map<string, number>();
                          postings.forEach(p => {
                            const count = (p.assignments || []).length;
                            postedCountMap.set(p.file_no, (postedCountMap.get(p.file_no) || 0) + count);
                          });

                          const eligible = pool.filter(staff => {
                            if (staff.file_no === record.file_no) return false;
                            const totalPosted = (postedCountMap.get(staff.file_no) || 0);
                            const totalAllotted = (staff.count || 0);
                            return totalPosted < totalAllotted;
                          });
                          setReplacementPool(eligible);
                          setIsReplacementModalOpen(true);
                        }}
                        onDelete={() => {
                          if (window.confirm(`Are you sure you want to delete posting for ${record.name}? This will return the staff to the pool.`)) {
                            handleSingleDelete(record);
                          }
                        }}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0f161d] flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Showing <span className="font-bold text-slate-700 dark:text-slate-200">{(page - 1) * limit + 1}</span> to <span className="font-bold text-slate-700 dark:text-slate-200">{Math.min(page * limit, total)}</span> of <span className="font-bold text-slate-700 dark:text-slate-200">{total}</span> results
              </div>

              <div className="flex gap-2">
                <button
                  disabled={page === 1}
                  onClick={() => setPage(1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">first_page</span>
                </button>
                <button
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">chevron_left</span>
                </button>
                <div className="flex items-center px-3 text-sm font-bold">
                  Page {page} of {Math.ceil(total / limit) || 1}
                </div>
                <button
                  disabled={page >= Math.ceil(total / limit)}
                  onClick={() => setPage(p => p + 1)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">chevron_right</span>
                </button>
                <button
                  disabled={page >= Math.ceil(total / limit)}
                  onClick={() => setPage(Math.ceil(total / limit))}
                  className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-300 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-lg">last_page</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <CsvUploadModal
          isOpen={isCsvModalOpen}
          onClose={() => setIsCsvModalOpen(false)}
          onUpload={handleCsvUpload}
        />

        {/* Staff Replacement Modal */}
        {isReplacementModalOpen && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[10000] flex items-center justify-center p-4 animate-fadeIn">
            <div className="bg-white dark:bg-[#121b25] w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col max-h-[90vh] overflow-hidden">
              <div className="p-6 border-b border-slate-100 dark:border-gray-800 flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100">Replace Posted Staff</h3>
                  <p className="text-xs font-medium text-slate-500 mt-1 uppercase tracking-wider">
                    Source: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{replacementSource?.name}</span>
                  </p>
                </div>
                <button onClick={() => {
                  setIsReplacementModalOpen(false);
                  setModalSearchFileNo('');
                  setModalSearchName('');
                  setModalSearchConraiss('');
                }} className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-400">close</span>
                </button>
              </div>

              <div className="px-6 py-4 border-b border-slate-100 dark:border-gray-800 bg-slate-50/50 dark:bg-slate-900/10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-slate-400">tag</span>
                    <input
                      type="text"
                      placeholder="File No..."
                      value={modalSearchFileNo}
                      onChange={(e) => setModalSearchFileNo(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0f161d] text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-slate-400">person</span>
                    <input
                      type="text"
                      placeholder="Name..."
                      value={modalSearchName}
                      onChange={(e) => setModalSearchName(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0f161d] text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-sm text-slate-400">grade</span>
                    <input
                      type="text"
                      placeholder="Conraiss..."
                      value={modalSearchConraiss}
                      onChange={(e) => setModalSearchConraiss(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-gray-700 bg-white dark:bg-[#0f161d] text-xs font-medium focus:ring-2 focus:ring-indigo-500/20 outline-none transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="p-6 overflow-y-auto space-y-4">
                <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/50 p-4 rounded-2xl flex items-start gap-3">
                  <span className="material-symbols-outlined text-amber-500 mt-0.5">info</span>
                  <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                    This will return <span className="font-bold underline">{replacementSource?.name}</span> to the eligible pool and transfer their assignments to the person you select below.
                  </p>
                </div>

                <div className="space-y-3">
                  <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Select Replacement Staff ({filteredReplacementPool.length} Match)</span>
                  {filteredReplacementPool.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 italic bg-slate-50 dark:bg-slate-900/20 rounded-2xl border border-dashed border-slate-200 dark:border-gray-800">
                      {replacementPool.length === 0 ? 'No eligible staff found in the pool.' : 'No staff matches your search criteria.'}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-2">
                      {filteredReplacementPool.map(staff => (
                        <button
                          key={staff.id}
                          onClick={() => handleExecuteReplacement(staff)}
                          className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-gray-800 bg-white dark:bg-[#0f161d] hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/10 transition-all text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-500">
                              {staff.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-bold text-slate-800 dark:text-slate-100 text-sm leading-tight">{staff.name}</p>
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[10px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded font-black text-slate-500 uppercase">{staff.file_no}</span>
                                <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded font-black text-indigo-600 dark:text-indigo-400 uppercase">CON {staff.conraiss}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] block font-black text-emerald-500 uppercase tracking-tight">Available</span>
                            <span className="text-xs text-slate-400 font-medium">{staff.station}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 dark:border-gray-800 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setIsReplacementModalOpen(false);
                    setModalSearchFileNo('');
                    setModalSearchName('');
                    setModalSearchConraiss('');
                  }}
                  className="px-6 py-2 rounded-xl border border-slate-200 dark:border-gray-800 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnnualPostings;