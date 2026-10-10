import React from 'react';
import { Employee } from '../../types/employee';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Table, Column } from '../../components/ui/Table';
import { StatusChip } from '../../components/ui/StatusChip';
import { formatCurrency } from '../../utils/formatters';
import { Users, Plus, CalendarCheck } from 'lucide-react';

interface AttendancePageProps {
  employees: Employee[];
}

export const AttendancePage: React.FC<AttendancePageProps> = ({ employees }) => {
  const columns: Column<Employee>[] = [
    { header: 'Employee ID', accessor: 'employeeId', className: 'font-bold text-[#1F4E79]' },
    { header: 'Employee Name', accessor: 'name', className: 'font-bold' },
    { header: 'Department', accessor: 'department' },
    { header: 'Role', accessor: 'role' },
    { header: 'Pay Basis', accessor: 'salaryType' },
    { header: 'Base Pay Rate', accessor: (row) => formatCurrency(row.baseSalary) },
    { header: 'Today\'s Shift Attendance', accessor: () => <StatusChip status="Present" variant="green" /> }
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-xl font-bold text-[#1F4E79]">Attendance & Employee Payroll</h2>
          <p className="text-xs text-slate-500">Track daily worker attendance, shifts, overtime, and monthly salary calculations</p>
        </div>
        <Button variant="primary" icon={<CalendarCheck className="w-4 h-4" />}>
          Mark Daily Attendance
        </Button>
      </div>

      <Card>
        <Table columns={columns} data={employees} keyExtractor={(row) => row.id} />
      </Card>
    </div>
  );
};
