export interface Parcel {
  PID: number;
  ParcelName: string;
  Quantity: number;
  Status: 'คงเหลือ' | 'ใกล้หมด' | 'หมดแล้ว';
}