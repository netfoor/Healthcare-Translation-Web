# Guía de Despliegue en Amplify CI/CD

Esta guía explica cómo configurar y solucionar problemas comunes al desplegar esta aplicación en AWS Amplify utilizando CI/CD.

## Configuración Recomendada

Asegúrate de que tu proyecto esté configurado correctamente para despliegue en Amplify:

1. **Archivo amplify.yml**: Debe existir en la raíz del proyecto con la configuración adecuada para build y despliegue.

2. **Scripts específicos**: Usa `npm run build:amplify` en entornos de Amplify en lugar de `npm run build` para evitar problemas con Turbopack.

3. **Scripts de optimización**: Ejecuta los scripts de preparación y optimización antes del build.

## Solución de Problemas Comunes

### Error de favicon.ico

Si encuentras errores relacionados con favicon.ico:

```
[Error: ENOENT: no such file or directory, open '.next/server/app/favicon.ico/route.js.nft.json']
```

Solución:
- Ejecuta `npm run fix:favicon` para crear un favicon.ico en la ubicación correcta
- Asegúrate de que existe un archivo favicon.ico en `/public`

### Errores de Turbopack

Turbopack puede causar problemas en entornos de CI/CD de Amplify. 

Solución:
- Usa `npm run build:amplify` en lugar de `npm run build`
- Este script usa el compilador estándar de Next.js en lugar de Turbopack

### Problemas con amplify_outputs.json

Si aparecen errores relacionados con la falta del archivo amplify_outputs.json:

Solución:
- El script `prepare-build.js` crea un archivo mock automáticamente
- Asegúrate de que este script se ejecute antes del build en amplify.yml

## Verificación Previa al Despliegue

Para verificar que tu aplicación está lista para desplegar:

```bash
npm run validate:amplify
```

Este comando verifica la configuración y los archivos necesarios para un despliegue exitoso.

## Optimización para Amplify

Para optimizar la aplicación específicamente para Amplify:

```bash
npm run optimize:amplify
```

Este script realiza varias optimizaciones y correcciones para el entorno de Amplify.

## Estructura de amplify.yml

```yaml
version: 1
backend:
  phases:
    build:
      commands:
        - npm ci --cache .npm --prefer-offline
        - npx ampx pipeline-deploy --branch $AWS_BRANCH --app-id $AWS_APP_ID
frontend:
  phases:
    preBuild:
      commands:
        - node scripts/prepare-build.js
        - node scripts/optimize-for-amplify.js
        - node scripts/fix-favicon-issue.js
    build:
      commands:
        - npm run build:amplify
  artifacts:
    baseDirectory: .next
    files:
      - '**/*'
  cache:
    paths:
      - .next/cache/**/*
      - node_modules/**/*
      - .npm/**/*
```

## Variables de Entorno Recomendadas

Configura estas variables de entorno en la consola de Amplify:

- `AMPLIFY_APP_URL`: URL de tu aplicación en Amplify (ej: https://main.abc123.amplifyapp.com)
- `NEXT_PUBLIC_SKIP_AMPLIFY_AUTH`: Establecer en "true" para omitir autenticación durante build
- `NEXT_PUBLIC_USE_MOCK_DATA`: Establecer en "true" para usar datos mock
- `NEXT_PUBLIC_WEBSOCKET_FALLBACK_ENABLED`: Establecer en "true" para habilitar fallback

## Recomendaciones para CI/CD más rápido

1. Utiliza el caché adecuadamente (.npm, node_modules, .next/cache)
2. Minimiza las operaciones en scripts de preBuild
3. Usa `npm ci` en lugar de `npm install` para instalaciones más rápidas
4. Considera usar la bandera `--production` si no necesitas dependencias de desarrollo
