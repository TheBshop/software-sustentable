import { describe, it, expect } from 'vitest';
import { PROV, MUNI, CORR, REG, CATALOGO, FE, feCO2e, fWarm, clasif, AREAS, TAREAS_BASE, OBL_MUNI, JUR } from '@nueva-vida/catalogos';

describe('Catálogos compartidos', () => {
  it('cubre las 24 jurisdicciones con su normativa municipal', () => {
    expect(Object.keys(PROV)).toHaveLength(24);
    for (const p of Object.keys(MUNI)) expect(PROV[p], `provincia ${p}`).toBeDefined();
    expect(MUNI.entre_rios.parana.normas[0][0]).toBe('Ord. 9.233');
    // Rosario: la Ord. 9.477 del listado no aparece en las fuentes
    expect(MUNI.santa_fe.rosario.normas.find((n) => n[0] === 'Ord. 9.477')[2]).toBe(-1);
    for (const m of Object.values(MUNI).flatMap((o) => Object.values(o))) for (const t of m.temas) expect(OBL_MUNI[t], `tema ${t}`).toBeDefined();
  });

  it('define registros para los tres perfiles, con origen del dato en los que tienen kg', () => {
    expect(Object.keys(REG)).toEqual(['cooperativa', 'empresa', 'municipio']);
    const ingresos = REG.cooperativa.find((r) => r.id === 'ingresos');
    expect(ingresos.campos.map((c) => c.k)).toEqual(['fecha', 'origen', 'material', 'kg', 'pesaje', 'comprobante']);
    expect(REG.cooperativa.some((r) => r.id === 'electricidad')).toBe(true);
  });

  it('usa los factores oficiales (SNIGEI-AR 2025 y EPA WARM v16)', () => {
    expect(feCO2e(FE.Gasoil)).toBeCloseTo(2.379, 3);
    expect(feCO2e(FE.Electricidad)).toBeCloseTo(0.286, 3);
    expect(fWarm('Cartón').kg).toBeCloseTo(3.46, 2);
    expect(fWarm('PEBD / film')).toBeNull();
  });

  it('clasifica materiales y corrientes', () => {
    expect(clasif('Vidrio').op).toBe('R5');
    expect(clasif('Cartón', 'Retiro a generador').txt).toMatch(/^Asimilable a RSU/);
    expect(clasif('Otros').op).toBe('—');
    expect(Object.keys(CORR).length).toBeGreaterThanOrEqual(28);
    expect(CATALOGO.length).toBe(40);
    expect(JUR.buenos_aires.registro).toMatch(/Destinos Sustentables/);
  });

  it('tiene las 5 áreas de cumplimiento y las rutinas de base', () => {
    expect(AREAS.map((a) => a[0])).toEqual(['reg', 'doc', 'ope', 'lab', 'fis']);
    expect(TAREAS_BASE).toHaveLength(15);
  });
});
