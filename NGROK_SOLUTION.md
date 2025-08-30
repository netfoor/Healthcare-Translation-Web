# Solución con Ngrok para WebSocket Seguro
# Este archivo explica cómo usar Ngrok para resolver el problema de conectividad WebSocket

## Problema detectado
El diagnóstico muestra un desajuste de protocolos:
- Tu aplicación está corriendo en HTTP local
- Intentas conectarte a un WebSocket seguro (WSS)
- Los navegadores bloquean este tipo de conexiones mixtas por seguridad

## Solución con Ngrok

Ngrok te permite crear un túnel HTTPS público a tu servidor local,
resolviendo el problema de protocolo mixto (HTTP/WSS).

### Pasos para usar Ngrok:

1. **Instalar Ngrok**
   - Descarga desde: https://ngrok.com/download
   - O instala con npm: `npm install -g ngrok`

2. **Crear una cuenta gratis en Ngrok**
   - Regístrate en: https://dashboard.ngrok.com/signup
   - Obtén tu authtoken en: https://dashboard.ngrok.com/get-started/your-authtoken

3. **Configura tu authtoken**
   ```
   ngrok config add-authtoken TU_TOKEN_AQUÍ
   ```

4. **Inicia tu aplicación Next.js normalmente**
   ```
   npm run dev
   ```

5. **En otra terminal, inicia Ngrok apuntando a tu puerto local**
   ```
   ngrok http 3000
   ```

6. **Ngrok te dará una URL HTTPS pública**
   Ejemplo: `https://12345abcde.ngrok.io`

7. **Abre tu aplicación usando esta URL de Ngrok**
   Ahora estarás accediendo a tu aplicación a través de HTTPS,
   lo que permitirá la conexión a WebSockets seguros (WSS).

## Ventajas de Ngrok

- No necesitas configurar certificados SSL
- Es muy fácil de usar
- Proporciona una URL pública que puedes compartir
- Incluye un dashboard con todas las solicitudes para depuración
- Funciona a través de firewalls y NATs

## Consideraciones

- La URL gratuita de Ngrok cambia cada vez que reinicias el túnel
- La versión gratuita tiene algunas limitaciones de uso
- Para desarrollo local esto es perfecto, pero no para producción

## Solución para producción

Para un entorno de producción, asegúrate de que tu aplicación
esté desplegada con HTTPS habilitado (lo cual es estándar en
plataformas como Vercel, Netlify, AWS Amplify, etc.)
