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
  // Primary Firestore Schema fields
  id: string; // e.g. "Kqe22WlJcHgRNKI6xF0e"
  entryNumber: string; // e.g. "VLOG-2026-0001"
  tripDate: string; // e.g. "2026-11-21" (YYYY-MM-DD)
  vehicleId: string; // e.g. "ERQdH6fQw61UTLMmFGW3"
  vehicleNumber: string; // e.g. "77814551" or "TN87H9298"
  typeOfVehicle: string; // e.g. "LOAD VECHILE"
  modelMake: string; // e.g. "ASHOK LEYLAND"
  fuelType: VehicleFuelType | string; // e.g. "Diesel"
  mileage: number; // e.g. 10
  startKm: number; // e.g. 90
  startTime: string; // e.g. "11:36"
  endKm: number; // e.g. 200
  endTime: string; // e.g. "12:15"
  distanceCovered: number; // e.g. 110 (endKm - startKm)
  timeTaken: string; // e.g. "39m"
  estimatedFuelConsumed: number; // e.g. 11 (distanceCovered / mileage)
  fuelRate: number; // e.g. 92
  amountSpent: number; // e.g. 1012 (estimatedFuelConsumed * fuelRate)
  driverName: string; // e.g. "Pranav"
  remarks: string; // e.g. ""
  status: string; // e.g. "completed"
  createdBy: string; // e.g. "7WfxoJvAyceJe1STVGNqKXgkvbN2"
  createdByName: string; // e.g. "Pranav "
  createdAt: string; // Normalized string from Firestore Timestamp
  updatedAt: string; // Normalized string from Firestore Timestamp

  // Compatibility / helper aliases
  entryId?: string;
  date?: string;
  vehicleNo?: string;
  totalDistance?: number;
  timeTakenMinutes?: number;
  timeTakenFormatted?: string;
  fuelConsumed?: number;
}

export interface CreateVehicleDailyEntryPayload {
  // Primary Firestore Schema fields
  entryNumber?: string;
  tripDate: string;
  vehicleId?: string;
  vehicleNumber: string;
  typeOfVehicle?: string;
  modelMake?: string;
  fuelType: VehicleFuelType | string;
  mileage: number;
  startKm: number;
  startTime: string;
  endKm: number;
  endTime: string;
  distanceCovered: number;
  timeTaken: string;
  estimatedFuelConsumed: number;
  fuelRate: number;
  amountSpent: number;
  driverName: string;
  remarks?: string;
  status?: string;

  // Compatibility aliases
  entryId?: string;
  date?: string;
  vehicleNo?: string;
  totalDistance?: number;
  timeTakenMinutes?: number;
  timeTakenFormatted?: string;
  fuelConsumed?: number;
}

export interface UpdateVehicleDailyEntryPayload extends Partial<CreateVehicleDailyEntryPayload> {}

export interface VehicleDailyFilterOptions {
  search?: string;
  vehicleNumber?: string;
  vehicleNo?: string;
  fuelType?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}
