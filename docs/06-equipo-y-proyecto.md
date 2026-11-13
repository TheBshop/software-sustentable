# 6. Organización del equipo y del proyecto

## Equipo mínimo recomendado

| Rol | Dedicación | Responsabilidad |
|---|---|---|
| **Referente de la cooperativa** (Product Owner) | 2–3 h/semana | Prioriza el backlog, responde dudas del negocio, valida cada demo. **Es el rol más importante**: sin él se construye lo que no se usa. |
| **Dev líder full-stack** | 15–20 h/semana | Arquitectura, API, reviews, deploys. |
| **Dev front/móvil** | 10–20 h/semana | Web React y app Expo (mismo lenguaje). |
| Dev de apoyo / estudiante (opcional) | variable | Historias chicas, tests, ABMs. Buen lugar para pasantías o voluntariado universitario (UNER, UTN Paraná). |
| **Choferes y planta "piloto"** | 15 min por demo | 1 chofer y 1 persona de planta que prueban cada versión y dan feedback real. |

Con 2 devs part-time, el MVP de los sprints 1–3 (retiros + certificados + liquidación) es razonable en **~7–8 semanas**.

## Ritmo (Scrum liviano)

| Ceremonia | Cuándo | Duración |
|---|---|---|
| Planificación | inicio de sprint (cada 2 semanas) | 1 h |
| Sincronización | 2 veces por semana (o un hilo diario por chat) | 15 min |
| **Demo en la cooperativa** | fin de sprint, **en la planta, con los teléfonos** | 45 min |
| Retro | después de la demo | 30 min |

## Herramientas
- **GitHub**: código, PRs, Actions y **GitHub Projects** como tablero (Backlog → Listo → En curso → En revisión → Hecho). Gratis.
- **Chat**: el grupo de WhatsApp que ya usan, más un canal solo para devs.
- **Docs**: esta carpeta `docs/` en el repo (vive junto al código y se revisa en PRs).

## Estrategia de salida al MVP

1. **Piloto chico**: 1 camión, 2–3 grandes generadores amigables, durante 1 mes.
2. **Doble registro** las primeras 2 semanas (papel + app) para comparar y ganar confianza.
3. **Medir**: tiempo por retiro, retiros sin sincronizar, certificados enviados, días promedio de cobro.
4. Recién con el piloto estable, sumar el resto de clientes y camiones.

## Riesgos y cómo mitigarlos

| Riesgo | Mitigación |
|---|---|
| Choferes con teléfonos viejos o sin datos | App liviana, offline-first, fotos comprimidas; evaluar que la coope provea 1–2 equipos Android de gama media. |
| Baja adopción ("es más fácil el papel") | Pantalla única de 3 pasos, botones grandes, capacitación en la planta, y que el chofer vea su beneficio (lista del día). |
| Factores de CO2 cuestionados | Fuente citada y metodología publicada en la página de verificación. |
| Requisitos fiscales (ARCA) | MVP con prefactura; la factura fiscal se integra vía proveedor en una etapa posterior. |
| Datos personales de clientes | HTTPS, contraseñas hasheadas, roles, backups, y la página pública muestra solo lo indispensable (Ley 25.326 de Protección de Datos Personales). |
| Dependencia de 1 sola persona dev | Docs en el repo, PRs revisados por otro, credenciales del hosting a nombre de la cooperativa (no de un dev). |

## Sostenibilidad
- Todas las cuentas (GitHub org, Atlas, Render, dominio, Expo) **a nombre de la cooperativa**, con al menos 2 administradores.
- Costo mensual estimado en producción: **USD 0–15**.
- Considerar licencia abierta (p. ej. AGPL) para que otras cooperativas de reciclado puedan reutilizarlo; abre puertas a financiamiento y voluntariado.
