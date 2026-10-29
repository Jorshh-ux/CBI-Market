# Pruebas y validación de CBI-Market

## Objetivo

Validar la estabilidad del cuestionario y el sistema de recomendaciones antes de integrar cambios en `master`. Las pruebas deben ejecutarse en una tienda de desarrollo, nunca con datos de producción salvo autorización explícita.

## Verificaciones automatizadas

Ejecutar desde `app-desarrollo`:

| Comando | Qué valida |
|---|---|
| `npm run lint` | Reglas estáticas de ESLint |
| `npm run typecheck` | Generación de tipos de React Router y comprobación TypeScript |
| `npm run test:recommendations` | Pruebas del motor de recomendación |
| `npm run build` | Compilación de producción |

El proyecto no define un script general `npm test`; la suite disponible se ejecuta mediante `npm run test:recommendations`.

## Casos funcionales manuales

Marcar cada caso cuando se haya verificado en la tienda de desarrollo:

- [ ] Instalar la app y completar el flujo inicial de Shopify.
- [ ] Desinstalar la app y comprobar el webhook `app/uninstalled`.
- [ ] Comprobar el webhook `app/scopes_update` si se cambian permisos.
- [ ] Abrir el cuestionario en escritorio.
- [ ] Abrir el cuestionario en móvil.
- [ ] Abandonar el cuestionario antes de enviarlo.
- [ ] Enviar respuestas vacías o incompletas y confirmar que se manejan de forma controlada.
- [ ] Confirmar el estado cuando no hay candidatos válidos.
- [ ] Confirmar que la IA falla de forma segura y entra el fallback Motor V1.
- [ ] Confirmar que los identificadores devueltos por IA se validan contra productos candidatos reales.
- [ ] Confirmar que no se recomienda un producto no disponible cuando la configuración exige excluirlo.
- [ ] Confirmar que las recomendaciones respetan el límite configurado.
- [ ] Confirmar que los errores no exponen claves, tokens ni detalles internos al cliente.

Los casos de móvil/escritorio, abandono, respuestas vacías, cero candidatos, fallback de IA, IDs inválidos y productos agotados fueron reportados como probados manualmente por el responsable del proyecto. Vuelve a ejecutarlos si cambia el código relacionado.

## Criterios de aceptación

- Todos los comandos automatizados terminan con código de salida cero.
- No hay errores de lint, tipos o compilación.
- Los errores esperados se presentan de forma controlada.
- El fallback no inventa productos ni identificadores.
- No se filtran secretos en logs, respuestas, archivos versionados ni el diff.
- Las comprobaciones de instalación/desinstalación y webhooks se marcan como pendientes hasta que se prueben explícitamente.

## Revisión antes de commit

Desde la raíz del repositorio:

```powershell
git diff --check
git status --short --branch
git diff --stat
```

Inspecciona el diff completo. Añade al staging únicamente los archivos que deban formar parte del cambio; no uses `git add .` si existen archivos desconocidos o temporales.
