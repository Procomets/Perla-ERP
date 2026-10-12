import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronUp, FileDown } from 'lucide-react';
import { EmployeeMaster } from '../../../types/employee';
import { AttendanceRecord } from '../../../types/attendance';
import { AttendanceService } from '../../../services/attendanceService';
import { EmployeePdfModal } from './EmployeePdfModal';

interface EmployeeMonitorProps {
  employees: EmployeeMaster[];
  currentYear: number;
}

export const EmployeeMonitor: React.FC<EmployeeMonitorProps> = ({ employees, currentYear }) => {
  const [selectedEmpId, setSelectedEmpId] = useState<string>(employees[0]?.employeeId || '');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({});

  // Sync selected employee if list changes and none selected
  useEffect(() => {
    if ((!selectedEmpId || !employees.some((e) => e.employeeId === selectedEmpId)) && employees.length > 0) {
      setSelectedEmpId(employees[0].employeeId);
    }
  }, [employees, selectedEmpId]);

  // Load yearly attendance
  useEffect(() => {
    if (!selectedEmpId) return;
    const fetchYearly = async () => {
      setLoading(true);
      try {
        const data = await AttendanceService.getYearlyAttendanceForEmployee(selectedEmpId, String(selectedYear));
        setRecords(data);
      } catch (err) {
        console.error('Failed to load yearly records:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchYearly();
  }, [selectedEmpId, selectedYear]);

  const selectedEmployee = useMemo(() => {
    return employees.find((e) => e.employeeId === selectedEmpId);
  }, [employees, selectedEmpId]);

  const isLabour = selectedEmployee?.employeeType === 'Labour';

  const toggleMonth = (monthIndex: number) => {
    setExpandedMonths((prev) => ({
      ...prev,
      [monthIndex]: !prev[monthIndex]
    }));
  };

  // Month-by-month stats
  const monthStats = useMemo(() => {
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    return monthNames.map((name, index) => {
      const monthStr = `${selectedYear}-${String(index + 1).padStart(2, '0')}`;
      const daysInMonth = new Date(selectedYear, index + 1, 0).getDate();

      let sundaysCount = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(selectedYear, index, day);
        if (d.getDay() === 0) sundaysCount++;
      }
      const workingDays = daysInMonth - sundaysCount;

      const monthRecords = records.filter((r) => r.monthYear === monthStr);
      const presentDays = monthRecords.filter((r) => r.status === 'Present' || r.status === 'N').length;
      const pnDays = monthRecords.filter((r) => r.status === 'P/N').length;
      const absentDays = monthRecords.filter((r) => r.status === 'Absent').length;

      return {
        monthIndex: index,
        monthName: name,
        monthStr,
        totalDays: daysInMonth,
        workingDays,
        presentDays,
        pnDays,
        absentDays,
        records: monthRecords
      };
    });
  }, [selectedYear, records]);

  // Yearly totals
  const totals = useMemo(() => {
    const totalWorking = monthStats.reduce((acc, m) => acc + m.workingDays, 0);
    const totalPresent = monthStats.reduce((acc, m) => acc + m.presentDays + (isLabour ? m.pnDays * 2 : m.pnDays), 0);
    const totalAbsent = monthStats.reduce((acc, m) => acc + m.absentDays, 0);
    const percent = totalWorking > 0 ? Math.round((totalPresent / totalWorking) * 100) : 0;
    return { totalWorking, totalPresent, totalAbsent, percent };
  }, [monthStats, isLabour]);

  const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);

  return (
    <div className="space-y-5 p-5">
      {/* Top Filter & Action Bar */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="w-full sm:w-72">
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Select Employee</label>
            <select
              value={selectedEmpId}
              onChange={(e) => setSelectedEmpId(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-800"
            >
              {employees.map((emp) => (
                <option key={emp.employeeId} value={emp.employeeId}>
                  {emp.fullName} ({emp.employeeId}) — {emp.employeeType}
                </option>
              ))}
            </select>
          </div>

          <div className="w-32">
            <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Select Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:outline-none focus:border-slate-800"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedEmployee && (
          <div className="flex items-center justify-end pt-2 sm:pt-0">
            <button
              onClick={() => setIsPdfModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-2xs transition"
            >
              <FileDown className="w-3.5 h-3.5 text-slate-500" />
              <span>Export PDF</span>
            </button>
          </div>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Total Working Days</span>
          <span className="text-xl font-bold text-slate-900 mt-1 block">{totals.totalWorking}</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Days Present</span>
          <span className="text-xl font-bold text-emerald-700 mt-1 block">{totals.totalPresent}</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Days Absent</span>
          <span className="text-xl font-bold text-rose-700 mt-1 block">{totals.totalAbsent}</span>
        </div>
        <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase text-slate-400 block">Attendance Rate</span>
          <span className="text-xl font-bold text-blue-700 mt-1 block">{totals.percent}%</span>
        </div>
      </div>

      {/* 12 Months Breakdown Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold uppercase text-[10px]">
                <th className="py-2.5 px-3 w-10"></th>
                <th className="py-2.5 px-4 font-bold text-slate-700">Month</th>
                <th className="py-2.5 px-3 text-center">Calendar Days</th>
                <th className="py-2.5 px-3 text-center">Working Days</th>
                <th className="py-2.5 px-3 text-center text-emerald-700">Present</th>
                {isLabour && <th className="py-2.5 px-3 text-center text-sky-700">P/N (Double)</th>}
                <th className="py-2.5 px-3 text-center text-rose-700">Absent</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Loading yearly records...
                  </td>
                </tr>
              ) : (
                monthStats.map((stat) => {
                  const isExpanded = !!expandedMonths[stat.monthIndex];

                  return (
                    <React.Fragment key={stat.monthIndex}>
                      <tr className="hover:bg-slate-50 transition cursor-pointer" onClick={() => toggleMonth(stat.monthIndex)}>
                        <td className="py-2.5 px-3 text-center text-slate-400">
                          {isExpanded ? <ChevronUp className="w-4 h-4 mx-auto" /> : <ChevronDown className="w-4 h-4 mx-auto" />}
                        </td>
                        <td className="py-2.5 px-4 font-bold text-slate-900">{stat.monthName}</td>
                        <td className="py-2.5 px-3 text-center text-slate-600">{stat.totalDays}</td>
                        <td className="py-2.5 px-3 text-center text-slate-700 font-medium">{stat.workingDays}</td>
                        <td className="py-2.5 px-3 text-center font-bold text-emerald-700">{stat.presentDays}</td>
                        {isLabour && <td className="py-2.5 px-3 text-center font-bold text-sky-700">{stat.pnDays}</td>}
                        <td className="py-2.5 px-3 text-center font-bold text-rose-700">{stat.absentDays}</td>
                      </tr>

                      {/* Expandable Date Breakdown */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={7} className="p-4 bg-slate-50/70 border-y border-slate-200">
                            <div className="space-y-2">
                              <span className="text-[11px] font-bold text-slate-600 block">
                                Day-by-Day Attendance: {stat.monthName} {selectedYear}
                              </span>
                              <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-16 gap-1.5 pt-1">
                                {Array.from({ length: stat.totalDays }, (_, i) => i + 1).map((day) => {
                                  const d = new Date(selectedYear, stat.monthIndex, day);
                                  const dateStr = `${selectedYear}-${String(stat.monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                                  const rec = stat.records.find((r) => r.date === dateStr);
                                  const isSun = d.getDay() === 0;

                                  let badge = 'bg-slate-100 text-slate-400 border border-slate-200';
                                  let label = '-';

                                  if (rec?.status === 'Present') {
                                    badge = 'bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold';
                                    label = 'P';
                                  } else if (rec?.status === 'P/N') {
                                    badge = 'bg-sky-100 text-sky-800 border border-sky-300 font-bold';
                                    label = 'P/N';
                                  } else if (rec?.status === 'N') {
                                    badge = 'bg-purple-100 text-purple-800 border border-purple-300 font-bold';
                                    label = 'N';
                                  } else if (rec?.status === 'Absent') {
                                    badge = 'bg-rose-100 text-rose-800 border border-rose-300 font-bold';
                                    label = 'AB';
                                  } else if (isSun) {
                                    badge = 'bg-amber-50 text-amber-600 border border-amber-200';
                                    label = 'Sun';
                                  }

                                  return (
                                    <div
                                      key={day}
                                      className={`p-1.5 rounded-lg text-center flex flex-col items-center justify-center ${badge}`}
                                      title={`${dateStr}: ${label}`}
                                    >
                                      <span className="text-[9px] opacity-70 leading-none">{day}</span>
                                      <span className="text-[10px] font-bold mt-0.5 leading-none">{label}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Interactive PDF Preview Modal */}
      <EmployeePdfModal
        isOpen={isPdfModalOpen}
        onClose={() => setIsPdfModalOpen(false)}
        employee={selectedEmployee}
        selectedYear={selectedYear}
        monthlyStats={monthStats}
        totals={totals}
      />
    </div>
  );
};
