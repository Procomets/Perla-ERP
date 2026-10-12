import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Calendar,
  Clock,
  Lock,
  Unlock,
  Settings,
  Download,
  Printer,
  Search,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  RefreshCw,
  Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { EmployeeMaster } from '../../types/employee';
import { EmployeeService } from '../../services/employeeService';
import { AttendanceRecord, AttendanceStatus, GeneralSettings } from '../../types/attendance';
import { AttendanceService, DEFAULT_GENERAL_SETTINGS } from '../../services/attendanceService';
import { AttendanceTable } from './components/AttendanceTable';
import { EmployeeMonitor } from './components/EmployeeMonitor';
import { GeneralSettingsModal } from './components/GeneralSettingsModal';
import { exportAttendanceToExcel } from './utils/attendanceExcelExport';

interface AttendancePageProps {
  employees?: any[];
}

export const AttendancePage: React.FC<AttendancePageProps> = () => {
  const { user, activeRole } = useAuth();
  const isAdmin =
    activeRole === 'Admin' ||
    (user?.role && user.role.toLowerCase().includes('admin')) ||
    (user?.email && user.email.toLowerCase().includes('admin'));

  const currentUserEmail = user?.email || 'user@perlatextiles.com';

  // State: Date selection
  const now = new Date();
  const [currentYear, setCurrentYear] = useState<number>(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(now.getMonth()); // 0-indexed

  // State: Tab (0 = Monthly, 1 = Labour, 2 = Monitor)
  const [activeTab, setActiveTab] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // State: Data
  const [employees, setEmployees] = useState<EmployeeMaster[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [settings, setSettings] = useState<GeneralSettings>(DEFAULT_GENERAL_SETTINGS);
  const [loading, setLoading] = useState<boolean>(true);
  const [isTimeBlocked, setIsTimeBlocked] = useState<boolean>(false);

  // Modals & Notices
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [noticeMessage, setNoticeMessage] = useState<{ type: 'error' | 'success' | 'info'; text: string } | null>(null);

  const monthYearStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;

  const showNotice = (type: 'error' | 'success' | 'info', text: string) => {
    setNoticeMessage({ type, text });
    setTimeout(() => setNoticeMessage(null), 4000);
  };

  // Fetch employees from employeeMaster and generalSettings
  const fetchEmployeesAndSettings = async () => {
    try {
      const [emps, sets] = await Promise.all([
        EmployeeService.getEmployees(),
        AttendanceService.getGeneralSettings()
      ]);
      // Only active employees
      setEmployees(emps.filter((e) => e.employmentStatus === 'Active'));
      setSettings(sets);
    } catch (err) {
      console.error('Failed to load initial employees or settings:', err);
    }
  };

  // Fetch monthly attendance records
  const fetchMonthlyAttendance = async () => {
    setLoading(true);
    try {
      const records = await AttendanceService.getAttendanceForMonth(monthYearStr);
      setAttendanceRecords(records);
    } catch (err) {
      console.error('Failed to fetch attendance for month:', monthYearStr, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeesAndSettings();
  }, []);

  useEffect(() => {
    fetchMonthlyAttendance();
  }, [monthYearStr]);

  // Check timing restriction for non-admin users
  useEffect(() => {
    if (isAdmin) {
      setIsTimeBlocked(false);
      return;
    }

    const checkTiming = () => {
      if (settings.isBlocked) {
        setIsTimeBlocked(true);
        return;
      }

      const start = settings.accessStartTime || '09:00';
      const end = settings.accessEndTime || '18:00';

      const dateObj = new Date();
      const currentHours = String(dateObj.getHours()).padStart(2, '0');
      const currentMinutes = String(dateObj.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;

      let blocked = false;
      if (start < end) {
        // Standard daytime window, e.g. 09:00 to 18:00
        blocked = !(currentTimeStr >= start && currentTimeStr <= end);
      } else {
        // Overnight window, e.g. 23:00 to 06:00
        blocked = !(currentTimeStr >= start || currentTimeStr <= end);
      }

      setIsTimeBlocked(blocked);
    };

    checkTiming();
    const interval = setInterval(checkTiming, 30000); // Check every 30 seconds
    return () => clearInterval(interval);
  }, [settings, isAdmin]);

  // Group employees
  const monthlyEmployees = useMemo(
    () => employees.filter((e) => e.employeeType === 'Monthly Salary'),
    [employees]
  );
  const labourEmployees = useMemo(
    () => employees.filter((e) => e.employeeType === 'Labour'),
    [employees]
  );

  // Toggle Attendance Cell
  const handleToggleAttendance = async (
    employeeId: string,
    dateStr: string,
    currentStatus: AttendanceStatus | null
  ) => {
    const emp = employees.find((e) => e.employeeId === employeeId);
    const isLabour = emp?.employeeType === 'Labour';

    // Status transition:
    // Labour: null -> Present -> Absent -> P/N -> null
    // Monthly: null -> Present -> Absent -> N -> null
    let nextStatus: AttendanceStatus | null = null;
    if (currentStatus === null) nextStatus = 'Present';
    else if (currentStatus === 'Present') nextStatus = 'Absent';
    else if (currentStatus === 'Absent') nextStatus = isLabour ? 'P/N' : 'N';
    else nextStatus = null;

    // Optimistic UI update
    setAttendanceRecords((prev) => {
      if (nextStatus === null) {
        return prev.filter((r) => !(r.employeeId === employeeId && r.date === dateStr));
      }
      const existingIdx = prev.findIndex((r) => r.employeeId === employeeId && r.date === dateStr);
      if (existingIdx >= 0) {
        const copy = [...prev];
        copy[existingIdx] = { ...copy[existingIdx], status: nextStatus };
        return copy;
      }
      return [
        ...prev,
        {
          employeeId,
          date: dateStr,
          monthYear: monthYearStr,
          status: nextStatus,
          markedBy: currentUserEmail
        }
      ];
    });

    try {
      await AttendanceService.markAttendance(employeeId, dateStr, monthYearStr, nextStatus, currentUserEmail);
    } catch (err: any) {
      console.error('Failed to mark attendance:', err);
      showNotice('error', 'Failed to save attendance entry to Firebase.');
      await fetchMonthlyAttendance(); // Revert on failure
    }
  };

  // Update General Settings in Firebase
  const handleSaveGeneralSettings = async (updated: Partial<GeneralSettings>) => {
    try {
      await AttendanceService.updateGeneralSettings(updated, currentUserEmail);
      setSettings((prev) => ({ ...prev, ...updated }));
      showNotice('success', 'General attendance settings updated successfully in Firebase.');
    } catch (err: any) {
      console.error('Failed to update general settings:', err);
      showNotice('error', 'Failed to save settings.');
      throw err;
    }
  };

  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false);

  // Export Attendance Register to Excel with UI Colors & Formatting
  const handleExportExcel = async () => {
    if (monthlyEmployees.length === 0 && labourEmployees.length === 0) {
      showNotice('info', 'No employees found to export.');
      return;
    }

    setIsExportingExcel(true);
    try {
      await exportAttendanceToExcel({
        monthlyEmployees,
        labourEmployees,
        attendanceRecords,
        currentYear,
        currentMonth
      });
      showNotice('success', 'Exported attendance workbook with Monthly & Labour sheets.');
    } catch (err: any) {
      console.error('Failed to export Excel:', err);
      showNotice('error', 'Failed to generate Excel file.');
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="space-y-5">
      {/* Toast Notice */}
      {noticeMessage && (
        <div
          className={`fixed top-5 right-5 z-60 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg border text-xs font-medium animate-in slide-in-from-top-3 duration-150 ${
            noticeMessage.type === 'success'
              ? 'bg-slate-900 border-slate-800 text-white'
              : noticeMessage.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-700'
              : 'bg-blue-50 border-blue-200 text-blue-700'
          }`}
        >
          {noticeMessage.type === 'success' ? (
            <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : noticeMessage.type === 'error' ? (
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
          ) : (
            <Info className="w-4 h-4 text-blue-500 shrink-0" />
          )}
          <span>{noticeMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Attendance Register</h1>
            {isAdmin ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3 h-3" />
                <span>Admin (Unrestricted Access)</span>
              </span>
            ) : isTimeBlocked ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <Lock className="w-3 h-3" />
                <span>Locked</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Clock className="w-3 h-3" />
                <span>Window Open ({settings.accessStartTime} - {settings.accessEndTime})</span>
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Daily factory workforce muster roll, shift night allowances, and working day tracking
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5 text-slate-500" />
              <span>Timing Settings</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportExcel}
            disabled={isExportingExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>{isExportingExcel ? 'Exporting...' : 'Export Excel'}</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-slate-500" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Access Restriction Notice Banner for Non-Admin when locked */}
      {!isAdmin && isTimeBlocked && (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-amber-900 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Attendance marking is currently locked.</strong> Entry is only allowed between{' '}
              <strong>{settings.accessStartTime || '09:00'}</strong> and{' '}
              <strong>{settings.accessEndTime || '18:00'}</strong>. You may view records in read-only mode.
            </span>
          </div>
        </div>
      )}

      {/* Filter and Month/Year Selector Strip */}
      <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Month & Year Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {monthNames.map((name, idx) => (
                <option key={name} value={idx}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1">
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none cursor-pointer"
            >
              {[2024, 2025, 2026, 2027].map((yr) => (
                <option key={yr} value={yr}>
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={fetchMonthlyAttendance}
            title="Refresh Attendance Records"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full md:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search employee..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:border-slate-800 transition"
          />
        </div>
      </div>

      {/* Main Tab Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        {/* Tab Headers */}
        <div className="flex items-center border-b border-slate-100 bg-slate-50/50 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab(0)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 0
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>Monthly Salary Employees</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {monthlyEmployees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(1)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 1
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>Labour Workers</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              {labourEmployees.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab(2)}
            className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2 ${
              activeTab === 2
                ? 'border-slate-900 text-slate-900 bg-white rounded-t-lg'
                : 'border-transparent text-slate-400 hover:text-slate-700'
            }`}
          >
            <span>Employee Monitor</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 font-mono">
              Yearly
            </span>
          </button>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 2 ? (
            <EmployeeMonitor employees={employees} currentYear={currentYear} />
          ) : loading ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-slate-400" />
              <span>Loading attendance records from Firebase...</span>
            </div>
          ) : (
            <AttendanceTable
              employees={activeTab === 0 ? monthlyEmployees : labourEmployees}
              attendanceRecords={attendanceRecords}
              currentYear={currentYear}
              currentMonth={currentMonth}
              isTimeBlocked={isTimeBlocked}
              isSettingsBlocked={Boolean(settings.isBlocked)}
              isAdmin={Boolean(isAdmin)}
              searchQuery={searchQuery}
              onToggleAttendance={handleToggleAttendance}
              onShowBlockedNotice={(msg) => showNotice('info', msg)}
            />
          )}
        </div>

        {/* Legend Footer */}
        {activeTab !== 2 && (
          <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: '#e8f5e9', color: '#2e7d32', borderColor: '#c8e6c9' }}
                  className="w-6 h-6 border flex items-center justify-center rounded font-semibold text-xs"
                >
                  P
                </span>
                <span>Present</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: '#ffebee', color: '#c62828', borderColor: '#ffcdd2' }}
                  className="w-6 h-6 border flex items-center justify-center rounded font-semibold text-xs"
                >
                  AB
                </span>
                <span>Absent</span>
              </div>

              {activeTab === 1 ? (
                <div className="flex items-center gap-1.5">
                  <span
                    style={{ backgroundColor: '#e3f2fd', color: '#1565c0', borderColor: '#bbdefb' }}
                    className="px-1.5 h-6 border flex items-center justify-center rounded font-semibold text-xs"
                  >
                    P/N
                  </span>
                  <span>Present + Night Shift (2 Days)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span
                    style={{ backgroundColor: '#ede7f6', color: '#4527a0', borderColor: '#d1c4e9' }}
                    className="w-6 h-6 border flex items-center justify-center rounded font-semibold text-xs"
                  >
                    N
                  </span>
                  <span>Night Shift</span>
                </div>
              )}

              <div className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: '#fff3e0', color: '#8d6e63', borderColor: '#ffe0b2' }}
                  className="px-1.5 h-6 border flex items-center justify-center rounded font-semibold text-xs"
                >
                  Sun
                </span>
                <span>Weekly Off</span>
              </div>

              <div className="flex items-center gap-1.5">
                <span
                  style={{ backgroundColor: '#e0f7fa', color: '#00838f', borderColor: '#b2ebf2' }}
                  className="px-1.5 h-6 border flex items-center justify-center rounded font-semibold text-xs"
                >
                  Today
                </span>
                <span>Current Day</span>
              </div>
            </div>

            <div className="text-slate-400 text-xs">
              Click on a day cell to toggle status • Data synced live to Firebase Firestore
            </div>
          </div>
        )}
      </div>

      {/* Admin General Settings Modal */}
      <GeneralSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onSave={handleSaveGeneralSettings}
        currentUserEmail={currentUserEmail}
      />
    </div>
  );
};
