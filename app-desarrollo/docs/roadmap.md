# Roadmap de estabilización de CBI-Market

## Alcance

Este roadmap es de estabilización; no autoriza agregar funcionalidades nuevas. El objetivo es dejar el cuestionario y las recomendaciones en un estado verificable, documentado y publicable con seguridad.

## Estado conocido

### Validaciones automatizadas reportadas como satisfactorias

- [x] `npm run lint`
- [x] `npm run typecheck`
- [x] `npm run test:recommendations` (se reportaron seis pruebas satisfactorias)
- [x] `npm run build`
- [x] `git diff --check` en la revisión anterior

### Pruebas manuales reportadas por el responsable del proyecto

- [x] Escritorio y móvil
- [x] Abandono del cuestionario
- [x] Respuestas vacías/incompletas
- [x] Sin candidatos
- [x] Fallo de IA y fallback
- [x] Identificadores inválidos
- [x] Productos agotados

Estas marcas reflejan lo reportado en la sesión; no son una ejecución independiente de este documento.

## Pendientes para cerrar

1. [ ] Probar instalación de la app en una tienda de desarrollo.
2. [ ] Probar desinstalación y verificar el comportamiento del webhook correspondiente.
3. [ ] Revisar el webhook de actualización de permisos si aplica.
4. [ ] Completar la revisión de seguridad de archivos versionados y del historial Git; la búsqueda por patrones ejecutada no encontró coincidencias, pero no sustituye una auditoría especializada.
5. [ ] Revisar los cambios finales y confirmar que no se incluyan archivos temporales ni credenciales.
6. [ ] Ejecutar de nuevo lint, typecheck, pruebas de recomendaciones y build después de cualquier cambio de documentación/código relevante.
7. [ ] Crear el commit con mensaje claro tras aprobar el diff.
8. [ ] Hacer push a `origin master` solo después de revisar el commit y confirmar que el árbol de trabajo está en el estado esperado.

## Fuera de alcance

- Nuevas funciones o rediseños.
- Cambios de proveedor de base de datos.
- Cambios en el algoritmo de recomendación que no sean necesarios para corregir un defecto confirmado.
- Migraciones destructivas o eliminación de datos locales sin respaldo.

## Definición de terminado

La estabilización se considera cerrada cuando las verificaciones automatizadas pasan, las pruebas manuales pendientes están documentadas, el diff ha sido revisado, no se incluyen secretos ni archivos accidentales y el commit publicado corresponde únicamente a los cambios aprobados.
