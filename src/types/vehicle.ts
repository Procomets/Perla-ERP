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
