import React, { useMemo } from 'react';
import { EmployeeMaster } from '../../../types/employee';
import { AttendanceRecord, AttendanceStatus } from '../../../types/attendance';

interface AttendanceTableProps {
  employees: EmployeeMaster[];
  attendanceRecords: AttendanceRecord[];
  currentYear: number;
  currentMonth: number; // 0-indexed (0 = Jan, 11 = Dec)
  isTimeBlocked: boolean;
  isSettingsBlocked: boolean;
  isAdmin: boolean;
  searchQuery: string;
  onToggleAttendance: (employeeId: string, dateStr: string, currentStatus: AttendanceStatus | null) => Promise<void>;
  onShowBlockedNotice: (reason: string) => void;
}

export const AttendanceTable: React.FC<AttendanceTableProps> = ({
  employees,
  attendanceRecords,
  currentYear,
  currentMonth,
  isTimeBlocked,
  isSettingsBlocked,
  isAdmin,
  searchQuery,
  onToggleAttendance,
  onShowBlockedNotice
}) => {
  // Compute days in the month
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Compute total working days (excluding Sundays)
  const sundaysCount = useMemo(() => {
    let count = 0;
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(currentYear, currentMonth, day);
      if (d.getDay() === 0) count++;
    }
    return count;
  }, [currentYear, currentMonth, daysInMonth]);

  const totalWorkingDays = daysInMonth - sundaysCount;

  // Filter employees
  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const q = searchQuery.toLowerCase().trim();
    return employees.filter(
      (emp) =>
        (emp.fullName || '').toLowerCase().includes(q) ||
        (emp.employeeId || '').toLowerCase().includes(q) ||
        (emp.department || '').toLowerCase().includes(q)
    );
  }, [employees, searchQuery]);

  const today = new Date();
  const isCurrentMonth = today.getFullYear() === currentYear && today.getMonth() === currentMonth;

  // Handle cell click with role and time checks
  const handleCellClick = (empId: string, day: number) => {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const isTodayDate =
      today.getFullYear() === currentYear &&
      today.getMonth() === currentMonth &&
      today.getDate() === day;

    // Admin has NO time or date restrictions
    if (!isAdmin) {
      if (isSettingsBlocked) {
        onShowBlockedNotice('Attendance entry is locked by Administrator.');
        return;
      }
      if (isTimeBlocked) {
        onShowBlockedNotice('Attendance is locked. You can only enter attendance during the allowed timing window.');
        return;
      }
      if (!isTodayDate) {
        onShowBlockedNotice('Regular users can only mark attendance for Today. Contact an Admin to update other dates.');
        return;
      }
    }

    // Find current status
    const record = attendanceRecords.find((r) => r.employeeId === empId && r.date === dateStr);
    const currentStatus = record ? record.status : null;
    onToggleAttendance(empId, dateStr, currentStatus);
  };

  return (
    <div className="overflow-x-auto select-none border border-[#e0e0e0] bg-white rounded-lg shadow-xs">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-[#e0e0e0] text-slate-700 sticky top-0 z-10 bg-white">
            <th className="py-2.5 px-3 w-12 text-center border-r border-[#e0e0e0] font-semibold text-xs text-slate-600 bg-slate-50">
              S.No
            </th>
            <th className="py-2.5 px-4 min-w-[210px] border-r border-[#e0e0e0] font-semibold text-xs text-slate-600 bg-slate-50">
              Employee Name
            </th>
            {daysArray.map((day) => {
              const d = new Date(currentYear, currentMonth, day);
              const isSun = d.getDay() === 0;
              const isTod = isCurrentMonth && today.getDate() === day;

              let thBg = '#ffffff';
              let thColor = '#374151';

              if (isTod) {
                thBg = '#e0f7fa'; // Cyan for Today
                thColor = '#00838f';
              } else if (isSun) {
                thBg = '#ffebee'; // Soft red/pink for Sunday
                thColor = '#c62828';
              }

              return (
                <th
                  key={day}
                  style={{ backgroundColor: thBg, color: thColor }}
                  className="py-2 px-1 text-center min-w-[38px] w-9 border-r border-[#e0e0e0] font-medium text-xs transition-colors"
                >
                  {day}
                </th>
              );
            })}
            <th className="py-2.5 px-3 text-center min-w-[110px] font-semibold text-xs text-slate-700 bg-slate-50 border-l border-[#e0e0e0]">
              Working / Present
            </th>
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.length === 0 ? (
            <tr>
              <td colSpan={daysInMonth + 3} className="py-12 text-center text-slate-400 text-sm">
                No active employees found matching the criteria.
              </td>
            </tr>
          ) : (
            filteredEmployees.map((emp, index) => {
              let presentCount = 0;

              return (
                <tr key={emp.id || emp.employeeId} className="hover:bg-slate-50/50 transition-colors">
                  {/* S.No */}
                  <td className="py-2 px-2 text-center text-slate-500 font-mono text-xs border-r border-b border-[#e0e0e0] bg-white">
                    {index + 1}
                  </td>

                  {/* Employee Name & ID */}
                  <td className="py-2 px-4 border-r border-b border-[#e0e0e0] bg-white">
                    <div className="font-medium text-slate-900 text-xs truncate">{emp.fullName}</div>
                    <div className="text-[11px] text-slate-500 font-mono flex items-center gap-1.5 mt-0.5">
                      <span>{emp.employeeId}</span>
                      {emp.department && (
                        <>
                          <span className="text-slate-300">•</span>
                          <span className="truncate text-slate-400">{emp.department}</span>
                        </>
                      )}
                    </div>
                  </td>

                  {/* Days 1..daysInMonth */}
                  {daysArray.map((day) => {
                    const d = new Date(currentYear, currentMonth, day);
                    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const record = attendanceRecords.find((r) => r.employeeId === emp.employeeId && r.date === dateStr);

                    const isSun = d.getDay() === 0;
                    const isTod = isCurrentMonth && today.getDate() === day;

                    let bgColor = '#ffffff';
                    let textColor = '#9e9e9e';
                    let text = '-';
                    let isBold = false;

                    if (record?.status === 'Present') {
                      presentCount += 1;
                      bgColor = '#e8f5e9'; // Pastel Green
                      textColor = '#2e7d32'; // Deep Green
                      text = 'P';
                      isBold = true;
                    } else if (record?.status === 'Absent') {
                      bgColor = '#ffebee'; // Pastel Red
                      textColor = '#c62828'; // Deep Red
                      text = 'AB';
                      isBold = true;
                    } else if (record?.status === 'P/N') {
                      // Labour: Day + Night (2 shifts)
                      presentCount += 2;
                      bgColor = '#e3f2fd'; // Pastel Blue
                      textColor = '#1565c0'; // Deep Blue
                      text = 'P/N';
                      isBold = true;
                    } else if (record?.status === 'N') {
                      // Monthly: Night Shift (1 shift)
                      presentCount += 1;
                      bgColor = '#ede7f6'; // Pastel Purple
                      textColor = '#4527a0'; // Deep Purple
                      text = 'N';
                      isBold = true;
                    } else if (isTod) {
                      bgColor = '#e0f7fa'; // Cyan column for Today
                      textColor = '#00838f';
                    } else if (isSun) {
                      bgColor = '#fff3e0'; // Warm peach column for Sunday
                      textColor = '#8d6e63';
                    }

                    const isClickable = isAdmin || (isTod && !isSettingsBlocked && !isTimeBlocked);

                    return (
                      <td
                        key={day}
                        onClick={() => handleCellClick(emp.employeeId, day)}
                        title={`${emp.fullName} - ${dateStr} (${text})`}
                        style={{ backgroundColor: bgColor }}
                        className={`p-0 h-10 min-h-[40px] w-9 min-w-[38px] text-center border-r border-b border-[#e0e0e0] transition-colors select-none ${
                          isClickable ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                        }`}
                      >
                        <div
                          style={{ color: textColor }}
                          className={`w-full h-full flex items-center justify-center text-xs leading-none ${
                            isBold ? 'font-semibold' : 'font-normal'
                          }`}
                        >
                          {text}
                        </div>
                      </td>
                    );
                  })}

                  {/* Total Working / Total Present */}
                  <td className="py-2 px-3 text-center font-bold text-xs border-b border-[#e0e0e0] bg-slate-50/60 border-l border-[#e0e0e0]">
                    <span className="text-slate-700">{totalWorkingDays} / </span>
                    <span style={{ color: '#2e7d32' }}>{presentCount}</span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
};

