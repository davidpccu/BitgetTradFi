import assert from 'node:assert/strict';
import test from 'node:test';
import { floorToStepTowardZero, formatDecimal, multiply, parseDecimal } from '../src/domain/decimal.js';

test('decimal arithmetic avoids binary floating point and floors toward zero', () => {
  assert.equal(formatDecimal(multiply(parseDecimal('1.25'), parseDecimal('0.8'))), '1');
  assert.equal(formatDecimal(floorToStepTowardZero(parseDecimal('1.29'), parseDecimal('0.1'))), '1.2');
  assert.equal(formatDecimal(floorToStepTowardZero(parseDecimal('-1.29'), parseDecimal('0.1'))), '-1.2');
});
