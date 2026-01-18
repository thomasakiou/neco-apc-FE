import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { getDashboardStats, DashboardStats } from '../../services/dashboardStats';
import { getRecentReactivations } from '../../services/apc';
import { APCRecord } from '../../types/apc';
import HelpModal from '../../components/HelpModal';
import { helpContent } from '../../data/helpContent';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [reactivatedStaff, setReactivatedStaff] = useState<APCRecord[]>([]);
  const [showReactivationAlert, setShowReactivationAlert] = useState(true);

  const fetchStats = async (force = false) => {
    if (force) setIsRefreshing(true);
    else setLoading(true);

    try {
      const data = await getDashboardStats(force);
      setStats(data);
    } catch (error) {
      console.error('Failed to load dashboard stats', error);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
    // Fetch recent reactivations
    getRecentReactivations().then(setReactivatedStaff).catch(console.error);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 bg-slate-50 dark:bg-[#0b1015]">
        <div className="relative">
          <div className="size-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="material-symbols-outlined text-emerald-500 animate-pulse text-2xl">insights</span>
          </div>
        </div>
        <p className="text-sm font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">Analyzing Data...</p>
      </div>
    );
  }

  const safeStats = stats || {
    counts: {
      staff: 0, apc: 0, completedPostings: 0, ssceCustodians: 0,
      beceCustodians: 0, ssceExtCustodians: 0, states: 0, markingVenues: 0,
      ssceExtMarkingVenues: 0, beceMarkingVenues: 0, nceeCenters: 0
    },
    charts: {
      staffDistribution: [],
      postingStatus: [],
      totalPostings: 0
    }
  };

  const { counts, charts } = safeStats;

  return (
    <div className="flex flex-col h-full w-full bg-[#f8fafc] dark:bg-[#0b1015] transition-colors duration-300 overflow-hidden">
      {/* Auto-Reactivation Notification Banner */}
      {showReactivationAlert && reactivatedStaff.length > 0 && (
        <div className="flex-none bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-3 shadow-lg">
          <div className="flex items-center justify-between max-w-[1600px] mx-auto">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm">
                <span className="material-symbols-outlined text-2xl animate-pulse">notifications_active</span>
              </div>
              <div>
                <p className="font-bold text-sm">System Auto-Reactivation</p>
                <p className="text-xs opacity-90">
                  {reactivatedStaff.length} staff member{reactivatedStaff.length > 1 ? 's were' : ' was'} automatically reactivated:
                  <span className="font-bold ml-1">
                    {reactivatedStaff.slice(0, 3).map(s => s.name).join(', ')}
                    {reactivatedStaff.length > 3 && ` and ${reactivatedStaff.length - 3} more`}
                  </span>
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowReactivationAlert(false)}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
              title="Dismiss"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
      )}

      {/* Premium Header */}
      <header className="flex-none flex flex-col sm:flex-row sm:items-center justify-between px-6 md:px-10 py-5 bg-white/40 dark:bg-[#121b25]/40 backdrop-blur-xl border-b border-slate-200/60 dark:border-white/5 z-20 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl lg:text-4xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            APCIC <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">Dashboard</span>
          </h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-0.5 opacity-70">NECO APCIC Posting Ecosystem</p>
        </div>


        <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-6 w-full sm:w-auto">
          <button
            onClick={() => setShowHelp(true)}
            className="flex items-center justify-center p-2 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all shadow-sm"
            title="Dashboard Guide"
          >
            <span className="material-symbols-outlined text-xl">help</span>
          </button>

          <button
            onClick={() => fetchStats(true)}
            className={`flex items-center gap-2 px-3 md:px-4 py-2 rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-bold text-[10px] md:text-xs hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm active:scale-95 ${isRefreshing ? 'opacity-50 pointer-events-none' : ''}`}
          >
            <span className={`material-symbols-outlined text-base md:text-lg ${isRefreshing ? 'animate-spin' : ''}`}>sync</span>
            {isRefreshing ? 'Refreshing...' : 'Live Data'}
          </button>

          <div className="hidden xs:block h-8 w-[1px] bg-slate-200 dark:bg-white/10"></div>

          <div className="flex items-center gap-2 md:gap-3 bg-white dark:bg-white/5 p-1 md:p-1.5 md:pr-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
            <div className="size-8 md:size-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-xs md:text-sm shadow-lg shadow-emerald-500/20">
              AD
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] md:text-xs font-black text-slate-900 dark:text-white leading-none">Admin Controller</span>
              <span className="text-[9px] md:text-[10px] font-bold text-emerald-500 uppercase leading-none mt-1">Neco HQ</span>
            </div>
          </div>
        </div>
      </header>

      <HelpModal
        isOpen={showHelp}
        onClose={() => setShowHelp(false)}
        helpData={helpContent.dashboard}
      />

      <div className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-12">
        <div className="max-w-[1600px] mx-auto space-y-6 md:space-y-10">

          {/* Executive Metrics Grid */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 md:gap-6">
            <GlassCard
              title="Global Staff Pool"
              value={counts.staff}
              icon="diversity_1"
              gradient="from-blue-500 to-indigo-600"
              trend="+12% from last cycle"
            />
            <GlassCard
              title="Active APC Records"
              value={counts.apc}
              icon="quick_reference_all"
              gradient="from-emerald-500 to-teal-600"
              trend="98% data integrity"
            />
            <GlassCard
              title="Postings Completed"
              value={counts.completedPostings}
              icon="verified"
              gradient="from-violet-500 to-purple-600"
              trend="Efficiency Peak"
            />
            <GlassCard
              title="Operational States"
              value={counts.states}
              icon="explore"
              gradient="from-amber-500 to-orange-600"
              trend="All 37 Regions Active"
            />
          </section>

          {/* Core Analytics Sections */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

            {/* Staff Geographical Distribution */}
            <div className="lg:col-span-8 group">
              <div className="h-full bg-white dark:bg-[#121b25]/60 dark:backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 p-6 md:p-8 shadow-xl shadow-slate-200/20 dark:shadow-none transition-all hover:border-emerald-500/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                  <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white flex items-center gap-3">
                    <span className="size-8 md:size-10 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-emerald-500 transition-colors">
                      <span className="material-symbols-outlined text-xl md:text-2xl">analytics</span>
                    </span>
                    Deployment Distribution
                  </h3>
                  <div className="w-fit px-4 py-1.5 rounded-full bg-slate-100 dark:bg-white/5 text-[9px] md:text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    Top 10 Active Stations
                  </div>
                </div>

                <div className="h-[300px] md:h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={charts.staffDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10b981" stopOpacity={1} />
                          <stop offset="100%" stopColor="#3b82f6" stopOpacity={1} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                        interval={0}
                        angle={-25}
                        textAnchor="end"
                        height={60}
                      />
                      <Tooltip
                        cursor={{ fill: 'rgba(59, 130, 246, 0.05)', radius: [10, 10, 0, 0] }}
                        content={(props) => {
                          const { active, payload } = props;
                          if (active && payload && payload.length) {
                            return (
                              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 p-3 rounded-2xl shadow-2xl backdrop-blur-xl">
                                <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase mb-1">{payload[0].payload.name}</p>
                                <p className="text-xl font-black text-slate-900 dark:text-white">{payload[0].value.toLocaleString()} <span className="text-[10px] text-emerald-500">Staff</span></p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar dataKey="value" radius={[10, 10, 10, 10]} barSize={45}>
                        {charts.staffDistribution.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? 'url(#barGradient)' : '#64748b'}
                            fillOpacity={index === 0 ? 1 : 0.15}
                            className="transition-all duration-500 hover:fill-emerald-500 hover:fill-opacity-100"
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Posting Integrity Overview */}
            <div className="lg:col-span-4 group">
              <div className="h-full bg-white dark:bg-[#121b25]/60 dark:backdrop-blur-md rounded-[2rem] md:rounded-[2.5rem] border border-slate-200/50 dark:border-white/5 p-6 md:p-8 shadow-xl shadow-slate-200/20 dark:shadow-none transition-all hover:border-teal-500/20 flex flex-col">
                <h3 className="text-lg md:text-xl font-black text-slate-900 dark:text-white mb-8 flex items-center gap-3">
                  <span className="size-8 md:size-10 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-teal-500 transition-colors">
                    <span className="material-symbols-outlined text-xl md:text-2xl">donut_large</span>
                  </span>
                  Posting Target Status
                </h3>

                <div className="flex-1 flex flex-col items-center justify-center -mt-4">
                  <div className="size-48 md:size-64 relative">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={charts.postingStatus}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={105}
                          paddingAngle={8}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={12}
                        >
                          {charts.postingStatus.map((entry, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              className="focus:outline-white cursor-pointer transition-all hover:opacity-80"
                            />
                          ))}
                        </Pie>
                        <Tooltip content={() => null} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[8px] md:text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Utilization</span>
                      <span className="text-2xl md:text-4xl font-black text-slate-900 dark:text-white leading-none">{charts.totalPostings.toLocaleString()}</span>
                      <div className="mt-2 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[8px] md:text-[10px] font-black">APC ACTIVE</div>
                    </div>
                  </div>

                  <div className="w-full space-y-3 mt-8">
                    {charts.postingStatus.map((item, index) => {
                      const percent = charts.totalPostings > 0 ? ((item.value / charts.totalPostings) * 100).toFixed(1) : '0';
                      return (
                        <div key={index} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 transition-transform hover:scale-[1.02]">
                          <div className="flex items-center gap-3">
                            <span className="size-3 rounded-full shadow-[0_0_10px] shadow-current" style={{ color: item.color, backgroundColor: item.color }}></span>
                            <span className="text-xs font-black text-slate-600 dark:text-slate-300">{item.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-900 dark:text-white block leading-none">{item.value.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">{percent}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Secondary Operational Stats */}
          <section className="bg-slate-900 dark:bg-emerald-950/20 rounded-[2rem] md:rounded-[3rem] p-6 md:p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 size-64 md:size-96 bg-emerald-500/10 blur-[80px] md:blur-[100px] rounded-full -mr-32 -mt-32 md:-mr-48 md:-mt-48"></div>
            <div className="absolute bottom-0 left-0 size-64 md:size-96 bg-blue-500/5 blur-[80px] md:blur-[100px] rounded-full -ml-32 -mb-32 md:-ml-48 md:-mb-48"></div>

            <div className="relative z-10 grid grid-cols-1 xs:grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-6 md:gap-8">
              <MiniOperational title="SSCE INT Custodians" value={counts.ssceCustodians} icon="shield_person" />
              <MiniOperational title="SSCE EXT Custodians" value={counts.ssceExtCustodians} icon="shield_person" />
              <MiniOperational title="BECE Custodians" value={counts.beceCustodians} icon="security" />
              <MiniOperational title="SSCE INT MV" value={counts.markingVenues} icon="room_preferences" />
              <MiniOperational title="SSCE EXT MV" value={counts.ssceExtMarkingVenues} icon="room_preferences" />
              <MiniOperational title="BECE MV" value={counts.beceMarkingVenues} icon="room_preferences" />
              <MiniOperational title="NCEE Centers" value={counts.nceeCenters} icon="account_balance" />
            </div>
          </section>

        </div>
      </div>
    </div>
  );
};

const GlassCard = ({ title, value, icon, gradient, trend }: any) => (
  <div className="group relative">
    <div className={`absolute -inset-0.5 bg-gradient-to-br ${gradient} rounded-3xl blur opacity-0 group-hover:opacity-20 transition duration-500`}></div>
    <div className="relative bg-white dark:bg-[#121b25] border border-slate-200/60 dark:border-white/5 rounded-3xl p-6 shadow-xl shadow-slate-200/10 dark:shadow-none transition-all duration-300 group-hover:-translate-y-1">
      <div className="flex items-start justify-between mb-6">
        <div className={`size-14 rounded-2xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white shadow-lg shadow-current/20`}>
          <span className="material-symbols-outlined text-2xl">{icon}</span>
        </div>
        <div className="px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 text-[10px] font-black flex items-center gap-1">
          <span className="material-symbols-outlined text-[12px]">trending_up</span>
          LIVE
        </div>
      </div>
      <p className="text-[10px] md:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none mb-2">{title}</p>
      <p className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white tracking-tight leading-none">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase italic opacity-60">{trend}</span>
        <span className="material-symbols-outlined text-sm text-slate-300 dark:text-slate-600">arrow_forward_ios</span>
      </div>
    </div>
  </div>
);

const MiniOperational = ({ title, value, icon }: any) => (
  <div className="flex flex-col gap-2">
    <div className="flex items-center gap-3">
      <span className="material-symbols-outlined text-emerald-400/60 text-xl">{icon}</span>
      <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{title}</span>
    </div>
    <div className="flex items-end gap-2">
      <span className="text-3xl font-black text-white">{value.toLocaleString()}</span>
      <span className="text-[10px] font-bold text-emerald-500/80 mb-1.5 uppercase">UNITS</span>
    </div>
  </div>
);

interface StatCardProps {
  title: string;
  value: string;
  icon: string;
  color: string;
  bg: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color, bg }) => (
  <div className="flex items-center gap-4 rounded-xl p-6 bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 transition-all hover:shadow-md">
    <div className={`size-12 rounded-full flex items-center justify-center ${bg} ${color}`}>
      <span className="material-symbols-outlined text-2xl">{icon}</span>
    </div>
    <div className="flex flex-col">
      <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</p>
      <p className="text-slate-900 dark:text-slate-200 text-2xl font-black">{value}</p>
    </div>
  </div>
);

export default AdminDashboard;