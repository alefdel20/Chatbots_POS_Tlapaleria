import { Product } from './types'

export const sampleProducts: Product[] = [
  {
    barcode: '7501000111111',
    sku: 'CLAV-001',
    name: 'Clavo 1" (bolsa 100 pzas)',
    unit_base: 'pza',
    type: 'PAQUETE',
    pack_factor: 100,
    price_gross: 89.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 12
  },
  {
    barcode: '7501000222222',
    sku: 'TORN-001',
    name: 'Tornillo 1/2" (pieza)',
    unit_base: 'pza',
    type: 'PIEZA',
    pack_factor: null,
    price_gross: 3.5,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 240
  },
  {
    barcode: '7501000333333',
    sku: 'CEM-001',
    name: 'Cemento gris (kg)',
    unit_base: 'kg',
    type: 'GRANEL',
    pack_factor: null,
    price_gross: 18.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 550
  },
  {
    barcode: '7501000444444',
    sku: 'CABL-001',
    name: 'Cable THW Cal.12 (m)',
    unit_base: 'm',
    type: 'GRANEL',
    pack_factor: null,
    price_gross: 22.5,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 120
  },
  {
    barcode: '7501000555555',
    sku: 'PINT-001',
    name: 'Pintura blanca 1L',
    unit_base: 'lt',
    type: 'PIEZA',
    pack_factor: null,
    price_gross: 119.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 30
  },
  {
    barcode: '7501000666666',
    sku: 'BRO-001',
    name: 'Brocha 2"',
    unit_base: 'pza',
    type: 'PIEZA',
    pack_factor: null,
    price_gross: 35.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 45
  },
  {
    barcode: '7501000777777',
    sku: 'LIJ-001',
    name: 'Lija grano 120 (paquete 5)',
    unit_base: 'pza',
    type: 'PAQUETE',
    pack_factor: 5,
    price_gross: 42.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 20
  },
  {
    barcode: '7501000888888',
    sku: 'PEG-001',
    name: 'Pegamento PVC 250ml',
    unit_base: 'ml',
    type: 'PIEZA',
    pack_factor: null,
    price_gross: 58.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 18
  },
  {
    barcode: '7501000999999',
    sku: 'TUER-001',
    name: 'Tuerca 1/2" (bolsa 50 pzas)',
    unit_base: 'pza',
    type: 'PAQUETE',
    pack_factor: 50,
    price_gross: 65.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 15
  },
  {
    barcode: '7501000101016',
    sku: 'CINT-001',
    name: 'Cinta aislante 18m',
    unit_base: 'pza',
    type: 'PIEZA',
    pack_factor: null,
    price_gross: 29.0,
    tax_rate: 0.16,
    active: true,
    stock_snapshot: 90
  }
]
