import React, { useState, useEffect, useMemo } from 'react';
import {
  Clock,
  LogIn,
  LogOut,
  Edit2,
  Check,
  Search,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Calendar,
  Sparkles,
  X,
  Moon
} from 'lucide-react';
import { EmployeeMaster } from '../../../types/employee';
import { AttendanceRecord, AttendanceStatus } from '../../../types/attendance';
import { TableMaximizeWrapper, TableTotalsFooter } from '../../../components/ui/TableMaximizeWrapper';
import {
  calculateWorkingHours,
  formatWorkingHours,
  formatTime24To12,
  getCurrentTimeString,
  calculateShiftStatus
} from '../../../services/attendanceService';

interface TodayAttendanceViewProps {
  employees: EmployeeMaster[];
  attendanceRecords: AttendanceRecord[];
  onRecordAttendance: (
    employeeId: string,
    data: {
      timeIn?: string | null;
      timeOut?: string | null;
      status?: AttendanceStatus;
      workingHours?: number;
    }
  ) => Promise<void>;
  targetDate: string; // YYYY-MM-DD
  onTargetDateChange?: (date: string) => void;
  defaultCategory?: 'All' | 'Monthly Salary' | 'Labour';
}

export const TodayAttendanceView: React.FC<TodayAttendanceViewProps> = ({
  employees,
  attendanceRecords,
  onRecordAttendance,
  targetDate,
  onTargetDateChange,
  defaultCategory = 'Monthly Salary'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'All' | 'Monthly Salary' | 'Labour'>(defaultCategory);
  const [currentTime, setCurrentTime] = useState<string>('');

  // Editing state for individual employee timing inputs:
  // key: `${employeeId}_timeIn` or `${employeeId}_timeOut`
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [savingEmpId, setSavingEmpId] = useState<string | null>(null);

  // Live digital clock in section header
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        })
      );
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Filter attendance records specifically for targetDate
  const dateRecordsMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendanceRecords.forEach((r) => {
      if (r.date === targetDate) {
        map.set(r.employeeId, r);
      }
    });
    return map;
  }, [attendanceRecords, targetDate]);

  // Filtered employees list based on category & search
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      if (categoryFilter !== 'All' && emp.employeeType !== categoryFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (emp.fullName || '').toLowerCase().includes(q);
        const matchId = (emp.employeeId || '').toLowerCase().includes(q);
        const matchDept = (emp.department || '').toLowerCase().includes(q);
        if (!matchName && !matchId && !matchDept) return false;
      }
      return true;
    });
  }, [employees, categoryFilter, searchQuery]);

  // Overall counts for summary cards
  const stats = useMemo(() => {
    let clockedIn = 0;
    let clockedOut = 0;
    const activeStaff = categoryFilter === 'All'
      ? employees
      : employees.filter((e) => e.employeeType === categoryFilter);

    activeStaff.forEach((emp) => {
      const r = dateRecordsMap.get(emp.employeeId);
      if (r?.timeIn) clockedIn++;
      if (r?.timeOut) clockedOut++;
    });
    return {
      total: activeStaff.length,
      clockedIn,
      clockedOut,
      pendingIn: Math.max(0, activeStaff.length - clockedIn)
    };
  }, [employees, dateRecordsMap, categoryFilter]);

  // Handler: Clock In single employee
  const handleClockIn = async (employeeId: string) => {
    const nowTime = getCurrentTimeString();
    setSavingEmpId(employeeId);
    try {
      const existing = dateRecordsMap.get(employeeId);
      const workingHours = existing?.timeOut
        ? calculateWorkingHours(nowTime, existing.timeOut)
        : undefined;
      const status = calculateShiftStatus(nowTime, existing?.timeOut, workingHours);

      await onRecordAttendance(employeeId, {
        timeIn: nowTime,
        status,
        workingHours
      });
    } finally {
      setSavingEmpId(null);
    }
  };

  // Handler: Clock Out single employee
  const handleClockOut = async (employeeId: string) => {
    const nowTime = getCurrentTimeString();
    setSavingEmpId(employeeId);
    try {
      const existing = dateRecordsMap.get(employeeId);
      const workingHours = existing?.timeIn
        ? calculateWorkingHours(existing.timeIn, nowTime)
        : undefined;
      const status = calculateShiftStatus(existing?.timeIn, nowTime, workingHours);

      await onRecordAttendance(employeeId, {
        timeIn: existing?.timeIn,
        timeOut: nowTime,
        status,
        workingHours
      });
    } finally {
      setSavingEmpId(null);
    }
  };

  // Handler: Clock In all pending employees with 1 click
  const handleClockInAllPending = async () => {
    const nowTime = getCurrentTimeString();
    const pendingEmployees = filteredEmployees.filter(
      (emp) => !dateRecordsMap.get(emp.employeeId)?.timeIn
    );
    if (pendingEmployees.length === 0) return;

    for (const emp of pendingEmployees) {
      const status = calculateShiftStatus(nowTime, null, 0);
      await onRecordAttendance(emp.employeeId, {
        timeIn: nowTime,
        status
      });
    }
  };

  // Start editing a time field
  const handleStartEdit = (employeeId: string, field: 'timeIn' | 'timeOut', currentValue?: string | null) => {
    setEditingField(`${employeeId}_${field}`);
    setEditValue(currentValue || getCurrentTimeString());
  };

  // Save edited time
  const handleSaveEdit = async (employeeId: string, field: 'timeIn' | 'timeOut') => {
    if (!editValue) return;
    const existing = dateRecordsMap.get(employeeId);
    setSavingEmpId(employeeId);
    try {
      if (field === 'timeIn') {
        const workingHours = existing?.timeOut
          ? calculateWorkingHours(editValue, existing.timeOut)
          : undefined;
        const status = calculateShiftStatus(editValue, existing?.timeOut, workingHours);
        await onRecordAttendance(employeeId, {
          timeIn: editValue,
          status,
          workingHours
        });
      } else {
        const workingHours = existing?.timeIn
          ? calculateWorkingHours(existing.timeIn, editValue)
          : undefined;
        const status = calculateShiftStatus(existing?.timeIn, editValue, workingHours);
        await onRecordAttendance(employeeId, {
          timeIn: existing?.timeIn,
          timeOut: editValue,
          status,
          workingHours
        });
      }
      setEditingField(null);
    } finally {
      setSavingEmpId(null);
    }
  };

  // Clear a time field if mistakenly entered
  const handleClearTime = async (employeeId: string, field: 'timeIn' | 'timeOut') => {
    const existing = dateRecordsMap.get(employeeId);
    setSavingEmpId(employeeId);
    try {
      if (field === 'timeIn') {
        const remainingTimeOut = existing?.timeOut;
        const status = remainingTimeOut ? calculateShiftStatus(null, remainingTimeOut, 0) : null;
        await onRecordAttendance(employeeId, {
          timeIn: null,
          workingHours: 0,
          status: (status as any)
        });
      } else {
        const remainingTimeIn = existing?.timeIn;
        const status = remainingTimeIn ? calculateShiftStatus(remainingTimeIn, null, 0) : null;
        await onRecordAttendance(employeeId, {
          timeOut: null,
          workingHours: 0,
          status: (status as any)
        });
      }
      setEditingField(null);
    } finally {
      setSavingEmpId(null);
    }
  };

  // Manually cycle / override shift type if needed (Day Shift -> Night Shift -> Double Shift -> Day Shift)
  const handleCycleShift = async (employeeId: string, currentStatus: AttendanceStatus) => {
    let nextStatus: AttendanceStatus = 'Present';
    if (currentStatus === 'Present') nextStatus = 'N';
    else if (currentStatus === 'N') nextStatus = 'P/N';
    else if (currentStatus === 'P/N') nextStatus = 'Present';

    const existing = dateRecordsMap.get(employeeId);
    setSavingEmpId(employeeId);
    try {
      await onRecordAttendance(employeeId, {
        timeIn: existing?.timeIn,
        timeOut: existing?.timeOut,
        workingHours: existing?.workingHours,
        status: nextStatus
      });
    } finally {
      setSavingEmpId(null);
    }
  };

  // Formatted date string for header
  const targetDateObj = new Date(targetDate + 'T00:00:00');
  const formattedDateStr = targetDateObj.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="space-y-4 p-4 sm:p-6 bg-white">
      {/* Top Banner / Title & Clock */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 tracking-tight">
            Today&apos;s Attendance Register
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {formattedDateStr}
          </p>
        </div>

        <div className="flex items-center gap-4 flex-wrap">
          {/* Digital Clock in Single Line (No Box) */}
          <div className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className="text-slate-400 font-medium">System Time:</span>
            <span className="font-mono font-bold text-slate-800 text-xs sm:text-sm">{currentTime || '--:--:--'}</span>
          </div>

          {/* Date Selector for Admin or Backfill */}
          {onTargetDateChange && (
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <input
                type="date"
                value={targetDate}
                onChange={(e) => onTargetDateChange(e.target.value)}
                className="bg-transparent text-xs text-slate-800 font-semibold focus:outline-none cursor-pointer"
                title="Change Attendance Date"
              />
            </div>
          )}
        </div>
      </div>

      {/* Quick KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Total Staff */}
        <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
            Total Staff
          </span>
          <span className="text-lg font-bold text-slate-900 mt-1 block">
            {stats.total} Active
          </span>
        </div>

        {/* Clocked In */}
        <div className="p-3 bg-emerald-50/70 rounded-xl border border-emerald-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
            Clocked In (Present)
          </span>
          <span className="text-lg font-bold text-emerald-700 mt-1 flex items-center gap-1.5">
            <LogIn className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{stats.clockedIn} Marked</span>
          </span>
        </div>

        {/* Clocked Out */}
        <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-800 block">
            Clocked Out
          </span>
          <span className="text-lg font-bold text-indigo-700 mt-1 flex items-center gap-1.5">
            <LogOut className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{stats.clockedOut} Completed</span>
          </span>
        </div>

        {/* Pending In */}
        <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 block">
            Pending In
          </span>
          <span className="text-lg font-bold text-amber-700 mt-1 flex items-center gap-1.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{stats.pendingIn} Pending</span>
          </span>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-1">
        {/* Sub-Category Filter Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {(['Monthly Salary', 'Labour', 'All'] as const).map((tab) => {
            const count =
              tab === 'All'
                ? employees.length
                : employees.filter((e) => e.employeeType === tab).length;
            const label = tab === 'Monthly Salary' ? 'Monthly Salary Employees' : tab === 'Labour' ? 'Labour Workers' : 'All Staff';

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setCategoryFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${categoryFilter === tab
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
                  }`}
              >
                <span>{label}</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700 font-mono">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Search & Bulk Action */}
        <div className="flex items-center gap-2 flex-1 md:justify-end">
          <div className="relative flex-1 sm:w-64 max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, ID or department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 transition"
            />
          </div>

          {stats.pendingIn > 0 && (
            <button
              type="button"
              onClick={handleClockInAllPending}
              className="inline-flex items-center px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
              title="Mark Clock In for all displayed employees who have not clocked in yet"
            >
              <span>Clock In All Pending</span>
            </button>
          )}
        </div>
      </div>

      {/* Employee Attendance Table */}
      <TableMaximizeWrapper
        title={`Daily Attendance Check-in (${targetDate})`}
        badge={
          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-[#1F4E79]">
            {filteredEmployees.length} Staff
          </span>
        }
      >
        <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
          <div data-table-scroll="true" className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse border border-slate-300">
              <thead className="bg-[#EEF5FB] border-b-2 border-slate-300 text-[#1F4E79] font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-2.5 px-4 w-12 text-center border-r border-slate-300 bg-[#EEF5FB]">#</th>
                  <th className="py-2.5 px-4 min-w-[200px] border-r border-slate-300 bg-[#EEF5FB]">Employee Details</th>
                  <th className="py-2.5 px-4 w-32 text-center border-r border-slate-300 bg-[#EEF5FB]">Status</th>
                  <th className="py-2.5 px-4 w-52 text-center border-r border-slate-300 bg-[#EEF5FB]">Time In</th>
                  <th className="py-2.5 px-4 w-52 text-center border-r border-slate-300 bg-[#EEF5FB]">Time Out</th>
                  <th className="py-2.5 px-4 min-w-[140px] pr-12 text-center bg-[#EEF5FB]">Working Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-400 text-xs">
                      No active employees found matching the selected filter.
                    </td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp, index) => {
                    const record = dateRecordsMap.get(emp.employeeId);
                    const hasTimeIn = Boolean(record?.timeIn);
                    const hasTimeOut = Boolean(record?.timeOut);
                    const isSaving = savingEmpId === emp.employeeId;

                    // Compute working hours dynamically
                    const workingHours =
                      record?.workingHours !== undefined && record.workingHours > 0
                        ? record.workingHours
                        : hasTimeIn && hasTimeOut
                          ? calculateWorkingHours(record?.timeIn, record?.timeOut)
                          : 0;

                    const isEditingIn = editingField === `${emp.employeeId}_timeIn`;
                    const isEditingOut = editingField === `${emp.employeeId}_timeOut`;

                    return (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/70 transition-colors">
                        {/* S.No */}
                        <td className="py-3 px-4 text-center text-slate-400 font-mono text-xs">
                          {index + 1}
                        </td>

                        {/* Employee Details */}
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                              {emp.fullName?.charAt(0) || 'E'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 truncate flex items-center gap-1.5">
                                <span>{emp.fullName}</span>
                                <span
                                  className={`text-[9px] font-bold uppercase px-1.5 py-0.2 rounded ${emp.employeeType === 'Labour'
                                    ? 'bg-amber-100 text-amber-800'
                                    : 'bg-blue-100 text-blue-800'
                                    }`}
                                >
                                  {emp.employeeType}
                                </span>
                              </div>
                              <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                                <span>{emp.employeeId}</span>
                                {emp.department && (
                                  <>
                                    <span className="text-slate-300">•</span>
                                    <span className="truncate text-slate-400">{emp.department}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Status - Auto-calculated Shift (Day / Night / Double) */}
                        <td className="py-3 px-4 text-center">
                          {hasTimeIn ? (
                            (() => {
                              const calculated = calculateShiftStatus(record?.timeIn, record?.timeOut, workingHours);
                              const shift = record?.status && record.status !== 'Absent' ? record.status : calculated;

                              if (shift === 'P/N') {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleCycleShift(emp.employeeId, shift)}
                                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-700 hover:text-blue-900 transition cursor-pointer"
                                    title="Double Shift (Day + Night, 2 shifts). Click to change."
                                  >
                                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span>Double Shift</span>
                                  </button>
                                );
                              }
                              if (shift === 'N') {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleCycleShift(emp.employeeId, shift)}
                                    className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-purple-700 hover:text-purple-900 transition cursor-pointer"
                                    title="Night Shift (N). Click to change."
                                  >
                                    <Moon className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                    <span>Night Shift</span>
                                  </button>
                                );
                              }
                              return (
                                <button
                                  type="button"
                                  onClick={() => handleCycleShift(emp.employeeId, shift)}
                                  className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition cursor-pointer"
                                  title="Day Shift (Present). Click to change."
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span>Day Shift</span>
                                </button>
                              );
                            })()
                          ) : (
                            <span className="text-xs text-slate-400 font-medium">
                              Not In
                            </span>
                          )}
                        </td>

                        {/* TIME IN */}
                        <td className="py-3 px-4 text-center">
                          {!hasTimeIn && !isEditingIn ? (
                            /* Button visible only when time is not noted */
                            <button
                              type="button"
                              onClick={() => handleClockIn(emp.employeeId)}
                              disabled={isSaving}
                              className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs shadow-2xs transition cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Click to clock in with current system time"
                            >
                              <span>Time In</span>
                            </button>
                          ) : isEditingIn ? (
                            /* Editable input when editing */
                            <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
                              <input
                                type="time"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="text-xs font-mono font-bold text-slate-800 bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(emp.employeeId, 'timeIn')}
                                disabled={isSaving}
                                className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                                title="Save Time In"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingField(null)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            /* Time noted: Button disappears, shows recorded time with edit access */
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-800">
                                {formatTime24To12(record?.timeIn)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(emp.employeeId, 'timeIn', record?.timeIn)}
                                className="p-1 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                                title="Edit Time In"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearTime(emp.employeeId, 'timeIn')}
                                className="p-1 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                                title="Clear Time In"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* TIME OUT */}
                        <td className="py-3 px-4 text-center">
                          {!hasTimeOut && !isEditingOut ? (
                            /* Button visible only when time out is not noted */
                            <button
                              type="button"
                              onClick={() => handleClockOut(emp.employeeId)}
                              disabled={isSaving}
                              className="inline-flex items-center justify-center px-3.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-semibold text-xs shadow-2xs transition cursor-pointer active:scale-95 disabled:opacity-50"
                              title="Click to clock out with current system time"
                            >
                              <span>Time Out</span>
                            </button>
                          ) : isEditingOut ? (
                            /* Editable input when editing */
                            <div className="inline-flex items-center gap-1 bg-white border border-slate-300 rounded-lg px-2 py-1 shadow-2xs">
                              <input
                                type="time"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                className="text-xs font-mono font-bold text-slate-800 bg-transparent focus:outline-none"
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEdit(emp.employeeId, 'timeOut')}
                                disabled={isSaving}
                                className="p-1 rounded text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 transition cursor-pointer"
                                title="Save Time Out"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingField(null)}
                                className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition cursor-pointer"
                                title="Cancel"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            /* Time noted: Button disappears, shows recorded time with edit access */
                            <div className="inline-flex items-center justify-center gap-1.5">
                              <span className="font-mono font-bold text-xs text-slate-800">
                                {formatTime24To12(record?.timeOut)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleStartEdit(emp.employeeId, 'timeOut', record?.timeOut)}
                                className="p-1 text-slate-400 hover:text-slate-800 transition cursor-pointer"
                                title="Edit Time Out"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleClearTime(emp.employeeId, 'timeOut')}
                                className="p-1 text-slate-300 hover:text-rose-600 transition cursor-pointer"
                                title="Clear Time Out"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* WORKING HOURS */}
                        <td className="py-3 px-4 text-center">
                          {hasTimeIn && hasTimeOut ? (
                            <span className="font-mono font-bold text-xs text-slate-800">
                              {formatWorkingHours(workingHours)}
                            </span>
                          ) : hasTimeIn ? (
                            <span className="inline-flex items-center justify-center gap-1 text-[11px] text-amber-600 font-medium">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                              <span>In Progress</span>
                            </span>
                          ) : (
                            <span className="text-slate-300 font-mono">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <TableTotalsFooter
                cells={[
                  {
                    colSpan: 6,
                    label: `TOTAL (${filteredEmployees.length} staff: ${stats.clockedIn} clocked in, ${stats.clockedOut} clocked out, ${stats.pendingIn} pending)`
                  }
                ]}
              />
            </table>
          </div>
        </div>
      </TableMaximizeWrapper>
    </div>
  );
};

