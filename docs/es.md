# Bbox

Siga su Bbox de Bouygues Telecom en Gladys: estado de la línea y de Internet,
velocidades, Wi-Fi, dispositivos conectados y llamadas perdidas. Todo pasa por
la API local de la box, sin nube.

> **Desarrollada sin el hardware: sus comentarios son bienvenidos.** Esta
> integración se escribió a partir de la documentación de la API de la Bbox y
> de las bibliotecas libres que la usan, sin una Bbox para probarla. Si en su
> modelo falta un valor o parece incorrecto, abra una issue en
> [GitHub](https://github.com/guim31/gladys-bbox/issues) con el modelo de su
> Bbox y los logs de la integración.

Integración independiente, sin relación con Bouygues Telecom.

## Lo que obtiene

Un dispositivo **Bbox**, con:

- **Conexión a Internet** (conectada o no) y **Línea sincronizada**;
- **Tipo de línea** (FTTH, VDSL2, ADSL) y **velocidades sincronizadas** de
  subida y de bajada (velocidades de sincronización en xDSL, velocidad máxima
  anunciada por la box en fibra);
- **Velocidad de bajada** y **velocidad de subida** instantáneas, en Mbit/s;
- **Dirección IPv4 pública** y **dirección IPv6**;
- **Modelo**, **firmware**, **tiempo encendido** (en días) y, si el modelo la
  proporciona, **temperatura**;
- **Wi-Fi 2,4 GHz**, **Wi-Fi 5 GHz** y, si el modelo lo tiene, **Wi-Fi de
  invitados**: interruptores para apagarlos o volver a encenderlos desde
  Gladys;
- **Llamadas perdidas** de la línea fija, si la box tiene telefonía;
- **Dispositivos conectados**: su número.

Y, si lo desea, un dispositivo de **presencia** por cada dispositivo que conoce
la Bbox (teléfono, ordenador…), identificado por su dirección MAC.

## Requisitos

- Gladys 5.1 o más reciente.
- Gladys en la red local de la Bbox.
- La **contraseña de administrador** de la Bbox: la de la interfaz web
  [mabbox.bytel.fr](https://mabbox.bytel.fr).

Modelos: la integración usa la API local común a las Bbox de Bouygues Telecom
(`/api/v1`). Las respuestas con las que se ha probado vienen de la Bbox Fibre
(F@st5330b) y de la generación Wi-Fi 6 (F@st5688b). Las Bbox Miami, Ultym,
Must, Wi-Fi 6 y Wi-Fi 7 exponen la misma API, pero ninguna se ha probado en
real: sus comentarios dirán qué funciona.

## Configuración

1. Abra la pestaña **Configuración** de la integración.
2. **Dirección de la Bbox**: `192.168.1.254` sirve para casi todas las box. Si
   ha cambiado la red de su box, indique su nueva dirección IP.
3. **Contraseña de administrador**: la de la interfaz web de la box. Atención:
   varias contraseñas incorrectas bloquean el acceso a la box durante un
   tiempo. Tras un rechazo, la integración deja de intentarlo hasta que guarde
   una nueva contraseña.
4. **Intervalo de lectura**: cada 60 segundos por defecto, no más a menudo.
5. **Idioma de los nombres de funciones**: Gladys conserva el nombre de una
   función una vez añadido el dispositivo. Elija el idioma antes de añadir la
   Bbox.
6. Guarde y haga clic en **Probar la conexión**: el modelo, el firmware y el
   estado de Internet aparecen debajo del botón.
7. Añada la Bbox desde la pestaña **Descubrir**.

## Presencia de los dispositivos conectados

Con la opción **Ofrecer los dispositivos conectados (presencia)**, cada
dispositivo que conoce la Bbox aparece en la pestaña **Descubrir**. Añada
aquellos cuya presencia quiera seguir, por ejemplo sus teléfonos.

Como la presencia Bluetooth de Gladys, es un sensor de tipo «visto a las»: la
Bbox lo indica cada 5 minutos mientras el dispositivo está conectado, y en
cuanto vuelve. En una escena, la acción **Comprobar presencia del usuario**
considera que el usuario se ha ido cuando ninguno de sus dispositivos se ha
visto durante el plazo elegido: elija 10 minutos o más.

Los teléfonos recientes cambian de dirección MAC de una red Wi-Fi a otra
(dirección «privada» o «aleatoria»); en el Wi-Fi de casa, suele mantenerse
igual. Si un teléfono aparece con varios nombres, desactive la dirección
privada para la red de la Bbox en sus ajustes de Wi-Fi.

## Acciones

- **Probar la conexión**: lee la Bbox y muestra su modelo, su firmware y el
  estado de Internet.
- **Reiniciar la Bbox**: marque «Confirmo el reinicio» antes de hacer clic.
  Internet, el Wi-Fi y el teléfono se cortan durante unos dos minutos, Gladys
  incluido si pasa por el Wi-Fi.

## Escenas

En el editor de escenas (categoría **Integraciones**):

- **Conexión a Internet perdida**: la Bbox ha perdido su conexión a Internet.
- **Conexión a Internet restablecida**: ha vuelto. Las acciones siguientes leen
  la duración del corte en minutos (`{{triggerEvent.data.downtime_minutes}}`) y
  la dirección IPv4 (`{{triggerEvent.data.ipv4}}`).
- **Llamada perdida**: una llamada a la línea fija no fue contestada. El número
  de quien llama está en `{{triggerEvent.data.number}}` cuando el registro de
  llamadas de la box lo proporciona.

Estos disparadores comparan dos lecturas: un corte más corto que el intervalo
de lectura puede pasar desapercibido. Una Bbox que ya no responde en absoluto
(reinicio, cable desconectado) no dispara nada: Gladys no puede saber si
Internet funciona.

Durante un corte, Gladys tampoco tiene Internet: una notificación que pasa por
Internet (Telegram…) no puede enviarse. Prefiera una acción local (luz,
sirena), o notifique al restablecerse.

## Panel

El widget **Bbox** muestra en directo las velocidades y el número de
dispositivos conectados, el estado de Internet y de la línea, la dirección
IPv4, el Wi-Fi y las llamadas perdidas. Su botón enciende o apaga el Wi-Fi de
invitados. El ajuste **Filas que mostrar** conserva solo las filas que marque;
si lo deja vacío, el widget lo muestra todo.

## Certificado

La Bbox sirve su API en HTTPS con un certificado emitido para
`mabbox.bytel.fr`. Solo el servidor DNS de la box conoce ese nombre: por eso la
integración se conecta a la dirección IP configurada, pero comprueba el
certificado para `mabbox.bytel.fr`, como lo haría su navegador.

Si el estado de conexión indica un **error de certificado**, la box
probablemente sirve una cadena de certificados incompleta, que los navegadores
completan por sí solos pero la integración no. Solo en ese caso, ajuste
**Comprobación del certificado** en **No comprobar**. El tráfico se queda en
su red local, pero la integración ya no puede garantizar que habla con su Bbox
y no con otro dispositivo de la red. Indíquelo también en una issue, con el
modelo de su box.

## Solución de problemas

- **«La Bbox no responde»**: compruebe la dirección (`192.168.1.254` por
  defecto) y que Gladys está realmente en la red de la box, no detrás de otro
  router.
- **«La Bbox rechazó la contraseña»**: introdúzcala de nuevo y guarde. La
  integración no vuelve a intentarlo por sí sola, para no prolongar el bloqueo
  de la box.
- **«La Bbox bloquea los accesos»**: demasiados intentos fallidos, desde Gladys
  o desde otro lugar. La integración espera 15 minutos antes de volver a
  intentarlo.
- **Un valor sigue vacío**: puede que su modelo no lo proporcione. Abra una
  issue con el modelo de la box y los logs.
- **Apagar el Wi-Fi** desde Gladys también desconecta a Gladys si está
  conectado por ese Wi-Fi: prefiera una conexión por cable.
