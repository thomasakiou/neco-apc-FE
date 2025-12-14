import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { getDashboardStats, DashboardStats } from '../../services/dashboardStats';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getDashboardStats();
        setStats(data);
      } catch (error) {
        console.error('Failed to load dashboard stats', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // Fallback if stats fail
  const safeStats = stats || {
    counts: {
      staff: 0, apc: 0, completedPostings: 0, ssceCustodians: 0,
      beceCustodians: 0, states: 0, markingVenues: 0, nceeCenters: 0
    },
    charts: {
      staffDistribution: [],
      postingStatus: [],
      totalPostings: 0
    }
  };

  const { counts, charts } = safeStats;

  return (
    <div className="flex flex-col h-full w-full bg-slate-50/50 dark:bg-[#101922] transition-colors duration-200">
      {/* Top Header */}
      <header className="sticky top-0 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-8 py-3 bg-white/80 dark:bg-[#121b25]/80 backdrop-blur-sm z-10 transition-colors">
        <h2 className="text-slate-900 dark:text-slate-200 text-lg font-bold">Dashboard Overview</h2>
        <div className="flex items-center gap-4">
          <label className="relative hidden sm:flex items-center">
            <span className="material-symbols-outlined absolute left-3 text-slate-400">search</span>
            <input className="form-input w-full min-w-40 max-w-64 rounded-lg bg-slate-100 dark:bg-[#0b1015] text-slate-900 dark:text-slate-200 pl-10 border-transparent focus:border-emerald-500 focus:ring-emerald-500 text-sm h-10 placeholder:text-slate-400" placeholder="Search..." type="search" />
          </label>
          <button className="flex items-center justify-center rounded-full size-10 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 transition-colors">
            <span className="material-symbols-outlined">notifications</span>
          </button>
          <div className="bg-emerald-600/10 rounded-full size-10 flex items-center justify-center text-emerald-600 font-bold">AD</div>
        </div>
      </header>

      <div className="flex-1 p-8 space-y-8 overflow-y-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Staff" value={counts.staff.toLocaleString()} icon="group" color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" />
          <StatCard title="In APC" value={counts.apc.toLocaleString()} icon="description" color="text-purple-600" bg="bg-purple-50 dark:bg-purple-900/20" />
          <StatCard title="Completed Posting" value={counts.completedPostings.toLocaleString()} icon="task_alt" color="text-emerald-600" bg="bg-emerald-50 dark:bg-emerald-900/20" />
          <StatCard title="States" value={counts.states.toLocaleString()} icon="map" color="text-amber-600" bg="bg-amber-50 dark:bg-amber-900/20" />

          <StatCard title="SSCE Custodians" value={counts.ssceCustodians.toLocaleString()} icon="reduce_capacity" color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-900/20" />
          <StatCard title="BECE Custodians" value={counts.beceCustodians.toLocaleString()} icon="diversity_3" color="text-pink-600" bg="bg-pink-50 dark:bg-pink-900/20" />
          <StatCard title="Marking Venues" value={counts.markingVenues.toLocaleString()} icon="location_city" color="text-cyan-600" bg="bg-cyan-50 dark:bg-cyan-900/20" />
          <StatCard title="NCEE Exam Centers" value={counts.nceeCenters.toLocaleString()} icon="school" color="text-rose-600" bg="bg-rose-50 dark:bg-rose-900/20" />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Staff Distribution */}
          <div className="lg:col-span-3 bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-xl p-6 transition-colors shadow-sm">
            <h3 className="text-slate-800 dark:text-slate-200 text-base font-bold mb-6 flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">bar_chart</span>
              Staff Distribution By Location (Top 10)
            </h3>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={charts.staffDistribution} margin={{ top: 20, right: 30, left: 20, bottom: 50 }}>
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                  />
                  <Tooltip
                    cursor={{ fill: 'transparent' }}
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {charts.staffDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? '#10b981' : '#3b82f6'} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Posting Status Overview */}
          <div className="lg:col-span-2 bg-white dark:bg-[#121b25] border border-gray-200 dark:border-gray-800 rounded-xl p-6 flex flex-col items-center justify-center transition-colors shadow-sm">
            <h3 className="text-slate-800 dark:text-slate-200 text-base font-bold mb-4 w-full text-left flex items-center gap-2">
              <span className="material-symbols-outlined text-slate-400">pie_chart</span>
              Posting Status Overview
            </h3>
            <div className="h-[250px] w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={charts.postingStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {charts.postingStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-slate-800 dark:text-slate-200">{charts.totalPostings.toLocaleString()}</span>
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Total APC</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-3 mt-4 px-4">
              {charts.postingStatus.map((item, index) => {
                const percent = charts.totalPostings > 0 ? ((item.value / charts.totalPostings) * 100).toFixed(1) : '0';
                return (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="size-3 rounded-full" style={{ backgroundColor: item.color }}></span>
                      <span className="text-slate-600 dark:text-slate-300 font-medium">{item.name}</span>
                    </div>
                    <span className="font-bold text-slate-800 dark:text-slate-200">{item.value.toLocaleString()} <span className="text-slate-400 text-xs font-normal">({percent}%)</span></span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

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