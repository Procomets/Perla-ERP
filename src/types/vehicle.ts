export type VehicleStatus = 'Active' | 'Under Maintenance' | 'Inactive';
export type VehicleOwnerType = 'Own' | 'Attached' | 'Market';
export type VehicleFuelType = 'Diesel' | 'Petrol' | 'Electric' | 'CNG';

export interface VehicleRecord {
  id: string;
  vehicleNo: string; // e.g. "TN87H9298" (stored in uppercase)
  typeOfVehicle: string; // e.g. "NEW TIPPER 12 WHEEL", "TATA ACE"
  modelMake: string; // e.g. "TATA", "ASHOK LEYLAND", "MAHINDRA"
  fuelType?: VehicleFuelType; // Diesel / Petrol / Electric / CNG
  mileage?: number | string; // e.g. 4.5 (km/L or km/charge)
  purchaseYear: number | string; // e.g. "2026"
  fcDueDate: string; // YYYY-MM-DD
  insuranceDueDate: string; // YYYY-MM-DD
  ownerType?: VehicleOwnerType; // Own / Attached / Market
  driverName?: string;
  driverPhone?: string;
  status: VehicleStatus; // Active / Under Maintenance / Inactive
  remarks?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  createdByName?: string;
}

export interface CreateVehiclePayload {
  vehicleNo: string;
  typeOfVehicle: string;
  modelMake: string;
  fuelType?: VehicleFuelType;
  mileage?: number | string;
  purchaseYear: number | string;
  fcDueDate: string;
  insuranceDueDate: string;
  ownerType?: VehicleOwnerType;
  driverName?: string;
  driverPhone?: string;
  status?: VehicleStatus;
  remarks?: string;
}

export interface UpdateVehiclePayload extends Partial<CreateVehiclePayload> {}

export interface VehicleFilterOptions {
  search?: string;
  status?: string;
  typeOfVehicle?: string;
  modelMake?: string;
  fuelType?: string;
}

export interface VehicleDailyEntry {
  id: string;
  entryId: string; // e.g. "VLOG-2026-0001"
  date: string; // YYYY-MM-DD
  vehicleId?: string;
  vehicleNo: string; // e.g. "TN87H9298"
  typeOfVehicle?: string; // e.g. "NEW TIPPER 12 WHEEL"
  modelMake?: string; // e.g. "TATA"
  fuelType: VehicleFuelType; // Diesel / Petrol / Electric / CNG
  mileage: number; // e.g. 4.5 (km/L or km/charge)

  startKm: number; // Start kilometer reading
  startTime: string; // e.g. "08:00"
  endKm: number; // End kilometer reading
  endTime: string; // e.g. "17:30"

  totalDistance: number; // endKm - startKm in km
  timeTakenMinutes: number; // duration in minutes
  timeTakenFormatted: string; // e.g. "9h 30m"

  fuelRate?: number; // Fuel price per L / kWh
  fuelConsumed?: number; // totalDistance / mileage
  amountSpent: number; // Amount spent based on mileage

  driverName: string; // Auto-collected or admin-edited
  remarks?: string;

  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateVehicleDailyEntryPayload {
  date: string;
  vehicleNo: string;
  vehicleId?: string;
  typeOfVehicle?: string;
  modelMake?: string;
  fuelType: VehicleFuelType;
  mileage: number;

  startKm: number;
  startTime: string;
  endKm: number;
  endTime: string;

  totalDistance: number;
  timeTakenMinutes: number;
  timeTakenFormatted: string;

  fuelRate?: number;
  fuelConsumed?: number;
  amountSpent: number;

  driverName: string;
  remarks?: string;
}

export interface UpdateVehicleDailyEntryPayload extends Partial<CreateVehicleDailyEntryPayload> {}

export interface VehicleDailyFilterOptions {
  search?: string;
  vehicleNo?: string;
  fuelType?: string;
  startDate?: string;
  endDate?: string;
}
