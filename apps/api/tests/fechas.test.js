import { describe, it, expect } from 'vitest';
import { dateInput, endOfLocalDay, startOfLocalMonth } from '../src/lib/validation.js';

// La cooperativa trabaja en hora de Argentina (UTC-3): una fecha "2026-11-13" tiene que
// seguir siendo el 13/11 al mostrarse, aunque el servidor corra en UTC.
describe('Fechas en hora de Argentina', () => {
  it('una fecha sin hora es la medianoche local', () => {
    expect(dateInput.parse('2026-11-13').toISOString()).toBe('2026-11-13T03:00:00.000Z');
  });

  it('respeta fechas con hora explícita', () => {
    expect(dateInput.parse('2026-11-13T15:30:00Z').toISOString()).toBe('2026-11-13T15:30:00.000Z');
  });

  it('"hasta" incluye el día completo', () => {
    expect(endOfLocalDay('2026-11-30').toISOString()).toBe('2026-12-01T02:59:59.999Z');
  });

  it('el mes empieza a la medianoche local, también a fin de mes en UTC', () => {
    // 1/12 01:00 UTC todavía es 30/11 en Argentina
    expect(startOfLocalMonth(new Date('2026-12-01T01:00:00Z')).toISOString()).toBe('2026-11-01T03:00:00.000Z');
    expect(startOfLocalMonth(new Date('2026-11-13T12:00:00Z')).toISOString()).toBe('2026-11-01T03:00:00.000Z');
  });
});
