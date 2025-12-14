import React, { useEffect, useState } from 'react';
import { getAllPostingRecords } from '../../services/posting';
import { getAllAssignments } from '../../services/assignment';
import { getAllMandates } from '../../services/mandate';
import { getAllMarkingVenues } from '../../services/markingVenue';
import { PostingResponse } from '../../types/posting';
import { Assignment } from '../../types/assignment';
import { Mandate } from '../../types/mandate';
import { MarkingVenue } from '../../types/markingVenue';

const AnnualPostings: React.FC = () => {
  const [postings, setPostings] = useState<PostingResponse[]>([]);
  const [filteredPostings, setFilteredPostings] = useState<PostingResponse[]>([]);
  const [loading, setLoading] = useState(true);

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
  const [filterToBePosted, setFilterToBePosted] = useState('');

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
    filterToBePosted,
    postings
  ]);

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
      result = result.filter(p =>
        p.assignments?.some((a: any) =>
          (typeof a === 'string' ? a : a.name || a.code) === filterAssignment
        )
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
      result = result.filter(p => p.posted_for === filterPostedFor);
    }
    if (filterToBePosted) {
      const boolVal = filterToBePosted === 'true';
      result = result.filter(p => p.to_be_posted === boolVal);
    }

    setFilteredPostings(result);
  };

  // Helper to extract unique "posted_for" values for filter
  const postedForOptions = Array.from(new Set(postings.map(p => p.posted_for).filter(Boolean))) as string[];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0b1015] p-6 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">

      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-600 via-emerald-500 to-cyan-600 dark:from-teal-400 dark:via-emerald-400 dark:to-cyan-400 drop-shadow-sm">
          Annual Posting Board
        </h1>
        <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium">
          Manage staff postings, assignments, and mandates efficiently.
        </p>
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
              <span className="material-symbols-outlined text-slate-400 group-focus-within:text-teal-500 transition-colors">location_on</span>
            </div>
            <input
              type="text"
              placeholder="Search Station..."
              className="w-full pl-10 h-10 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:bg-white dark:focus:bg-[#0b1015] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium"
              value={searchStation}
              onChange={(e) => setSearchStation(e.target.value)}
            />
          </div>

          {/* Posted For Filter */}
          <div className="relative">
            <select
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
              value={filterPostedFor}
              onChange={(e) => setFilterPostedFor(e.target.value)}
            >
              <option value="">All Posted For</option>
              {postedForOptions.map(opt => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
              <span className="material-symbols-outlined text-lg">expand_more</span>
            </div>
          </div>

          {/* Assignments Filter */}
          <div className="relative">
            <select
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
              value={filterAssignment}
              onChange={(e) => setFilterAssignment(e.target.value)}
            >
              <option value="">All Assignments</option>
              {assignments.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
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

          {/* To Be Posted Filter */}
          <div className="relative">
            <select
              className="w-full h-10 px-3 rounded-xl border border-slate-200 dark:border-gray-700 bg-slate-50 dark:bg-[#0f161d] focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 transition-all outline-none text-sm font-medium appearance-none cursor-pointer"
              value={filterToBePosted}
              onChange={(e) => setFilterToBePosted(e.target.value)}
            >
              <option value="">Status: All</option>
              <option value="true">To Be Posted</option>
              <option value="false">Not To Be Posted</option>
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-slate-500">
              <span className="material-symbols-outlined text-lg">expand_more</span>
            </div>
          </div>

        </div>

        {/* Table Container */}
        <div className="overflow-hidden rounded-xl border border-slate-200/60 dark:border-gray-800 bg-white dark:bg-[#121b25] mt-4 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gradient-to-r from-slate-50 to-white dark:from-[#0f161d] dark:to-[#121b25] border-b border-slate-200 dark:border-gray-800">
                  <th className="p-4 w-10">
                    <input type="checkbox" className="rounded border-gray-300 text-teal-600 focus:ring-teal-500" />
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">File No / Name</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Station / CONRAISS</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Year / Count</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Assignments & Mandates</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Venue & Posted For</th>
                  <th className="p-4 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-gray-800">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">Loading records...</td>
                  </tr>
                ) : filteredPostings.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500 italic">No records found matching your filters.</td>
                  </tr>
                ) : (
                  filteredPostings.map((record) => (
                    <tr key={record.id} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors duration-150">
                      <td className="p-4 align-top">
                        <input type="checkbox" className="rounded border-gray-300 text-teal-600 focus:ring-teal-500 mt-1" />
                      </td>
                      <td className="p-4 align-top">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-700 dark:text-slate-200 group-hover:text-teal-600 transition-colors">{record.name}</span>
                          <span className="font-mono text-xs text-slate-400 bg-slate-100 dark:bg-slate-800/50 px-1.5 py-0.5 rounded w-fit mt-1">{record.file_no}</span>
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
                            <div className="flex flex-wrap gap-1 mt-1">
                              {record.mandates.map((item: any, idx) => (
                                <span key={idx} className="text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300 px-1.5 py-0.5 rounded">
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
                          {record.posted_for && (
                            <div className="flex items-center gap-1 text-xs text-slate-500 mt-1">
                              <span className="material-symbols-outlined text-[14px]">label</span>
                              {record.posted_for}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="p-4 align-top">
                        {record.to_be_posted ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                            Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                            Draft
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination / Total Count Footer */}
          <div className="p-4 border-t border-slate-200 dark:border-gray-800 bg-slate-50 dark:bg-[#0f161d] flex items-center justify-between">
            <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-slate-700 dark:text-slate-200">{filteredPostings.length}</span> records
            </div>
            {/* Simplified pagination if needed later */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnnualPostings;