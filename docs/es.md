# SFR Box

Siga su SFR Box desde Gladys: línea, conexión a Internet, Wi-Fi, dispositivos
conectados, y reinícielo desde una escena o desde el panel. Todo se queda en su
red local: Gladys consulta el router una vez por minuto mediante su API local,
sin cuenta en la nube.

> **Desarrollada sin el hardware: sus comentarios son bienvenidos.** Esta
> integración se escribió a partir de la documentación pública de la API del
> router y de respuestas reales recogidas por la biblioteca libre
> [hacf-fr/sfrbox-api](https://github.com/hacf-fr/sfrbox-api) (Home Assistant).
> Si algo falta o es incorrecto en su router, abra una issue indicando su modelo
> y su firmware (los muestra el botón **Probar la conexión**).
>
> Esta integración no está afiliada a SFR.

## Routers compatibles

El router debe ofrecer la API local «neufbox» (`http://192.168.1.1/api/1.0/`).

| Router                                        | Estado                                                                                                                                                                 |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NB4, NB5, NB6, NB6V, NB6VAC                   | La API está documentada para estos modelos.                                                                                                                            |
| Firmwares recientes (`BOX10H`, `3DCM` / FTTB) | Información del sistema confirmada con respuestas reales; el resto no está probado.                                                                                    |
| SFR Box 8 y 8X                                | Desconocido: ni la documentación de la API ni Home Assistant los mencionan. Los firmwares recientes de arriba sugieren que responden. Sus comentarios son bienvenidos. |
| Routers sin esta API (p. ej. `NCC`)           | No compatibles.                                                                                                                                                        |

## Requisitos

- Gladys 5.1 o posterior.
- Gladys y el router en la misma red local.
- Opcional: la **contraseña de administrador** del router. Por defecto es la
  clave Wi-Fi impresa en la etiqueta del router, salvo si usted la cambió en la
  interfaz del router (`http://192.168.1.1`).

## Configuración

1. Instale la integración desde el catálogo de Gladys y abra su pestaña
   **Configuración**.
2. **Dirección del router**: `192.168.1.1`, salvo si su red usa otra.
3. **Usuario administrador** (`admin`) y **contraseña de administrador**:
   opcionales. Sin ellos obtiene la línea, la conexión a Internet y la
   información del sistema. Con ellos obtiene también el estado del Wi-Fi y el
   reinicio.
4. **Descubrir los dispositivos conectados**: muestra los dispositivos que ve
   el router, para la detección de presencia.
5. **Idioma de los nombres de funciones**: los nombres que reciben las
   funciones cuando usted añade un dispositivo (después ya no cambian).
6. Pulse **Guardar configuración** y luego **Probar la conexión**: el resultado
   indica el modelo, el firmware, la línea, el número de dispositivos conectados
   y si se acepta la contraseña.
7. Abra la pestaña **Descubrir** y añada el dispositivo **SFR Box** (**Añadir a
   Gladys**), así como los dispositivos conectados que desee seguir.

Gladys guarda la contraseña y nunca la escribe en los registros.

## Lo que obtiene

**El dispositivo «SFR Box»**

| Función                                             | Cuándo                                      |
| --------------------------------------------------- | ------------------------------------------- |
| Conexión a Internet (conectada o no)                | siempre                                     |
| Conexión IPv6                                       | siempre                                     |
| Dirección IPv4 pública                              | siempre                                     |
| Tipo de línea (ADSL, FTTH…)                         | siempre                                     |
| Línea DSL sincronizada                              | línea DSL                                   |
| Velocidades DSL de bajada y de subida (kbit/s)      | línea DSL                                   |
| Atenuación y margen de ruido, de bajada y de subida | línea DSL                                   |
| Línea de fibra activa                               | línea de fibra                              |
| Wi-Fi activado                                      | con la contraseña de administrador          |
| Tiempo de funcionamiento (horas)                    | siempre                                     |
| Temperatura del router                              | si el router tiene un sensor de temperatura |
| Modelo, firmware                                    | siempre                                     |

La línea de fibra no ofrece ninguna velocidad mediante esta API: las
velocidades solo se refieren al DSL. Si añade la contraseña más tarde o si su
línea pasa a fibra, la pestaña **Descubrir** propone **Actualizar** el
dispositivo.

**Dispositivos conectados (presencia)**

Cada dispositivo que ve el router puede añadirse como dispositivo de Gladys con
una función **Presencia**, que se muestra como «visto hace N minutos». Se
actualiza cuando el dispositivo aparece en la red y luego cada 5 minutos
mientras sigue conectado. Para marcar a alguien como ausente, use la acción de
escena de Gladys **Comprobar presencia del usuario** con una duración de **10
minutos o más**.

Los teléfonos suelen usar una **dirección Wi-Fi privada (aleatoria)** por red:
desactívela para la red de casa en los ajustes Wi-Fi del teléfono; si no, el
dispositivo aparece con una dirección nueva. Según el firmware, el router solo
da esta lista con la contraseña de administrador.

## Escenas

- **Conexión a Internet perdida** (activador): el router indica que su
  conexión a Internet está cortada. No se activa durante un reinicio pedido
  desde Gladys.
- **Conexión a Internet restablecida** (activador): la conexión ha vuelto. Las
  acciones siguientes leen la duración del corte con
  `{{triggerEvent.data.outage_seconds}}` (con una precisión de un minuto
  aproximadamente; vacío si el corte empezó antes de que Gladys vigilara el
  router).
- **Reiniciar la SFR Box** (acción): Internet, TV y teléfono se cortan unos
  minutos. Necesita la contraseña de administrador.

Estos activadores se basan en lo que dice el router: si el propio router no es
accesible (apagado, reiniciándose), no se activa nada.

## Panel

El widget **SFR Box** muestra la conexión a Internet, el estado de la línea, las
velocidades DSL, el tiempo de funcionamiento y la temperatura. Su ajuste
**Mostrar un botón de reinicio** añade un botón de reinicio, con confirmación,
cuando la contraseña está configurada.

## Acciones

- **Probar la conexión**: consulta el router ahora y comprueba la contraseña.
- **Reiniciar el router**: marque **Confirmo el reinicio** y luego ejecute la
  acción.

## Solución de problemas

- **«SFR Box inaccesible»**: compruebe la dirección y que Gladys funciona en la
  misma red que el router (una VPN o un segundo router entre ambos impide el
  acceso).
- **«Contraseña rechazada por el router»**: compruebe la contraseña en la
  interfaz del router. Tras un rechazo, Gladys deja de intentarlo para no
  bloquear la cuenta: guarde de nuevo la configuración para volver a intentarlo.
- **«El router solo acepta la autenticación por botón»**: el router desactiva
  la autenticación por contraseña. Actívela en la interfaz del router para el
  estado del Wi-Fi y el reinicio.
- Un valor sigue vacío: puede que su firmware no lo proporcione. Ejecute
  **Probar la conexión** y comparta el resultado en una issue.
- Los registros de la integración están disponibles en Gladys, en la pestaña
  **Registros** de la integración. En funcionamiento normal se mantienen
  tranquilos: arranque, conexión, fallos y su recuperación, y sus acciones.
  Defina `LOG_LEVEL=debug` para más detalles; las contraseñas y los tokens
  nunca aparecen en ellos.
