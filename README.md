# Bariloche Juntos

La app del viaje, del 23 al 27 de octubre de 2026. Se instala en el teléfono,
se actualiza sola y lo que carga uno le aparece al otro.

## Qué hay acá

| Archivo | Para qué es |
|---|---|
| `index.html` | La app entera: las cuatro secciones, los cálculos y el diseño |
| `sync.js` | La sincronización entre los dos teléfonos |
| `sw.js` | Hace que abra sin señal y que se actualice sola |
| `manifest.webmanifest` | Lo que convierte la página en app instalable |
| `firestore.rules` | Las reglas de seguridad de la base |
| `icons/` | El ícono que va a quedar en la pantalla de inicio |

Los archivos que terminan en `.local.html` o `.local.js` tienen datos reales
del viaje y están en el `.gitignore`. Nunca se suben.

## Cómo prenderla, paso a paso

### 1. Crear la base en Firebase

Firebase es de Google y para lo que necesitamos es gratis.

1. Entrá a <https://console.firebase.google.com> con tu cuenta de Google
2. **Crear un proyecto**, ponele `bariloche`. Cuando pregunte por Google
   Analytics, decile que no, no hace falta
3. En el menú de la izquierda, **Compilación → Firestore Database → Crear base de datos**
4. Elegí **modo de producción** y la ubicación `southamerica-east1`, que es la
   más cerca

### 2. Copiar la configuración

1. Arriba a la izquierda, el engranaje → **Configuración del proyecto**
2. Bajá hasta **Tus apps** y tocá el ícono de web, el que dice `</>`
3. Ponele cualquier nombre y registrala. **No** hace falta Firebase Hosting
4. Te va a mostrar un bloque que arranca con `const firebaseConfig = {`
5. Copiá esos valores dentro de `sync.js`, arriba de todo, donde dice
   `PEGAR ACÁ LA CONFIGURACIÓN DE FIREBASE`

### 3. Poner las reglas de seguridad

1. **Firestore Database → Reglas**
2. Borrá lo que haya y pegá todo el contenido de `firestore.rules`
3. **Publicar**

Sin esto la base queda abierta a cualquiera o cerrada del todo. Con esto,
solo se puede tocar el documento del viaje.

### 4. Publicarla

```bash
git add -A
git commit -m "Lo que cambiaste"
git push
```

GitHub Pages la sube sola en un minuto o dos.

### 5. Instalarla en el teléfono

En cada iPhone, **con Safari** (en Chrome no aparece la opción):

1. Abrí el link de la app
2. Tocá el botón de compartir, el cuadradito con la flecha para arriba
3. Bajá hasta **Agregar a inicio**
4. **Agregar**

Queda el ícono de la montaña en la pantalla de inicio. Se abre a pantalla
completa, sin las barras de Safari.

## Cómo funciona la sincronización

El estado vive en un solo documento de Firestore, en `viaje/estado`, con
dos partes: `plata` (los precios y las excursiones) y `lista` (lo que está
tildado).

Cuando tocás algo, `sync.js` espera unos segundos a que dejes de tocar y
recién ahí escribe, para no mandar una escritura por tecla. Del otro lado,
el otro teléfono está escuchando y lo aplica sin recargar la página.

Abajo a la derecha aparece un cartelito cuando guarda o cuando le llega
algo del otro.

**Si todavía no cargaste la configuración de Firebase**, la app anda igual,
nada más que cada teléfono se guarda lo suyo. El cartelito va a decir
"Sin sincronizar".

## Cómo se actualiza sola

`sw.js` va a buscar la última versión a la red cada vez que abrís la app, y
usa lo que tiene guardado solo si estás sin señal. Así que apenas subo un
cambio a GitHub, al abrirla ya lo tienen los dos. No hay que pasarse links.

## Por qué este repositorio no tiene ningún dato del viaje

Es público, así que acá está el código y nada más. Los códigos de reserva,
los precios, los nombres y la dirección viven en Firestore, y solo los ve
quien entra con su cuenta de Google y está en la lista de las reglas.

En el HTML, cada lugar donde va un dato real está marcado con
`data-d="loquesea"` y trae un valor de mentira de relleno. Cuando la app
arranca y alguien autorizado entra, `pintarViaje()` reemplaza esos huecos
con lo que dice la base.

Si alguien desconocido abre la app publicada, ve la pantalla de entrada. Si
mira el código fuente, ve `AA0000` donde va el código de vuelo.

La configuración de Firebase sí está a la vista, y eso es normal: así está
pensado Firebase. La seguridad está en las reglas, no en esconder la clave.
