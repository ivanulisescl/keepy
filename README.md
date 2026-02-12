# Keepy

App web responsiva para gestionar categorías y notas (Local Storage + backup JSON).

## Ejecutar en local (necesario para PWA)
La instalación como PWA y el service worker **requieren** `http://` o `https://` (no funciona con `file://`).

En Windows, desde la carpeta del proyecto:

```powershell
python -m http.server 5173
```

Luego abre `http://localhost:5173`.

## Sync con GitHub (reemplazar)
- **Exportar JSON**: descarga `keepy.backup.json` con tu contenido.
- Sube ese archivo al repo (commit + push).
- En la app, usa:
  - **Sync desde GitHub (reemplazar)**: siempre reemplaza lo local por el JSON del repo.
  - **Sync si hay nueva versión**: solo reemplaza si el `appVersion` del JSON del repo es mayor.

El JSON que sincroniza está en `keepy.backup.json` (raíz del repo).

