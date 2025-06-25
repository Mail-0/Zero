import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';
import { getBrowserTimezone } from '@/lib/timezones';
import { Plus, Trash2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Employee {
  id: string;
  name: string;
  timezone: string;
  startTime: string;
  endTime: string;
}

interface WorkingHours {
  startTime: string;
  endTime: string;
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Tokyo',
  'Asia/Shanghai',
  'Asia/Kolkata',
  'Asia/Qatar',
  'Africa/Cairo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const timeToMinutes = (time: string): number => {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

const minutesToTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
};

const calculateOverlap = (
  userStart: string,
  userEnd: string,
  userTz: string,
  empStart: string,
  empEnd: string,
  empTz: string,
): { start: string; end: string } | null => {
  const userStartMinutes = timeToMinutes(userStart);
  const userEndMinutes = timeToMinutes(userEnd);

  // Create date objects for today in the employee's timezone
  const today = new Date();
  const dateStr = format(today, 'yyyy-MM-dd');

  // Create dates representing the employee's working hours in their timezone
  const empStartLocal = new Date(`${dateStr}T${empStart}:00`);
  const empEndLocal = new Date(`${dateStr}T${empEnd}:00`);

  // Convert from the employee's timezone to UTC
  const empStartUTC = fromZonedTime(empStartLocal, empTz);
  const empEndUTC = fromZonedTime(empEndLocal, empTz);

  // Convert from UTC to the user's timezone
  const empStartInUserTz = toZonedTime(empStartUTC, userTz);
  const empEndInUserTz = toZonedTime(empEndUTC, userTz);

  // Format as HH:mm in the user's timezone
  const empStartTimeStr = formatInTimeZone(empStartInUserTz, userTz, 'HH:mm');
  const empEndTimeStr = formatInTimeZone(empEndInUserTz, userTz, 'HH:mm');

  const empStartMinutesInUserTz = timeToMinutes(empStartTimeStr);
  const empEndMinutesInUserTz = timeToMinutes(empEndTimeStr);

  // Handle day boundary crossing
  let adjustedEmpEndMinutes = empEndMinutesInUserTz;
  if (empEndMinutesInUserTz < empStartMinutesInUserTz) {
    adjustedEmpEndMinutes += 24 * 60; // Add 24 hours
  }

  const overlapStart = Math.max(userStartMinutes, empStartMinutesInUserTz);
  const overlapEnd = Math.min(userEndMinutes, adjustedEmpEndMinutes);

  if (overlapStart >= overlapEnd) return null;

  return {
    start: minutesToTime(overlapStart % (24 * 60)),
    end: minutesToTime(overlapEnd % (24 * 60)),
  };
};

export default function HRPage() {
  const [employees, setEmployees] = useState<Employee[]>([
    {
      id: '1',
      name: 'Ahmet',
      timezone: 'Europe/London',
      startTime: '17:00',
      endTime: '18:00',
    },
    {
      id: '2',
      name: 'Needle',
      timezone: 'Africa/Cairo',
      startTime: '19:00',
      endTime: '20:00',
    },
    {
      id: '3',
      name: 'Adam G',
      timezone: 'Asia/Qatar',
      startTime: '19:00',
      endTime: '20:00',
    },
    {
      id: '4',
      name: 'Nizzy',
      timezone: 'America/Chicago',
      startTime: '11:00',
      endTime: '12:00',
    },
    {
      id: '5',
      name: 'Amrit',
      timezone: 'Asia/Kolkata',
      startTime: '20:00',
      endTime: '22:30',
    },
  ]);
  // Company timezone
  const [userTimezone, setUserTimezone] = useState('America/Los_Angeles');
  const [userWorkingHours, setUserWorkingHours] = useState<WorkingHours>({
    startTime: '09:00',
    endTime: '17:00',
  });
  const [currentTime, setCurrentTime] = useState(new Date());
  const [newEmployee, setNewEmployee] = useState({
    name: '',
    timezone: '',
    startTime: '09:00',
    endTime: '17:00',
  });

  useEffect(() => {
    // setUserTimezone(getBrowserTimezone());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const addEmployee = () => {
    if (newEmployee.name && newEmployee.timezone) {
      setEmployees([
        ...employees,
        {
          ...newEmployee,
          id: Date.now().toString(),
        },
      ]);
      setNewEmployee({
        name: '',
        timezone: '',
        startTime: '09:00',
        endTime: '17:00',
      });
    }
  };

  const removeEmployee = (id: string) => {
    setEmployees(employees.filter((emp) => emp.id !== id));
  };

  const updateEmployee = (id: string, field: keyof Employee, value: string) => {
    setEmployees(employees.map((emp) => (emp.id === id ? { ...emp, [field]: value } : emp)));
  };

  const calculateTeamOverlap = (): { start: string; end: string } | null => {
    if (employees.length === 0) return null;

    const overlaps = employees
      .map((emp) =>
        calculateOverlap(
          userWorkingHours.startTime,
          userWorkingHours.endTime,
          userTimezone,
          emp.startTime,
          emp.endTime,
          emp.timezone,
        ),
      )
      .filter(Boolean);

    if (overlaps.length === 0) return null;

    const latestStart = Math.max(...overlaps.map((o) => timeToMinutes(o!.start)));
    const earliestEnd = Math.min(...overlaps.map((o) => timeToMinutes(o!.end)));

    if (latestStart >= earliestEnd) return null;

    return {
      start: minutesToTime(latestStart),
      end: minutesToTime(earliestEnd),
    };
  };

  const teamOverlap = calculateTeamOverlap();

  return (
    <div className="space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Employee Timezone & Working Hours Manager
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label className="text-sm font-medium">Base Timezone</label>
              <Input value={userTimezone} disabled className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Base Start Time</label>
              <Input
                type="time"
                value={userWorkingHours.startTime}
                onChange={(e) =>
                  setUserWorkingHours((prev) => ({ ...prev, startTime: e.target.value }))
                }
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Base End Time</label>
              <Input
                type="time"
                value={userWorkingHours.endTime}
                onChange={(e) =>
                  setUserWorkingHours((prev) => ({ ...prev, endTime: e.target.value }))
                }
                className="mt-1"
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <h3 className="mb-4 text-lg font-medium">Add Employee</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
              <Input
                placeholder="Employee Name"
                value={newEmployee.name}
                onChange={(e) => setNewEmployee((prev) => ({ ...prev, name: e.target.value }))}
              />
              <Select
                value={newEmployee.timezone}
                onValueChange={(value) => setNewEmployee((prev) => ({ ...prev, timezone: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="time"
                value={newEmployee.startTime}
                onChange={(e) => setNewEmployee((prev) => ({ ...prev, startTime: e.target.value }))}
              />
              <Input
                type="time"
                value={newEmployee.endTime}
                onChange={(e) => setNewEmployee((prev) => ({ ...prev, endTime: e.target.value }))}
              />
              <Button onClick={addEmployee} disabled={!newEmployee.name || !newEmployee.timezone}>
                <Plus className="mr-2 h-4 w-4" />
                Add
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {teamOverlap && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">Team Overlap Window</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-green-700">
              All team members are available from{' '}
              <span className="font-bold">{teamOverlap.start}</span> to{' '}
              <span className="font-bold">{teamOverlap.end}</span> in the base timezone
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {employees.map((employee) => {
          const employeeCurrentTime = formatInTimeZone(currentTime, employee.timezone, 'HH:mm:ss');
          const overlap = calculateOverlap(
            userWorkingHours.startTime,
            userWorkingHours.endTime,
            userTimezone,
            employee.startTime,
            employee.endTime,
            employee.timezone,
          );

          return (
            <Card key={employee.id}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 items-center gap-4 md:grid-cols-7">
                  <Input
                    value={employee.name}
                    onChange={(e) => updateEmployee(employee.id, 'name', e.target.value)}
                    className="font-medium"
                  />
                  <Select
                    value={employee.timezone}
                    onValueChange={(value) => updateEmployee(employee.id, 'timezone', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_TIMEZONES.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="text-center">
                    <div className="text-sm text-gray-500">Current Time</div>
                    <div className="font-mono text-lg">{employeeCurrentTime}</div>
                  </div>
                  <Input
                    type="time"
                    value={employee.startTime}
                    onChange={(e) => updateEmployee(employee.id, 'startTime', e.target.value)}
                  />
                  <Input
                    type="time"
                    value={employee.endTime}
                    onChange={(e) => updateEmployee(employee.id, 'endTime', e.target.value)}
                  />
                  <div className="text-center">
                    {overlap ? (
                      <div>
                        <div className="text-sm text-green-600">Overlap</div>
                        <div className="font-mono text-sm">
                          {overlap.start}-{overlap.end}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-red-600">No overlap</div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeEmployee(employee.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {employees.length === 0 && (
        <Card>
          <CardContent className="pt-6 text-center text-gray-500">
            No employees added yet. Add employees to see timezone comparisons and working hour
            overlaps.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
