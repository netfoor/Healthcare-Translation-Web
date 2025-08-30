# Actualización de URLs para AWS Amplify

Cuando despliegas tu aplicación en AWS Amplify, necesitas configurar la variable de entorno `AMPLIFY_APP_URL` con la URL proporcionada por Amplify para que las redirecciones de autenticación funcionen correctamente.

## Configuración con el script

El script `update-amplify-urls.js` configura automáticamente la variable de entorno `AMPLIFY_APP_URL` para ser usada durante el despliegue:

```bash
# Reemplaza con la URL real que te proporciona AWS Amplify
npm run update-amplify-urls https://tu-app.amplifyapp.com
```

Este script:
1. Valida la URL proporcionada
2. Crea o actualiza un archivo `.env.amplify` con la URL
3. Intenta configurar la variable en tu entorno actual (según el sistema operativo)
4. Proporciona instrucciones para desplegar correctamente

## Uso durante el despliegue

Para que la variable de entorno sea utilizada durante el despliegue, utiliza uno de estos métodos:

### En Windows (PowerShell):

```bash
$env:AMPLIFY_APP_URL="https://tu-app.amplifyapp.com"; npm run deploy
```

### En macOS/Linux:

```bash
AMPLIFY_APP_URL="https://tu-app.amplifyapp.com" npm run deploy
```

## Verificación de la configuración

Para verificar que la variable de entorno está configurada correctamente:

### En Windows (PowerShell):

```bash
echo $env:AMPLIFY_APP_URL
```

### En macOS/Linux:

```bash
echo $AMPLIFY_APP_URL
```

## Funcionamiento técnico

El archivo `amplify/auth/resource.ts` está configurado para leer la variable de entorno `AMPLIFY_APP_URL` y utilizarla para configurar las URLs de redirección de Cognito. Cuando despliegas con esta variable configurada, el servicio de autenticación se configura automáticamente con la URL correcta.

## Configuración manual en AWS Cognito (alternativa)

Si prefieres, también puedes actualizar las URLs directamente en la consola de AWS Cognito después del despliegue:

1. Abre la [consola de AWS Cognito](https://console.aws.amazon.com/cognito/home)
2. Selecciona tu User Pool
3. Ve a "App integration" > "App client settings"
4. Actualiza los "Callback URL(s)" y "Sign out URL(s)" con tus URLs de Amplify
5. Guarda los cambios
