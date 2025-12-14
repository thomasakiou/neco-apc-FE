import React, { useEffect, useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { getAllPostingRecords, bulkCreatePostings, bulkDeletePostings } from '../../services/posting';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { PostingResponse, PostingCreate } from '../../types/posting';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { MarkingVenue } from '../../types/markingVenue';
import SearchableSelect from '../../components/SearchableSelect';
import CsvUploadModal from '../../components/CsvUploadModal';
import { CSVPostingData } from '../../services/personalizedPost';

const AnnualPostings: React.FC = () => {
  const [postings, setPostings] = useState<PostingResponse[]>([]);
  const [filteredPostings, setFilteredPostings] = useState<PostingResponse[]>([]);
  const [paginatedPostings, setPaginatedPostings] = useState<PostingResponse[]>([]);
  const [loading, setLoading] = useState(true);

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);

  // Filter Options
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [mandates, setMandates] = useState<Mandate[]>([]);
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

  // Modals
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);

  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [postingsData, assignmentsData, mandatesData, venuesData] = await Promise.all([
        getAllPostingRecords(),
        getAllAssignments(),
        getAllMandates(),
        getAllMarkingVenues()
      ]);

      setPostings(postingsData);
      setFilteredPostings(postingsData);
      setTotal(postingsData.length);
      setAssignments(assignmentsData);
      setMandates(mandatesData);
      setVenues(venuesData);
    } catch (error) {
      console.error("Failed to fetch initial data", error);
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    filterData();
  }, [
    searchFileNo,
    searchName,
    searchStation,
    filterAssignment,
    filterMandate,
    filterVenue,
    filterPostedFor,
    filterAssignmentsLeft,
    filterToBePosted,
    postings
  ]);

  // Handle Pagination
  useEffect(() => {
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    setPaginatedPostings(filteredPostings.slice(startIndex, endIndex));
  }, [filteredPostings, page, limit]);

  // Check 'page' validity when filtered count changes
  useEffect(() => {
    const maxPage = Math.ceil(filteredPostings.length / limit) || 1;
    if (page > maxPage) setPage(maxPage);
  }, [filteredPostings.length, limit]);

  const filterData = () => {
    let result = postings;

    if (searchFileNo) {
      result = result.filter(p => p.file_no?.toLowerCase().includes(searchFileNo.toLowerCase()));
    }
    if (searchName) {
      result = result.filter(p => p.name?.toLowerCase().includes(searchName.toLowerCase()));
    }
    if (searchStation) {
      result = result.filter(p => p.station?.toLowerCase().includes(searchStation.toLowerCase()));
    }
    if (filterAssignment) {
      // Text search for assignment
      const lowerSearch = filterAssignment.toLowerCase();
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
      const boolVal = filterToBePosted === 'true';
      if (filterToBePosted === 'true') {
        result = result.filter(p => (p.to_be_posted || 0) > 0);
      } else {
        result = result.filter(p => (p.to_be_posted || 0) <= 0);
      }
    }

    setFilteredPostings(result);
    setTotal(result.length);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = new Set(filteredPostings.map(p => p.id));
      setSelectedIds(allIds);
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSelected = new Set(selectedIds);
    if (checked) {
      newSelected.add(id);
    } else {
      newSelected.delete(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedIds.size} posting(s)?`)) return;

    try {
      setLoading(true);
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
  };

  const handleExport = () => {
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
  };

  const downloadCsvTemplate = () => {
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
  };

  const handleCsvUpload = async (data: CSVPostingData[]) => {
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
  };

  // Helper to extract unique "posted_for" values for filter
  const postedForOptions = Array.from(new Set(postings.map(p => p.posted_for).filter(val => val !== undefined && val !== null))) as (string | number)[];
  const assignmentsLeftOptions = Array.from(new Set(postings.map(p => p.to_be_posted).filter(val => val !== undefined && val !== null))) as (string | number)[];

  const assignmentOptionsForSelect = assignments.map(a => ({ id: a.id, name: a.name }));

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-[#0b1015] p-6 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-y-auto">

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
              {mandates.map(m => <option key={m.id} value={m.mandate}>{m.mandate}</option>)}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
              <span className="material-symbols-outlined text-lg">expand_more</span>
            </div>
          </div>

          {/* Venues Filter */}
          <div className="relative">
            <select
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
              value={filterVenue}
              onChange={(e) => setFilterVenue(e.target.value)}
            >
              <option value="">All Venues</option>
              {venues.map(v => <option key={v.id} value={v.name}>{v.name}</option>)}
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
                  <th className="p-4 w-10">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 cursor-pointer w-4 h-4"
                      checked={filteredPostings.length > 0 && filteredPostings.every(p => selectedIds.has(p.id))}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                    />
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">File No / Name</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Station / CONRAISS</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Year / Count</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assignments & Mandates</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Venue & Posted For</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assign. Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">Loading records...</td>
                  </tr>
                ) : paginatedPostings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">No records found matching your filters.</td>
                  </tr>
                ) : (
                  paginatedPostings.map((record) => (
                    <tr key={record.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors duration-150">
                      <td className="p-4 align-top">
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 mt-1 cursor-pointer w-4 h-4"
                          checked={selectedIds.has(record.id)}
                          onChange={(e) => handleSelectOne(record.id, e.target.checked)}
                        />
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col">
                          {/* ENHANCED FILE NO STYLE */}
                          <span className="font-mono text-lg font-black text-slate-800 dark:text-slate-100 bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded w-fit mb-1 shadow-sm border border-slate-200 dark:border-slate-700">{record.file_no}</span>
                          <span className="font-bold text-slate-600 dark:text-slate-300 group-hover:text-teal-600 transition-colors text-sm">{record.name}</span>
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1">
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px] text-slate-400">business</span>
                            {record.station || '-'}
                          </div>
                          {record.conraiss && (
                            <span className="text-xs font-semibold text-sky-600 bg-sky-50 dark:bg-sky-900/20 dark:text-sky-300 px-2 py-0.5 rounded-full w-fit">
                              CON: {record.conraiss}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">{record.year || '-'}</span>
                          {record.count ? (
                            <span className="text-xs font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 px-2 py-0.5 rounded-full w-fit">
                              Count: {record.count}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 align-top max-w-xs">
                        <div className="flex flex-col gap-2">
                          {/* Assignments */}
                          {record.assignments && record.assignments.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {record.assignments.map((item: any, idx) => (
                                <span key={idx} className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                                  {typeof item === 'string' ? item : item.name || item.code}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Mandates */}
                          {record.mandates && record.mandates.length > 0 && (
                            <div className="flex flex-col gap-1 mt-1">
                              {record.mandates.map((item: any, idx) => (
                                <span key={idx} className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded w-fit">
                                  {typeof item === 'string' ? item : item.mandate || item.code}
                                </span>
                              ))}
                            </div>
                          )}
                          {(!record.assignments?.length && !record.mandates?.length) && <span className="text-slate-400 text-xs italic">No Assignments</span>}
                        </div>
                      </td>
                      <td className="p-4 align-top max-w-xs">
                        <div className="flex flex-col gap-2">
                          {/* Venue */}
                          {record.assignment_venue && record.assignment_venue.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {record.assignment_venue.map((item: any, idx) => (
                                <span key={idx} className="text-[10px] font-bold text-purple-600 bg-purple-50 border border-purple-100 dark:bg-purple-900/30 dark:border-purple-800 dark:text-purple-300 px-1.5 py-0.5 rounded">
                                  {typeof item === 'string' ? item : item.name || item.code}
                                </span>
                              ))}
                            </div>
                          )}
                          {/* Posted For */}
                          {record.posted_for !== undefined && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                              <span className="material-symbols-outlined text-[14px]">label</span>
                              Posted: {record.posted_for}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${(record.to_be_posted || 0) > 0
                          ? 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800'
                          : 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800'
                          }`}>
                          {record.to_be_posted || 0}
                        </span>
                      </td>
                    </tr>
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
    </div>
  );
};

export default AnnualPostings;