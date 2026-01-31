import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useDebounce } from '../../hooks/useDebounce';
import * as XLSX from 'xlsx';
import { archivePostings } from '../../services/finalPosting';
import { getAllPostingRecords, bulkCreatePostings, bulkDeletePostings, updatePosting } from '../../services/posting';
import { getAllAPCRecords, updateAPC, getAssignmentLimit } from '../../services/apc';
import { getAllAssignments } from '../../services/assignment';
import { getAllStates } from '../../services/state';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { getPageCache, setPageCache } from '../../services/pageCache';
import { PostingResponse, PostingCreate } from '../../types/posting';
import { APCRecord } from '../../types/apc';
import { Assignment } from '../../types/assignment';
import { MarkingVenue } from '../../types/markingVenue';
import { useNotification } from '../../context/NotificationContext';
import SearchableSelect from '../../components/SearchableSelect';
import CsvUploadModal from '../../components/CsvUploadModal';
import HelpModal from '../../components/HelpModal';
import PostingEditModal from '../../components/PostingEditModal';
import { helpContent } from '../../data/helpContent';
import { CSVPostingData, assignmentFieldMap } from '../../services/personalizedPost';

interface CollapsibleRowProps {
  record: PostingResponse;
  selected: boolean;
  onDelete: () => void;
  onReplace: () => void;
  isSwapping: boolean;
  isSwapSource: boolean;
  onSwap: () => void;
  onEdit: () => void;
}

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
};

const formatVenueName = (venue: string | null | undefined): string => {
  if (!venue) return '-';
  // If it's already in the "Name | State" format, just return it
  if (venue.includes('|')) {
    const parts = venue.split('|').map(p => p.trim());
    const uniqueParts: string[] = [];
    const seen = new Set<string>();
    for (const p of parts) {
      const lower = p.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        uniqueParts.push(p);
      }
    }
    return uniqueParts.join(' | ');
  }

  // Previously we were splitting by '-' which broke names like "AKWA-IBOM" 
  // or names that already included the code as a suffix.
  // We'll keep the full string for now to ensure visibility.
  return venue;
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

const CollapsibleRow = React.memo<CollapsibleRowProps>(({ record, selected, onSelect, onDelete, onReplace, isSwapping, isSwapSource, onSwap, onEdit }) => {
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
          <div className="flex flex-col gap-1.5">
            {record.assignment_venue?.map((venue, idx) => {
              // Try to find code in venue_code first, then parse from venue string (STRICT: digits only), then empty
              const code = record.venue_code?.[idx] || (typeof venue === 'string' ? venue.match(/\((\d+)\)/)?.[1] : '');
              return (
                <div key={idx} className="whitespace-normal min-w-[50px] font-mono text-xs font-bold text-slate-500">
                  {code || '-'}
                </div>
              );
            })}
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-col gap-1.5">
            {record.assignments.map((assignment, idx) => (
              <div key={idx}>
                <span className="inline-flex px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase whitespace-nowrap">
                  {typeof assignment === 'string' ? assignment : assignment.name || assignment.code}
                </span>
              </div>
            ))}
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-col gap-1.5">
            {record.mandates?.map((mandate, idx) => (
              <div key={idx} className="text-xs font-semibold text-slate-600 dark:text-slate-400 whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]" title={typeof mandate === 'string' ? mandate : mandate.mandate || mandate.code}>
                {typeof mandate === 'string' ? mandate : mandate.mandate || mandate.code}
              </div>
            ))}
          </div>
        </td>
        <td className="px-4 py-4 font-bold text-slate-700 dark:text-slate-300 text-xs">
          <div className="flex flex-col gap-1.5">
            {record.assignment_venue?.map((venue, idx) => (
              <div key={idx} className="whitespace-normal min-w-[200px]" title={formatVenueName(venue)}>
                {formatVenueName(venue)}
              </div>
            ))}
          </div>
        </td>
        <td className="px-4 py-4">
          <div className="flex flex-col gap-1.5">
            {record.assignment_venue?.map((venue, idx) => {
              const venueStr = typeof venue === 'string' ? venue : venue.name || venue.code;
              // If we have a specific state array in record it would be better, but derivation from venue is the current pattern
              const state = record.state?.[idx] || (venueStr?.includes('|') ? venueStr.split('|').pop().trim() : '-');
              return (
                <div key={idx}>
                  <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-black bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50 uppercase">
                    {state}
                  </span>
                </div>
              );
            })}
          </div>
        </td>
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
              onClick={onEdit}
              className="p-2 text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
              title="Edit Posting"
            >
              <span className="material-symbols-outlined text-lg">edit</span>
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
      {
        isExpanded && (
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
                    <span className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Posting Stats</span>
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Count:</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{record.count || 0}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-500">Posted For:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-1.5 rounded">{record.posted_for || 0}</span>
                      </div>
                    </div>
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
        )
      }
    </React.Fragment >
  );
});


const AnnualPostings: React.FC = () => {
  const cached = getPageCache('AnnualPostings');

  const [postings, setPostings] = useState<PostingResponse[]>(cached?.data || []);
  const [loading, setLoading] = useState(!cached);
  const [showHelp, setShowHelp] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveProgress, setArchiveProgress] = useState<{ current: number; total: number } | null>(null);
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
  const [replacementFilterType, setReplacementFilterType] = useState<'eligible' | 'all'>('eligible');

  // Pagination
  const [page, setPage] = useState(cached?.page || 1);
  const [limit, setLimit] = useState(cached?.limit || 10);

  // Filter Options
  const [assignments, setAssignments] = useState<Assignment[]>(cached?.assignmentsOptions || []);
  const [venues, setVenues] = useState<MarkingVenue[]>(cached?.venuesOptions || []);
  const [states, setStates] = useState<any[]>(cached?.statesOptions || []);

  // Search States
  const [searchFileNo, setSearchFileNo] = useState(cached?.searchTerm || '');
  const [searchName, setSearchName] = useState(cached?.filters?.searchName || '');
  const [searchStation, setSearchStation] = useState(cached?.filters?.searchStation || '');

  // Dropdown Filter States
  const [filterAssignment, setFilterAssignment] = useState(cached?.filters?.filterAssignment || '');
  const [filterMandate, setFilterMandate] = useState(cached?.filters?.filterMandate || '');
  const [filterVenue, setFilterVenue] = useState(cached?.filters?.filterVenue || '');
  const [filterPostedFor, setFilterPostedFor] = useState(cached?.filters?.filterPostedFor || '');
  const [filterAssignmentsLeft, setFilterAssignmentsLeft] = useState(cached?.filters?.filterAssignmentsLeft || ''); // New Filter
  const [filterToBePosted, setFilterToBePosted] = useState(cached?.filters?.filterToBePosted || '');
  const [filterDescription, setFilterDescription] = useState(cached?.filters?.filterDescription || '');
  const [venueSearch, setVenueSearch] = useState('');
  const [filterState, setFilterState] = useState(cached?.filters?.filterState || '');
  const [isSyncing, setIsSyncing] = useState(false);

  const hasInitialized = useRef(!!cached);

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

  // Edit State
  const [editingPosting, setEditingPosting] = useState<PostingResponse | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEdit = useCallback((posting: PostingResponse) => {
    setEditingPosting(posting);
    setIsEditModalOpen(true);
  }, []);

  // Update cache
  useEffect(() => {
    setPageCache('AnnualPostings', {
      data: postings,
      page,
      limit,
      searchTerm: searchFileNo,
      filters: {
        searchName,
        searchStation,
        filterAssignment,
        filterMandate,
        filterVenue,
        filterPostedFor,
        filterAssignmentsLeft,
        filterToBePosted,
        filterDescription,
        filterState
      },
      assignmentsOptions: assignments,
      venuesOptions: venues,
      statesOptions: states
    });
  }, [postings, page, limit, searchFileNo, searchName, searchStation, filterAssignment, filterMandate, filterVenue, filterPostedFor, filterAssignmentsLeft, filterToBePosted, filterDescription, filterState, assignments, venues, states]);

  const fetchInitialData = useCallback(async (force: boolean = false) => {
    if (hasInitialized.current && !force) {
      hasInitialized.current = false;
      return;
    }
    try {
      setLoading(true);
      // Step 1: Fetch primary data quickly
      const [postingsData, assignmentsData, venuesData, statesData] = await Promise.all([
        getAllPostingRecords(force),
        getAllAssignments(force),
        getAllMarkingVenues(force),
        getAllStates()
      ]);

      setPostings(postingsData);
      setAssignments(assignmentsData);
      setVenues(venuesData);
      setStates(statesData.sort((a, b) => a.name.localeCompare(b.name)));
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedFileNo, debouncedName, debouncedStation, debouncedAssignmentSearch, filterMandate, filterVenue, filterState, filterAssignmentsLeft, filterToBePosted, filterDescription]);

  // UI for global loading/progress overlay
  const renderLoadingOverlay = () => {
    if (!loading) return null;
    return (
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] z-[9999] flex items-center justify-center animate-fadeIn">
        <div className="bg-white dark:bg-[#121b25] p-8 rounded-3xl shadow-2xl border border-slate-200 dark:border-gray-800 flex flex-col items-center gap-6 max-w-sm w-full mx-4">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-teal-500/20 border-t-teal-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="material-symbols-outlined text-teal-500 animate-pulse">
                {archiveProgress ? 'archive' : 'sync'}
              </span>
            </div>
          </div>

          <div className="text-center">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 mb-2">
              {archiveProgress ? 'Archiving Postings' : 'Loading Data'}
            </h3>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {archiveProgress
                ? `Archiving staff records: ${archiveProgress.current} / ${archiveProgress.total}`
                : 'Please wait while we sync with the server...'}
            </p>
          </div>

          {archiveProgress && (
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-teal-500 h-full transition-all duration-300"
                style={{ width: `${(archiveProgress.current / archiveProgress.total) * 100}%` }}
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
      result = result.filter(p => String(p.file_no || '').toLowerCase().includes(debouncedFileNo.toLowerCase()));
    }
    if (debouncedName) {
      result = result.filter(p => String(p.name || '').toLowerCase().includes(debouncedName.toLowerCase()));
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
    if (filterState) {
      const normalizedFilter = normalizeString(filterState);
      result = result.filter(p => {
        const recordStates = p.state?.length
          ? p.state
          : (p.assignment_venue?.[0]?.includes('|') ? [p.assignment_venue[0].split('|').pop().trim()] : []);

        return recordStates.some(s => normalizeString(s) === normalizedFilter);
      });
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
    filterDescription,
    filterState
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
        updatePosting(swapSource.id, {
          assignment_venue: [...target.assignment_venue || []],
          state: [...(target.state || [])]
        }),
        updatePosting(target.id, {
          assignment_venue: [...swapSource.assignment_venue || []],
          state: [...(swapSource.state || [])]
        })
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
      const normTargetFileNo = targetAPC.file_no.toString().padStart(4, '0');
      const existingTargetRecord = postings.find(p => p.file_no.toString().padStart(4, '0') === normTargetFileNo);
      const targetCurrentPosted = existingTargetRecord ? (existingTargetRecord.assignments?.length || 0) : 0;

      // 2. Prepare Updates (Cleaned up redundant newTargetRecord)

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
        const combinedAssignments = existingTargetRecord?.assignments ? [...existingTargetRecord.assignments] : [];
        const combinedMandates = existingTargetRecord?.mandates ? [...existingTargetRecord.mandates] : [];
        const combinedVenues = existingTargetRecord?.assignment_venue ? [...existingTargetRecord.assignment_venue] : [];
        const combinedStates = existingTargetRecord?.state ? [...existingTargetRecord.state] : (existingTargetRecord?.assignment_venue?.map(_ => '') || []);

        replacementSource.assignments.forEach((code, idx) => {
          const field = assignmentFieldMap[code];
          if (field) {
            updates[field] = replacementSource.assignment_venue[idx] || '';
          }
          // Merge logic
          if (!combinedAssignments.includes(code)) {
            combinedAssignments.push(code);
            combinedMandates.push(replacementSource.mandates[idx]);
            combinedVenues.push(replacementSource.assignment_venue[idx]);
            combinedStates.push(replacementSource.state?.[idx] || '');
          }
        });
        const { id, created_at, updated_at, created_by, updated_by, ...clean } = updates;
        await updateAPC(id, clean);

        return { combinedAssignments, combinedMandates, combinedVenues, combinedStates };
      };

      // 5. Execute API Calls
      const { combinedAssignments, combinedMandates, combinedVenues, combinedStates } = await updateTargetAPC();

      const payload: PostingCreate = {
        file_no: normTargetFileNo,
        name: targetAPC.name,
        station: targetAPC.station,
        conraiss: targetAPC.conraiss,
        year: replacementSource.year,
        count: targetAPC.count || replacementSource.count, // Prefer target's count from APC
        posted_for: combinedAssignments.length,
        to_be_posted: (targetAPC.count || 0) - combinedAssignments.length,
        assignments: combinedAssignments,
        mandates: combinedMandates,
        assignment_venue: combinedVenues,
        state: combinedStates,
        description: existingTargetRecord?.description || replacementSource.description
      };

      await Promise.all([
        updateSourceAPC(),
        bulkDeletePostings([replacementSource.id, ...(existingTargetRecord ? [existingTargetRecord.id] : [])]),
        bulkCreatePostings({ items: [payload] })
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
      // 1. Text Search Filters
      const matchesFileNo = !modalSearchFileNo || staff.file_no.toLowerCase().includes(modalSearchFileNo.toLowerCase());
      const matchesName = !modalSearchName || staff.name.toLowerCase().includes(modalSearchName.toLowerCase());
      const matchesConraiss = !modalSearchConraiss || staff.conraiss?.toLowerCase().includes(modalSearchConraiss.toLowerCase());

      if (!matchesFileNo || !matchesName || !matchesConraiss) return false;

      // 2. "Eligible" Filter Logic
      if (replacementFilterType === 'eligible' && replacementSource) {
        // Staff must have the assignment in APC AND not be posted for it
        // Note: replacementPool already includes only staff with remaining capacity (totalPosted < totalAllotted)

        // Check if staff is configured for the target assignments in APC
        const isConfigured = replacementSource.assignments.every(code => {
          const field = assignmentFieldMap[code] || assignmentFieldMap[code.toString().toUpperCase()];
          if (!field) return true; // Loose check if no mapping
          const val = staff[field as keyof APCRecord];
          // "Returned" implies they were posted but sent back, so they are technically available/eligible again
          // If it's empty/null, they were never assigned it.
          return val && val.toString() !== '';
        });

        if (!isConfigured) return false;

        // Check if staff is NOT already posted for these specific assignments
        // (Even if they have capacity count > current posted, we don't want to double post the SAME assignment)
        const normStaffNo = staff.file_no.toString().padStart(4, '0');
        const existingPosting = postings.find(p => p.file_no.toString().padStart(4, '0') === normStaffNo);

        if (existingPosting) {
          const hasConflict = replacementSource.assignments.some(code => {
            // Check if existing posting already has this assignment code
            return existingPosting.assignments?.some((existingCode: any) => {
              const c1 = typeof existingCode === 'string' ? existingCode : existingCode.code;
              const c2 = code;
              return c1?.toString().toUpperCase() === c2?.toString().toUpperCase();
            });
          });
          if (hasConflict) return false;
        }
      }

      return true;
    });
  }, [replacementPool, modalSearchFileNo, modalSearchName, modalSearchConraiss, replacementFilterType, replacementSource, postings]);

  const handleSingleDelete = useCallback(async (record: PostingResponse) => {
    try {
      setLoading(true);

      await bulkDeletePostings([record.id]);
      alert("Posting deleted successfully.");
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
    if (!window.confirm(`Are you sure you want to delete ${totalCount} posting(s)?`)) return;

    try {
      setLoading(true);

      // 1. Delete Postings
      await bulkDeletePostings(Array.from(selectedIds));

      alert("Selected postings deleted successfully.");
      setSelectedIds(new Set());
      fetchInitialData();
    } catch (error: any) {
      console.error("Bulk delete failed", error);
      alert(`Failed to delete postings: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchInitialData, postings, selectedIds]);

  const handleArchive = async () => {
    if (!window.confirm("Are you sure you want to ARCHIVE current postings to the Final Posting table? This will append the data.")) return;

    try {
      setIsArchiving(true);
      setLoading(true);

      // Keep a copy of postings to update APC
      const postingsToArchive = [...postings];
      setArchiveProgress({ current: 0, total: postingsToArchive.length });

      // 1. Archive to final table (This might take a while if many records)
      await archivePostings();

      // 2. Clear APC fields for archived staff
      if (postingsToArchive.length > 0) {
        const allAPC = await getAllAPCRecords(false, true);
        const apcMap = new Map(allAPC.map(a => [a.file_no.toString().padStart(4, '0'), a]));
        const CHUNK_SIZE = 50;

        for (let i = 0; i < postingsToArchive.length; i += CHUNK_SIZE) {
          const chunk = postingsToArchive.slice(i, i + CHUNK_SIZE);
          const updates = [];

          for (const posting of chunk) {
            const normFileNo = posting.file_no.toString().padStart(4, '0');
            const apcRecord = apcMap.get(normFileNo);

            if (apcRecord && posting.assignments && posting.assignments.length > 0) {
              let payload: any = { ...apcRecord };
              const { id, created_at, updated_at, created_by, updated_by, ...rest } = payload;
              payload = { ...rest };

              let hasChanges = false;
              posting.assignments.forEach((assignment: any) => {
                const codeOrName = typeof assignment === 'string' ? assignment : assignment.code || assignment.name;
                const fieldName = assignmentFieldMap[codeOrName] || assignmentFieldMap[codeOrName?.toString().toUpperCase()];
                if (fieldName) {
                  payload[fieldName] = ''; // Clear the assignment field
                  hasChanges = true;
                }
              });

              if (hasChanges) {
                updates.push(updateAPC(apcRecord.id, payload));
              }
            }
          }

          if (updates.length > 0) {
            await Promise.allSettled(updates);
          }

          setArchiveProgress(prev => ({
            current: Math.min(i + CHUNK_SIZE, postingsToArchive.length),
            total: postingsToArchive.length
          }));
        }
      }

      success("Successfully archived all postings and updated APC records.");
      setArchiveProgress(null);
      fetchInitialData();
    } catch (err: any) {
      console.error("Archive failed", err);
      error(err.message || "Failed to archive postings.");
      setArchiveProgress(null);
    } finally {
      setIsArchiving(false);
      setLoading(false);
    }
  };

  const handleExport = useCallback(() => {
    if (filteredPostings.length === 0) {
      alert("No data to export");
      return;
    }
    setLoading(true);
    try {
      const headers = [
        'File Number', 'Name', 'Station', 'CONRAISS', 'Year', 'Count',
        'Assignments', 'Mandates', 'Venue', 'State', 'Posted For', 'To Be Posted', 'Description'
      ];

      const escapeCsv = (val: any) => {
        if (val === null || val === undefined) return '';
        const str = String(val);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      const rows = filteredPostings.map(record => [
        record.file_no,
        record.name,
        record.station,
        record.conraiss,
        record.year,
        record.count,
        record.assignments?.map((a: any) => typeof a === 'string' ? a : a.name || a.code).join(' | '),
        record.mandates?.map((m: any) => typeof m === 'string' ? m : m.mandate || m.code).join(' | '),
        record.assignment_venue?.map((v: any) => typeof v === 'string' ? v : v.name || v.code).join(' | '),
        (record.state && record.state.length > 0 ? record.state.join(' | ') : '') || (record.assignment_venue?.[0]?.includes('|') ? record.assignment_venue[0].split('|').pop().trim() : ''),
        record.posted_for,
        record.to_be_posted,
        record.description || ''
      ].map(escapeCsv).join(','));

      const csvContent = [headers.join(','), ...rows].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `Posting_List_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

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
      // 1. Fetch dependencies
      const [allAPC, allPostings] = await Promise.all([
        getAllAPCRecords(false, true),
        getAllPostingRecords(true)
      ]);

      const apcMap = new Map(allAPC.map(a => [a.file_no.toString().padStart(4, '0'), a]));
      const postingMap = new Map(allPostings.map(p => [p.file_no.toString().padStart(4, '0'), p]));

      const apcUpdates = new Map<string, any>();
      const postingPayloads = new Map<string, PostingCreate>();

      data.forEach(row => {
        const normFileNo = row.staffNo.toString().padStart(4, '0');
        const apcRecord = apcMap.get(normFileNo);

        if (!apcRecord) {
          console.warn(`Staff ${normFileNo} not found in APC records. Skipping.`);
          return;
        }

        // Get existing posting data or start fresh
        const existingPosting = postingPayloads.get(normFileNo) || postingMap.get(normFileNo);

        let assignments = existingPosting?.assignments ? [...existingPosting.assignments] : [];
        let mandates = existingPosting?.mandates ? [...existingPosting.mandates] : [];
        let venues = existingPosting?.assignment_venue ? [...existingPosting.assignment_venue] : [];

        // Add new data from row
        if (row.assignments && Array.isArray(row.assignments)) {
          const rowMandates = row.mandate ? row.mandate.split(/[;|]/).map(m => m.trim()) : [];
          const rowVenues = row.venue ? row.venue.split(/[;|]/).map(v => v.trim()) : [];

          row.assignments.forEach((code, idx) => {
            assignments.push(code);
            mandates.push(rowMandates[idx] || row.mandate || code);
            venues.push(rowVenues[idx] || row.venue || '');
          });
        } else if (row.mandate) {
          // Fallback if assignments array is missing but mandate is present
          // We try to infer code from mandate or use mandate as code
          const code = row.mandateCode || row.mandate;
          assignments.push(code);
          mandates.push(row.mandate);
          venues.push(row.venue || '');
        }

        // Deduplicate
        const dedup = deduplicatePostings(assignments, mandates, venues);

        // Update APC record (clear fields for these assignments)
        let apcFields = apcUpdates.get(apcRecord.id) || { ...apcRecord };
        const { id, created_at, updated_at, created_by, updated_by, ...cleanApc } = apcFields;
        apcFields = { ...cleanApc };

        dedup.assignments.forEach(code => {
          const fieldName = assignmentFieldMap[code] || assignmentFieldMap[code.toString().toUpperCase()];
          if (fieldName) {
            apcFields[fieldName] = ''; // Clear from pool
          }
        });
        apcUpdates.set(apcRecord.id, apcFields);

        // Prepare posting record
        const totalAllotted = apcRecord.count || getAssignmentLimit(apcRecord.conraiss);
        postingPayloads.set(normFileNo, {
          file_no: normFileNo,
          name: row.name || apcRecord.name || '',
          station: row.station || apcRecord.station || '',
          conraiss: row.conraiss || apcRecord.conraiss || '',
          year: new Date().getFullYear().toString(),
          count: totalAllotted,
          posted_for: dedup.assignments.length,
          to_be_posted: totalAllotted - dedup.assignments.length,
          assignments: dedup.assignments,
          mandates: dedup.mandates,
          assignment_venue: dedup.venues,
          description: row.description || existingPosting?.description || '',
          state: row.state ? [row.state] : (existingPosting?.state || (dedup.venues?.[0]?.includes('|') ? [dedup.venues[0].split('|').pop().trim()] : []))
        });
      });

      // 2. Execute Updates
      const apcPromises = Array.from(apcUpdates.entries()).map(([id, fields]) => updateAPC(id, fields));
      const postingPayload = Array.from(postingPayloads.values());

      if (postingPayload.length > 0) {
        // To prevent duplicate ROWS for the same staff, we delete the old records before bulk creating new ones
        const idsToDelete = Array.from(postingPayloads.keys())
          .map(s => postingMap.get(s)?.id)
          .filter(id => id);

        if (idsToDelete.length > 0) {
          await bulkDeletePostings(idsToDelete as string[]);
        }

        await Promise.all([
          ...apcPromises,
          bulkCreatePostings({ items: postingPayload })
        ]);

        success(`Successfully imported ${postingPayload.length} records.`);
        setIsCsvModalOpen(false);
        fetchInitialData();
      } else {
        error("No valid records to import.");
      }

    } catch (err: any) {
      console.error("Bulk upload failed", err);
      error(`Upload failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [fetchInitialData, success, error]);

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
            <button
              onClick={() => setShowHelp(true)}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm font-bold text-xs"
              title="Page Guide"
            >
              <span className="material-symbols-outlined text-lg">help</span>
              Help
            </button>
            <button
              onClick={fetchInitialData}
              disabled={loading}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm font-bold text-xs ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Refresh Data"
            >
              <span className={`material-symbols-outlined text-lg ${loading ? 'animate-spin' : ''}`}>refresh</span>
              Refresh
            </button>
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
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-300 dark:border-gray-700 text-indigo-600 dark:text-indigo-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
            >
              <span className="material-symbols-outlined text-lg">download</span>
              Export List
            </button>
            <button
              onClick={handleArchive}
              disabled={isArchiving || loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-300 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all disabled:opacity-50"
              title="Archive to Final Posting"
            >
              <span className={`material-symbols-outlined text-lg ${isArchiving ? 'animate-spin' : ''}`}>archive</span>
              {isArchiving ? 'Archiving...' : 'Commit to Final'}
            </button>
            <button
              onClick={downloadCsvTemplate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white dark:bg-[#121b25] border border-slate-300 dark:border-gray-700 text-slate-600 dark:text-slate-300 font-bold text-xs shadow-sm hover:bg-slate-50 dark:hover:bg-gray-800 transition-all"
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

            {/* State Filter */}
            <div className="relative">
              <select
                className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
                value={filterState}
                onChange={(e) => setFilterState(e.target.value)}
              >
                <option value="">All States</option>
                {states.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
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
          <div className="overflow-hidden rounded-xl border border-slate-300 dark:border-gray-800 bg-white dark:bg-[#121b25] mt-4 shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gradient-to-r from-slate-50 to-white dark:from-[#0f161d] dark:to-[#121b25] border-b border-slate-300 dark:border-gray-800">
                    <th className="p-4 w-10"><input type="checkbox" className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4" checked={filteredPostings.length > 0 && filteredPostings.every(p => selectedIds.has(p.id))} onChange={(e) => handleSelectAll(e.target.checked)} /></th>
                    <th className="p-4 w-10 text-center">
                      <span className="material-symbols-outlined text-slate-400 text-sm">unfold_more</span>
                    </th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">File No</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Name</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Station</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Conraiss</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Code</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assignments</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Mandates</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Venue</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">State</th>
                    <th className="p-4 text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-300 dark:divide-gray-800">
                  {loading ? (
                    <tr><td colSpan={12} className="p-8 text-center text-slate-500 italic">Loading records...</td></tr>
                  ) : paginatedPostings.length === 0 ? (
                    <tr><td colSpan={12} className="p-8 text-center text-slate-500 italic">No records found matching your filters.</td></tr>
                  ) : (
                    paginatedPostings.map((record) => (
                      <CollapsibleRow
                        key={record.id}
                        record={record}
                        selected={selectedIds.has(record.id)}
                        onSelect={(checked) => handleSelectOne(record.id, checked)}
                        onDelete={() => {
                          if (window.confirm(`Are you sure you want to delete posting for ${record.name}? This will return the staff to the pool.`)) {
                            handleSingleDelete(record);
                          }
                        }}
                        onReplace={async () => {
                          setReplacementSource(record);
                          // Fetch eligible pool
                          const pool = await getAllAPCRecords(true, false);

                          // Pre-calculate posted counts from current postings with padding
                          const postedCountMap = new Map<string, number>();
                          postings.forEach(p => {
                            const count = (p.assignments || []).length;
                            const normFileNo = p.file_no.toString().padStart(4, '0');
                            postedCountMap.set(normFileNo, (postedCountMap.get(normFileNo) || 0) + count);
                          });

                          const eligible = pool.filter(staff => {
                            const normStaffNo = staff.file_no.toString().padStart(4, '0');
                            const normRecordNo = record.file_no.toString().padStart(4, '0');
                            if (normStaffNo === normRecordNo) return false;
                            const totalPosted = (postedCountMap.get(normStaffNo) || 0);
                            const totalAllotted = (staff.count || 0);
                            return totalPosted < totalAllotted;
                          });

                          setReplacementPool(eligible);
                          setIsReplacementModalOpen(true);
                        }}
                        isSwapping={!!swapSource}
                        isSwapSource={swapSource?.id === record.id}
                        onSwap={() => {
                          if (swapSource && swapSource.id !== record.id) {
                            handleExecuteSwap(record);
                          } else {
                            setSwapSource(swapSource?.id === record.id ? null : record);
                          }
                        }}
                        onEdit={() => handleEdit(record)}
                      />
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer */}
            <div className="p-4 border-t border-slate-300 dark:border-gray-800 bg-background-light dark:bg-[#0f161d] flex flex-col md:flex-row items-center justify-between gap-4">
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
                  setReplacementFilterType('eligible'); // Reset on close
                }} className="w-10 h-10 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors">
                  <span className="material-symbols-outlined text-slate-400">close</span>
                </button>
              </div>

              <div className="px-6 py-4 border-b border-slate-200 dark:border-gray-800 bg-background-light/50 dark:bg-slate-900/10 flex flex-col gap-4">
                {/* Filter Toggle */}
                <div className="flex bg-slate-200 dark:bg-slate-800/50 p-1 rounded-xl w-fit">
                  <button
                    onClick={() => setReplacementFilterType('eligible')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${replacementFilterType === 'eligible'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    Eligible Staff
                  </button>
                  <button
                    onClick={() => setReplacementFilterType('all')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${replacementFilterType === 'all'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                  >
                    All Staff
                  </button>
                </div>

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
        <PostingEditModal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          initialData={editingPosting}
          onSubmit={async (data) => {
            if (!editingPosting) return;
            try {
              await updatePosting(editingPosting.id, data);
              success('Posting updated successfully');
              fetchInitialData();
            } catch (err: any) {
              error(err.message || 'Failed to update posting');
            }
          }}
        />
        <HelpModal
          isOpen={showHelp}
          onClose={() => setShowHelp(false)}
          helpData={helpContent.annualPostings}
        />
      </div>
    </div>
  );
};

export default AnnualPostings;