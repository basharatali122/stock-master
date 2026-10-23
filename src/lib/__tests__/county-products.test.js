import { describe, expect, test } from 'bun:test';
import products from '../../data/county-products-october-2026.json';

const find = (name: string) => products.find(product => product.name === name);

describe('COUNTY October 2026 source price sheets', () => {
  test('imports all 54 distinct source rows', () => {
    expect(products.length).toBe(54);
    expect(new Set(products.map(product => product.name)).size).toBe(54);
  });
  test('family biscuits have 96 single-unit boxes per carton and source box rates', () => {
    expect(find('Tea Partner Delight (Egg & Milk Cookies) Rs. 60')).toMatchObject({
      boxes_per_carton: 96, pack_type: '1×96', price: 55, purchase_rate: 48.95,
    });
  });
  test('party cake uses its own 18-box packing and net distributor purchase rate', () => {
    expect(find('Cup Bite (Party Cake) Rs. 20')).toMatchObject({
      boxes_per_carton: 18, pack_type: '12×18', price: 220, purchase_rate: 185.49,
    });
  });
  test('lollipops use 12-box cartons with their source rates', () => {
    expect(find('Mix Fruit Pop Rs. 5')).toMatchObject({
      boxes_per_carton: 12, pack_type: '60×12', price: 275, purchase_rate: 240.75,
    });
  });
  test('price sheets do not invent received stock or apply discounts twice', () => {
    expect(products.every(product => product.stock_quantity === 0 && product.discount_percentage === 0)).toBe(true);
  });
});